/**
 * Verification test for Collapsible Web Sources Accordion & Default Hide Mode
 */

const assert = require('assert');

// Mock browser environment
global.chrome = {
    runtime: {
        id: 'test-id',
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
        console.error(`[FAIL] ${name}:`, err.message);
    }
}

// ── Test 1: User screenshot input produces collapsed interactive details accordion ──
runTest('parseMarkdown parses noora-sources-accordion and removes "open" attribute (default hide mode)', () => {
    const rawInput = `The current president of India is Droupadi Murmu.

<details class="noora-sources-accordion" open>
<summary class="noora-sources-summary">
🌐 <strong>Web Sources & Citations</strong> (4 retrieved)</summary>
<div class="noora-sources-body">
1. Home | President of India —
https://www.presidentofindia.gov.in
Smt. Droupadi Murmu was sworn in as the 15th President of India on 25 July, 2022. Previously, she was the Governor of Jharkhand ...Read more...
1. President of India - Wikipedia —
https://en.wikipedia.org
Droupadi Murmu is the 15th and current ...
</div>
</details>`;

    const html = utils.parseMarkdown(rawInput);

    // 1. Must NOT escape tags to &lt;details&gt;
    assert.ok(!html.includes('&lt;details'), 'Must NOT escape details tag into raw text');
    assert.ok(!html.includes('&lt;summary'), 'Must NOT escape summary tag into raw text');

    // 2. Must render real interactive <details> tag
    assert.ok(html.includes('<details class="noora-sources-accordion"'), 'Must render real <details> element');
    assert.ok(html.includes('<summary class="noora-sources-summary">'), 'Must render real <summary> element');

    // 3. Must STRIP "open" attribute to enforce default hide mode
    assert.ok(!html.includes('<details class="noora-sources-accordion" open>'), 'Must NOT contain "open" attribute');
    assert.ok(!/<details\b[^>]*\bopen\b/i.test(html), 'Must NOT have open attribute anywhere on details tag');

    // 4. Must convert raw URLs to clickable links
    assert.ok(html.includes('<a href="https://www.presidentofindia.gov.in"'), 'Must convert plain URL to clickable link');
    assert.ok(html.includes('<a href="https://en.wikipedia.org"'), 'Must convert wikipedia URL to clickable link');
});

// ── Test 2: Unclosed <details> block during streaming is handled safely and collapsed ──
runTest('parseMarkdown handles unclosed details block during streaming and keeps it collapsed', () => {
    const streamingInput = `Thinking about the leader...

<details class="noora-sources-accordion" open>
<summary class="noora-sources-summary">🌐 <strong>Web Sources & Citations</strong> (1 retrieved)</summary>
<div class="noora-sources-body">
1. President of India — https://presidentofindia.gov.in`;

    const html = utils.parseMarkdown(streamingInput);
    assert.ok(html.includes('<details class="noora-sources-accordion"'), 'Should safely wrap unclosed streaming details');
    assert.ok(!/<details\b[^>]*\bopen\b/i.test(html), 'Should not have open attribute');
    assert.ok(html.includes('</details>'), 'Should automatically close the details block');
});

// ── Test 3: Standard markdown text without details still renders correctly ──
runTest('parseMarkdown continues to render standard markdown, code blocks, and headings cleanly', () => {
    const md = `# Title\n\n**Bold text** and *italic*\n\n\`\`\`javascript\nconst x = 10;\n\`\`\``;
    const html = utils.parseMarkdown(md);
    assert.ok(html.includes('<h1>Title</h1>'), 'Heading should render');
    assert.ok(html.includes('<strong>Bold text</strong>'), 'Bold should render');
    assert.ok(html.includes('class="code-block-wrapper"'), 'Code block should render');
});

console.log(`\n========================================`);
console.log(`Results: ${passedTests}/${totalTests} tests passed (${Math.round((passedTests/totalTests)*100)}%)`);
console.log(`========================================`);

if (passedTests !== totalTests) {
    process.exit(1);
}
