process.env.NODE_ENV = 'development';
const assert = require('assert');
const utils = require('../utils.js');

console.log('=== VERIFYING NORMAL AI CHAT PRESERVATION (NO CAPSULES) ===\n');

// 1. When no capsules are selected:
const emptyCapsules = [];
const normalChatQuery = 'What is the capital of France?';
const ragRes = utils.retrieveCapsuleContext(normalChatQuery, emptyCapsules);

assert.strictEqual(ragRes.context, '', 'Context must be empty string when capsules are empty');
assert.strictEqual(ragRes.hasSufficientEvidence, false, 'hasSufficientEvidence must be false');
assert.deepStrictEqual(ragRes.sources, [], 'Sources must be empty array');

// 2. Indexing empty corpus returns zero chunks cleanly
const emptyIndex = utils.indexCorpus([]);
assert.strictEqual(emptyIndex.chunks.length, 0, 'Empty corpus must have 0 chunks');

// 3. Source verification with empty sources returns isVerified: false cleanly
const vRes = utils.verifyAnswerAgainstSources('Paris', 'Paris', []);
assert.strictEqual(vRes.isVerified, false, 'Empty sources must yield isVerified: false');
assert.strictEqual(vRes.grounded, false, 'Empty sources must yield grounded: false');

console.log('Normal AI chat behavior verified: zero regressions when Capsule is disabled.\n');
