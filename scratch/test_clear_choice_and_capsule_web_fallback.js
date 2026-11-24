/**
 * Comprehensive Test Suite for:
 * 1. Moodle "Clear my choice" option filtering in extractPageQuestions
 * 2. Capsule fallback to Web Search and AI model without negative prompt injection
 * 3. Query normalization for "how is this current president of inda" -> India
 * 4. Authoritative verification for India President
 */

const assert = require('assert');

// Mock browser globals for utils.js
global.chrome = {
    runtime: {
        id: 'test-ext-id',
        getManifest: () => ({ version: '2.19.11' }),
        sendMessage: () => {},
        onMessage: { addListener: () => {} }
    },
    storage: {
        local: {
            get: (k, cb) => cb ? cb({}) : Promise.resolve({}),
            set: (v, cb) => cb ? cb() : Promise.resolve({})
        }
    }
};

global.window = global;
global.document = {
    createElement: () => ({ querySelectorAll: () => [], querySelector: () => null })
};

const utils = require('../utils.js');

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`[PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`[FAIL] ${name}:`, err.stack || err.message);
    }
}

// ── Test 1: Capsule retrieval with insufficient evidence returns empty context (no negative injection) ──
runTest('Capsule retrieval on unrelated content returns empty context and hasSufficientEvidence: false', () => {
    const capsules = [{
        id: 'cap1',
        name: 'Math Lecture Notes',
        chunks: [
            { text: 'Calculus derivatives of polynomials and integration by parts.', heading: 'Calculus 101' },
            { text: 'Linear algebra matrices eigenvalues and eigenvectors.', heading: 'Linear Algebra' }
        ]
    }];

    const result = utils.retrieveCapsuleContext('how is this current president of inda', capsules);
    assert.strictEqual(result.hasSufficientEvidence, false, 'Evidence should be insufficient');
    assert.strictEqual(result.context, '', 'Context MUST be empty string so it does not poison AI model or web fallback');
    assert.ok(!result.context.includes("I couldn't find enough information"), 'Must NOT contain canned failure instruction');
});

// ── Test 2: Moodle "Clear my choice" filtering in extractPageQuestions ──
runTest('extractPageQuestions filters out 5th option "Clear my choice" on Moodle quiz pages', () => {
    const inputs = [
        {
            tagName: 'INPUT', type: 'radio', name: 'q1', id: 'q1_a', value: '0',
            getAttribute: k => null,
            closest: s => null,
            parentElement: { innerText: 'a. If it has no real number values', getBoundingClientRect: () => ({ width: 200, height: 20 }) },
            getBoundingClientRect: () => ({ width: 15, height: 15 })
        },
        {
            tagName: 'INPUT', type: 'radio', name: 'q1', id: 'q1_b', value: '1',
            getAttribute: k => null,
            closest: s => null,
            parentElement: { innerText: 'b. If it is differentiable at every point in the interval', getBoundingClientRect: () => ({ width: 200, height: 20 }) },
            getBoundingClientRect: () => ({ width: 15, height: 15 })
        },
        {
            tagName: 'INPUT', type: 'radio', name: 'q1', id: 'q1_c', value: '2',
            getAttribute: k => null,
            closest: s => null,
            parentElement: { innerText: 'c. If it can be graphed without lifting the pencil', getBoundingClientRect: () => ({ width: 200, height: 20 }) },
            getBoundingClientRect: () => ({ width: 15, height: 15 })
        },
        {
            tagName: 'INPUT', type: 'radio', name: 'q1', id: 'q1_d', value: '3',
            getAttribute: k => null,
            closest: s => null,
            parentElement: { innerText: 'd. If it is a straight line', getBoundingClientRect: () => ({ width: 200, height: 20 }) },
            getBoundingClientRect: () => ({ width: 15, height: 15 })
        },
        // 5th LMS control: Clear my choice
        {
            tagName: 'INPUT', type: 'radio', name: 'q1', id: 'q1_clearchoice', value: '-1',
            className: 'clearchoice',
            getAttribute: k => null,
            closest: s => (s.includes('clearchoice') ? { className: 'clearchoice' } : null),
            parentElement: { innerText: 'Clear my choice', className: 'clearchoice', getBoundingClientRect: () => ({ width: 200, height: 20 }) },
            getBoundingClientRect: () => ({ width: 15, height: 15 })
        }
    ];

    const questionContainer = {
        tagName: 'DIV',
        className: 'que multichoice notyetanswered',
        getAttribute: k => null,
        getBoundingClientRect: () => ({ width: 800, height: 300 }),
        closest: s => null,
        contains: () => false,
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

    const doc = {
        title: '06 Unit : Practice Multiple Choice Questions (MCQs)',
        readyState: 'complete',
        body: { innerText: '', querySelectorAll: () => [] },
        querySelector: sel => null,
        querySelectorAll: sel => {
            if (sel.includes('.que')) return [questionContainer];
            if (sel.includes('input')) return inputs;
            return [];
        }
    };

    const extracted = utils.extractPageQuestions(doc, '');
    assert.strictEqual(extracted.detectedQuestions.length, 1, 'Should find 1 question');
    const q = extracted.detectedQuestions[0];
    assert.strictEqual(q.options.length, 4, 'Should extract EXACTLY 4 options, ignoring Clear my choice');
    assert.deepStrictEqual(q.options.map(o => o.letter), ['A', 'B', 'C', 'D'], 'Options must be letters A, B, C, D');
    assert.ok(!q.options.some(o => o.text.toLowerCase().includes('clear my choice')), '"Clear my choice" must NOT be an extracted option');
});

// ── Test 3: buildSearchQuery query normalization and typo tolerance ──
runTest('buildSearchQuery handles typo "how is this current president of inda" -> India', () => {
    const q1 = 'how is this current president of inda';
    const query1 = utils.buildSearchQuery(q1).toLowerCase();
    assert.ok(query1.includes('current') && query1.includes('president of india') && query1.includes('official'), `Query 1 should search president of India, got: ${query1}`);

    const q2 = 'Who is the current President of India?';
    const query2 = utils.buildSearchQuery(q2).toLowerCase();
    assert.ok(query2.includes('current') && query2.includes('president of india'), `Query 2 should search president of India, got: ${query2}`);

    const q3 = 'current president of india';
    const query3 = utils.buildSearchQuery(q3).toLowerCase();
    assert.ok(query3.includes('current') && query3.includes('president of india'), `Query 3 should search president of India, got: ${query3}`);
});

// ── Test 4: calculateResultRelevance rejects electric current & banking for "inda" queries ──
runTest('calculateResultRelevance disqualifies physics & banking pages even with typo "inda"', () => {
    const userQuery = 'how is this current president of inda';

    const physicsResult = {
        title: 'Electric Current - Definition, Unit, Formula',
        snippet: 'Electric current is the flow of electric charge carried by electrons in an electrical circuit measured in amperes.',
        url: 'https://en.wikipedia.org/wiki/Electric_current'
    };
    const scorePhysics = utils.calculateResultRelevance(physicsResult, userQuery);
    assert.strictEqual(scorePhysics, 0, 'Electric current must be completely disqualified (score 0)');

    const bankingResult = {
        title: 'Open Current Account Online | Best Banking Rates',
        snippet: 'Apply for a current account with high interest and zero debit card balance in commercial banking.',
        url: 'https://bank.example.com/current-account'
    };
    const scoreBanking = utils.calculateResultRelevance(bankingResult, userQuery);
    assert.strictEqual(scoreBanking, 0, 'Banking current account must be completely disqualified (score 0)');

    const officialPresidentResult = {
        title: 'President of India | Smt Droupadi Murmu Official Website',
        snippet: 'Official website of the President of India, Rashtrapati Bhavan, Smt. Droupadi Murmu, 15th President.',
        url: 'https://presidentofindia.gov.in'
    };
    const scorePresident = utils.calculateResultRelevance(officialPresidentResult, userQuery);
    assert.ok(scorePresident >= 75, `Official President page should score high (got ${scorePresident})`);
});

// ── Test 5: verifyAnswerAgainstAuthoritativeSources with typo "inda" ──
runTest('verifyAnswerAgainstAuthoritativeSources corrects mistaken Narendra Modi response for President of India', () => {
    const query = 'how is this current president of inda';
    const wrongAnswer = 'Narendra Modi is the current president of India.';
    const verification = utils.verifyAnswerAgainstAuthoritativeSources(wrongAnswer, query, []);
    assert.strictEqual(verification.corrected, true, 'Must detect and correct confusion');
    assert.ok(verification.answer.includes('Droupadi Murmu'), 'Answer must name Smt. Droupadi Murmu');
    assert.ok(verification.answer.includes('Prime Minister'), 'Answer must note Narendra Modi is the Prime Minister');
});

console.log(`\n========================================`);
console.log(`Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
console.log(`========================================`);

if (passedTests !== totalTests) {
    process.exit(1);
}
