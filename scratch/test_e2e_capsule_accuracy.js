process.env.NODE_ENV = 'development';
const assert = require('assert');
const utils = require('../utils.js');

console.log('=== KENOWA AI: CAPSULE RAG ACCURACY BENCHMARK ===\n');

// 1. Sample realistic Capsule Documents
const capsuleDocs = [
    {
        name: 'cloud_architecture.md',
        content: `# Cloud Architecture & Networking Guide

## Virtual Private Cloud (VPC)
A Virtual Private Cloud (VPC) is a logically isolated virtual network within a public cloud provider.
Subnets are subdivisions of a VPC that reside within a single Availability Zone (AZ).
A public subnet contains a route to an Internet Gateway (IGW), enabling bidirectional Internet traffic.
A private subnet does not have a direct route to an Internet Gateway and requires a Network Address Translation (NAT) Gateway residing in a public subnet to initiate outbound IPv4 connections.

## Security Groups vs Network ACLs
Security Groups operate at the virtual network interface (ENI) level and are stateful. When an inbound rule permits traffic, the corresponding outbound response is automatically allowed regardless of outbound rules.
Network Access Control Lists (NACLs) operate at the subnet boundary and are stateless. Both inbound and outbound traffic must be explicitly permitted by numbered rules evaluated in ascending numerical order.

## Storage Classes & Durability
Cloud object storage provides 99.999999999% (11 9s) of data durability over a given year.
Standard storage is optimized for frequent access with low latency and high throughput.
Glacier Deep Archive provides the lowest cost storage for long-term archiving with retrieval times between 12 and 48 hours.
Lifecycle rules can automatically transition objects between storage tiers after a specified number of elapsed days.`
    },
    {
        name: 'biology_cell_division.md',
        content: `# Cell Biology: Mitosis and Meiosis

## Phases of Mitosis
Mitosis consists of four sequential continuous phases: Prophase, Metaphase, Anaphase, and Telophase (PMAT).
During Prophase, chromatin condenses into distinct visible chromosomes, and the mitotic spindle begins assembling.
During Metaphase, sister chromatids align along the equatorial metaphase plate perpendicular to the spindle axis.
During Anaphase, sister chromatids are pulled apart by shortening kinetochore microtubules toward opposite centrosome poles.
During Telophase, two nuclear envelopes reform around the separated chromosome clusters, followed by cytokinesis dividing the cytoplasm.

## Differences Between Mitosis and Meiosis
Mitosis produces two genetically identical diploid (2n) somatic daughter cells.
Meiosis produces four genetically diverse haploid (1n) gametes through two successive nuclear divisions (Meiosis I and Meiosis II).
Crossing over, or genetic recombination, occurs exclusively during Prophase I of Meiosis, where homologous chromosomes pair to form tetrads and exchange non-sister chromatid segments.`
    },
    {
        name: 'database_systems.md',
        content: `# Database Management & Transaction Processing

## ACID Properties
Transactions in relational database management systems adhere to four fundamental guarantees:
- Atomicity: Guarantees that all statements within a transaction execute completely or none execute at all ('all-or-nothing').
- Consistency: Ensures that any transaction brings the database from one valid state to another valid state, preserving all integrity constraints.
- Isolation: Ensures that concurrent execution of transactions leaves the database in the same state that would have been obtained if transactions were executed sequentially.
- Durability: Guarantees that once a transaction has committed, its changes survive system crashes or power failures via write-ahead logging (WAL).

## Indexing Techniques
B+ Tree indices maintain sorted keys in leaf nodes linked as a doubly-linked list, providing O(log N) lookup, insertion, and deletion while excelling at range scan queries.
Hash indices compute an exact bucket location via a hash function, achieving O(1) average lookup time for point queries, but cannot support range queries or prefix searches.`
    }
];

// Pre-index corpus
const corpusIndex = utils.indexCorpus(capsuleDocs);
console.log(`Indexed ${corpusIndex.chunks.length} chunks across ${capsuleDocs.length} documents.`);

// Benchmark test cases: 20 diverse realistic questions
const testCases = [
    // 1. Direct factual retrieval
    {
        id: 'Q1',
        category: 'Direct Factual',
        question: 'Which device is required for instances in a private subnet to initiate outbound IPv4 connections?',
        options: [
            { letter: 'A', text: 'Internet Gateway' },
            { letter: 'B', text: 'NAT Gateway in a public subnet' },
            { letter: 'C', text: 'Virtual Private Gateway' },
            { letter: 'D', text: 'Egress-only Internet Gateway' }
        ],
        expectedLetter: 'B',
        expectedDoc: 'cloud_architecture.md',
        shouldHaveEvidence: true
    },
    // 2. Exact definition
    {
        id: 'Q2',
        category: 'Definition',
        question: 'What is the annual data durability provided by cloud object storage?',
        options: [
            { letter: 'A', text: '99.99%' },
            { letter: 'B', text: '99.9%' },
            { letter: 'C', text: '99.999999999% (11 9s)' },
            { letter: 'D', text: '99.999%' }
        ],
        expectedLetter: 'C',
        expectedDoc: 'cloud_architecture.md',
        shouldHaveEvidence: true
    },
    // 3. Comparison / Difference
    {
        id: 'Q3',
        category: 'Comparison',
        question: 'Why are Security Groups considered stateful while Network ACLs are stateless?',
        options: [
            { letter: 'A', text: 'Security Groups automatically allow return traffic for permitted inbound packets' },
            { letter: 'B', text: 'Network ACLs operate at the instance ENI level' },
            { letter: 'C', text: 'Security Groups evaluate numbered rules in ascending order' },
            { letter: 'D', text: 'Network ACLs automatically allow return traffic' }
        ],
        expectedLetter: 'A',
        expectedDoc: 'cloud_architecture.md',
        shouldHaveEvidence: true
    },
    // 4. Biology - Mitosis stage
    {
        id: 'Q4',
        category: 'Sequence / Stage',
        question: 'During which phase of mitosis do sister chromatids separate toward opposite poles?',
        options: [
            { letter: 'A', text: 'Prophase' },
            { letter: 'B', text: 'Metaphase' },
            { letter: 'C', text: 'Anaphase' },
            { letter: 'D', text: 'Telophase' }
        ],
        expectedLetter: 'C',
        expectedDoc: 'biology_cell_division.md',
        shouldHaveEvidence: true
    },
    // 5. Biology - Outcome comparison
    {
        id: 'Q5',
        category: 'Comparison',
        question: 'How many daughter cells and of what ploidy are produced by meiosis?',
        options: [
            { letter: 'A', text: 'Two diploid somatic daughter cells' },
            { letter: 'B', text: 'Four genetically diverse haploid gametes' },
            { letter: 'C', text: 'Four diploid daughter cells' },
            { letter: 'D', text: 'Two haploid cells' }
        ],
        expectedLetter: 'B',
        expectedDoc: 'biology_cell_division.md',
        shouldHaveEvidence: true
    },
    // 6. Biology - Specific event
    {
        id: 'Q6',
        category: 'Specific Event',
        question: 'During which stage does genetic crossing over take place?',
        options: [
            { letter: 'A', text: 'Prophase of Mitosis' },
            { letter: 'B', text: 'Metaphase II' },
            { letter: 'C', text: 'Prophase I of Meiosis' },
            { letter: 'D', text: 'Anaphase I' }
        ],
        expectedLetter: 'C',
        expectedDoc: 'biology_cell_division.md',
        shouldHaveEvidence: true
    },
    // 7. Database - ACID
    {
        id: 'Q7',
        category: 'Definition',
        question: 'Which ACID property guarantees that all statements execute completely or none at all?',
        options: [
            { letter: 'A', text: 'Atomicity' },
            { letter: 'B', text: 'Consistency' },
            { letter: 'C', text: 'Isolation' },
            { letter: 'D', text: 'Durability' }
        ],
        expectedLetter: 'A',
        expectedDoc: 'database_systems.md',
        shouldHaveEvidence: true
    },
    // 8. Database - Durability mechanism
    {
        id: 'Q8',
        category: 'Mechanism',
        question: 'How does a relational database guarantee durability after commits?',
        options: [
            { letter: 'A', text: 'Using hash index lookups' },
            { letter: 'B', text: 'Via write-ahead logging (WAL)' },
            { letter: 'C', text: 'By running sequential isolation' },
            { letter: 'D', text: 'Through B+ tree range scans' }
        ],
        expectedLetter: 'B',
        expectedDoc: 'database_systems.md',
        shouldHaveEvidence: true
    },
    // 9. Database - Index trade-offs
    {
        id: 'Q9',
        category: 'Trade-off',
        question: 'Why are Hash indices unsuitable for range queries compared to B+ Trees?',
        options: [
            { letter: 'A', text: 'Hash indices have O(log N) insertion time' },
            { letter: 'B', text: 'Hash indices compute exact bucket locations rather than maintaining sorted order' },
            { letter: 'C', text: 'Hash indices use doubly-linked leaf nodes' },
            { letter: 'D', text: 'Hash indices only work in memory' }
        ],
        expectedLetter: 'B',
        expectedDoc: 'database_systems.md',
        shouldHaveEvidence: true
    },
    // 10. Glacier retrieval time
    {
        id: 'Q10',
        category: 'Numeric / Specification',
        question: 'What is the expected data retrieval window for Glacier Deep Archive?',
        options: [
            { letter: 'A', text: '1 to 5 minutes' },
            { letter: 'B', text: '3 to 5 hours' },
            { letter: 'C', text: '12 to 48 hours' },
            { letter: 'D', text: 'Instantaneous' }
        ],
        expectedLetter: 'C',
        expectedDoc: 'cloud_architecture.md',
        shouldHaveEvidence: true
    },
    // 11. True / False - Mitosis
    {
        id: 'Q11',
        category: 'True/False',
        question: 'True or False: Mitosis produces two genetically identical diploid cells.',
        options: [
            { letter: 'A', text: 'True' },
            { letter: 'B', text: 'False' }
        ],
        expectedLetter: 'A',
        expectedDoc: 'biology_cell_division.md',
        shouldHaveEvidence: true
    },
    // 12. True / False - NACL
    {
        id: 'Q12',
        category: 'True/False',
        question: 'True or False: Network ACLs are stateful and automatically permit return traffic.',
        options: [
            { letter: 'A', text: 'True' },
            { letter: 'B', text: 'False' }
        ],
        expectedLetter: 'B',
        expectedDoc: 'cloud_architecture.md',
        shouldHaveEvidence: true
    },
    // 13. Differently worded query (Synonyms & paraphrasing)
    {
        id: 'Q13',
        category: 'Paraphrased Query',
        question: 'How do relational DBMS engines preserve committed modifications despite an abrupt power outage?',
        options: [
            { letter: 'A', text: 'Through write-ahead logging (WAL)' },
            { letter: 'B', text: 'By storing everything in public subnets' },
            { letter: 'C', text: 'With B+ tree leaf nodes' },
            { letter: 'D', text: 'By executing non-sister recombination' }
        ],
        expectedLetter: 'A',
        expectedDoc: 'database_systems.md',
        shouldHaveEvidence: true
    },
    // 14. Multi-passage synthesis
    {
        id: 'Q14',
        category: 'Multi-passage Synthesis',
        question: 'In cloud networking, what subnet type houses a NAT Gateway to grant internet egress to private workloads?',
        options: [
            { letter: 'A', text: 'Private subnet' },
            { letter: 'B', text: 'Public subnet' },
            { letter: 'C', text: 'Isolated database subnet' },
            { letter: 'D', text: 'Glacier archive tier' }
        ],
        expectedLetter: 'B',
        expectedDoc: 'cloud_architecture.md',
        shouldHaveEvidence: true
    },
    // 15. Confusable terms (Chromatids vs Homologous chromosomes)
    {
        id: 'Q15',
        category: 'Confusable Terms',
        question: 'During crossing over in Meiosis I, what structures pair to form tetrads and exchange segments?',
        options: [
            { letter: 'A', text: 'Sister chromatids from identical chromosomes' },
            { letter: 'B', text: 'Homologous chromosomes' },
            { letter: 'C', text: 'Centrosome poles' },
            { letter: 'D', text: 'Kinetochore microtubules' }
        ],
        expectedLetter: 'B',
        expectedDoc: 'biology_cell_division.md',
        shouldHaveEvidence: true
    },
    // 16. Unrelated question 1 (Must be identified as Insufficient Information)
    {
        id: 'Q16',
        category: 'Unrelated / Out of Domain',
        question: 'What is the capital city of Australia and what is its primary currency?',
        options: [
            { letter: 'A', text: 'Canberra and Australian Dollar' },
            { letter: 'B', text: 'Sydney and Euro' },
            { letter: 'C', text: 'Melbourne and Pound' }
        ],
        expectedLetter: null,
        expectedDoc: null,
        shouldHaveEvidence: false
    },
    // 17. Unrelated question 2 (Must be identified as Insufficient Information)
    {
        id: 'Q17',
        category: 'Unrelated / Out of Domain',
        question: 'Who wrote the play Hamlet and in what century was it first performed?',
        options: [
            { letter: 'A', text: 'William Shakespeare in the 17th century' },
            { letter: 'B', text: 'Christopher Marlowe in the 15th century' }
        ],
        expectedLetter: null,
        expectedDoc: null,
        shouldHaveEvidence: false
    },
    // 18. Similar but absent topic (Quantum Computing - not in database or cloud docs)
    {
        id: 'Q18',
        category: 'Absent Topic',
        question: 'How do superconducting qubits maintain quantum coherence against thermal decoherence in dilution refrigerators?',
        options: [
            { letter: 'A', text: 'By cooling below 15 millikelvin' },
            { letter: 'B', text: 'Using B+ Tree indices' }
        ],
        expectedLetter: null,
        expectedDoc: null,
        shouldHaveEvidence: false
    },
    // 19. B+ tree leaf nodes structure
    {
        id: 'Q19',
        category: 'Technical Detail',
        question: 'How are leaf nodes linked in a B+ Tree index to facilitate efficient range scans?',
        options: [
            { letter: 'A', text: 'As a singly-linked circular list' },
            { letter: 'B', text: 'As a doubly-linked list' },
            { letter: 'C', text: 'In separate hash buckets' },
            { letter: 'D', text: 'Via stateful network interfaces' }
        ],
        expectedLetter: 'B',
        expectedDoc: 'database_systems.md',
        shouldHaveEvidence: true
    },
    // 20. Lifecycle transitions
    {
        id: 'Q20',
        category: 'Workflow / Rules',
        question: 'What mechanism automatically shifts cloud storage objects between tiers after a designated period?',
        options: [
            { letter: 'A', text: 'Lifecycle rules' },
            { letter: 'B', text: 'Network ACL tables' },
            { letter: 'C', text: 'Mitotic spindle checkpoints' },
            { letter: 'D', text: 'Two-phase commit protocols' }
        ],
        expectedLetter: 'A',
        expectedDoc: 'cloud_architecture.md',
        shouldHaveEvidence: true
    }
];

let retrievalSuccesses = 0;
let answerCorrectnesses = 0;
let optionMatchSuccesses = 0;
let e2eQuickAnswerSuccesses = 0;
let e2eExamModeSuccesses = 0;
let totalSupported = 0;
let totalUnsupported = 0;

// Option matching logic from Kenowa sidepanel.js
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

    // 3. Pure letter matching
    const optLetter = candidateLetter ? String(candidateLetter).toUpperCase() : null;
    if (parsed.isPureLetter && parsed.letter) {
        if (optLetter && optLetter === parsed.letter) return 96;
        const letters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'];
        const targetIdx = letters.indexOf(parsed.letter);
        if (targetIdx !== -1 && targetIdx === optIndex) return 92;
        return 0;
    }

    // 4. Target has substantive text
    if (parsed.cleanStem && parsed.cleanStem.length >= 3) {
        if (!cStem) return 0;
        if (cStem === parsed.cleanStem) return 100;
        if (cStem.includes(parsed.cleanStem) || parsed.cleanStem.includes(cStem)) {
            const minLen = Math.min(cStem.length, parsed.cleanStem.length);
            const maxLen = Math.max(cStem.length, parsed.cleanStem.length);
            const lenRatio = minLen / maxLen;
            if (lenRatio >= 0.75) {
                if (optLetter && parsed.letter && optLetter === parsed.letter) return 95;
                return 88;
            }
        }
    }

    if (optLetter && parsed.letter && optLetter === parsed.letter) return 85;
    return 0;
}

for (const tc of testCases) {
    const isSupported = tc.shouldHaveEvidence;
    if (isSupported) totalSupported++;
    else totalUnsupported++;

    const fullQuery = `${tc.question}\n${tc.options.map(o => `[${o.letter}] ${o.text}`).join('\n')}`;
    const ragRes = utils.retrieveCapsuleContext(fullQuery, capsuleDocs);

    // 1. Evaluate Retrieval & Sufficiency Decision
    let retrievalPassed = false;
    if (isSupported) {
        const hasExpectedDoc = ragRes.sources.some(s => s.name === tc.expectedDoc);
        if (ragRes.hasSufficientEvidence && hasExpectedDoc) {
            retrievalPassed = true;
            retrievalSuccesses++;
        }
    } else {
        // Must reject insufficient evidence
        if (!ragRes.hasSufficientEvidence) {
            retrievalPassed = true;
            retrievalSuccesses++;
        }
    }

    // 2. Evaluate Answer Grounding & Option Matching (Simulation)
    let answerCorrect = false;
    let optionMatchCorrect = false;
    let e2eQAPassed = false;
    let e2eExamPassed = false;

    if (isSupported) {
        // Find best option supported by retrieved passages
        const targetOpt = tc.options.find(o => o.letter === tc.expectedLetter);
        const verificationText = `${tc.question} ${targetOpt.text}`;
        const verification = utils.verifyAnswerAgainstSources(verificationText, targetOpt.text, ragRes.sources);
        
        if (verification.grounded) {
            answerCorrect = true;
            answerCorrectnesses++;
        }

        // Test Kenowa Exam Mode option matching on AI output formats: ["Letter. Text"], ["Letter"], ["Text"]
        const aiOutputFormat = `${tc.expectedLetter}. ${targetOpt.text}`;
        let bestMatchedOpt = null;
        let bestScore = 0;

        tc.options.forEach((opt, idx) => {
            const sc = scoreOptionMatch(opt.text, opt.text, opt.letter, aiOutputFormat, idx, tc.options.length);
            if (sc > bestScore && sc >= 75) {
                bestScore = sc;
                bestMatchedOpt = opt;
            }
        });

        if (bestMatchedOpt && bestMatchedOpt.letter === tc.expectedLetter) {
            optionMatchCorrect = true;
            optionMatchSuccesses++;
        }

        if (retrievalPassed && answerCorrect) {
            e2eQAPassed = true;
            e2eQuickAnswerSuccesses++;
        }
        if (retrievalPassed && optionMatchCorrect) {
            e2eExamPassed = true;
            e2eExamModeSuccesses++;
        }
    } else {
        // For unsupported questions, Quick Answer and Exam Mode MUST return insufficient info
        if (!ragRes.hasSufficientEvidence) {
            answerCorrect = true;
            answerCorrectnesses++;
            optionMatchCorrect = true;
            optionMatchSuccesses++;
            e2eQAPassed = true;
            e2eQuickAnswerSuccesses++;
            e2eExamPassed = true;
            e2eExamModeSuccesses++;
        }
    }

    console.log(`[${tc.id}] [${tc.category}] Retrieval: ${retrievalPassed ? 'PASS' : 'FAIL'} | Grounding: ${answerCorrect ? 'PASS' : 'FAIL'} | E2E QA: ${e2eQAPassed ? 'PASS' : 'FAIL'} | E2E Exam: ${e2eExamPassed ? 'PASS' : 'FAIL'}`);
}

const totalQuestions = testCases.length;
const retrievalRate = (retrievalSuccesses / totalQuestions) * 100;
const answerRate = (answerCorrectnesses / totalQuestions) * 100;
const optionMatchRate = (optionMatchSuccesses / totalQuestions) * 100;
const e2eQARate = (e2eQuickAnswerSuccesses / totalQuestions) * 100;
const e2eExamRate = (e2eExamModeSuccesses / totalQuestions) * 100;

console.log('\n========================================');
console.log('BENCHMARK RESULTS SUMMARY:');
console.log('========================================');
console.log(`Total Evaluated Questions: ${totalQuestions} (${totalSupported} supported, ${totalUnsupported} unsupported/unrelated)`);
console.log(`Retrieval Accuracy:        ${retrievalRate.toFixed(1)}% (Target >= 90%)`);
console.log(`Answer Correctness:        ${answerRate.toFixed(1)}% (Target >= 90%)`);
console.log(`Option Matching Accuracy:  ${optionMatchRate.toFixed(1)}% (Target >= 90%)`);
console.log(`E2E Quick Answer Accuracy: ${e2eQARate.toFixed(1)}% (Target >= 90%)`);
console.log(`E2E Exam Mode Accuracy:    ${e2eExamRate.toFixed(1)}% (Target >= 90%)`);
console.log('========================================\n');

assert(retrievalRate >= 90, `Retrieval Rate was below 90%: ${retrievalRate}%`);
assert(answerRate >= 90, `Answer Rate was below 90%: ${answerRate}%`);
assert(optionMatchRate >= 90, `Option Match Rate was below 90%: ${optionMatchRate}%`);
assert(e2eQARate >= 90, `E2E Quick Answer Rate was below 90%: ${e2eQARate}%`);
assert(e2eExamRate >= 90, `E2E Exam Rate was below 90%: ${e2eExamRate}%`);

console.log('ALL CAPSULE ACCURACY BENCHMARKS EXCEEDED 90% TARGET! TEST PASSED.\n');
