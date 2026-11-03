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
    const source = String(text).replace(/\r\n?/g, '\n');
    const codeBlocks = [];
    const inlineCodeBlocks = [];
    let working = source.replace(/```([^\n]*)\n([\s\S]*?)```/g, (match, lang, code) => {
        const token = `@@CODEBLOCK${codeBlocks.length}@@`;
        codeBlocks.push({ lang: (lang || 'text').trim() || 'text', code });
        return token;
    });
    working = working.replace(/`([^`\n]+)`/g, (match, code) => {
        const token = `@@INLINECODE${inlineCodeBlocks.length}@@`;
        inlineCodeBlocks.push(code);
        return token;
    });

    const formatTokens = [];
    const tokenFor = html => {
        const token = `@@FMT${formatTokens.length}@@`;
        formatTokens.push(html);
        return token;
    };
    const inline = value => {
        let raw = String(value);
        raw = raw.replace(/!\[([^\]]*)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) => tokenFor(`<span class="md-image-label">${escapeHtml(label || 'Image')}</span>`));
        raw = raw.replace(/\[([^\]]+)\]\((https?:\/\/[^)]+)\)/g, (_, label, url) => tokenFor(`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`));
        raw = raw.replace(/\*\*\*(.+?)\*\*\*/g, (_, body) => tokenFor(`<strong><em>${inline(body)}</em></strong>`));
        raw = raw.replace(/___(.+?)___/g, (_, body) => tokenFor(`<strong><em>${inline(body)}</em></strong>`));
        raw = raw.replace(/<u>([\s\S]+?)<\/u>/gi, (_, body) => tokenFor(`<u>${inline(body)}</u>`));
        raw = raw.replace(/\+\+([^+\n]+?)\+\+/g, (_, body) => tokenFor(`<u>${inline(body)}</u>`));
        raw = raw.replace(/\*\*(.+?)\*\*/g, (_, body) => tokenFor(`<strong>${inline(body)}</strong>`));
        raw = raw.replace(/__(.+?)__/g, (_, body) => tokenFor(`<strong>${inline(body)}</strong>`));
        raw = raw.replace(/\*([^*\n]+?)\*/g, (_, body) => tokenFor(`<em>${escapeHtml(body)}</em>`));
        raw = raw.replace(/(^|[^\w])_([^_\n]+?)_(?!\w)/g, (_, before, body) => `${before}${tokenFor(`<em>${escapeHtml(body)}</em>`)}`);
        let html = escapeHtml(raw);
        html = html.replace(/@@FMT(\d+)@@/g, (_, index) => formatTokens[Number(index)] || '');
        return html;
    };

    const renderCodeBlock = block => {
        let highlighted = escapeHtml(block.code);
        highlighted = highlighted.replace(/\b(const|let|var|function|return|if|else|for|while|import|export|class|async|await|try|catch|new|this|throw|null|undefined|true|false)\b/g, '<span class="code-kw">$1</span>');
        highlighted = highlighted.replace(/(&quot;.*?&quot;|&#039;.*?&#039;)/g, '<span class="code-str">$1</span>');
        highlighted = highlighted.replace(/\b(\d+)\b/g, '<span class="code-num">$1</span>');
        return `<div class="code-block-wrapper"><div class="code-header"><span class="code-lang">${escapeHtml(block.lang)}</span><button class="copy-code-btn" data-code="${encodeURIComponent(block.code)}"><svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy</button></div><pre><code class="language-${escapeHtml(block.lang)}">${highlighted}</code></pre></div>`;
    };

    const lines = working.split('\n');
    const blocks = [];
    for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        if (!line.trim()) continue;
        const codeMatch = line.match(/^@@CODEBLOCK(\d+)@@$/);
        if (codeMatch) { blocks.push(renderCodeBlock(codeBlocks[Number(codeMatch[1])])); continue; }
        const heading = line.match(/^\s{0,3}(#{1,6})\s+(.+?)\s*$/);
        if (heading) { blocks.push(`<h${heading[1].length}>${inline(heading[2])}</h${heading[1].length}>`); continue; }
        if (/^\s*(---+|\*\s*\*\s*\*|___+)\s*$/.test(line)) { blocks.push('<hr>'); continue; }
        if (/^\s*[-*+]\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*[-*+]\s+/.test(lines[i])) items.push(`<li>${inline(lines[i].replace(/^\s*[-*+]\s+/, ''))}</li>`), i++;
            i--; blocks.push(`<ul>${items.join('')}</ul>`); continue;
        }
        if (/^\s*\d+\.\s+/.test(line)) {
            const items = [];
            while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) items.push(`<li>${inline(lines[i].replace(/^\s*\d+\.\s+/, ''))}</li>`), i++;
            i--; blocks.push(`<ol>${items.join('')}</ol>`); continue;
        }
        if (/^\s*>\s?/.test(line)) { blocks.push(`<blockquote>${inline(line.replace(/^\s*>\s?/, ''))}</blockquote>`); continue; }
        if (line.includes('|') && i + 1 < lines.length && /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)+\|?\s*$/.test(lines[i + 1])) {
            const splitRow = (r) => {
                let trimmed = r.trim();
                if (trimmed.startsWith('|')) trimmed = trimmed.slice(1);
                if (trimmed.endsWith('|')) trimmed = trimmed.slice(0, -1);
                return trimmed.split('|').map(c => c.trim());
            };
            const headerCells = splitRow(line);
            const sepCells = splitRow(lines[i + 1]);
            const alignments = sepCells.map(c => {
                const left = c.startsWith(':');
                const right = c.endsWith(':');
                if (left && right) return 'center';
                if (right) return 'right';
                if (left) return 'left';
                return '';
            });
            i += 2;
            const rows = [];
            while (i < lines.length && lines[i].trim() !== '' && lines[i].includes('|')) {
                rows.push(splitRow(lines[i]));
                i++;
            }
            i--;
            let tableHtml = '<div class="table-container"><table class="markdown-table"><thead><tr>';
            headerCells.forEach((c, idx) => {
                const align = alignments[idx] ? ` style="text-align:${alignments[idx]}"` : '';
                tableHtml += `<th${align}>${inline(c)}</th>`;
            });
            tableHtml += '</tr></thead><tbody>';
            rows.forEach(row => {
                tableHtml += '<tr>';
                for (let cIdx = 0; cIdx < headerCells.length; cIdx++) {
                    const c = row[cIdx] !== undefined ? row[cIdx] : '';
                    const align = alignments[cIdx] ? ` style="text-align:${alignments[cIdx]}"` : '';
                    tableHtml += `<td${align}>${inline(c)}</td>`;
                }
                tableHtml += '</tr>';
            });
            tableHtml += '</tbody></table></div>';
            blocks.push(tableHtml);
            continue;
        }
        blocks.push(inline(line));
    }
    let html = blocks.join('<br>');
    inlineCodeBlocks.forEach((code, index) => { html = html.replaceAll(`@@INLINECODE${index}@@`, `<code class="inline-code">${escapeHtml(code)}</code>`); });
    return html;
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
