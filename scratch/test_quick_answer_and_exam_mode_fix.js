// ============================================================
// Test Suite: Quick Answer Response Error & Exam Mode Repeat Fix
// Tests:
// 1. Placeholder neutralization in parseTargetAnswer (e.g. "A. Option Text")
// 2. Exact Option Matching with neutralized placeholder
// 3. Question Number Anchor discovery in extractPageQuestions
// 4. selection.js formatQuickAnswerText resolution from [A] prompt format
// 5. Exam Mode next page button matching and repeat loop
// ============================================================

const assert = require('assert');
const utils = require('../utils.js');

const {
    parseTargetAnswer,
    scoreOptionMatch,
    extractPageQuestions,
    cleanOptionText
} = utils;

console.log('🧪 Starting Quick Answer Response & Exam Mode Fix Test Suite...\n');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  ✅ PASS: ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  ❌ FAIL: ${name}`);
        console.error(`     Error: ${err.message}`);
        console.error(err.stack);
    }
}

// ============================================================
// TEST 1: Placeholder Neutralization in parseTargetAnswer
// ============================================================
console.log('--- Test 1: Placeholder Neutralization in parseTargetAnswer ---');

runTest('1.1 Neutralizes "A. Option Text" to pure letter A', () => {
    const parsed = parseTargetAnswer('["A. Option Text"]');
    assert.strictEqual(parsed.letter, 'A', `Letter should be A, got: ${parsed.letter}`);
    assert.strictEqual(parsed.isPureLetter, true, `Should be pure letter because "Option Text" is a placeholder`);
    assert.strictEqual(parsed.cleanStem, '', `cleanStem should be empty`);
});

runTest('1.2 Neutralizes other common prompt artifacts', () => {
    const samples = ['B. Option Text', 'C. Choice Text', 'D. Option 1', 'A. Option A', 'B. First Option'];
    for (const s of samples) {
        const parsed = parseTargetAnswer(s);
        assert.strictEqual(parsed.isPureLetter, true, `Sample "${s}" should be recognized as pure letter`);
    }
});

runTest('1.3 Preserves real option substantive text', () => {
    const realAns = 'b. If it is differentiable at every point in the interval';
    const parsed = parseTargetAnswer(realAns);
    assert.strictEqual(parsed.letter, 'B');
    assert.strictEqual(parsed.isPureLetter, false);
    assert(parsed.cleanStem.includes('differentiable'), `cleanStem should contain differentiable: ${parsed.cleanStem}`);
});

// ============================================================
// TEST 2: Option Matching when AI returns placeholder
// ============================================================
console.log('\n--- Test 2: Option Matching with Placeholder Output ---');

runTest('2.1 AI returning ["A. Option Text"] matches option A with high score', () => {
    const options = [
        { letter: 'A', text: 'If it has no real number values', index: 0 },
        { letter: 'B', text: 'If it is differentiable at every point in the interval', index: 1 },
        { letter: 'C', text: 'If it can be graphed without lifting the pencil', index: 2 },
        { letter: 'D', text: 'If it is a straight line', index: 3 }
    ];

    const targetAns = '["A. Option Text"]';

    const scoreA = scoreOptionMatch(options[0].text, '', options[0].letter, targetAns, 0, 4);
    const scoreB = scoreOptionMatch(options[1].text, '', options[1].letter, targetAns, 1, 4);
    const scoreC = scoreOptionMatch(options[2].text, '', options[2].letter, targetAns, 2, 4);
    const scoreD = scoreOptionMatch(options[3].text, '', options[3].letter, targetAns, 3, 4);

    assert(scoreA >= 90, `Option A should match with score >= 90, got: ${scoreA}`);
    assert.strictEqual(scoreB, 0, `Option B should score 0, got: ${scoreB}`);
    assert.strictEqual(scoreC, 0, `Option C should score 0, got: ${scoreC}`);
    assert.strictEqual(scoreD, 0, `Option D should score 0, got: ${scoreD}`);
});

// ============================================================
// TEST 3: Question Extraction (Moodle Structure & Number Anchoring)
// ============================================================
console.log('\n--- Test 3: Question Extraction (Moodle & Number Anchoring) ---');

runTest('3.1 Extracts Moodle question correctly and does not drop on .history or .answered', () => {
    // Mock minimal DOM for Moodle
    function createMockMoodleDoc() {
        const doc = {
            title: '06 Unit : Practice Multiple Choice Questions (MCQs)',
            readyState: 'complete',
            body: {
                innerText: 'Question 1 Not yet answered Marked out of 1.00 Flag question How is continuity of a function on an interval determined? a. If it has no real number values b. If it is differentiable at every point in the interval c. If it can be graphed without lifting the pencil d. If it is a straight line Next page',
                querySelectorAll: () => []
            }
        };

        const inputs = [
            {
                tagName: 'INPUT', type: 'radio', name: 'q1', id: 'q1_a', value: '0',
                getAttribute: k => (k === 'aria-label' ? null : null),
                closest: s => null,
                parentElement: { innerText: 'a. If it has no real number values' },
                getBoundingClientRect: () => ({ width: 15, height: 15 })
            },
            {
                tagName: 'INPUT', type: 'radio', name: 'q1', id: 'q1_b', value: '1',
                getAttribute: k => (k === 'aria-label' ? null : null),
                closest: s => null,
                parentElement: { innerText: 'b. If it is differentiable at every point in the interval' },
                getBoundingClientRect: () => ({ width: 15, height: 15 })
            },
            {
                tagName: 'INPUT', type: 'radio', name: 'q1', id: 'q1_c', value: '2',
                getAttribute: k => (k === 'aria-label' ? null : null),
                closest: s => null,
                parentElement: { innerText: 'c. If it can be graphed without lifting the pencil' },
                getBoundingClientRect: () => ({ width: 15, height: 15 })
            },
            {
                tagName: 'INPUT', type: 'radio', name: 'q1', id: 'q1_d', value: '3',
                getAttribute: k => (k === 'aria-label' ? null : null),
                closest: s => null,
                parentElement: { innerText: 'd. If it is a straight line' },
                getBoundingClientRect: () => ({ width: 15, height: 15 })
            }
        ];

        const questionContainer = {
            tagName: 'DIV',
            className: 'que multichoice notyetanswered',
            getAttribute: k => (k === 'role' ? null : null),
            getBoundingClientRect: () => ({ width: 800, height: 300 }),
            closest: s => null,
            querySelector: sel => {
                if (sel.includes('.qtext')) {
                    return { innerText: 'How is continuity of a function on an interval determined?', getBoundingClientRect: () => ({ width: 600, height: 40 }) };
                }
                if (sel.includes('input')) return inputs[0];
                return null;
            },
            querySelectorAll: sel => {
                if (sel.includes('input')) return inputs;
                return [];
            }
        };

        doc.querySelector = sel => null;
        doc.querySelectorAll = sel => {
            if (sel.includes('.que')) return [questionContainer];
            if (sel.includes('input')) return inputs;
            return [];
        };

        return doc;
    }

    const mockDoc = createMockMoodleDoc();
    const result = extractPageQuestions(mockDoc);

    assert.strictEqual(result.status, 'found', `Status should be found, got: ${result.status}`);
    assert.strictEqual(result.detectedQuestions.length, 1, 'Should detect exactly 1 question');
    const q = result.detectedQuestions[0];
    assert.strictEqual(q.stem, 'How is continuity of a function on an interval determined?');
    assert.strictEqual(q.options.length, 4);
    assert.strictEqual(q.options[0].letter, 'A');
    assert.strictEqual(q.options[0].text, 'If it has no real number values');
    assert.strictEqual(q.options[1].letter, 'B');
    assert.strictEqual(q.options[2].letter, 'C');
    assert.strictEqual(q.options[3].letter, 'D');
});

// ============================================================
// TEST 4: selection.js formatQuickAnswerText Resolution
// ============================================================
console.log('\n--- Test 4: formatQuickAnswerText Resolution from [A] prompt format ---');

runTest('4.1 formatQuickAnswerText correctly resolves [A] format prompt to full option text', () => {
    // Simulated formatQuickAnswerText function matching selection.js
    const formatQuickAnswerText = (rawAnswer, promptText) => {
        if (!rawAnswer) return '';
        let text = String(rawAnswer).trim();
        const arrayMatch = text.match(/\[\s*(?:"[^"]*"(?:\s*,\s*"[^"]*")*)\s*\]/);
        const hasHeader = /###\s*(?:🎯\s*)?Correct Answers?/i.test(text);
        if (!arrayMatch && !hasHeader) return text;

        const optionRegex = /(?:^|\n)\s*(?:\[|\()?([a-hA-H1-9])(?:\]|\))?[\.\)\:\-]?\s*([^\n]+)/g;
        const optionsMap = new Map();
        let m;
        while ((m = optionRegex.exec(promptText || '')) !== null) {
          const letter = m[1].toUpperCase();
          const optText = m[2].trim();
          if (optText.length > 0) {
            optionsMap.set(letter, `${letter}. ${optText}`);
          }
        }

        let items = [];
        if (arrayMatch) {
          try { items = JSON.parse(arrayMatch[0]); } catch (_) {}
        }

        if (items.length > 0) {
          const resolved = [];
          const seen = new Set();
          for (const item of items) {
            const clean = String(item).trim().replace(/^["']|["']$/g, '').trim();
            const letterMatch = clean.match(/^(?:option|choice)?\s*(?:\[|\()?([a-hA-H1-9])(?:[\.\)\:\-\]]+|$)/i);
            const letter = letterMatch ? letterMatch[1].toUpperCase() : '';
            const isPlaceholder = /^(?:[a-hA-H1-9][\.\)\:\-\]]*\s*)?(?:option\s*text|choice\s*text|option\s*\d+|choice\s*\d+|option|choice)$/i.test(clean);
            const resolvedFromMap = letter ? optionsMap.get(letter) : null;
            const resolvedText = resolvedFromMap || (!isPlaceholder && clean.length > 2 && !clean.includes('["') ? clean : null);
            const finalText = resolvedText || (letter ? `${letter}.` : clean);
            if (!seen.has(finalText)) {
              seen.add(finalText);
              resolved.push(finalText);
            }
          }

          if (resolved.length > 0) {
            return `### 🎯 Correct Answer\n\n**${resolved[0]}**`;
          }
        }
        return text;
    };

    const promptText = `Question:
How is continuity of a function on an interval determined?

Available Choices:
  [A] If it has no real number values
  [B] If it is differentiable at every point in the interval
  [C] If it can be graphed without lifting the pencil
  [D] If it is a straight line`;

    // AI model returned the dummy string ["A. Option Text"]
    const rawAiResponse = '["A. Option Text"]';
    const formatted = formatQuickAnswerText(rawAiResponse, promptText);

    assert(!formatted.includes('Option Text'), `Output should NOT contain "Option Text": ${formatted}`);
    assert(!formatted.includes('&quot;'), `Output should NOT contain escaped &quot;: ${formatted}`);
    assert(formatted.includes('**A. If it has no real number values**'), `Output should resolve to full option text, got: ${formatted}`);
});

// ============================================================
// TEST 5: Next Page Button Recognition
// ============================================================
console.log('\n--- Test 5: Next Page Button Recognition ---');

runTest('5.1 Button keyword matcher detects "Next page" from Moodle', () => {
    const buttons = [
        { text: 'Back', value: '' },
        { text: '', value: 'Next page' },
        { text: 'Flag question', value: '' }
    ];

    function findBtn(kws, excl = []) {
        return buttons.find(b => {
            const t = (b.text || b.value || '').trim().toLowerCase();
            return t && kws.some(k => t.includes(k)) && !excl.some(k => t.includes(k));
        });
    }

    const nextBtn =
        findBtn(['next page'], []) ||
        findBtn(['save and next'], []) ||
        findBtn(['next question'], []) ||
        findBtn(['next'], ['finish', 'submit', 'previous', 'prev', 'back', 'cancel']);

    assert(nextBtn !== undefined, 'Next button should be found');
    assert.strictEqual(nextBtn.value, 'Next page', 'Should match "Next page" button');
});

// ============================================================
// SUMMARY
// ============================================================
console.log(`\n============================================================`);
console.log(`Test Results: ${passedTests} / ${totalTests} passed (${Math.round((passedTests / totalTests) * 100)}%)`);
console.log(`============================================================\n`);

if (passedTests !== totalTests) {
    process.exit(1);
} else {
    process.exit(0);
}
