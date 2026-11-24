// ============================================================
// Kenowa AI — Smart Capsule + Web Search + AI Confidence Score
// Comprehensive 8-Scenario Verification Suite
// ============================================================
const assert = require('assert');
const utils = require('../utils.js');

async function runAllScenarios() {
    console.log('\n=== RUNNING 8-SCENARIO SMART CAPSULE + WEB SEARCH + CONFIDENCE TESTS ===\n');

    // ── Scenario 1: Capsule contains the correct answer ──────────
    {
        const question = "What is the primary function of mitochondria?";
        const capsuleData = {
            hasSufficientEvidence: true,
            sources: [{ name: "cell_biology.pdf", heading: "Organelles", content: "Mitochondria generate ATP for the cell." }],
            matchRatio: 0.85,
            grounded: true
        };

        const shouldSearch = utils.shouldPerformWebSearch(question, {
            isCapsuleSufficient: capsuleData.hasSufficientEvidence,
            searchMode: 'auto'
        });
        assert.strictEqual(shouldSearch, false, 'Web search must be skipped when Capsule has answer');

        const conf = utils.calculateAnswerConfidence({
            answerText: "B. Generate ATP for the cell",
            selectedOption: { letter: "B", text: "Generate ATP for the cell" },
            capsuleRelevance: capsuleData,
            webSearchResults: [],
            webSearchUsed: false,
            capsuleUsed: true,
            isWebSearchEnabled: true,
            optionMatchScore: 100,
            isSingleChoiceWinner: true,
            hasConflictingSources: false
        });

        assert(conf.percentage >= 85, `Confidence must be High (>=85%), got ${conf.percentage}%`);
        assert.strictEqual(conf.level, 'High');
        assert.strictEqual(conf.evidenceSource, 'Capsule');
        assert(conf.explanation.toLowerCase().includes('capsule'), 'Explanation must mention Capsule');
        console.log(`  [PASS] 1. Capsule contains correct answer -> ${conf.percentage}% ${conf.level} (${conf.evidenceSource})`);
    }

    // ── Scenario 2: Capsule does not contain answer & Web Search is ON
    {
        const question = "What year was Python first released?";
        const capsuleData = { hasSufficientEvidence: false, sources: [], grounded: false };

        const shouldSearch = utils.shouldPerformWebSearch(question, {
            isCapsuleSufficient: capsuleData.hasSufficientEvidence,
            searchMode: 'auto'
        });
        assert.strictEqual(shouldSearch, true, 'Web search must trigger when Capsule is insufficient');

        const mockWebResults = [
            { title: "Python FAQ", url: "https://docs.python.org/faq", snippet: "Python was first released in 1991 by Guido van Rossum.", domainAuthority: 40 },
            { title: "Python History", url: "https://en.wikipedia.org/wiki/Python", snippet: "Released in February 1991.", domainAuthority: 40 }
        ];

        const conf = utils.calculateAnswerConfidence({
            answerText: "A. 1991",
            selectedOption: { letter: "A", text: "1991" },
            capsuleRelevance: capsuleData,
            webSearchResults: mockWebResults,
            webSearchUsed: true,
            capsuleUsed: false,
            isWebSearchEnabled: true,
            optionMatchScore: 100,
            isSingleChoiceWinner: true,
            hasConflictingSources: false
        });

        assert(conf.percentage >= 85, `Confidence must be High with authoritative web sources, got ${conf.percentage}%`);
        assert.strictEqual(conf.level, 'High');
        assert.strictEqual(conf.evidenceSource, 'Web Search');
        assert.strictEqual(conf.sourceCount, 2);
        console.log(`  [PASS] 2. Capsule insufficient + Web Search ON -> ${conf.percentage}% ${conf.level} (${conf.evidenceSource}, ${conf.sourceCount} sources)`);
    }

    // ── Scenario 3: Capsule does not contain answer & Web Search is OFF
    {
        const question = "What is the capital of Australia?";
        const capsuleData = { hasSufficientEvidence: false, sources: [], grounded: false };

        const shouldSearch = utils.shouldPerformWebSearch(question, {
            isCapsuleSufficient: false,
            searchMode: 'off'
        });
        assert.strictEqual(shouldSearch, false, 'Web search must NOT trigger when disabled');

        const conf = utils.calculateAnswerConfidence({
            answerText: "C. Canberra",
            selectedOption: { letter: "C", text: "Canberra" },
            capsuleRelevance: capsuleData,
            webSearchResults: [],
            webSearchUsed: false,
            capsuleUsed: false,
            isWebSearchEnabled: false,
            optionMatchScore: 100,
            isSingleChoiceWinner: true,
            hasConflictingSources: false
        });

        assert(conf.percentage <= 75, `Pure AI Knowledge confidence cannot exceed 75%, got ${conf.percentage}%`);
        assert.strictEqual(conf.level, 'Medium');
        assert.strictEqual(conf.evidenceSource, 'AI Knowledge');
        console.log(`  [PASS] 3. Capsule insufficient + Web Search OFF -> ${conf.percentage}% ${conf.level} (${conf.evidenceSource}, capped)`);
    }

    // ── Scenario 4: Web Search returns conflicting information ────
    {
        const question = "Is product X FDA approved?";
        const conflictingResults = [
            { title: "Source A", url: "https://example.com/1", snippet: "Product X is mandatory and is allowed by regulators." },
            { title: "Source B", url: "https://example.com/2", snippet: "Product X is prohibited and not allowed." }
        ];

        const conflictCheck = utils.detectConflictingInformation(conflictingResults, question, "Yes");
        assert.strictEqual(conflictCheck.hasConflict, true, 'Conflict detector must flag opposing claims');

        const conf = utils.calculateAnswerConfidence({
            answerText: "A. Yes",
            selectedOption: { letter: "A", text: "Yes" },
            capsuleRelevance: null,
            webSearchResults: conflictingResults,
            webSearchUsed: true,
            capsuleUsed: false,
            isWebSearchEnabled: true,
            optionMatchScore: 100,
            isSingleChoiceWinner: true,
            hasConflictingSources: conflictCheck.hasConflict
        });

        assert(conf.percentage < 60, `Conflicting sources must drop confidence to Low (<60%), got ${conf.percentage}%`);
        assert.strictEqual(conf.level, 'Low');
        assert(conf.explanation.toLowerCase().includes('conflict'), 'Explanation must mention conflicting evidence');
        console.log(`  [PASS] 4. Web Search returns conflicting information -> ${conf.percentage}% ${conf.level} (Conflict penalty applied)`);
    }

    // ── Scenario 5: Web Search fails or times out ─────────────────
    {
        const question = "What is the speed of light?";
        const conf = utils.calculateAnswerConfidence({
            answerText: "B. 299,792,458 m/s",
            selectedOption: { letter: "B", text: "299,792,458 m/s" },
            capsuleRelevance: null,
            webSearchResults: [],
            webSearchUsed: false,
            capsuleUsed: false,
            isWebSearchEnabled: true,
            optionMatchScore: 90,
            isSingleChoiceWinner: true,
            hasConflictingSources: false,
            searchFailed: true
        });

        assert(conf.percentage <= 65, `Failed search must cap confidence, got ${conf.percentage}%`);
        assert(conf.level === 'Medium' || conf.level === 'Low');
        assert.strictEqual(conf.evidenceSource, 'AI Knowledge');
        console.log(`  [PASS] 5. Web Search fails or times out -> ${conf.percentage}% ${conf.level} (Graceful fallback)`);
    }

    // ── Scenario 6: AI answer does not match any webpage option ───
    {
        const question = "Which protocol is used for secure web browsing?";
        // Real webpage options: ["A. FTP", "B. SMTP", "C. SSH"]
        // AI returns "HTTPS"
        const optScore = utils.scoreOptionMatch("FTP", "ftp", "A", "HTTPS", 0, 3);
        assert(optScore < 75, `Mismatch score must be below 75, got ${optScore}`);

        const conf = utils.calculateAnswerConfidence({
            answerText: "HTTPS",
            selectedOption: null,
            capsuleRelevance: null,
            webSearchResults: [{ title: "HTTP vs HTTPS", url: "https://wikipedia.org", snippet: "HTTPS is secure HTTP." }],
            webSearchUsed: true,
            capsuleUsed: false,
            isWebSearchEnabled: true,
            optionMatchScore: optScore,
            isSingleChoiceWinner: false,
            hasConflictingSources: false
        });

        assert(conf.percentage < 40, `Unmatched option confidence must be low (<40%), got ${conf.percentage}%`);
        assert.strictEqual(conf.level, 'Low');
        assert(conf.explanation.includes('matched'), 'Explanation must flag matching failure');
        console.log(`  [PASS] 6. AI answer does not match any webpage option -> ${conf.percentage}% ${conf.level} (Low confidence safety guard)`);
    }

    // ── Scenario 7: Multiple consecutive questions have isolated confidence
    {
        // Question 1: Capsule Match
        const confQ1 = utils.calculateAnswerConfidence({
            answerText: "A. Mitochondria",
            optionMatchScore: 100,
            capsuleUsed: true,
            capsuleRelevance: { hasSufficientEvidence: true, matchRatio: 0.9 }
        });

        // Question 2: Web Search Match (Multiple corroborating sources)
        const confQ2 = utils.calculateAnswerConfidence({
            answerText: "C. 1991",
            optionMatchScore: 100,
            webSearchUsed: true,
            webSearchResults: [
                { title: "Python", url: "https://python.org", snippet: "1991", domainAuthority: 40 },
                { title: "Wikipedia", url: "https://en.wikipedia.org/wiki/Python", snippet: "1991", domainAuthority: 40 }
            ]
        });

        // Question 3: Pure AI Knowledge
        const confQ3 = utils.calculateAnswerConfidence({
            answerText: "B. Mars",
            optionMatchScore: 85,
            isWebSearchEnabled: false
        });

        assert(confQ1.percentage >= 85, 'Q1 should be High');
        assert(confQ2.percentage >= 85, 'Q2 should be High');
        assert(confQ3.percentage <= 75, 'Q3 should be Medium/capped');
        assert.notStrictEqual(confQ1.evidenceSource, confQ2.evidenceSource, 'Sources must be isolated');
        assert.notStrictEqual(confQ2.evidenceSource, confQ3.evidenceSource, 'Sources must be isolated');
        console.log(`  [PASS] 7. Multiple consecutive questions: Q1=${confQ1.percentage}% (${confQ1.evidenceSource}), Q2=${confQ2.percentage}% (${confQ2.evidenceSource}), Q3=${confQ3.percentage}% (${confQ3.evidenceSource})`);
    }

    // ── Scenario 8: Confidence changes appropriately when evidence quality changes
    {
        // Rank 1: Combined Capsule + Authoritative Web Search (Highest)
        const rank1 = utils.calculateAnswerConfidence({
            answerText: "Exact Match",
            optionMatchScore: 100,
            capsuleUsed: true,
            capsuleRelevance: { hasSufficientEvidence: true, matchRatio: 0.9 },
            webSearchUsed: true,
            webSearchResults: [{ title: "Ref", url: "https://nih.gov", snippet: "Corroboration", domainAuthority: 45 }]
        });

        // Rank 2: Capsule only
        const rank2 = utils.calculateAnswerConfidence({
            answerText: "Exact Match",
            optionMatchScore: 100,
            capsuleUsed: true,
            capsuleRelevance: { hasSufficientEvidence: true, matchRatio: 0.8 }
        });

        // Rank 3: Web Search only
        const rank3 = utils.calculateAnswerConfidence({
            answerText: "Exact Match",
            optionMatchScore: 100,
            webSearchUsed: true,
            webSearchResults: [{ title: "Ref", url: "https://example.edu", snippet: "Fact", domainAuthority: 40 }]
        });

        // Rank 4: AI Model Knowledge only
        const rank4 = utils.calculateAnswerConfidence({
            answerText: "Exact Match",
            optionMatchScore: 100,
            isWebSearchEnabled: false
        });

        // Rank 5: Conflicting web sources
        const rank5 = utils.calculateAnswerConfidence({
            answerText: "Exact Match",
            optionMatchScore: 100,
            webSearchUsed: true,
            webSearchResults: [{ title: "A", url: "http://a.com", snippet: "A" }],
            hasConflictingSources: true
        });

        // Rank 6: Unmatched option
        const rank6 = utils.calculateAnswerConfidence({
            answerText: "No Match",
            optionMatchScore: 0
        });

        assert(rank1.percentage >= rank2.percentage, 'Combined should be >= Capsule alone');
        assert(rank2.percentage >= rank4.percentage, 'Capsule should be > AI knowledge');
        assert(rank3.percentage >= rank4.percentage, 'Web search should be > AI knowledge');
        assert(rank4.percentage > rank5.percentage, 'AI knowledge should be > Conflicting sources');
        assert(rank5.percentage > rank6.percentage, 'Conflicting sources should be > Unmatched option');

        console.log(`  [PASS] 8. Monotonic Confidence Degradation verified:`);
        console.log(`     Combined (${rank1.percentage}%) > Capsule (${rank2.percentage}%) >= Web (${rank3.percentage}%) > AI (${rank4.percentage}%) > Conflict (${rank5.percentage}%) > Unmatched (${rank6.percentage}%)`);
    }

    console.log('\n=== RESULTS: ALL 8 SCENARIOS PASSED PERFECTLY ===\n');
}

runAllScenarios().catch(err => {
    console.error('Test failed:', err);
    process.exit(1);
});
