// Automated verification test suite for Exam Mode Option Matching & Selection Fixes

function cleanOptionText(str) {
    return String(str || '')
        .toLowerCase()
        .replace(/&nbsp;/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseTargetAnswer(targetAns) {
    const raw = String(targetAns || '').trim();
    const prefixMatch = raw.match(/^(?:(?:option|choice)\s+)?(?:\[|\()?([a-dA-D1-9])(?:[\.\)\:\s\]\-]+|$)(.*)$/i);
    let letter = null;
    let text = raw;
    let hasExplicitLetter = false;

    if (prefixMatch) {
        letter = prefixMatch[1].toUpperCase();
        text = prefixMatch[2].trim();
        hasExplicitLetter = true;
    } else if (/^[a-dA-D1-9]$/i.test(raw)) {
        letter = raw.toUpperCase();
        text = '';
        hasExplicitLetter = true;
    }

    const cleanStem = cleanOptionText(text).replace(/^[a-z0-9]\s+/, '').trim();
    const isPureLetter = hasExplicitLetter && cleanStem.length === 0;

    return { letter, text, cleanStem, isPureLetter, raw };
}

function isTrueVariant(str) {
    const s = cleanOptionText(str);
    return s === 'true' || s === 't' || s === 'yes' || s === 'y' || s === '1' || s === 'correct';
}

function isFalseVariant(str) {
    const s = cleanOptionText(str);
    return s === 'false' || s === 'f' || s === 'no' || s === 'n' || s === '0' || s === 'incorrect';
}

function scoreOptionMatch(candidateText, candidateValue, candidateLetter, targetAns, optIndex, totalOptionsInGroup) {
    if (!targetAns) return 0;

    const parsed = parseTargetAnswer(targetAns);
    const cTextClean = cleanOptionText(candidateText);
    const cValClean = cleanOptionText(candidateValue);
    const cStem = cTextClean.replace(/^[a-z0-9]\s+/, '').trim();

    // 1. True / False normalization
    const targetIsTrue = isTrueVariant(targetAns) || isTrueVariant(parsed.cleanStem);
    const targetIsFalse = isFalseVariant(targetAns) || isFalseVariant(parsed.cleanStem);
    const candidateIsTrue = isTrueVariant(candidateText) || isTrueVariant(candidateValue);
    const candidateIsFalse = isFalseVariant(candidateText) || isFalseVariant(candidateValue);

    if (targetIsTrue && candidateIsTrue) return 100;
    if (targetIsFalse && candidateIsFalse) return 100;
    if ((targetIsTrue && candidateIsFalse) || (targetIsFalse && candidateIsTrue)) return 0;

    // 2. Exact match of candidate text/value with raw target or parsed stem
    if (cStem && parsed.cleanStem && cStem === parsed.cleanStem) return 100;
    if (cTextClean && (cTextClean === cleanOptionText(targetAns) || cTextClean === parsed.cleanStem)) return 100;
    if (cValClean && (cValClean === cleanOptionText(targetAns) || cValClean === parsed.cleanStem)) return 100;

    // 3. Pure letter matching (when target has NO conflicting text, e.g. "B" or "B.")
    const optLetter = candidateLetter ? String(candidateLetter).toUpperCase() : null;
    if (parsed.isPureLetter && parsed.letter) {
        if (optLetter && optLetter === parsed.letter) return 96;
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const targetIdx = letters.indexOf(parsed.letter);
        if (targetIdx !== -1 && targetIdx === optIndex) return 92;
        return 0; // Pure letter target does NOT match different letters
    }

    // 4. Target has substantive text: Verify text match!
    // NEVER allow a letter-match to override contradictory text!
    if (parsed.cleanStem && parsed.cleanStem.length >= 3) {
        if (!cStem) return 0;

        // Exact stem match
        if (cStem === parsed.cleanStem) return 100;

        // Substring containment with length ratio check
        if (cStem.includes(parsed.cleanStem) || parsed.cleanStem.includes(cStem)) {
            const minLen = Math.min(cStem.length, parsed.cleanStem.length);
            const maxLen = Math.max(cStem.length, parsed.cleanStem.length);
            const lenRatio = minLen / maxLen;
            if (lenRatio >= 0.75) {
                if (optLetter && parsed.letter && optLetter === parsed.letter) return 95;
                return 88;
            }
        }

        // Token overlap with strict threshold (must share >= 80% words)
        const cWords = cStem.split(' ').filter(w => w.length > 2);
        const tWords = parsed.cleanStem.split(' ').filter(w => w.length > 2);
        if (cWords.length > 0 && tWords.length > 0) {
            const cWordSet = new Set(cWords);
            const matchedCount = tWords.filter(w => cWordSet.has(w)).length;
            const overlapRatio = matchedCount / Math.max(cWordSet.size, tWords.length);
            if (overlapRatio >= 0.8) {
                return Math.floor(overlapRatio * 85);
            }
        }

        // Text completely disagrees! Return 0 even if letters match!
        return 0;
    }

    return 0;
}

console.log('=== TEST SUITE: KENOWA EXAM MODE MATCHING & SELECTION ===\n');

// ── Test Case 1: Exact User Reported Bug ──────────────────────
console.log('Test 1: User Reported Bug - Unrelated Option with Same Letter "B"');
const question1Options = [
    { index: 0, letter: 'A', text: 'Only administrators', value: 'opt_a' },
    { index: 1, letter: 'B', text: 'My contacts and anyone in my courses', value: 'opt_b' },
    { index: 2, letter: 'C', text: 'Everyone on the web', value: 'opt_c' }
];

const aiAnswersRaw = [
    'B. Data collection from sources that have already collected data',
    'B. My contacts and anyone in my courses'
];

// Score the unrelated answer
let unrelatedBestScore = 0;
let unrelatedBestOpt = null;
question1Options.forEach(opt => {
    const sc = scoreOptionMatch(opt.text, opt.value, opt.letter, aiAnswersRaw[0], opt.index, 3);
    if (sc > unrelatedBestScore) {
        unrelatedBestScore = sc;
        unrelatedBestOpt = opt;
    }
});
console.log(`Unrelated answer score against page options: ${unrelatedBestScore}`);
if (unrelatedBestScore >= 75) {
    throw new Error(`Test 1 Failed: Unrelated answer scored ${unrelatedBestScore} (should be 0)`);
}

// Score the correct answer
let correctBestScore = 0;
let correctBestOpt = null;
question1Options.forEach(opt => {
    const sc = scoreOptionMatch(opt.text, opt.value, opt.letter, aiAnswersRaw[1], opt.index, 3);
    if (sc > correctBestScore) {
        correctBestScore = sc;
        correctBestOpt = opt;
    }
});
console.log(`Correct answer score against page options: ${correctBestScore} (Option ${correctBestOpt?.letter})`);
if (correctBestScore < 75 || correctBestOpt?.letter !== 'B') {
    throw new Error(`Test 1 Failed: Correct answer did not match option B`);
}

// ── Test Case 2: Single-Choice Question Selection Guard ─────────
console.log('\nTest 2: Single-Choice Question Selection Guard (At Most 1 Option)');
const singleChoiceQuestion = {
    type: 'single',
    options: question1Options
};

// Simulate the single-choice validation logic from sidepanel.js
let validatedList = [];
let bestOpt = null;
let bestScore = 0;
for (const rawAns of aiAnswersRaw) {
    for (const opt of singleChoiceQuestion.options) {
        const sc = scoreOptionMatch(opt.text, opt.value, opt.letter, rawAns, opt.index, singleChoiceQuestion.options.length);
        if (sc > bestScore && sc >= 75) {
            bestScore = sc;
            bestOpt = opt;
        }
    }
}
if (bestOpt) {
    validatedList.push({
        letter: bestOpt.letter,
        text: bestOpt.text,
        fullDisplay: `${bestOpt.letter}. ${bestOpt.text}`
    });
}

console.log(`Validated list count: ${validatedList.length}`);
console.log(`Validated output: ${validatedList.map(v => v.fullDisplay).join(', ')}`);
if (validatedList.length !== 1) {
    throw new Error(`Test 2 Failed: Expected exactly 1 validated answer, got ${validatedList.length}`);
}
if (validatedList[0].fullDisplay !== 'B. My contacts and anyone in my courses') {
    throw new Error(`Test 2 Failed: Matched wrong option: ${validatedList[0].fullDisplay}`);
}

// ── Test Case 3: Pure Letter Matching ─────────────────────────
console.log('\nTest 3: Pure Letter Target "B." vs "A."');
const pureBScore = scoreOptionMatch(question1Options[1].text, question1Options[1].value, 'B', 'B.', 1, 3);
const pureAScore = scoreOptionMatch(question1Options[1].text, question1Options[1].value, 'B', 'A.', 1, 3);
console.log(`Pure 'B.' score on option B: ${pureBScore}`);
console.log(`Pure 'A.' score on option B: ${pureAScore}`);
if (pureBScore < 90 || pureAScore !== 0) {
    throw new Error('Test 3 Failed: Pure letter matching failed');
}

// ── Test Case 4: True / False Matching ────────────────────────
console.log('\nTest 4: True / False Matching');
const tfOptions = [
    { index: 0, letter: 'A', text: 'True', value: 'true' },
    { index: 1, letter: 'B', text: 'False', value: 'false' }
];
const trueOnTrue = scoreOptionMatch(tfOptions[0].text, tfOptions[0].value, 'A', 'True', 0, 2);
const falseOnTrue = scoreOptionMatch(tfOptions[0].text, tfOptions[0].value, 'A', 'False', 0, 2);
console.log(`True on True: ${trueOnTrue}, False on True: ${falseOnTrue}`);
if (trueOnTrue !== 100 || falseOnTrue !== 0) {
    throw new Error('Test 4 Failed: True/False matching failed');
}

// ── Test Case 5: Multi-select Checkboxes ──────────────────────
console.log('\nTest 5: Multi-Select Checkboxes');
const multiQuestion = {
    type: 'multiple',
    options: [
        { index: 0, letter: 'A', text: 'Data collection from internal sources', value: 'a' },
        { index: 1, letter: 'B', text: 'Unrelated option', value: 'b' },
        { index: 2, letter: 'C', text: 'Data collection from external sources', value: 'c' }
    ]
};
const multiAnswers = [
    'A. Data collection from internal sources',
    'C. Data collection from external sources'
];
const multiValidated = [];
const seenOptIds = new Set();
for (const rawAns of multiAnswers) {
    let best = null;
    let bSc = 0;
    for (const opt of multiQuestion.options) {
        if (seenOptIds.has(opt.letter)) continue;
        const sc = scoreOptionMatch(opt.text, opt.value, opt.letter, rawAns, opt.index, 3);
        if (sc > bSc && sc >= 75) {
            bSc = sc;
            best = opt;
        }
    }
    if (best) {
        seenOptIds.add(best.letter);
        multiValidated.push(`${best.letter}. ${best.text}`);
    }
}
console.log(`Multi-select validated count: ${multiValidated.length}`);
console.log(`Multi-select items: ${multiValidated.join(', ')}`);
if (multiValidated.length !== 2) {
    throw new Error(`Test 5 Failed: Expected 2 options, got ${multiValidated.length}`);
}

console.log('\n======================================================');
console.log('🎉 ALL EXAM MODE VERIFICATION TESTS PASSED SUCCESSFULLY!');
console.log('======================================================');
