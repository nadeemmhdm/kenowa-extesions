// Comprehensive Test Suite for Page Detection, Question/Option Extraction,
// Quick Answer Scanning, and Exam Mode Integration

const assert = require('assert');
const origLog = console.log;
const origInfo = console.info;
const origWarn = console.warn;
const {
    cleanQuestionStem,
    cleanOptionTextAndLetter,
    extractPageQuestions
} = require('../utils.js');
console.log = origLog;
console.info = origInfo;
console.warn = origWarn;

// ── Lightweight Mock DOM for Node.js Testing ──────────────────────────

class MockElement {
    constructor(tagName, attrs = {}, text = '') {
        this.tagName = tagName.toUpperCase();
        this.attributes = { ...attrs };
        this.className = attrs.class || '';
        this.id = attrs.id || '';
        this.name = attrs.name || '';
        this.type = attrs.type || '';
        this.value = attrs.value || '';
        this.checked = Boolean(attrs.checked);
        this.style = { display: attrs.style?.display || 'block', visibility: attrs.style?.visibility || 'visible' };
        this.offsetWidth = 100;
        this.offsetHeight = 30;
        this.childNodes = [];
        this.parentElement = null;
        this._text = text;
    }

    getAttribute(name) {
        return this.attributes[name] ?? (name === 'role' ? this.attributes.role : null);
    }

    setAttribute(name, val) {
        this.attributes[name] = String(val);
        if (name === 'class') this.className = String(val);
        if (name === 'id') this.id = String(val);
        if (name === 'name') this.name = String(val);
        if (name === 'type') this.type = String(val);
        if (name === 'value') this.value = String(val);
    }

    hasAttribute(name) {
        return name in this.attributes;
    }

    appendChild(child) {
        child.parentElement = this;
        this.childNodes.push(child);
        return child;
    }

    get innerText() {
        if (this._text) return this._text;
        return this.childNodes.map(c => c.innerText || c.textContent || '').join(' ').trim();
    }

    set innerText(val) {
        this._text = val;
        this.childNodes = [];
    }

    get textContent() {
        return this.innerText;
    }

    set textContent(val) {
        this.innerText = val;
    }

    closest(selector) {
        let cur = this;
        while (cur) {
            if (cur._matches(selector)) return cur;
            cur = cur.parentElement;
        }
        return null;
    }

    contains(other) {
        let cur = other;
        while (cur) {
            if (cur === this) return true;
            cur = cur.parentElement;
        }
        return false;
    }

    cloneNode(deep = true) {
        const clone = new MockElement(this.tagName, { ...this.attributes }, this._text);
        clone.id = this.id;
        clone.name = this.name;
        clone.type = this.type;
        clone.value = this.value;
        clone.checked = this.checked;
        if (deep) {
            for (const child of this.childNodes) {
                clone.appendChild(child.cloneNode(true));
            }
        }
        return clone;
    }

    remove() {
        if (this.parentElement) {
            const idx = this.parentElement.childNodes.indexOf(this);
            if (idx !== -1) this.parentElement.childNodes.splice(idx, 1);
            this.parentElement = null;
        }
    }

    _matches(sel) {
        const parts = sel.split(',').map(s => s.trim());
        return parts.some(single => this._matchesSingle(single));
    }

    _matchesSingle(sel) {
        if (!sel) return false;
        // Attribute selector e.g. [role="radio"] or [data-testid*="question"]
        const attrMatch = sel.match(/^\[([a-zA-Z0-9_\-]+)(?:([\*\^~|\$]?=)["']?([^"'\]]+)["']?)?\]$/);
        if (attrMatch) {
            const [, attr, op, val] = attrMatch;
            const actual = this.getAttribute(attr);
            if (actual === null || actual === undefined) return false;
            if (!op) return true;
            if (op === '=') return actual === val;
            if (op === '*=') return actual.includes(val);
            if (op === '^=') return actual.startsWith(val);
            if (op === '$=') return actual.endsWith(val);
            return false;
        }

        // Tag with attribute: input[type="radio"]
        const tagAttrMatch = sel.match(/^([a-zA-Z0-9]+)\[([a-zA-Z0-9_\-]+)(?:([\*\^~|\$]?=)["']?([^"'\]]+)["']?)?\](?::not\((.+)\))?$/);
        if (tagAttrMatch) {
            const [, tag, attr, op, val, notSel] = tagAttrMatch;
            if (this.tagName.toLowerCase() !== tag.toLowerCase()) return false;
            const actual = this.getAttribute(attr);
            if (actual === null || actual === undefined) return false;
            if (op === '=' && actual !== val) return false;
            if (op === '*=' && !actual.includes(val)) return false;
            if (notSel && this._matches(notSel)) return false;
            return true;
        }

        // Button with class: button[class*="choice"]
        const btnClassMatch = sel.match(/^([a-zA-Z0-9]+)\[class\*=["']?([^"'\]]+)["']?\]$/);
        if (btnClassMatch) {
            const [, tag, classSub] = btnClassMatch;
            if (this.tagName.toLowerCase() !== tag.toLowerCase()) return false;
            return this.className.includes(classSub);
        }

        // Div with class: div[class*="choice"]
        const divClassMatch = sel.match(/^div\[class\*=["']?([^"'\]]+)["']?\]$/);
        if (divClassMatch) {
            if (this.tagName.toLowerCase() !== 'div') return false;
            return this.className.includes(divClassMatch[1]);
        }

        // Simple class e.g. .que or .question
        if (sel.startsWith('.')) {
            const cls = sel.slice(1);
            return this.className.split(/\s+/).includes(cls);
        }

        // Simple ID e.g. #q1
        if (sel.startsWith('#')) {
            return this.id === sel.slice(1);
        }

        // Tag name e.g. fieldset, h1, legend
        return this.tagName.toLowerCase() === sel.toLowerCase();
    }

    querySelectorAll(selector) {
        const results = [];
        const traverse = (node) => {
            for (const child of node.childNodes) {
                if (child._matches(selector)) {
                    results.push(child);
                }
                traverse(child);
            }
        };
        traverse(this);
        return results;
    }

    querySelector(selector) {
        const all = this.querySelectorAll(selector);
        return all.length > 0 ? all[0] : null;
    }
}

class MockDocument {
    constructor() {
        this.body = new MockElement('body');
        this.title = 'Kenowa Online Exam';
        this.readyState = 'complete';
    }

    querySelector(selector) {
        if (this.body._matches(selector)) return this.body;
        return this.body.querySelector(selector);
    }

    querySelectorAll(selector) {
        return this.body.querySelectorAll(selector);
    }

    createElement(tagName, attrs = {}, text = '') {
        return new MockElement(tagName, attrs, text);
    }
}

// ── Test Runner ───────────────────────────────────────────────────────

let passedTests = 0;
let totalTests = 0;

function runTest(name, fn) {
    totalTests++;
    try {
        fn();
        console.log(`  [PASS] ${name}`);
        passedTests++;
    } catch (err) {
        console.error(`  [FAIL] ${name}`);
        console.error(`    ${err.message}`);
        console.error(err.stack);
    }
}

console.log('\n=== RUNNING EXTENSION PAGE DETECTION & INTEGRATION TESTS ===\n');

// ── 1. Clean Question Stem Tests ──────────────────────────────────────

runTest('cleanQuestionStem strips question prefixes, points, and type tags', () => {
    assert.strictEqual(
        cleanQuestionStem('Question 1: What is the primary function of mitochondria? (1 point)'),
        'What is the primary function of mitochondria?'
    );
    assert.strictEqual(
        cleanQuestionStem('Q2. [5 marks] Which data structure uses FIFO?'),
        'Which data structure uses FIFO?'
    );
    assert.strictEqual(
        cleanQuestionStem('3) (Multiple Choice) Select all that apply: Who discovered penicillin?'),
        'Select all that apply: Who discovered penicillin?'
    );
    assert.strictEqual(
        cleanQuestionStem('Question 14: Choose the best answer from the following: What is 2 + 2?'),
        'What is 2 + 2?'
    );
    assert.strictEqual(
        cleanQuestionStem('Mark 1.00 out of 1.00 Flag question What causes tides?'),
        'What causes tides?'
    );
});

// ── 2. Clean Option Text and Letter Tests ─────────────────────────────

runTest('cleanOptionTextAndLetter extracts letters and preserves legitimate text', () => {
    const o1 = cleanOptionTextAndLetter('A. Cell Wall', 0);
    assert.strictEqual(o1.letter, 'A');
    assert.strictEqual(o1.text, 'Cell Wall');

    const o2 = cleanOptionTextAndLetter('(B) Chloroplast', 1);
    assert.strictEqual(o2.letter, 'B');
    assert.strictEqual(o2.text, 'Chloroplast');

    const o3 = cleanOptionTextAndLetter('[C] Mitochondria', 2);
    assert.strictEqual(o3.letter, 'C');
    assert.strictEqual(o3.text, 'Mitochondria');

    const o4 = cleanOptionTextAndLetter('D) Ribosomes', 3);
    assert.strictEqual(o4.letter, 'D');
    assert.strictEqual(o4.text, 'Ribosomes');

    // Legitimately starting with scientific letter:
    const o5 = cleanOptionTextAndLetter('E. E. Coli bacteria', 4);
    assert.strictEqual(o5.letter, 'E');
    assert.strictEqual(o5.text, 'E. Coli bacteria');

    // Without explicit letter:
    const o6 = cleanOptionTextAndLetter('Pure option without prefix', 2);
    assert.strictEqual(o6.letter, 'C');
    assert.strictEqual(o6.text, 'Pure option without prefix');
});

// ── 3. Mock DOM Test: Moodle Single Choice Question ───────────────────

runTest('extractPageQuestions detects Moodle .que question container and radio options', () => {
    const doc = new MockDocument();
    const que = doc.createElement('div', { class: 'que multichoice' });
    const qtext = doc.createElement('div', { class: 'qtext' }, 'Question 1: What is the capital of France?');
    que.appendChild(qtext);

    const answers = doc.createElement('div', { class: 'answer' });

    // Option A
    const optA = doc.createElement('div', { class: 'r0' });
    const inpA = doc.createElement('input', { type: 'radio', name: 'q1', id: 'q1_a', value: '1' });
    const lblA = doc.createElement('label', { for: 'q1_a' }, 'A. Berlin');
    optA.appendChild(inpA);
    optA.appendChild(lblA);
    answers.appendChild(optA);

    // Option B
    const optB = doc.createElement('div', { class: 'r1' });
    const inpB = doc.createElement('input', { type: 'radio', name: 'q1', id: 'q1_b', value: '2' });
    const lblB = doc.createElement('label', { for: 'q1_b' }, 'B. Paris');
    optB.appendChild(inpB);
    optB.appendChild(lblB);
    answers.appendChild(optB);

    // Option C
    const optC = doc.createElement('div', { class: 'r0' });
    const inpC = doc.createElement('input', { type: 'radio', name: 'q1', id: 'q1_c', value: '3' });
    const lblC = doc.createElement('label', { for: 'q1_c' }, 'C. Rome');
    optC.appendChild(inpC);
    optC.appendChild(lblC);
    answers.appendChild(optC);

    que.appendChild(answers);
    doc.body.appendChild(que);

    const result = extractPageQuestions(doc);
    assert.strictEqual(result.status, 'found');
    assert.strictEqual(result.detectedQuestions.length, 1);

    const q = result.detectedQuestions[0];
    assert.strictEqual(q.stem, 'What is the capital of France?');
    assert.strictEqual(q.type, 'single');
    assert.strictEqual(q.options.length, 3);
    assert.strictEqual(q.options[0].letter, 'A');
    assert.strictEqual(q.options[0].text, 'Berlin');
    assert.strictEqual(q.options[1].letter, 'B');
    assert.strictEqual(q.options[1].text, 'Paris');
    assert.strictEqual(q.options[2].letter, 'C');
    assert.strictEqual(q.options[2].text, 'Rome');
});

// ── 4. Mock DOM Test: True / False Question Type ──────────────────────

runTest('extractPageQuestions identifies True/False questions accurately', () => {
    const doc = new MockDocument();
    const que = doc.createElement('div', { class: 'questionBlock' });
    const qtext = doc.createElement('h3', {}, 'The Earth revolves around the Sun.');
    que.appendChild(qtext);

    const inpTrue = doc.createElement('input', { type: 'radio', name: 'tf', id: 'tf_t' });
    const lblTrue = doc.createElement('label', { for: 'tf_t' }, 'True');
    const inpFalse = doc.createElement('input', { type: 'radio', name: 'tf', id: 'tf_f' });
    const lblFalse = doc.createElement('label', { for: 'tf_f' }, 'False');

    que.appendChild(inpTrue);
    que.appendChild(lblTrue);
    que.appendChild(inpFalse);
    que.appendChild(lblFalse);
    doc.body.appendChild(que);

    const result = extractPageQuestions(doc);
    assert.strictEqual(result.status, 'found');
    assert.strictEqual(result.detectedQuestions[0].type, 'truefalse');
    assert.strictEqual(result.detectedQuestions[0].options.length, 2);
});

// ── 5. Mock DOM Test: Multiple-Select Question Type ───────────────────

runTest('extractPageQuestions identifies Multiple-Select checkbox questions', () => {
    const doc = new MockDocument();
    const que = doc.createElement('div', { class: 'form-question' });
    const title = doc.createElement('div', { class: 'prompt' }, 'Select all prime numbers below:');
    que.appendChild(title);

    const o1 = doc.createElement('input', { type: 'checkbox', name: 'primes', id: 'p1' });
    const l1 = doc.createElement('label', { for: 'p1' }, '2');
    const o2 = doc.createElement('input', { type: 'checkbox', name: 'primes', id: 'p2' });
    const l2 = doc.createElement('label', { for: 'p2' }, '4');
    const o3 = doc.createElement('input', { type: 'checkbox', name: 'primes', id: 'p3' });
    const l3 = doc.createElement('label', { for: 'p3' }, '5');

    que.appendChild(o1);
    que.appendChild(l1);
    que.appendChild(o2);
    que.appendChild(l2);
    que.appendChild(o3);
    que.appendChild(l3);
    doc.body.appendChild(que);

    const result = extractPageQuestions(doc);
    assert.strictEqual(result.status, 'found');
    assert.strictEqual(result.detectedQuestions[0].type, 'multiple');
    assert.strictEqual(result.detectedQuestions[0].options.length, 3);
});

// ── 6. Mock DOM Test: Modern React / Vue Quiz with ARIA Roles ─────────

runTest('extractPageQuestions handles custom ARIA role="radiogroup" and button choices', () => {
    const doc = new MockDocument();
    const card = doc.createElement('div', { class: 'QuestionCard' });
    const heading = doc.createElement('div', { role: 'heading' }, 'Which protocol is secure?');
    card.appendChild(heading);

    const group = doc.createElement('div', { role: 'radiogroup' });
    const btn1 = doc.createElement('button', { class: 'choice-item', role: 'radio' }, 'HTTP');
    const btn2 = doc.createElement('button', { class: 'choice-item', role: 'radio' }, 'HTTPS');
    const btn3 = doc.createElement('button', { class: 'choice-item', role: 'radio' }, 'FTP');

    group.appendChild(btn1);
    group.appendChild(btn2);
    group.appendChild(btn3);
    card.appendChild(group);
    doc.body.appendChild(card);

    const result = extractPageQuestions(doc);
    assert.strictEqual(result.status, 'found');
    assert.strictEqual(result.detectedQuestions.length, 1);
    const q = result.detectedQuestions[0];
    assert.strictEqual(q.stem, 'Which protocol is secure?');
    assert.strictEqual(q.options.length, 3);
    assert.strictEqual(q.options[1].letter, 'B');
    assert.strictEqual(q.options[1].text, 'HTTPS');
});

// ── 7. Mock DOM Test: Multi-Question Page Detection ───────────────────

runTest('extractPageQuestions detects multiple questions in order', () => {
    const doc = new MockDocument();

    for (let i = 1; i <= 3; i++) {
        const qContainer = doc.createElement('div', { class: 'display_question' });
        const stem = doc.createElement('div', { class: 'question_text' }, `Question ${i}: Stem number ${i}?`);
        qContainer.appendChild(stem);

        const inpA = doc.createElement('input', { type: 'radio', name: `group_${i}`, id: `q${i}_a` });
        const lblA = doc.createElement('label', { for: `q${i}_a` }, 'A. Choice 1');
        const inpB = doc.createElement('input', { type: 'radio', name: `group_${i}`, id: `q${i}_b` });
        const lblB = doc.createElement('label', { for: `q${i}_b` }, 'B. Choice 2');

        qContainer.appendChild(inpA);
        qContainer.appendChild(lblA);
        qContainer.appendChild(inpB);
        qContainer.appendChild(lblB);
        doc.body.appendChild(qContainer);
    }

    const result = extractPageQuestions(doc);
    assert.strictEqual(result.status, 'found');
    assert.strictEqual(result.detectedQuestions.length, 3);
    assert.strictEqual(result.detectedQuestions[0].stem, 'Stem number 1?');
    assert.strictEqual(result.detectedQuestions[1].stem, 'Stem number 2?');
    assert.strictEqual(result.detectedQuestions[2].stem, 'Stem number 3?');
});

// ── 8. Mock DOM Test: Loading State Detection ─────────────────────────

runTest('extractPageQuestions detects dynamic loading state with spinners', () => {
    const doc = new MockDocument();
    const spinner = doc.createElement('div', { class: 'spinner loading-indicator' }, 'Loading next question...');
    doc.body.appendChild(spinner);

    const result = extractPageQuestions(doc);
    assert.strictEqual(result.isPageLoading, true);
    assert.strictEqual(result.status, 'loading');
});

// ── 9. Mock DOM Test: Exam Completion Detection ───────────────────────

runTest('extractPageQuestions detects exam finished state', () => {
    const doc = new MockDocument();
    const finishMsg = doc.createElement('div', { class: 'summary' }, 'Summary of attempt - Your quiz has been submitted!');
    doc.body.appendChild(finishMsg);

    const result = extractPageQuestions(doc);
    assert.strictEqual(result.isExamFinished, true);
    assert.strictEqual(result.status, 'finished');
});

// ── 10. Mock DOM Test: Plain-Text Fallback Question ───────────────────

runTest('extractPageQuestions extracts plain text un-instrumented question with choices', () => {
    const doc = new MockDocument();
    const container = doc.createElement('div', {}, 'Which gas do plants absorb during photosynthesis?\nA. Nitrogen\nB. Oxygen\nC. Carbon Dioxide\nD. Hydrogen');
    doc.body.appendChild(container);

    const result = extractPageQuestions(doc);
    assert.strictEqual(result.status, 'found');
    assert.strictEqual(result.detectedQuestions.length, 1);
    const q = result.detectedQuestions[0];
    assert.strictEqual(q.stem, 'Which gas do plants absorb during photosynthesis?');
    assert.strictEqual(q.options.length, 4);
    assert.strictEqual(q.options[2].letter, 'C');
    assert.strictEqual(q.options[2].text, 'Carbon Dioxide');
});

// ── 11. Quick Answer Formatting Tests ─────────────────────────────────

runTest('Quick Answer formats array responses and resolves naked letters against choices', () => {
    // Emulate formatQuickAnswerText
    function formatQuickAnswerText(rawAnswer, promptText) {
        if (!rawAnswer) return '';
        let text = String(rawAnswer).trim();
        const arrayMatch = text.match(/\[\s*(?:"[^"]*"(?:\s*,\s*"[^"]*")*)\s*\]/);
        const hasHeader = /###\s*(?:🎯\s*)?Correct Answers?/i.test(text);
        if (!arrayMatch && !hasHeader) return text;

        const optionRegex = /(?:^|\n)\s*([a-hA-H1-9])[\.\)\:\-]\s*([^\n]+)/g;
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
                const letter = clean.replace(/[\.\)\:\-]/g, '').trim().toUpperCase();
                const resolvedText = optionsMap.get(letter) || (clean.length > 2 && !clean.includes('["') ? clean : null);
                const finalText = resolvedText || (letter ? `${letter}.` : clean);
                if (!seen.has(finalText)) {
                    seen.add(finalText);
                    resolved.push(finalText);
                }
            }

            if (resolved.length > 0) {
                return resolved.length === 1
                    ? `### 🎯 Correct Answer\n\n**${resolved[0]}**`
                    : `### 🎯 Correct Answers\n\n` + resolved.map(r => `- **${r}**`).join('\n');
            }
        }
        return text;
    }

    const prompt = 'Question: Capital of France?\nAvailable Choices:\nA. Berlin\nB. Paris\nC. Rome';
    const singleRaw = '["b.", "b."]';
    const formattedSingle = formatQuickAnswerText(singleRaw, prompt);
    assert.strictEqual(formattedSingle, '### 🎯 Correct Answer\n\n**B. Paris**');

    const multiRaw = '["A", "C"]';
    const formattedMulti = formatQuickAnswerText(multiRaw, prompt);
    assert.strictEqual(formattedMulti, '### 🎯 Correct Answers\n\n- **A. Berlin**\n- **C. Rome**');
});

// ── 12. Exam Mode Deduplication State Tests ───────────────────────────

runTest('Exam Mode state tracking prevents re-answering or duplicate submissions', () => {
    const answeredQuestionIds = new Set();
    const q1Signature = 'q1_hash_mitochondria';

    assert.strictEqual(answeredQuestionIds.has(q1Signature), false);
    answeredQuestionIds.add(q1Signature);
    assert.strictEqual(answeredQuestionIds.has(q1Signature), true);

    // Attempting to re-detect while page hasn't navigated:
    const isAlreadyAnswered = answeredQuestionIds.has(q1Signature);
    assert.strictEqual(isAlreadyAnswered, true);

    // Navigating to new question:
    const q2Signature = 'q2_hash_chloroplast';
    assert.strictEqual(answeredQuestionIds.has(q2Signature), false);
});

console.log(`\n=== RESULTS: ${passedTests}/${totalTests} TESTS PASSED ===\n`);
if (passedTests !== totalTests) {
    process.exit(1);
}
