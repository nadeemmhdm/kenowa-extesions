// Test script to verify exact option matching and rejection logic

function cleanText(str) {
    return String(str || '')
        .toLowerCase()
        .replace(/&nbsp;/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function parseTargetAnswer(targetAns) {
    const raw = String(targetAns || '').trim();
    // Match prefix like "B.", "B)", "[B]", "(B)", "Option B:", "Choice B."
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

    const cleanStem = cleanText(text).replace(/^[a-z0-9]\s+/, '').trim();
    const isPureLetter = hasExplicitLetter && cleanStem.length === 0;

    return { letter, text, cleanStem, isPureLetter, raw };
}

function isTrueVariant(str) {
    const s = cleanText(str);
    return s === 'true' || s === 't' || s === 'yes' || s === 'y' || s === '1' || s === 'correct';
}

function isFalseVariant(str) {
    const s = cleanText(str);
    return s === 'false' || s === 'f' || s === 'no' || s === 'n' || s === '0' || s === 'incorrect';
}

function scoreOptionMatch(candidateText, candidateValue, candidateLetter, targetAns, optIndex, totalOptionsInGroup) {
    if (!targetAns) return 0;

    const parsed = parseTargetAnswer(targetAns);
    const cTextClean = cleanText(candidateText);
    const cValClean = cleanText(candidateValue);
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
    if (cTextClean && (cTextClean === cleanText(targetAns) || cTextClean === parsed.cleanStem)) return 100;
    if (cValClean && (cValClean === cleanText(targetAns) || cValClean === parsed.cleanStem)) return 100;

    // 3. Pure letter matching (when target has NO conflicting text, e.g. "B" or "B.")
    const optLetter = candidateLetter ? String(candidateLetter).toUpperCase() : null;
    if (parsed.isPureLetter && parsed.letter) {
        if (optLetter && optLetter === parsed.letter) return 96;
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const targetIdx = letters.indexOf(parsed.letter);
        if (targetIdx !== -1 && targetIdx === optIndex) return 92;
        return 0; // Pure letter target does NOT match other letters
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
                // If letters also match, boost score
                if (optLetter && parsed.letter && optLetter === parsed.letter) return 95;
                return 88;
            }
        }

        // Token overlap with strict threshold (must share >= 80% words and key vocabulary)
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

// ── Run Tests ──────────────────────────────────────────────
console.log('--- TEST 1: Unrelated answer with same letter B ---');
const candidate1 = { text: 'My contacts and anyone in my courses', letter: 'B', index: 1 };
const targetUnrelated = 'B. Data collection from sources that have already collected data';
const score1 = scoreOptionMatch(candidate1.text, '', candidate1.letter, targetUnrelated, candidate1.index, 4);
console.log(`Score for unrelated option: ${score1} (Expected: 0)`);
if (score1 !== 0) throw new Error(`Test 1 Failed: Expected 0, got ${score1}`);

console.log('--- TEST 2: Correct answer with letter B ---');
const targetCorrect = 'B. My contacts and anyone in my courses';
const score2 = scoreOptionMatch(candidate1.text, '', candidate1.letter, targetCorrect, candidate1.index, 4);
console.log(`Score for correct option: ${score2} (Expected: 100)`);
if (score2 < 95) throw new Error(`Test 2 Failed: Expected >= 95, got ${score2}`);

console.log('--- TEST 3: Pure letter target "B" ---');
const targetPureLetter = 'B.';
const score3 = scoreOptionMatch(candidate1.text, '', candidate1.letter, targetPureLetter, candidate1.index, 4);
console.log(`Score for pure letter B: ${score3} (Expected: 96)`);
if (score3 !== 96) throw new Error(`Test 3 Failed: Expected 96, got ${score3}`);

console.log('--- TEST 4: Pure letter target "A" against candidate B ---');
const targetLetterA = 'A.';
const score4 = scoreOptionMatch(candidate1.text, '', candidate1.letter, targetLetterA, candidate1.index, 4);
console.log(`Score for wrong letter A: ${score4} (Expected: 0)`);
if (score4 !== 0) throw new Error(`Test 4 Failed: Expected 0, got ${score4}`);

console.log('--- TEST 5: True/False matching ---');
const tfCandidate = { text: 'True', letter: 'A', index: 0 };
const scoreTFTrue = scoreOptionMatch(tfCandidate.text, '', tfCandidate.letter, 'True', 0, 2);
const scoreTFFalse = scoreOptionMatch(tfCandidate.text, '', tfCandidate.letter, 'False', 0, 2);
console.log(`TF True score: ${scoreTFTrue}, TF False score: ${scoreTFFalse}`);
if (scoreTFTrue !== 100 || scoreTFFalse !== 0) throw new Error('Test 5 Failed');

console.log('✅ ALL MATCHING TESTS PASSED!');
