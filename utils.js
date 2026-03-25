function parseMarkdown(text) {
    if (!text) return '';

    // 1. Code Blocks (preserve content)
    const codeBlocks = [];
    text = text.replace(/```(\w+)?\n([\s\S]*?)```/g, (match, lang, code) => {
        const placeholder = `__CODE_BLOCK_${codeBlocks.length}__`;
        codeBlocks.push({ lang, code });
        return placeholder;
    });

    // 2. Inline Code (preserve content)
    const inlineCodeBlocks = [];
    text = text.replace(/`([^`]+)`/g, (match, code) => {
        const placeholder = `__INLINE_CODE_${inlineCodeBlocks.length}__`;
        inlineCodeBlocks.push(code);
        return placeholder;
    });

    // 3. Block Elements processing

    // Headers
    text = text.replace(/^### (.*)$/gm, '<h3>$1</h3>');
    text = text.replace(/^## (.*)$/gm, '<h2>$1</h2>');
    text = text.replace(/^# (.*)$/gm, '<h1>$1</h1>');

    // Horizontal Rule
    text = text.replace(/^---+$/gm, '<hr>');

    // Lists (Unordered) - Support both - and *
    text = text.replace(/^\s*[\-\*]\s+(.*)$/gm, '<ul><li>$1</li></ul>');
    text = text.replace(/<\/ul>\s*<ul>/g, ''); // Merge adjacent lists

    // Lists (Ordered)
    text = text.replace(/^\s*\d+\.\s+(.*)$/gm, '<ol><li>$1</li></ol>');
    text = text.replace(/<\/ol>\s*<ol>/g, ''); // Merge adjacent lists

    // 4. Inline Formatting

    // Bold (**text** or __text__)
    text = text.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    text = text.replace(/__(.*?)__/g, '<strong>$1</strong>');

    // Italic (*text* or _text_)
    // Use slightly strict regex to avoid matching * inside words accidentally, 
    // though global * replacement is common in simple parsers.
    text = text.replace(/\*([^\s*][^*]*?)\*/g, '<em>$1</em>');
    text = text.replace(/_([^\s_][^_]*?)_/g, '<em>$1</em>');

    // 5. Restore Code
    // Restore inline first
    inlineCodeBlocks.forEach((code, index) => {
        // Escape HTML in code
        const escaped = code.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
        text = text.replace(`__INLINE_CODE_${index}__`, `<code class="inline-code">${escaped}</code>`);
    });

    // Restore blocks
    codeBlocks.forEach((block, index) => {
        const language = block.lang || 'text';
        const escapedCode = block.code.replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");

        const html = `
            <div class="code-block-wrapper">
                <div class="code-header">
                    <span class="code-lang">${language}</span>
                    <button class="copy-code-btn" data-code="${encodeURIComponent(block.code)}">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
                        Copy
                    </button>
                </div>
                <pre><code class="language-${language}">${escapedCode}</code></pre>
            </div>
        `.trim();
        text = text.replace(`__CODE_BLOCK_${index}__`, html);
    });

    // 6. Links (Markdown style [text](url))
    text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank">$1</a>');

    // 7. Paragraph Handling (Newlines)
    // Convert remaining newlines to <br> but avoid adding them inside list structures or around headers
    // Clean up <br> before/after block tags
    text = text.replace(/\n/g, '<br>');

    // Remove <br> immediately following block closing tags or preceding block opening tags to avoid huge gaps
    text = text.replace(/(<\/h[1-6]>|<\/ul>|<\/ol>|<\/li>|<\/p>)\s*<br>/g, '$1');
    text = text.replace(/<br>\s*(<h[1-6]>|<ul>|<ol>|<li>|<p>)/g, '$1');

    // Blockquotes
    text = text.replace(/^> (.*)$/gm, '<blockquote>$1</blockquote>');

    return text;
}

function formatDate(timestamp) {
    return new Date(parseInt(timestamp)).toLocaleString();
}
