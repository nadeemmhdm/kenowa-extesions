(() => {
  if (window.top !== window) return;

  let toolbar;
  let lastRangeRect = null;
  let responseCard;
  let responseText;
  let responseTimeoutId;
  let thinkingStatus;
  let followupInput;
  let followupSend;
  let regenerateButton;
  let stopButton;
  let activeRequestId = null;
  let activeConversation = [];
  let pendingPrompt = '';
  let pendingHistory = [];
  let pendingRegenerate = false;
  let lastPromptText = '';
  let lastPromptHistory = [];
  let cardDismissed = false;
  let cardToken = 0;
  let requestToken = 0;
  let requestBusy = false;

  const shadow = document.createElement('div');
  shadow.id = 'kenowa-selection-root';
  const root = shadow.attachShadow({ mode: 'closed' });
  const style = document.createElement('style');
  style.textContent = `
    :host { all: initial; }
    .toolbar, .response { position: fixed; z-index: 2147483647; font-family: Inter, ui-sans-serif, system-ui, sans-serif; color: #f5f5ff; }
    .toolbar { display: flex; gap: 4px; padding: 5px; border: 1px solid rgba(255,255,255,.16); border-radius: 11px; background: rgba(22,22,31,.97); box-shadow: 0 10px 32px rgba(0,0,0,.35); animation: in .16s ease-out; }
    button { border: 0; border-radius: 7px; padding: 7px 9px; color: #e9e9f5; background: transparent; font: 600 12px/1.1 inherit; cursor: pointer; white-space: nowrap; }
    .icon-button { width:32px; height:32px; display:inline-flex; align-items:center; justify-content:center; padding:7px; }
    .icon-button svg { width:16px; height:16px; display:block; }
    button:hover { background: rgba(79,142,247,.22); color: white; }
    .send { background: linear-gradient(135deg,#4f8ef7,#7c6af7); color: white; }
    .response { width:min(390px,calc(100vw - 20px)); max-height:min(520px,calc(100vh - 20px)); display:flex; flex-direction:column; overflow:hidden; border:1px solid rgba(95,145,255,.46); border-radius:14px; background:rgba(17,19,29,.985); box-shadow:0 18px 48px rgba(0,0,0,.48),0 0 0 1px rgba(255,255,255,.035) inset; font-size:13px; line-height:1.55; }
    .response-header { display:flex; align-items:center; justify-content:space-between; flex:0 0 auto; padding:10px 12px; border-bottom:1px solid rgba(255,255,255,.08); background:linear-gradient(100deg,rgba(79,142,247,.12),rgba(124,106,247,.07)); }
    .response-title { color:#b8ceff; font-size:10px; font-weight:800; letter-spacing:.13em; text-transform:uppercase; }
    .response-tools { display:flex; align-items:center; gap:6px; }
    .response-stop { padding:5px 8px; border:1px solid rgba(255,137,137,.28); border-radius:7px; background:rgba(239,83,80,.12); color:#ffb8b4; font-size:10px; }
    .response-stop[hidden] { display:none; }
    .response-regenerate { width:25px; height:25px; padding:5px; border:1px solid rgba(255,255,255,.12); border-radius:7px; background:rgba(255,255,255,.05); }
    .response-regenerate svg { width:14px; height:14px; display:block; }
    .response-regenerate:disabled { opacity:.4; cursor:default; }
    .response-close { width:25px; height:25px; padding:0; border:1px solid rgba(255,255,255,.14); border-radius:7px; background:rgba(255,255,255,.06); font:19px/20px ui-sans-serif,system-ui,sans-serif; }
    .response-body { min-height:52px; overflow:auto; padding:13px 12px 10px; color:#f0f1fa; white-space:normal; overflow-wrap:anywhere; display:flex; flex-direction:column; gap:9px; }
    .chat-turn { display:flex; width:100%; }
    .chat-turn.user { justify-content:flex-end; }
    .chat-turn.assistant { justify-content:flex-start; }
    .chat-bubble { max-width:90%; padding:9px 11px; border-radius:12px; white-space:normal; overflow-wrap:anywhere; }
    .chat-turn.user .chat-bubble { color:#f7f9ff; background:linear-gradient(135deg,rgba(61,112,220,.62),rgba(93,83,189,.55)); border:1px solid rgba(125,163,255,.3); border-bottom-right-radius:4px; }
    .chat-turn.assistant .chat-bubble { color:#e7eaf4; background:rgba(255,255,255,.055); border:1px solid rgba(255,255,255,.09); border-bottom-left-radius:4px; }
    .chat-speaker { margin-bottom:4px; color:#9ebdff; font-size:9px; font-weight:800; letter-spacing:.11em; text-transform:uppercase; }
    .chat-turn.user .chat-speaker { color:#c7d6ff; }
    .chat-bubble p:first-child { margin-top:0; } .chat-bubble p:last-child { margin-bottom:0; }
    .response-body strong { color:#fff; font-weight:750; }
    .response-body em { color:#e3e7ff; }
    .response-body u { text-decoration-color:#91b3ff; text-decoration-thickness:1px; text-underline-offset:2px; }
    .response-body h1,.response-body h2,.response-body h3,.response-body h4 { margin:10px 0 5px; color:#c2d5ff; line-height:1.3; }
    .response-body h1 { font-size:17px; } .response-body h2 { font-size:15px; } .response-body h3,.response-body h4 { font-size:13px; }
    .response-body ul,.response-body ol { margin:5px 0; padding-left:21px; }
    .response-body li { margin:2px 0; }
    .response-body blockquote { margin:7px 0; padding:5px 9px; border-left:2px solid #789fff; color:#c9d1e5; background:rgba(120,159,255,.07); }
    .response-body hr { border:0; border-top:1px solid rgba(255,255,255,.14); margin:8px 0; }
    .response-body .inline-code,.response-body code { border-radius:4px; padding:1px 4px; color:#c7d6ff; background:rgba(255,255,255,.08); font:11px/1.45 ui-monospace,SFMono-Regular,Consolas,monospace; }
    .response-body .code-block-wrapper { margin:8px 0; overflow:hidden; border:1px solid rgba(255,255,255,.1); border-radius:8px; background:#10131c; }
    .response-body .code-header { display:flex; align-items:center; justify-content:space-between; padding:5px 8px; color:#abb9d7; background:rgba(255,255,255,.045); font-size:10px; }
    .response-body .copy-code-btn { padding:4px 7px; border:1px solid rgba(255,255,255,.12); font-size:10px; }
    .response-body pre { overflow:auto; margin:0; padding:9px; white-space:pre; }
    .response-body pre code { padding:0; color:#e0e5f1; background:transparent; }
    .thinking-status { display:flex; align-items:center; gap:8px; padding:0 14px 10px; color:#aebcda; font-size:11px; }
    .thinking-status[hidden] { display:none; }
    .thinking-orbit { width:13px; height:13px; flex:0 0 auto; border:2px solid rgba(116,158,255,.25); border-top-color:#85aaff; border-right-color:#b19cff; border-radius:50%; animation:orbit .75s linear infinite; }
    .thinking-dots::after { content:'•••'; display:inline-block; width:17px; letter-spacing:1px; animation:dots 1.1s ease-in-out infinite; }
    .response-composer { display:flex; align-items:flex-end; gap:7px; flex:0 0 auto; margin:0 10px 10px; padding:7px; border:1px solid rgba(255,255,255,.1); border-radius:10px; background:rgba(255,255,255,.045); }
    .response-composer:focus-within { border-color:rgba(109,156,255,.55); box-shadow:0 0 0 2px rgba(79,142,247,.1); }
    .response-input { width:100%; min-height:32px; max-height:96px; resize:vertical; border:0; outline:0; background:transparent; color:#f5f5ff; font:12px/1.45 Inter,ui-sans-serif,system-ui,sans-serif; }
    .response-input::placeholder { color:#848ba1; }
    .response-send { width:31px; height:31px; flex:0 0 auto; display:grid; place-items:center; padding:0; border-radius:8px; background:linear-gradient(135deg,#4f8ef7,#7664e8); color:#fff; }
    .response-send:disabled { opacity:.42; cursor:default; }
    @keyframes orbit { to { transform:rotate(360deg); } }
    @keyframes dots { 0%,100% { opacity:.28; transform:translateY(0); } 50% { opacity:1; transform:translateY(-1px); } }
    @keyframes in { from { opacity: 0; transform: translateY(4px) scale(.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
    @media (prefers-reduced-motion: reduce) { .thinking-orbit,.thinking-dots::after { animation:none; } }
  `;
  root.appendChild(style);
  shadow.style.display = 'none';
  document.documentElement.appendChild(shadow);

  const getSelection = () => {
    const selection = window.getSelection();
    const text = selection?.toString().trim();
    if (!text || selection.rangeCount === 0) return null;
    const range = selection.getRangeAt(0);
    const rect = range.getBoundingClientRect();
    if (!rect || (!rect.width && !rect.height)) return null;
    return { text, rect };
  };

  const position = (element, rect, offset = 8) => {
    const width = element.offsetWidth || 210;
    const height = element.offsetHeight || 36;
    let left = Math.max(8, Math.min(window.innerWidth - width - 8, rect.left + (rect.width / 2) - (width / 2)));
    let top = rect.bottom + offset;
    if (top + height > window.innerHeight - 8) top = Math.max(8, rect.top - height - offset);
    element.style.left = `${left}px`;
    element.style.top = `${top}px`;
  };

  const hideToolbar = () => { if (toolbar) toolbar.remove(); toolbar = null; };

  const copyText = async text => {
    try { await navigator.clipboard.writeText(text); }
    catch { const area = document.createElement('textarea'); area.value = text; area.style.position = 'fixed'; area.style.opacity = '0'; document.body.appendChild(area); area.select(); document.execCommand('copy'); area.remove(); }
  };

  const clearResponseCard = () => {
    if (activeRequestId) chrome.runtime.sendMessage({ type: 'kenowa-selection-stop', requestId: activeRequestId }).catch(() => {});
    cardDismissed = true;
    cardToken++;
    requestToken++;
    clearTimeout(responseTimeoutId);
    responseTimeoutId = null;
    responseCard?.remove();
    responseCard = null;
    responseText = null;
    thinkingStatus = null;
    followupInput = null;
    followupSend = null;
    regenerateButton = null;
    stopButton = null;
    activeRequestId = null;
    requestBusy = false;
    activeConversation = [];
    pendingPrompt = '';
    pendingHistory = [];
    pendingRegenerate = false;
    lastPromptText = '';
    lastPromptHistory = [];
    if (!toolbar) shadow.style.display = 'none';
  };

  const setComposerBusy = busy => {
    requestBusy = busy;
    if (followupInput) followupInput.disabled = busy;
    if (followupSend) followupSend.disabled = busy;
    if (regenerateButton) regenerateButton.disabled = busy;
    if (stopButton) { stopButton.hidden = !busy; stopButton.disabled = !busy; }
  };

  const renderResponseMarkdown = text => {
    if (typeof parseMarkdown === 'function') responseText.innerHTML = parseMarkdown(String(text || ''));
    else { const safe = document.createElement('span'); safe.textContent = String(text || ''); responseText.innerHTML = safe.innerHTML.replace(/\n/g, '<br>'); }
    responseText.querySelectorAll('.copy-code-btn').forEach(button => button.addEventListener('click', async event => {
      event.stopPropagation();
      try { await copyText(decodeURIComponent(button.dataset.code || '')); button.textContent = 'Copied'; }
      catch { button.textContent = 'Copy failed'; }
    }));
  };

  const showConversation = (turns, loading = false) => {
    showResponse('', loading);
    if (!responseText) return;
    responseText.replaceChildren();
    (Array.isArray(turns) ? turns : []).forEach(turn => {
      const role = turn?.role === 'user' ? 'user' : 'assistant';
      const row = document.createElement('div');
      row.className = `chat-turn ${role}`;
      const bubble = document.createElement('div');
      bubble.className = 'chat-bubble';
      const speaker = document.createElement('div');
      speaker.className = 'chat-speaker';
      speaker.textContent = role === 'user' ? 'You' : 'Kenowa';
      const content = document.createElement('div');
      content.className = 'chat-content';
      if (typeof parseMarkdown === 'function') content.innerHTML = parseMarkdown(String(turn?.content || ''));
      else { const safe = document.createElement('span'); safe.textContent = String(turn?.content || ''); content.appendChild(safe); }
      content.querySelectorAll('.copy-code-btn').forEach(button => button.addEventListener('click', async event => {
        event.stopPropagation();
        try { await copyText(decodeURIComponent(button.dataset.code || '')); button.textContent = 'Copied'; }
        catch { button.textContent = 'Copy failed'; }
      }));
      bubble.append(speaker, content);
      row.appendChild(bubble);
      responseText.appendChild(row);
    });
    responseText.scrollTop = responseText.scrollHeight;
  };

  const stopActiveRequest = () => {
    if (!activeRequestId || !requestBusy) return;
    const requestId = activeRequestId;
    activeRequestId = null;
    requestToken++;
    clearTimeout(responseTimeoutId);
    responseTimeoutId = null;
    chrome.runtime.sendMessage({ type: 'kenowa-selection-stop', requestId }).catch(() => {});
    setComposerBusy(false);
    const turns = pendingRegenerate ? activeConversation : [...pendingHistory, ...(pendingPrompt ? [{ role: 'user', content: pendingPrompt }] : [])];
    showConversation([...turns, { role: 'assistant', content: 'Generation stopped. You can continue the chat or regenerate the previous answer.' }], false);
    pendingPrompt = '';
    pendingHistory = [];
    pendingRegenerate = false;
  };

  const showResponse = (text, loading = false) => {
    if (!lastRangeRect || cardDismissed) return;
    if (!responseCard) {
      responseCard = document.createElement('section');
      responseCard.className = 'response';
      responseCard.setAttribute('aria-label', 'Kenowa answer and follow-up chat');

      const header = document.createElement('div');
      header.className = 'response-header';
      const title = document.createElement('span');
      title.className = 'response-title';
      title.textContent = 'Kenowa · selected text';
      const tools = document.createElement('div');
      tools.className = 'response-tools';
      regenerateButton = document.createElement('button');
      regenerateButton.className = 'response-regenerate';
      regenerateButton.type = 'button';
      regenerateButton.setAttribute('aria-label', 'Regenerate answer');
      regenerateButton.title = 'Regenerate answer';
      regenerateButton.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20 7v5h-5"></path><path d="M4.9 9A8 8 0 0 1 18.4 6L20 12M4 12v5h5"></path><path d="M5.6 18A8 8 0 0 0 19.1 15"></path></svg>';
      regenerateButton.hidden = true;
      regenerateButton.addEventListener('click', event => {
        event.stopPropagation();
        if (lastPromptText && !requestBusy) sendSelectionPrompt(lastPromptText, false, { historyOverride: lastPromptHistory, regenerate: true });
      });
      stopButton = document.createElement('button');
      stopButton.className = 'response-stop';
      stopButton.type = 'button';
      stopButton.textContent = 'Stop';
      stopButton.setAttribute('aria-label', 'Stop answer generation');
      stopButton.hidden = true;
      stopButton.addEventListener('click', event => { event.stopPropagation(); stopActiveRequest(); });
      const closeButton = document.createElement('button');
      closeButton.className = 'response-close';
      closeButton.type = 'button';
      closeButton.setAttribute('aria-label', 'Close answer');
      closeButton.title = 'Close';
      closeButton.textContent = '×';
      closeButton.addEventListener('click', event => { event.stopPropagation(); clearResponseCard(); });
      tools.append(regenerateButton, stopButton, closeButton);
      header.append(title, tools);

      responseText = document.createElement('div');
      responseText.className = 'response-body';
      thinkingStatus = document.createElement('div');
      thinkingStatus.className = 'thinking-status';
      thinkingStatus.setAttribute('role', 'status');
      thinkingStatus.setAttribute('aria-live', 'polite');
      const orbit = document.createElement('span');
      orbit.className = 'thinking-orbit';
      orbit.setAttribute('aria-hidden', 'true');
      const thinkingLabel = document.createElement('span');
      thinkingLabel.className = 'thinking-dots';
      thinkingLabel.textContent = 'Thinking';
      thinkingStatus.append(orbit, thinkingLabel);

      const form = document.createElement('form');
      form.className = 'response-composer';
      followupInput = document.createElement('textarea');
      followupInput.className = 'response-input';
      followupInput.rows = 1;
      followupInput.maxLength = 4000;
      followupInput.placeholder = 'Ask a follow-up…';
      followupInput.setAttribute('aria-label', 'Ask a follow-up question');
      followupSend = document.createElement('button');
      followupSend.className = 'response-send';
      followupSend.type = 'submit';
      followupSend.setAttribute('aria-label', 'Send follow-up');
      followupSend.title = 'Send';
      followupSend.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M22 2 11 13"></path><path d="m22 2-7 20-4-9-9-4 20-7Z"></path></svg>';
      form.append(followupInput, followupSend);
      form.addEventListener('submit', event => {
        event.preventDefault();
        event.stopPropagation();
        const prompt = followupInput.value.trim();
        if (prompt && !requestBusy) sendSelectionPrompt(prompt, false);
      });
      followupInput.addEventListener('keydown', event => {
        if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); form.requestSubmit(); }
      });

      responseCard.append(header, responseText, thinkingStatus, form);
      root.appendChild(responseCard);
    }
    renderResponseMarkdown(text);
    thinkingStatus.hidden = !loading;
    if (regenerateButton) { regenerateButton.hidden = !lastPromptText; regenerateButton.disabled = loading; }
    responseCard.classList.toggle('loading', loading);
    setComposerBusy(loading);
    position(responseCard, lastRangeRect, 12);
    shadow.style.display = 'block';
  };

  const sendSelectionPrompt = (prompt, initial = false, options = {}) => {
    if (requestBusy || cardDismissed) return;
    const thisCard = cardToken;
    const thisRequest = ++requestToken;
    const history = Array.isArray(options.historyOverride) ? options.historyOverride.slice(-16) : activeConversation.slice(-16);
    const shouldWebSearch = true;
    const requestId = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 12)}`;
    activeRequestId = requestId;
    pendingPrompt = prompt;
    pendingHistory = history;
    pendingRegenerate = Boolean(options.regenerate);
    setComposerBusy(true);
    showConversation([...history, { role: 'user', content: prompt }], true);
    clearTimeout(responseTimeoutId);
    responseTimeoutId = setTimeout(() => {
      if (thisCard !== cardToken || thisRequest !== requestToken) return;
      responseTimeoutId = null;
      if (activeRequestId === requestId) activeRequestId = null;
      chrome.runtime.sendMessage({ type: 'kenowa-selection-stop', requestId }).catch(() => {});
      setComposerBusy(false);
      showConversation([...history, { role: 'user', content: prompt }, { role: 'assistant', content: 'No answer arrived within 90 seconds. Check your provider, API key, and selected model, then try again.' }], false);
    }, 90000);
    chrome.runtime.sendMessage({ type: 'kenowa-selection-generate', requestId, text: prompt, history, webSearch: shouldWebSearch })
      .then(result => {
        if (thisCard !== cardToken || thisRequest !== requestToken || cardDismissed) return;
        if (activeRequestId === requestId) activeRequestId = null;
        clearTimeout(responseTimeoutId);
        responseTimeoutId = null;
        setComposerBusy(false);
        if (result?.ok) {
          let answer = result.text || 'The model returned an empty answer.';
          const sources = (Array.isArray(result.sources) ? result.sources : []).filter(source => {
            try { return ['http:', 'https:'].includes(new URL(source.url).protocol); } catch (_) { return false; }
          });
          if (sources.length) answer += `\n\n## Sources\n${sources.map(source => `- [${String(source.title || 'Source').replace(/[\[\]]/g, '')}](${source.url.replace(/[)]/g, '%29')})`).join('\n')}`;
          else if (result.webSearchWarning) answer += '\n\n> **Live search note:** I could not retrieve readable web sources for this question, so current facts are not verified.';
          activeConversation = [...history, { role: 'user', content: prompt }, { role: 'assistant', content: answer }].slice(-16);
          lastPromptText = prompt;
          lastPromptHistory = history.slice(-16);
          if (!initial && followupInput) followupInput.value = '';
          showConversation(activeConversation, false);
        } else if (!result) {
          showConversation([...history, { role: 'user', content: prompt }, { role: 'assistant', content: 'Background did not return a response. Reload Kenowa in chrome://extensions, refresh this webpage, and try again.' }], false);
        } else showConversation([...history, { role: 'user', content: prompt }, { role: 'assistant', content: result.error || 'The background returned an error without details.' }], false);
      })
      .catch(error => {
        if (thisCard !== cardToken || thisRequest !== requestToken || cardDismissed) return;
        if (activeRequestId === requestId) activeRequestId = null;
        clearTimeout(responseTimeoutId);
        responseTimeoutId = null;
        setComposerBusy(false);
        showConversation([...history, { role: 'user', content: prompt }, { role: 'assistant', content: `Could not send this message. ${error?.message || 'The extension did not respond.'}` }], false);
      });
  };

  const createToolbar = selection => {
    hideToolbar();
    if (responseCard) clearResponseCard();
    cardDismissed = false;
    cardToken++;
      activeConversation = [];
      pendingPrompt = '';
      pendingHistory = [];
      lastPromptText = '';
      lastPromptHistory = [];
      pendingRegenerate = false;
    lastRangeRect = selection.rect;
    toolbar = document.createElement('div');
    toolbar.className = 'toolbar';
    const copy = document.createElement('button');
    copy.className = 'icon-button';
    copy.type = 'button';
    copy.setAttribute('aria-label', 'Copy selected text');
    copy.title = 'Copy selected text';
    const copyIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><rect x="8" y="8" width="13" height="13" rx="2"></rect><path d="M16 8V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h3"></path></svg>';
    const copiedIcon = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" aria-hidden="true"><path d="m5 12 4 4L19 6"></path></svg>';
    copy.innerHTML = copyIcon;
    copy.onclick = async event => {
      event.stopPropagation();
      try {
        await copyText(selection.text);
        copy.innerHTML = copiedIcon;
        copy.title = 'Copied';
        setTimeout(() => { if (copy.isConnected) { copy.innerHTML = copyIcon; copy.title = 'Copy selected text'; } }, 1200);
      } catch (error) {
        copy.title = `Copy failed: ${error?.message || 'Clipboard unavailable'}`;
      }
    };
    const send = document.createElement('button');
    send.className = 'send';
    send.textContent = 'Ask Kenowa';
    send.setAttribute('aria-label', 'Ask Kenowa about the selected text');
    send.title = 'Ask Kenowa';
    send.onclick = event => {
      event.stopPropagation();
      hideToolbar();
      sendSelectionPrompt(selection.text, true);
    };
    toolbar.append(copy, send);
    root.appendChild(toolbar);
    shadow.style.display = 'block';
    position(toolbar, selection.rect);
  };

  const refresh = () => {
    const selection = getSelection();
    if (selection) createToolbar(selection);
    else if (!responseCard) hideToolbar();
  };

  document.addEventListener('mouseup', event => { if (!event.composedPath().includes(shadow)) setTimeout(refresh, 0); }, true);
  document.addEventListener('keyup', event => { if (!event.composedPath().includes(shadow)) refresh(); }, true);
  window.addEventListener('scroll', () => { if (toolbar && lastRangeRect) position(toolbar, lastRangeRect); if (responseCard && lastRangeRect) position(responseCard, lastRangeRect, 12); }, true);
  document.addEventListener('mousedown', event => { if (toolbar && !shadow.contains(event.target)) hideToolbar(); }, true);
  document.addEventListener('click', event => {
    if (responseCard && !event.composedPath().includes(shadow)) clearResponseCard();
  }, true);

  chrome.runtime.onMessage.addListener(message => {
    if (message?.type === 'kenowa-selection-status') {
      if (!activeRequestId || message.requestId !== activeRequestId) return;
      const turns = pendingPrompt ? [...pendingHistory, { role: 'user', content: pendingPrompt }] : [];
      if (turns.length) showConversation(turns, true);
      else showResponse(message.text || 'Contacting the selected model…', true);
      return;
    }
    if (message?.type === 'kenowa-selection-error') {
      if (!activeRequestId || message.requestId !== activeRequestId) return;
      activeRequestId = null;
      clearTimeout(responseTimeoutId);
      responseTimeoutId = null;
      setComposerBusy(false);
      const turns = pendingPrompt ? [...pendingHistory, { role: 'user', content: pendingPrompt }] : [];
      showConversation([...turns, { role: 'assistant', content: message.text || 'Kenowa could not start this request.' }], false);
      return;
    }
    if (message?.type !== 'kenowa-selection-response') return;
    if (!message.partial) {
      clearTimeout(responseTimeoutId);
      responseTimeoutId = null;
    }
    showResponse(message.text || 'Kenowa returned an empty response.', Boolean(message.partial));
  });
})();
