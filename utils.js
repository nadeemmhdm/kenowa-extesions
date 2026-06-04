// ============================================================
// KENOWA AI — utils.js v2.2 (Secured)
// ============================================================

// SECURITY: Disable console logging in production to prevent leakage of data/keys
if (typeof process === 'undefined' || process.env?.NODE_ENV !== 'development') {
    const noop = () => {};
    console.log = noop;
    console.info = noop;
    console.warn = noop;
    // We retain console.error for critical debugs if absolutely necessary
}

// SECURITY: HTML entity escape — prevents XSS when inserting
// user-generated text into innerHTML contexts
function escapeHtml(str) {
    if (typeof str !== 'string') return '';
    return str
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
}

function parseMarkdown(text) {
    if (!text) return '';

    // 1. Code Blocks (preserve content)
    const codeBlocks = [];
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const placeholder = `@@CODEBLOCK${codeBlocks.length}@@`;
        codeBlocks.push({ lang: lang || 'text', code });
        return placeholder;
    });

    // 2. Inline Code (preserve content)
    const inlineCodeBlocks = [];
    text = text.replace(/`([^`]+)`/g, (match, code) => {
        const placeholder = `@@INLINECODE${inlineCodeBlocks.length}@@`;
        inlineCodeBlocks.push(code);
        return placeholder;
    });

    // 3. Headers
    text = text.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.*)$/gm, '<h1>$1</h1>');

    // 4. Horizontal Rule
    text = text.replace(/^---+$/gm, '<hr>');

    // 5. Unordered Lists
    text = text.replace(/^\s*[\-\*]\s+(.*)$/gm, '<ul><li>$1</li></ul>');
    text = text.replace(/<\/ul>\s*<ul>/g, '');

    // 6. Ordered Lists
    text = text.replace(/^\s*\d+\.\s+(.*)$/gm, '<ol><li>$1</li></ol>');
    text = text.replace(/<\/ol>\s*<ol>/g, '');

    // 7. Bold / Italic
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');
    text = text.replace(/\*([^\s*][^*]*?)\*/g, '<em>$1</em>');
    text = text.replace(/_([^\s_][^_]*?)_/g, '<em>$1</em>');

    // 8. Restore Inline Code
    inlineCodeBlocks.forEach((code, index) => {
        const escaped = escapeHtml(code);
        text = text.replace(`@@INLINECODE${index}@@`, `<code class="inline-code">${escaped}</code>`);
    });

    // 9. Restore Code Blocks
    codeBlocks.forEach((block, index) => {
        const language = block.lang;
        
        // Basic Syntax Highlighting Logic
        let code = block.code;
        const escapedCode = escapeHtml(code);
        
        // Apply basic regex-based highlighting to the escaped code
        let highlighted = escapedCode;
        
        // Keywords (simple set)
        highlighted = highlighted.replace(/\b(const|let|var|function|return|if|else|for|while|import|export|class|async|await|try|catch|new|this|throw|null|undefined|true|false)\b/g, '<span class="code-kw">$1</span>');
        
        // Strings (double and single quotes)
        highlighted = highlighted.replace(/(&quot;.*?&quot;|&#039;.*?&#039;)/g, '<span class="code-str">$1</span>');
        
        // Comments (single line)
        highlighted = highlighted.replace(/(\/\/.*?)<br>/g, '<span class="code-comment">$1</span><br>');
        
        // Numbers
        highlighted = highlighted.replace(/\b(\d+)\b/g, '<span class="code-num">$1</span>');

        // SECURITY: data-code stores encoded URI — safe for attribute
        const encodedForAttr = encodeURIComponent(block.code);

        const html = `
            <div class="code-block-wrapper">
                <div class="code-header">
                    <span class="code-lang">${escapeHtml(language)}</span>
                    <button class="copy-code-btn" data-code="${encodedForAttr}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy
                    </button>
                </div>
                <pre><code class="language-${escapeHtml(language)}">${highlighted}</code></pre>
            </div>
        `.trim();
        text = text.replace(`@@CODEBLOCK${index}@@`, html);
    });

    // 10. Links — SECURITY: only allow http/https URLs
    text = text.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) => {
        return `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
    });

    // 11. Newlines → <br>
    text = text.replace(/\n/g, '<br>');
    text = text.replace(/(<\/h[1-6]>|<\/ul>|<\/ol>|<\/li>|<\/p>)\s*<br>/g, '$1');
    text = text.replace(/<br>\s*(<h[1-6]>|<ul>|<ol>|<li>|<p>)/g, '$1');

    // 12. Blockquotes
    text = text.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');

    return text;
}

function formatDate(timestamp) {
    return new Date(parseInt(timestamp)).toLocaleString();
}

// ============================================================
// CRYPTO: AES-GCM Encryption for Secure Sync
// ============================================================

async function deriveKey(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await window.crypto.subtle.importKey(
        "raw", enc.encode(password), { name: "PBKDF2" }, false, ["deriveKey"]
    );
    return window.crypto.subtle.deriveKey(
        { name: "PBKDF2", salt: salt, iterations: 100000, hash: "SHA-256" },
        keyMaterial, { name: "AES-GCM", length: 256 }, true, ["encrypt", "decrypt"]
    );
}

async function encryptData(text, password) {
    const enc = new TextEncoder();
    const salt = window.crypto.getRandomValues(new Uint8Array(16));
    const iv = window.crypto.getRandomValues(new Uint8Array(12));
    const key = await deriveKey(password, salt);
    const encrypted = await window.crypto.subtle.encrypt(
        { name: "AES-GCM", iv: iv }, key, enc.encode(text)
    );
    
    // Package into a single base64 string
    const encryptedArray = new Uint8Array(encrypted);
    const combined = new Uint8Array(salt.length + iv.length + encryptedArray.length);
    combined.set(salt, 0);
    combined.set(iv, salt.length);
    combined.set(encryptedArray, salt.length + iv.length);
    
    return btoa(String.fromCharCode.apply(null, combined));
}

async function decryptData(base64Ciphertext, password) {
    const combined = new Uint8Array(atob(base64Ciphertext).split('').map(c => c.charCodeAt(0)));
    const salt = combined.slice(0, 16);
    const iv = combined.slice(16, 28);
    const data = combined.slice(28);
    
    const key = await deriveKey(password, salt);
    try {
        const decrypted = await window.crypto.subtle.decrypt(
            { name: "AES-GCM", iv: iv }, key, data
        );
        return new TextDecoder().decode(decrypted);
    } catch (e) {
        throw new Error("Decryption failed. Incorrect password or corrupted data.");
    }
}