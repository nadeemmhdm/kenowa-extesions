// Test Suite: Exam Mode Capsule Insufficient Information & AI Fallback
// Tests all scenarios required by the user prompt.

const assert = require('assert');
const origLog = console.log;
const origInfo = console.info;
const origWarn = console.warn;
const origError = console.error;

const {
    retrieveCapsuleContext,
    verifyAnswerAgainstSources,
    cleanOptionTextAndLetter,
    cleanQuestionStem
} = require('../utils.js');

console.log = origLog;
console.info = origInfo;
console.warn = origWarn;
console.error = origError;

let passed = 0;
let total = 0;

function runTest(name, fn) {
    total++;
    try {
        fn();
        console.log(`  [PASS] ${name}`);
        passed++;
    } catch (err) {
        console.error(`  [FAIL] ${name}`);
        console.error(`    ${err.message}`);
        console.error(err.stack);
    }
}

console.log('\n=== RUNNING EXAM MODE CAPSULE FALLBACK & AI RETRIEVAL TESTS ===\n');

// ── Mock Helpers & Matching Engine ────────────────────────────────────

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
    const prefixMatch = raw.match(/^(?:(?:option|choice)\s+)?(?:\[|\()?([a-hA-H1-9])(?:[\.\)\:\s\]\-]+|$)(.*)$/i);
    let letter = null;
    let text = raw;
    let hasExplicitLetter = false;

    if (prefixMatch) {
        letter = prefixMatch[1].toUpperCase();
        text = prefixMatch[2].trim();
        hasExplicitLetter = true;
    } else if (/^[a-hA-H1-9]$/i.test(raw)) {
        letter = raw.toUpperCase();
        text = '';
        hasExplicitLetter = true;
    }

    const cleanStem = cleanOptionText(text).replace(/^[a-z0-9]\s+/, '').trim();
    const isPureLetter = hasExplicitLetter && cleanStem.length === 0;

    return { letter, text, cleanStem, isPureLetter, raw };
}

function scoreOptionMatch(candidateText, candidateValue, candidateLetter, targetAns, optIndex, totalOptionsInGroup) {
    if (!targetAns) return 0;
    const parsed = parseTargetAnswer(targetAns);
    const cTextClean = cleanOptionText(candidateText);
    const cValClean = cleanOptionText(candidateValue);
    const cLetter = String(candidateLetter || '').toUpperCase();
    const optLetter = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'][optIndex] || String(optIndex + 1);

    if (parsed.isPureLetter) {
        if (parsed.letter === cLetter || parsed.letter === optLetter) return 96;
        return 0;
    }

    const targetStem = parsed.cleanStem;
    if (targetStem.length > 0) {
        if (cTextClean === targetStem || cValClean === targetStem) return 100;
        if (cTextClean.startsWith(targetStem) || targetStem.startsWith(cTextClean)) {
            if (cTextClean.length > 3 && targetStem.length > 3) return 90;
        }
    }

    if (parsed.letter && (parsed.letter === cLetter || parsed.letter === optLetter)) {
        if (targetStem.length === 0) return 96;
    }

    return 0;
}

// ── Exam Step Simulation Engine ───────────────────────────────────────

function simulateExamModeQuestionStep({
    detectedQuestions,
    capsules,
    mockAiResponse,
    state,
    url = 'https://exam.university.edu/quiz/attempt.php'
}) {
    const logs = [];
    let bannerStatus = '';

    const detectedQuestionId = `${url}::${detectedQuestions.map(q => `${q.stem.substring(0, 100)}::${q.options.map(o => o.text).join('|')}`).join(';;')}`;

    // 1. Check if already answered
    if (state.answeredQuestionIds.has(detectedQuestionId)) {
        return { status: 'ALREADY_ANSWERED', logs, detectedQuestionId };
    }

    // 2. Capsule Check
    const isCapsuleActive = Array.isArray(capsules) && capsules.length > 0;
    let capsuleSection = '';
    let retrievedSources = [];
    let capsuleUsed = false;

    const fullPromptText = detectedQuestions.map(q => `${q.stem}\n${q.options.map(o => `[${o.letter}] ${o.text}`).join('\n')}`).join('\n\n');

    if (isCapsuleActive) {
        let ragResult = null;
        if (state.capsuleCheckCache.has(detectedQuestionId)) {
            ragResult = state.capsuleCheckCache.get(detectedQuestionId);
        } else {
            if (!state.notifiedQuestionIds.has(detectedQuestionId)) {
                bannerStatus = 'Checking Capsules…';
                logs.push('📚 Checking Capsules…');
                state.notifiedQuestionIds.add(detectedQuestionId);
            }
            try {
                ragResult = retrieveCapsuleContext(fullPromptText, capsules, { maxChars: 8000 });
            } catch (err) {
                ragResult = { context: '', sources: [], hasSufficientEvidence: false };
            }
            state.capsuleCheckCache.set(detectedQuestionId, ragResult);
        }

        retrievedSources = ragResult?.sources || [];

        if (ragResult?.hasSufficientEvidence && ragResult?.context) {
            capsuleUsed = true;
            capsuleSection = `\n\n${ragResult.context}\n\nCRITICAL CAPSULE RULE:\nUse the verified Capsule reference notes above as your primary source of truth. Ground your answer strictly in these references. If a choice is supported by the Capsule reference notes, you MUST choose that choice.\n`;
        } else {
            // FALLBACK TO AI MODEL!
            if (!state.fallbackNotifiedQuestionIds.has(detectedQuestionId)) {
                state.fallbackNotifiedQuestionIds.add(detectedQuestionId);
                logs.push('ℹ️ Selected Capsule does not contain enough information for this question — continuing with AI model.');
            }
            bannerStatus = 'AI thinking…';
            capsuleSection = '';
        }
    }

    // 3. Build Prompt
    const questionsPromptBlock = detectedQuestions.map((q, idx) => {
        let out = `Question ${idx + 1}: ${q.stem}\nType: ${q.type}\nAvailable Choices:`;
        q.options.forEach(opt => {
            out += `\n  [${opt.letter}] ${opt.text}`;
        });
        return out;
    }).join('\n\n');

    const prompt = `You are an expert exam-answering assistant.\nAnalyze the following quiz question and choose the correct answer strictly from the Available Choices provided below.\n${capsuleSection}\n${questionsPromptBlock}`;

    // 4. Mock AI Generation
    const aiRaw = typeof mockAiResponse === 'function' ? mockAiResponse(prompt, capsuleUsed) : mockAiResponse;
    if (!aiRaw || aiRaw.trim() === '[]') {
        logs.push('⚠️ AI could not determine the answer from the available options. Please select your answer manually.');
        return { status: 'AI_EMPTY', logs, detectedQuestionId, prompt, capsuleUsed };
    }

    // 5. Parse and Validate
    let parsedAnswers = [];
    try {
        parsedAnswers = JSON.parse(aiRaw);
    } catch (_) {
        parsedAnswers = [aiRaw];
    }

    const validatedList = [];
    for (const q of detectedQuestions) {
        for (const rawAns of parsedAnswers) {
            let bestOpt = null;
            let bestScore = 0;
            for (const opt of q.options) {
                const sc = scoreOptionMatch(opt.text, opt.value, opt.letter, rawAns, opt.index, q.options.length);
                if (sc > bestScore && sc >= 75) {
                    bestScore = sc;
                    bestOpt = opt;
                }
            }
            if (bestOpt) {
                validatedList.push({
                    letter: bestOpt.letter,
                    text: bestOpt.text,
                    fullDisplay: `${bestOpt.letter}. ${bestOpt.text}`
                });
            }
        }
    }

    if (!validatedList.length) {
        logs.push('⚠️ Answer validation failed. Please select your answer manually on the exam page before continuing.');
        return { status: 'UNMATCHED', logs, detectedQuestionId, prompt, capsuleUsed };
    }

    // 6. Selection Success
    state.answeredQuestionIds.add(detectedQuestionId);
    const displayAnswers = validatedList.map(v => v.fullDisplay).join(', ');
    logs.push(`✅ Correct Answer: ${displayAnswers}`);

    if (isCapsuleActive && capsuleUsed && retrievedSources.length > 0) {
        for (const v of validatedList) {
            const ver = verifyAnswerAgainstSources(v.fullDisplay, v.text, retrievedSources);
            if (ver.grounded && ver.verifiedSource) {
                logs.push(`📚 Verified by Capsule: ${ver.verifiedSource.name}`);
            }
        }
    }

    return {
        status: 'SUCCESS',
        logs,
        detectedQuestionId,
        validatedList,
        displayAnswers,
        capsuleUsed,
        prompt
    };
}

// ── Test Sample Data ──────────────────────────────────────────────────

const sampleCapsules = [
    {
        name: 'Cell_Biology_Notes.md',
        content: `# Cell Biology\n\n## Organelles\n\n### Ribosomes\nRibosomes are the cellular machines responsible for protein synthesis. They translate mRNA into polypeptide chains.\n\n### Mitochondria\nMitochondria generate ATP through oxidative phosphorylation and are known as the powerhouse of the cell.`
    }
];

const questionCellBio = [{
    stem: 'Which organelle is responsible for synthesizing proteins in the cell?',
    type: 'single',
    options: [
        { index: 0, letter: 'A', text: 'Golgi Apparatus', value: '1' },
        { index: 1, letter: 'B', text: 'Ribosomes', value: '2' },
        { index: 2, letter: 'C', text: 'Lysosomes', value: '3' },
        { index: 3, letter: 'D', text: 'Endoplasmic Reticulum', value: '4' }
    ]
}];

const questionWorldHistory = [{
    stem: 'In what year was the Treaty of Versailles signed to end World War I?',
    type: 'single',
    options: [
        { index: 0, letter: 'A', text: '1914', value: '1' },
        { index: 1, letter: 'B', text: '1918', value: '2' },
        { index: 2, letter: 'C', text: '1919', value: '3' },
        { index: 3, letter: 'D', text: '1939', value: '4' }
    ]
}];

// ── Test 1: Capsule contains the correct answer ────────────────────────

runTest('1. Capsule contains the correct answer -> Grounds in Capsule and validates', () => {
    const state = {
        answeredQuestionIds: new Set(),
        capsuleCheckCache: new Map(),
        notifiedQuestionIds: new Set(),
        fallbackNotifiedQuestionIds: new Set()
    };

    const res = simulateExamModeQuestionStep({
        detectedQuestions: questionCellBio,
        capsules: sampleCapsules,
        mockAiResponse: (prompt, capsuleUsed) => {
            assert.strictEqual(capsuleUsed, true);
            assert.ok(prompt.includes('Ribosomes are the cellular machines responsible for protein synthesis'));
            return JSON.stringify(['B. Ribosomes']);
        },
        state
    });

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.capsuleUsed, true);
    assert.strictEqual(res.displayAnswers, 'B. Ribosomes');
    assert.ok(res.logs.some(l => l.includes('Verified by Capsule: Cell_Biology_Notes.md')));
});

// ── Test 2: Capsule contains unrelated info -> Falls back to AI model ──

runTest('2. Capsule contains unrelated info -> Automatically falls back to AI without stopping', () => {
    const state = {
        answeredQuestionIds: new Set(),
        capsuleCheckCache: new Map(),
        notifiedQuestionIds: new Set(),
        fallbackNotifiedQuestionIds: new Set()
    };

    // Asking World History question while Capsule only has Cell Biology
    const res = simulateExamModeQuestionStep({
        detectedQuestions: questionWorldHistory,
        capsules: sampleCapsules,
        mockAiResponse: (prompt, capsuleUsed) => {
            // Capsule should NOT be used!
            assert.strictEqual(capsuleUsed, false);
            // Prompt should NOT contain cell biology notes
            assert.ok(!prompt.includes('Cell Biology'));
            // AI model answers using general knowledge
            return JSON.stringify(['C. 1919']);
        },
        state
    });

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.capsuleUsed, false);
    assert.strictEqual(res.displayAnswers, 'C. 1919');
    assert.ok(res.logs.some(l => l.includes('continuing with AI model')));
    assert.ok(!res.logs.some(l => l.includes('Verified by Capsule')));
    assert.ok(!res.logs.some(l => l.includes('Please select your answer manually')));
});

// ── Test 3: Capsule list is empty -> Direct AI model answer ───────────

runTest('3. Capsule list is empty -> Answers directly using AI model', () => {
    const state = {
        answeredQuestionIds: new Set(),
        capsuleCheckCache: new Map(),
        notifiedQuestionIds: new Set(),
        fallbackNotifiedQuestionIds: new Set()
    };

    const res = simulateExamModeQuestionStep({
        detectedQuestions: questionWorldHistory,
        capsules: [],
        mockAiResponse: () => JSON.stringify(['C. 1919']),
        state
    });

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.capsuleUsed, false);
    assert.strictEqual(res.displayAnswers, 'C. 1919');
});

// ── Test 4: Capsule retrieval throws error -> Graceful AI fallback ────

runTest('4. Capsule retrieval throws error -> Catches error and falls back to AI', () => {
    const state = {
        answeredQuestionIds: new Set(),
        capsuleCheckCache: new Map(),
        notifiedQuestionIds: new Set(),
        fallbackNotifiedQuestionIds: new Set()
    };

    const corruptedCapsules = [{ name: 'corrupted', content: null }];

    const res = simulateExamModeQuestionStep({
        detectedQuestions: questionWorldHistory,
        capsules: corruptedCapsules,
        mockAiResponse: () => JSON.stringify(['C. 1919']),
        state
    });

    assert.strictEqual(res.status, 'SUCCESS');
    assert.strictEqual(res.capsuleUsed, false);
    assert.strictEqual(res.displayAnswers, 'C. 1919');
    assert.ok(res.logs.some(l => l.includes('continuing with AI model')));
});

// ── Test 5: AI returns answer that does not match options ─────────────

runTest('5. AI returns unmatchable option -> Validation safely rejects without crash', () => {
    const state = {
        answeredQuestionIds: new Set(),
        capsuleCheckCache: new Map(),
        notifiedQuestionIds: new Set(),
        fallbackNotifiedQuestionIds: new Set()
    };

    const res = simulateExamModeQuestionStep({
        detectedQuestions: questionWorldHistory,
        capsules: sampleCapsules,
        mockAiResponse: () => JSON.stringify(['Z. 2050 Martian Treaty']),
        state
    });

    assert.strictEqual(res.status, 'UNMATCHED');
    assert.ok(res.logs.some(l => l.includes('Answer validation failed')));
    assert.strictEqual(state.answeredQuestionIds.has(res.detectedQuestionId), false);
});

// ── Test 6: Deduplication & Cache Prevents Repeated Checking ──────────

runTest('6. Same question re-queried uses cache and avoids duplicate notices', () => {
    const state = {
        answeredQuestionIds: new Set(),
        capsuleCheckCache: new Map(),
        notifiedQuestionIds: new Set(),
        fallbackNotifiedQuestionIds: new Set()
    };

    // First attempt: AI returned empty (simulating transient network error)
    const run1 = simulateExamModeQuestionStep({
        detectedQuestions: questionWorldHistory,
        capsules: sampleCapsules,
        mockAiResponse: () => '[]',
        state
    });

    assert.strictEqual(run1.status, 'AI_EMPTY');
    assert.strictEqual(state.notifiedQuestionIds.size, 1);
    assert.strictEqual(state.fallbackNotifiedQuestionIds.size, 1);
    assert.ok(state.capsuleCheckCache.has(run1.detectedQuestionId));
    assert.ok(run1.logs.some(l => l.includes('📚 Checking Capsules…')));

    // Second attempt on the SAME question
    const run2 = simulateExamModeQuestionStep({
        detectedQuestions: questionWorldHistory,
        capsules: sampleCapsules,
        mockAiResponse: () => JSON.stringify(['C. 1919']),
        state
    });

    assert.strictEqual(run2.status, 'SUCCESS');
    // Notice: run2 should NOT re-log "Checking Capsules..." or fallback message because question ID was cached!
    assert.ok(!run2.logs.some(l => l.includes('📚 Checking Capsules…')));
    assert.ok(!run2.logs.some(l => l.includes('continuing with AI model')));
    assert.strictEqual(run2.displayAnswers, 'C. 1919');
});

// ── Test 7: Multiple consecutive questions with mixed relevance ────────

runTest('7. Multiple consecutive questions with mixed Capsule relevance', () => {
    const state = {
        answeredQuestionIds: new Set(),
        capsuleCheckCache: new Map(),
        notifiedQuestionIds: new Set(),
        fallbackNotifiedQuestionIds: new Set()
    };

    // Question 1: In Capsule (Biology)
    const q1Res = simulateExamModeQuestionStep({
        detectedQuestions: questionCellBio,
        capsules: sampleCapsules,
        mockAiResponse: () => JSON.stringify(['B. Ribosomes']),
        state,
        url: 'https://exam.edu/q1'
    });
    assert.strictEqual(q1Res.status, 'SUCCESS');
    assert.strictEqual(q1Res.capsuleUsed, true);
    assert.ok(q1Res.logs.some(l => l.includes('Verified by Capsule')));

    // Question 2: NOT in Capsule (History)
    const q2Res = simulateExamModeQuestionStep({
        detectedQuestions: questionWorldHistory,
        capsules: sampleCapsules,
        mockAiResponse: () => JSON.stringify(['C. 1919']),
        state,
        url: 'https://exam.edu/q2'
    });
    assert.strictEqual(q2Res.status, 'SUCCESS');
    assert.strictEqual(q2Res.capsuleUsed, false); // Fell back to AI!
    assert.ok(q2Res.logs.some(l => l.includes('continuing with AI model')));

    // Question 3: Biology again (Mitochondria)
    const questionMito = [{
        stem: 'Which organelle generates ATP and is known as the powerhouse of the cell?',
        type: 'single',
        options: [
            { index: 0, letter: 'A', text: 'Ribosomes', value: '1' },
            { index: 1, letter: 'B', text: 'Mitochondria', value: '2' },
            { index: 2, letter: 'C', text: 'Nucleus', value: '3' },
            { index: 3, letter: 'D', text: 'Vacuole', value: '4' }
        ]
    }];

    const q3Res = simulateExamModeQuestionStep({
        detectedQuestions: questionMito,
        capsules: sampleCapsules,
        mockAiResponse: () => JSON.stringify(['B. Mitochondria']),
        state,
        url: 'https://exam.edu/q3'
    });
    assert.strictEqual(q3Res.status, 'SUCCESS');
    assert.strictEqual(q3Res.capsuleUsed, true); // Used Capsule again!
    assert.ok(q3Res.logs.some(l => l.includes('Verified by Capsule')));
});

console.log(`\n=== RESULTS: ${passed}/${total} TESTS PASSED ===\n`);
if (passed !== total) {
    process.exit(1);
}
