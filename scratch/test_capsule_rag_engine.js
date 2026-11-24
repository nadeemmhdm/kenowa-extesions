// Prototype and test suite for the Enhanced Capsule RAG Engine

const CAPSULE_STOPWORDS = new Set([
    'a', 'an', 'the', 'and', 'or', 'but', 'if', 'then', 'else', 'when',
    'at', 'by', 'for', 'with', 'about', 'against', 'between', 'into', 'through',
    'during', 'before', 'after', 'above', 'below', 'to', 'from', 'up', 'down',
    'in', 'out', 'on', 'off', 'over', 'under', 'again', 'further',
    'is', 'am', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'having', 'do', 'does', 'did', 'doing',
    'can', 'could', 'shall', 'should', 'will', 'would', 'may', 'might', 'must',
    'it', 'its', 'itself', 'they', 'them', 'their', 'theirs', 'themselves',
    'what', 'which', 'who', 'whom', 'this', 'that', 'these', 'those',
    'i', 'me', 'my', 'myself', 'we', 'our', 'ours', 'ourselves', 'you', 'your', 'yours', 'yourself', 'yourselves',
    'he', 'him', 'his', 'himself', 'she', 'her', 'hers', 'herself',
    'how', 'why', 'where', 'there', 'here', 'all', 'both', 'each', 'few', 'more', 'most',
    'other', 'some', 'such', 'no', 'nor', 'not', 'only', 'own', 'same', 'so',
    'than', 'too', 'very', 's', 't', 'just', 'don', 'now', 'of', 'please'
]);

function normalizeCapsuleText(str) {
    return String(str || '')
        .toLowerCase()
        .replace(/&nbsp;/g, ' ')
        .replace(/[^\p{L}\p{N}\s]/gu, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

function stemWord(word) {
    if (!word || word.length <= 3) return word;
    let w = word.toLowerCase();
    if (w.endsWith('ing') && w.length > 5) return w.slice(0, -3);
    if (w.endsWith('ies') && w.length > 4) return w.slice(0, -3) + 'y';
    if (w.endsWith('es') && w.length > 4) return w.slice(0, -2);
    if (w.endsWith('s') && !w.endsWith('ss') && w.length > 3) return w.slice(0, -1);
    if (w.endsWith('ed') && w.length > 4) return w.slice(0, -2);
    if (w.endsWith('ly') && w.length > 4) return w.slice(0, -2);
    if (w.endsWith('tion') && w.length > 6) return w.slice(0, -4);
    if (w.endsWith('ment') && w.length > 6) return w.slice(0, -4);
    return w;
}

function extractKeywords(text) {
    const rawWords = String(text || '').match(/[\p{L}\p{N}]{2,}/gu) || [];
    const keywords = [];
    const stems = [];
    for (const w of rawWords) {
        const lower = w.toLowerCase();
        if (!CAPSULE_STOPWORDS.has(lower)) {
            keywords.push(lower);
            stems.push(stemWord(lower));
        }
    }
    return { keywords, stems };
}

// Chunks a Markdown document while preserving headings, lists, tables, and sentence overlap
function chunkMarkdownDocument(content, capsuleName) {
    if (!content || typeof content !== 'string') return [];

    const lines = content.replace(/\r\n?/g, '\n').split('\n');
    const chunks = [];
    let currentHeadings = [];
    let currentSectionLines = [];
    let inCodeBlock = false;

    function createChunk(text, headings) {
        const trimmed = text.trim();
        if (!trimmed || trimmed.length < 15) return;
        const headingPath = headings.filter(Boolean).join(' > ');
        const headingLower = headingPath.toLowerCase();
        const contentLower = trimmed.toLowerCase();
        const { keywords, stems } = extractKeywords(`${headingLower} ${contentLower}`);
        
        // Count term frequency
        const tfMap = new Map();
        stems.forEach(s => tfMap.set(s, (tfMap.get(s) || 0) + 1));

        chunks.push({
            capsuleName,
            headingPath,
            headingLower,
            content: trimmed,
            contentLower,
            stems: new Set(stems),
            tfMap,
            tokenCount: stems.length,
            charLength: trimmed.length,
            index: chunks.length
        });
    }

    function flushSection() {
        if (!currentSectionLines.length) return;
        const rawText = currentSectionLines.join('\n').trim();
        currentSectionLines = [];
        if (!rawText) return;

        // Split section by paragraphs or list blocks
        const paragraphs = rawText.split(/\n\s*\n/).map(p => p.trim()).filter(Boolean);
        let currentChunkText = '';
        let lastSentenceOverlap = '';

        for (const p of paragraphs) {
            if (currentChunkText && (currentChunkText.length + p.length > 550)) {
                createChunk(currentChunkText, currentHeadings);
                // Extract last sentence of previous chunk for overlap
                const sentences = currentChunkText.split(/(?<=[.?!])\s+/);
                lastSentenceOverlap = sentences.length > 1 ? sentences[sentences.length - 1] : '';
                currentChunkText = lastSentenceOverlap ? `${lastSentenceOverlap}\n\n${p}` : p;
            } else {
                currentChunkText = currentChunkText ? `${currentChunkText}\n\n${p}` : p;
            }
        }
        if (currentChunkText) {
            createChunk(currentChunkText, currentHeadings);
        }
    }

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        if (trimmed.startsWith('```')) {
            inCodeBlock = !inCodeBlock;
            currentSectionLines.push(line);
            continue;
        }
        if (inCodeBlock) {
            currentSectionLines.push(line);
            continue;
        }

        const headingMatch = line.match(/^\s*(#{1,6})\s+(.+)$/);
        if (headingMatch) {
            flushSection();
            const level = headingMatch[1].length;
            const title = headingMatch[2].trim();
            currentHeadings = currentHeadings.slice(0, level - 1);
            currentHeadings[level - 1] = title;
            currentHeadings = currentHeadings.filter(Boolean);
            continue;
        }

        currentSectionLines.push(line);
    }
    flushSection();

    return chunks;
}

// Index corpus and precalculate BM25 IDF
function indexCorpus(capsules) {
    const allChunks = capsules.flatMap(c => chunkMarkdownDocument(c.content, c.name));
    const N = allChunks.length;
    if (N === 0) return { chunks: [], idfMap: new Map(), avgdl: 0 };

    // Document frequency per stem
    const dfMap = new Map();
    let totalLength = 0;

    for (const chunk of allChunks) {
        totalLength += chunk.tokenCount;
        for (const stem of chunk.stems) {
            dfMap.set(stem, (dfMap.get(stem) || 0) + 1);
        }
    }

    const avgdl = totalLength / N || 1;
    const idfMap = new Map();
    for (const [stem, df] of dfMap.entries()) {
        // BM25 IDF formulation with smoothing
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        idfMap.set(stem, Math.max(0.1, idf));
    }

    return { chunks: allChunks, idfMap, avgdl };
}

// Retrieve high-relevance chunks using BM25, exact phrase matching, and heading weighting
function retrieveCapsuleContext(query, capsules, options = {}) {
    if (!capsules || !capsules.length) {
        return { context: '', topChunks: [], hasSufficientEvidence: false, sources: [] };
    }

    const maxChars = options.maxChars || 8000;
    const { chunks, idfMap, avgdl } = indexCorpus(capsules);
    if (!chunks.length) {
        return { context: '', topChunks: [], hasSufficientEvidence: false, sources: [] };
    }

    const queryStr = String(query || '').toLowerCase().trim();
    const { keywords, stems } = extractKeywords(queryStr);
    const queryStems = new Set(stems);

    if (queryStems.size === 0) {
        return { context: '', topChunks: [], hasSufficientEvidence: false, sources: [] };
    }

    // Extract n-grams (2-word, 3-word) from query for phrase boosting
    const cleanTokens = queryStr.match(/[\p{L}\p{N}]{3,}/gu) || [];
    const ngrams = [];
    for (let i = 0; i <= cleanTokens.length - 2; i++) {
        ngrams.push(cleanTokens.slice(i, i + 2).join(' '));
        if (i <= cleanTokens.length - 3) {
            ngrams.push(cleanTokens.slice(i, i + 3).join(' '));
        }
    }

    const k1 = 1.2;
    const b = 0.75;
    const scoredChunks = [];

    for (const chunk of chunks) {
        let bm25Score = 0;
        let matchedTerms = 0;

        for (const qStem of queryStems) {
            const tf = chunk.tfMap.get(qStem) || 0;
            if (tf > 0) {
                matchedTerms++;
                const idf = idfMap.get(qStem) || 0.5;
                const numerator = tf * (k1 + 1);
                const denominator = tf + k1 * (1 - b + b * (chunk.tokenCount / avgdl));
                let termScore = idf * (numerator / denominator);

                // Heading boost: if query stem is in heading, boost 2.5x
                if (chunk.headingLower.includes(qStem)) {
                    termScore *= 2.5;
                }
                bm25Score += termScore;
            }
        }

        // Phrase boost: check if verbatim n-grams exist in chunk
        let phraseScore = 0;
        for (const ng of ngrams) {
            if (chunk.contentLower.includes(ng) || chunk.headingLower.includes(ng)) {
                phraseScore += 4.0;
            }
        }

        // Coverage factor
        const coverageRatio = matchedTerms / queryStems.size;
        let totalScore = (bm25Score + phraseScore) * (0.5 + coverageRatio);

        if (totalScore > 0) {
            scoredChunks.push({
                chunk,
                score: totalScore,
                matchedTerms,
                coverageRatio
            });
        }
    }

    scoredChunks.sort((a, b) => b.score - a.score);

    const bestScore = scoredChunks.length ? scoredChunks[0].score : 0;
    const bestCoverage = scoredChunks.length ? scoredChunks[0].coverageRatio : 0;
    // Strict threshold: Must have adequate BM25 score and matched meaningful terms
    const hasSufficientEvidence = bestScore >= 1.8 && (bestCoverage >= 0.3 || scoredChunks[0].matchedTerms >= 2);

    if (!hasSufficientEvidence) {
        return {
            context: `[CAPSULE REFERENCE SYSTEM INSTRUCTION]
The user is asking a question based on their selected Capsule reference documents (${capsules.map(c => c.name).join(', ')}).
However, a thorough search of the selected Capsule documents found NO relevant passages or evidence matching this question.
You MUST reply with EXACTLY this statement:
"I couldn't find enough information in the selected Capsule to answer this question accurately."
Do NOT attempt to answer using external pre-trained knowledge, do NOT invent facts, and do NOT provide an unsupported answer.`,
            topChunks: [],
            hasSufficientEvidence: false,
            sources: []
        };
    }

    const chosenChunks = [];
    const sourceMap = new Map();
    let usedChars = 0;

    for (const item of scoredChunks) {
        if (item.score < 1.0) continue;
        const c = item.chunk;
        const headerInfo = `[Document: ${c.capsuleName}${c.headingPath ? ` | Section: ${c.headingPath}` : ''}]`;
        const block = `${headerInfo}\n${c.content}`;

        if (usedChars + block.length > maxChars) {
            if (chosenChunks.length === 0) {
                chosenChunks.push(block.slice(0, maxChars));
            }
            break;
        }

        chosenChunks.push(block);
        usedChars += block.length;

        if (!sourceMap.has(c.capsuleName)) {
            sourceMap.set(c.capsuleName, {
                name: c.capsuleName,
                heading: c.headingPath,
                snippet: c.content.slice(0, 240).trim(),
                score: item.score
            });
        }

        if (usedChars >= maxChars * 0.9) break;
    }

    const context = `[CAPSULE REFERENCE SYSTEM INSTRUCTION]
You are answering based on the user's selected Capsule reference documents (${capsules.map(c => c.name).join(', ')}).
Follow these mandatory rules:
1. Use the retrieved Capsule reference material below as your SOLE and authoritative source of truth.
2. Answer the user's exact question accurately and directly based strictly on the provided content.
3. Do NOT invent, assume, or extrapolate facts, names, numbers, definitions, dates, or explanations that are not explicitly stated in the reference material.
4. If the retrieved Capsule content does not contain enough information to answer the question completely or accurately, clearly state: "I couldn't find enough information in the selected Capsule to answer this question accurately."
5. If the documents contain conflicting information, explicitly identify and explain the conflict instead of silently choosing an answer.

RETRIEVED CAPSULE CONTENT:
${chosenChunks.join('\n\n---\n\n')}`;

    return {
        context,
        topChunks: chosenChunks,
        hasSufficientEvidence: true,
        sources: Array.from(sourceMap.values())
    };
}

// Source-based answer verification
function verifyAnswerAgainstSources(answerText, selectedOptionText, retrievedSources) {
    if (!retrievedSources || !retrievedSources.length) {
        return { isVerified: false, reason: 'no_sources' };
    }
    const targetText = normalizeCapsuleText(`${selectedOptionText || ''} ${answerText || ''}`);
    const { stems: targetStems } = extractKeywords(targetText);

    if (targetStems.length === 0) {
        return { isVerified: false, reason: 'empty_answer' };
    }

    const combinedSourceText = normalizeCapsuleText(retrievedSources.map(s => `${s.name} ${s.heading || ''} ${s.snippet || ''}`).join(' '));
    const { stems: sourceStems } = extractKeywords(combinedSourceText);
    const sourceStemSet = new Set(sourceStems);

    let matched = 0;
    for (const stem of targetStems) {
        if (sourceStemSet.has(stem)) matched++;
    }

    const matchRatio = matched / targetStems.length;
    // Verified if substantive tokens of the answer exist in the retrieved sources
    const isVerified = matchRatio >= 0.4 || matched >= 2;

    return {
        isVerified,
        matchRatio,
        matchedCount: matched,
        totalAnswerTokens: targetStems.length
    };
}

// ── Run Tests ──────────────────────────────────────────────
console.log('=== TEST CAPSULE RAG ENGINE ===\n');

const sampleCapsules = [
    {
        name: 'Biology_Cell_Structure.md',
        content: `# Cell Biology

## Organelles and Their Functions
The cell is the basic structural and functional unit of all living organisms. Within eukaryotic cells, specialized structures called organelles perform specific metabolic processes.

### Mitochondria
Mitochondria are often referred to as the powerhouse of the cell. They generate most of the chemical energy needed to power the biochemical reactions through aerobic cellular respiration, producing adenosine triphosphate (ATP).

### Ribosomes
Ribosomes are molecular machines found within all living cells. They are responsible for biological protein synthesis, translating messenger RNA (mRNA) into polypeptide chains of amino acids.

### Chloroplasts
Chloroplasts are plant organelles that conduct photosynthesis, absorbing sunlight with chlorophyll to convert carbon dioxide and water into glucose and oxygen.`
    },
    {
        name: 'Computer_Networks.md',
        content: `# Computer Networking

## OSI Reference Model
The Open Systems Interconnection (OSI) model characterizes and standardizes the communication functions of a telecommunication or computing system.

### Transport Layer
Layer 4 is the Transport Layer. It provides transparent transfer of data between end systems, or hosts, and is responsible for end-to-end error recovery and flow control. The Transmission Control Protocol (TCP) and User Datagram Protocol (UDP) operate at this layer.`
    }
];

// Test 1: Exact fact retrieval
console.log('Test 1: Query "Which organelle is responsible for protein synthesis?"');
const res1 = retrieveCapsuleContext("Which organelle is responsible for protein synthesis?", sampleCapsules);
console.log(`Has sufficient evidence: ${res1.hasSufficientEvidence}`);
console.log(`Top source: ${res1.sources[0]?.name} (${res1.sources[0]?.heading})`);
if (!res1.hasSufficientEvidence || !res1.context.includes('Ribosomes')) {
    throw new Error('Test 1 Failed: Ribosomes not retrieved');
}

// Test 2: Multi-choice question retrieval with options
console.log('\nTest 2: MCQ "What layer of the OSI model does TCP operate at? A. Network B. Transport C. Application"');
const res2 = retrieveCapsuleContext("What layer of the OSI model does TCP operate at? A. Network B. Transport C. Application", sampleCapsules);
console.log(`Has sufficient evidence: ${res2.hasSufficientEvidence}`);
console.log(`Top source: ${res2.sources[0]?.name} (${res2.sources[0]?.heading})`);
if (!res2.hasSufficientEvidence || !res2.context.includes('Transport Layer')) {
    throw new Error('Test 2 Failed: Transport Layer not retrieved');
}

// Test 3: Insufficient information query (question not in documents)
console.log('\nTest 3: Unrelated question "What is the capital of Australia?"');
const res3 = retrieveCapsuleContext("What is the capital of Australia?", sampleCapsules);
console.log(`Has sufficient evidence: ${res3.hasSufficientEvidence}`);
if (res3.hasSufficientEvidence) {
    throw new Error('Test 3 Failed: Should report insufficient evidence for unrelated query');
}
console.log('Correctly detected insufficient evidence!');

// Test 4: Answer verification
console.log('\nTest 4: Answer verification for Ribosomes vs Golgi');
const verCorrect = verifyAnswerAgainstSources("Ribosomes synthesize proteins", "B. Ribosomes", res1.sources);
const verIncorrect = verifyAnswerAgainstSources("Golgi apparatus generates electricity", "C. Golgi apparatus", res1.sources);
console.log(`Correct answer verified: ${verCorrect.isVerified} (Ratio: ${verCorrect.matchRatio})`);
console.log(`Incorrect answer verified: ${verIncorrect.isVerified} (Ratio: ${verIncorrect.matchRatio})`);
if (!verCorrect.isVerified || verIncorrect.isVerified) {
    throw new Error('Test 4 Failed: Verification gave wrong result');
}

console.log('\n=============================================');
console.log('🎉 ALL CAPSULE RAG PROTOTYPE TESTS PASSED!');
console.log('=============================================');
