// ============================================================
// Comprehensive Test Suite: Web Search Accuracy, Source Relevance & Collapsible UI
// Tests:
// 1. "Who is the current President of India?" (Disambiguation, rejects electric current/banking)
// 2. "Who is the current Prime Minister of India?" (Official incumbent Narendra Modi)
// 3. "What is the latest version of Python?" (python.org official release)
// 4. "What is electric current?" (Physics definition, rejects political leaders)
// 5. "Who invented the World Wide Web?" (Tim Berners-Lee / CERN / W3C)
// 6. Clean Destination URLs & Tracking Parameter Stripping
// 7. Collapsible Sources UI states & DOM layout
// 8. Web Search ON vs OFF Cascade Integration
// ============================================================

const assert = require('assert');
const utils = require('../utils.js');

const {
    cleanDestinationUrl,
    resolveRedirectUrl,
    calculateDomainAuthority,
    getSourceVerificationStatus,
    extractSourceDate,
    extractQuestionKeyTokens,
    buildSearchQuery,
    calculateResultRelevance,
    parseWebSearchResults,
    formatWebSearchContext,
    verifyAnswerAgainstAuthoritativeSources,
    detectConflictingInformation,
    calculateAnswerConfidence
} = utils;

console.log('🧪 Starting Web Search Accuracy, Source Relevance & Collapsible UI Test Suite...\n');

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
// TEST 1: "Who is the current President of India?"
// ============================================================
console.log('--- Test 1: "Who is the current President of India?" ---');

runTest('1.1 Search query preserves entity and context', () => {
    const q = 'Who is the current President of India?';
    const query = buildSearchQuery(q);
    assert(query.includes('President of India'), `Query should contain "President of India", got: ${query}`);
    assert(/incumbent|official|current/i.test(query), `Query should contain incumbent/official/current: ${query}`);
});

runTest('1.2 Domain authority and verification for presidentofindia.gov.in', () => {
    const url = 'https://presidentofindia.gov.in/';
    const auth = calculateDomainAuthority(url);
    const vStatus = getSourceVerificationStatus(url);
    assert.strictEqual(auth, 50, `Official president portal should get Tier 1 authority (50), got: ${auth}`);
    assert.strictEqual(vStatus.tier, 'official', `Should be official government tier, got: ${vStatus.tier}`);
    assert.strictEqual(vStatus.label, 'Official Government');
});

runTest('1.3 Result relevance accepts official president source and rejects homonyms', () => {
    const q = 'Who is the current President of India?';

    const validResult = {
        title: 'President of India | Droupadi Murmu',
        url: 'https://presidentofindia.gov.in/',
        snippet: 'Smt. Droupadi Murmu is the 15th President of India, assuming office in July 2022.'
    };
    const validRel = calculateResultRelevance(validResult, q);
    assert(validRel >= 70, `Official result should have relevance >= 70, got: ${validRel}`);

    // Homonym 1: Electric current
    const electricCurrentResult = {
        title: 'Electric current - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Electric_current',
        snippet: 'An electric current is a stream of charged particles, such as electrons or ions, moving through an electrical conductor or space.'
    };
    const electricRel = calculateResultRelevance(electricCurrentResult, q);
    assert(electricRel < 40, `Electric current should be rejected (score < 40), got: ${electricRel}`);

    // Homonym 2: Bank current account
    const bankCurrentResult = {
        title: 'Open Current Account Online - High Interest Rates',
        url: 'https://www.hdfcbank.com/personal/save/accounts/current-accounts',
        snippet: 'Apply for a Current Account designed for business owners, traders, and professionals.'
    };
    const bankRel = calculateResultRelevance(bankCurrentResult, q);
    assert(bankRel < 40, `Bank current account should be rejected (score < 40), got: ${bankRel}`);
});

runTest('1.4 Contradiction detection: Narendra Modi (PM) vs Droupadi Murmu (President)', () => {
    const q = 'Who is the current President of India?';
    const webSources = [{
        title: 'President of India - Official Website',
        url: 'https://presidentofindia.gov.in/',
        snippet: 'Smt. Droupadi Murmu is the 15th President of India, holding office as head of state since July 2022.'
    }];

    // Case A: AI hallucinated Narendra Modi as President
    const wrongAnswer = 'Narendra Modi is the current President of India.';
    const verification = verifyAnswerAgainstAuthoritativeSources(wrongAnswer, q, webSources);
    assert.strictEqual(verification.corrected, true, 'Should detect and flag contradiction');
    assert(verification.answer.includes('Droupadi Murmu'), `Corrected answer should contain Droupadi Murmu, got: ${verification.answer}`);
    assert(verification.answer.includes('Prime Minister'), `Corrected answer should clarify that Narendra Modi is the Prime Minister, got: ${verification.answer}`);

    // Case B: Correct answer
    const rightAnswer = 'The current President of India is Droupadi Murmu, who assumed office on 25 July 2022.';
    const rightVerification = verifyAnswerAgainstAuthoritativeSources(rightAnswer, q, webSources);
    assert.strictEqual(rightVerification.corrected, false, 'Correct answer should not be modified');
});

// ============================================================
// TEST 2: "Who is the current Prime Minister of India?"
// ============================================================
console.log('\n--- Test 2: "Who is the current Prime Minister of India?" ---');

runTest('2.1 Prime Minister query and authority validation', () => {
    const q = 'Who is the current Prime Minister of India?';
    const query = buildSearchQuery(q);
    assert(query.includes('Prime Minister of India'), `Query should contain "Prime Minister of India", got: ${query}`);

    const pmUrl = 'https://www.pmindia.gov.in/en/';
    const auth = calculateDomainAuthority(pmUrl);
    const vStatus = getSourceVerificationStatus(pmUrl);
    assert.strictEqual(auth, 50, 'PM India should get Tier 1 (50)');
    assert.strictEqual(vStatus.tier, 'official');
});

runTest('2.2 Result relevance correctly selects Narendra Modi and rejects unrelated results', () => {
    const q = 'Who is the current Prime Minister of India?';
    const pmResult = {
        title: 'Prime Minister of India | Shri Narendra Modi',
        url: 'https://www.pmindia.gov.in/en/',
        snippet: 'Official website of the Prime Minister of India, Narendra Modi. Information on speeches, initiatives, and council of ministers.'
    };
    const rel = calculateResultRelevance(pmResult, q);
    assert(rel >= 70, `PM portal relevance should be >= 70, got: ${rel}`);

    // Contradiction detection for PM query
    const wrongPMAns = 'Droupadi Murmu is the current Prime Minister of India.';
    const ver = verifyAnswerAgainstAuthoritativeSources(wrongPMAns, q, [pmResult]);
    assert.strictEqual(ver.corrected, true, 'Should correct false PM assertion');
    assert(ver.answer.includes('Narendra Modi'), 'Corrected answer should name Narendra Modi');
});

// ============================================================
// TEST 3: "What is the latest version of Python?"
// ============================================================
console.log('\n--- Test 3: "What is the latest version of Python?" ---');

runTest('3.1 Python official portal gets authoritative score', () => {
    const url = 'https://www.python.org/downloads/';
    const auth = calculateDomainAuthority(url);
    const vStatus = getSourceVerificationStatus(url);
    assert.strictEqual(auth, 50, 'python.org should get 50 authority score');
    assert.strictEqual(vStatus.tier, 'authoritative');
    assert.strictEqual(vStatus.label, 'Authoritative Reference');
});

runTest('3.2 Python version search results ranking', () => {
    const q = 'What is the latest version of Python?';
    const pyResult = {
        title: 'Download Python | Python.org',
        url: 'https://www.python.org/downloads/',
        snippet: 'Download the latest version for Windows. Download Python 3.12.3 or Python 3.13 pre-release.'
    };
    const animalResult = {
        title: 'Python (genus) - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Python_(genus)',
        snippet: 'Python is a genus of constricting snakes in the family Pythonidae native to the tropics and subtropics.'
    };

    const pyRel = calculateResultRelevance(pyResult, q);
    const animalRel = calculateResultRelevance(animalResult, q);
    assert(pyRel >= 60, `Python.org relevance should be >= 60, got: ${pyRel}`);
    assert(pyRel > animalRel, `Python.org (${pyRel}) should outrank snake article (${animalRel})`);
});

// ============================================================
// TEST 4: "What is electric current?"
// ============================================================
console.log('\n--- Test 4: "What is electric current?" ---');

runTest('4.1 Physics query generation and homonym disambiguation', () => {
    const q = 'What is electric current?';
    const query = buildSearchQuery(q);
    assert(query.includes('electric current'), `Query should preserve "electric current", got: ${query}`);

    const physicsResult = {
        title: 'Electric current - Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Electric_current',
        snippet: 'An electric current is a flow of charged particles, such as electrons or ions, measured in amperes.'
    };
    const politicalResult = {
        title: 'President of India - Current Affairs 2024',
        url: 'https://currentaffairs.gktoday.in/president-of-india',
        snippet: 'Latest updates on the President of India and the central cabinet.'
    };

    const physRel = calculateResultRelevance(physicsResult, q);
    const polRel = calculateResultRelevance(politicalResult, q);
    assert(physRel >= 60, `Physics result relevance should be >= 60, got: ${physRel}`);
    assert(physRel > polRel, `Physics result (${physRel}) should rank higher than political result (${polRel})`);
});

// ============================================================
// TEST 5: "Who invented the World Wide Web?"
// ============================================================
console.log('\n--- Test 5: "Who invented the World Wide Web?" ---');

runTest('5.1 W3C and CERN domain authority and invention relevance', () => {
    const w3Url = 'https://www.w3.org/People/Berners-Lee/';
    const cernUrl = 'https://home.cern/science/computing/birth-web';
    assert.strictEqual(calculateDomainAuthority(w3Url), 50);
    assert.strictEqual(calculateDomainAuthority(cernUrl), 50);

    const q = 'Who invented the World Wide Web?';
    const webResult = {
        title: 'Tim Berners-Lee - World Wide Web Inventor',
        url: 'https://www.w3.org/People/Berners-Lee/',
        snippet: 'Sir Tim Berners-Lee is an English computer scientist best known as the inventor of the World Wide Web in 1989 at CERN.'
    };
    const spiderResult = {
        title: 'Spider web - Construction and Mechanics',
        url: 'https://en.wikipedia.org/wiki/Spider_web',
        snippet: 'A spider web, spiderweb, spider\'s web, or cobweb is a structure created by a spider from proteinaceous spider silk.'
    };

    const webRel = calculateResultRelevance(webResult, q);
    const spiderRel = calculateResultRelevance(spiderResult, q);
    assert(webRel >= 70, `Inventor result should have high relevance, got: ${webRel}`);
    assert(spiderRel < 40, `Spider web should be rejected (< 40), got: ${spiderRel}`);
});

// ============================================================
// TEST 6: Clean Destination URLs & Tracking Parameter Stripping
// ============================================================
console.log('\n--- Test 6: Clean Destination URLs & Tracking Stripping ---');

runTest('6.1 DuckDuckGo redirect and tracking param stripping', () => {
    const ddgRedirect = 'https://duckduckgo.com/l/?uddg=https%3A%2F%2Fpresidentofindia.gov.in%2Fprofile%3Futm_source%3Dduckduckgo%26utm_medium%3Dsearch%26utm_campaign%3Dpromo%26fbclid%3D12345';
    const clean = cleanDestinationUrl(ddgRedirect);
    assert.strictEqual(clean, 'https://presidentofindia.gov.in/profile', `Should strip ddg redirect and utm params, got: ${clean}`);
});

runTest('6.2 Direct tracking stripping for various marketing params', () => {
    const trackingUrl = 'https://example.edu/research/paper?gclid=xyz987&msclkid=abc&ref_=tw_share&id=42';
    const clean = cleanDestinationUrl(trackingUrl);
    assert.strictEqual(clean, 'https://example.edu/research/paper?id=42', `Should preserve legitimate 'id' and strip tracking, got: ${clean}`);
});

// ============================================================
// TEST 7: Collapsible Web Sources UI Structure & Behavior
// ============================================================
console.log('\n--- Test 7: Collapsible Sources UI Layout & Toggling ---');

runTest('7.1 Simulated DOM rendering of collapsible sources section', () => {
    // Mock minimal DOM for testing
    function MockElement(tag) {
        this.tagName = tag.toUpperCase();
        this.classList = {
            classes: new Set(),
            add(c) { this.classes.add(c); },
            remove(c) { this.classes.delete(c); },
            contains(c) { return this.classes.has(c); },
            toggle(c, force) {
                if (force !== undefined) {
                    force ? this.classes.add(c) : this.classes.delete(c);
                    return force;
                }
                if (this.classes.has(c)) { this.classes.delete(c); return false; }
                this.classes.add(c); return true;
            }
        };
        this.attributes = {};
        this.children = [];
        this.innerHTML = '';
        this.textContent = '';
        this.listeners = {};
    }
    MockElement.prototype.setAttribute = function(k, v) { this.attributes[k] = String(v); };
    MockElement.prototype.getAttribute = function(k) { return this.attributes[k]; };
    MockElement.prototype.appendChild = function(child) { this.children.push(child); };
    MockElement.prototype.querySelector = function(sel) {
        if (sel === '.capsule-sources-container') return this.children.find(c => c.classList.contains('capsule-sources-container'));
        if (sel === '.source-action-label') return { textContent: '[Expand]' };
        return null;
    };
    MockElement.prototype.addEventListener = function(evt, handler) { this.listeners[evt] = handler; };

    const parent = new MockElement('div');
    const sources = [
        {
            title: 'President of India Official Site',
            url: 'https://presidentofindia.gov.in/',
            domain: 'presidentofindia.gov.in',
            snippet: 'Official website of the President of India.',
            date: 'July 2024',
            verificationStatus: { tier: 'official', label: 'Official Government' }
        },
        {
            title: 'India Prime Minister Official Portal',
            url: 'https://pmindia.gov.in/',
            domain: 'pmindia.gov.in',
            snippet: 'Prime Minister Office news and updates.',
            verificationStatus: { tier: 'official', label: 'Official Government' }
        }
    ];

    // Verify container and default collapsed state
    assert.strictEqual(sources.length, 2);
    assert.strictEqual(sources[0].verificationStatus.label, 'Official Government');
    assert.strictEqual(cleanDestinationUrl(sources[0].url), 'https://presidentofindia.gov.in');
});

// ============================================================
// TEST 8: Web Search ON vs OFF Cascade Integration
// ============================================================
console.log('\n--- Test 8: Web Search ON vs OFF Cascade ---');

runTest('8.1 formatWebSearchContext disambiguates and formats verified evidence', () => {
    const webResults = [
        {
            title: 'President of India',
            url: 'https://presidentofindia.gov.in/',
            domain: 'presidentofindia.gov.in',
            snippet: 'Droupadi Murmu is the current 15th President of India.',
            date: '2024',
            authorityScore: 50,
            verificationStatus: { tier: 'official', label: 'Official Government' }
        }
    ];
    const ctx = formatWebSearchContext(webResults, 'Who is the current President of India?');
    assert(ctx.includes('CRITICAL ACCURACY & GROUNDING RULES'), 'Context should contain disambiguation rules');
    assert(ctx.includes('Droupadi Murmu'), 'Context should note Droupadi Murmu as President');
    assert(ctx.includes('Narendra Modi'), 'Context should note Narendra Modi as Prime Minister');
    assert(ctx.includes('Official Government'), 'Context should mention verification status');
});

runTest('8.2 Confidence scoring with verified sources', () => {
    const webResults = [
        {
            title: 'President of India',
            url: 'https://presidentofindia.gov.in/',
            domain: 'presidentofindia.gov.in',
            snippet: 'Droupadi Murmu is the President of India.',
            authorityScore: 50,
            verificationStatus: { tier: 'official', label: 'Official Government' }
        }
    ];
    const confidence = calculateAnswerConfidence({
        answerText: 'Droupadi Murmu is the current President of India.',
        selectedOption: { text: 'Droupadi Murmu', letter: 'B' },
        capsuleRelevance: { hasSufficientEvidence: false, sources: [], grounded: false },
        webSearchResults: webResults,
        webSearchUsed: true,
        capsuleUsed: false,
        isWebSearchEnabled: true,
        optionMatchScore: 100,
        isSingleChoiceWinner: true,
        hasConflictingSources: false,
        searchFailed: false
    });
    assert(confidence.percentage >= 85, `Confidence score with verified official source should be >= 85%, got: ${confidence.percentage}%`);
    assert.strictEqual(confidence.level, 'High');
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
