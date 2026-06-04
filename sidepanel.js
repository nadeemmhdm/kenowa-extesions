// ============================================================
// KENOWA AI — sidepanel.js v2.2
// Full Exam Mode Fix | Multi-device Settings Sync | Security
// ============================================================

const BASE_URL  = "https://generativelanguage.googleapis.com/v1beta/models/";
const MODEL_QUICK = "gemini-2.0-flash";
const MODEL_DEEP  = "gemini-1.5-pro";
const MODEL_IMAGE = "gemini-2.0-flash-exp";
const APP_VERSION = "2.2.0";

// ── DOM refs ──────────────────────────────────────────────────
let chatContainer, messagesList, userInput, sendBtn, attachBtn, sqBtn, examModeBtn, fileInput, imagePreviewContainer;
let iconSend, iconStop, welcomeScreen, historySidebar, menuBtn, closeSidebarBtn, newChatBtn;
let historyList, typingIndicator, modeSelector, micBtn;
// let authModal, authFormContainer, maintenanceMsg, authUsernameInput, authPasswordInput, authSubmitBtn, authError, tabSignin, tabSignup, authTitle;
let lessonModal, lessonTitle, lessonText, lessonImage, lessonDots, lessonPrevBtn, lessonNextBtn, lessonSkipBtn;
let examDelayInput;
let scanPageBtn, personaSelector, syncPassInput, btnSyncBackup, btnSyncRestore;

// ── State ──────────────────────────────────────────────────────
let currentChatId   = null;
let chats           = {};
let abortController = null;
let isGenerating    = false;
let currentMode     = 'quick';
let EXAM_DURATION   = 30 * 60 * 1000;
let currentDraftImages     = [];
let isExamMode             = false;
let examModeTimeout        = null;
let examModeTabId          = null;
let currentActiveTabId     = null;
let currentTabChatMap      = {};
let examModeStartTime      = null;
let lastExamPageSignature  = "";
let lastExamAnswer         = "";
let examNoQuestionCount    = 0;   // consecutive "no questions" hits — auto-off after 2
let examCountdownInterval  = null;
let blockedWebsites        = [];
let currentLessonIndex     = 0;
let isSQMode           = false;
let lastSuggestionContainer = null;
let statusCheckInterval    = null;
let heartbeatInterval      = null;

// ── Security helpers ──────────────────────────────────────────
function sanitize(str) {
    if (typeof str !== 'string') return '';
    return str.replace(/[<>"'&]/g, c => ({'<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;','&':'&amp;'}[c]));
}
function isSafeUrl(url) {
    if (!url || typeof url !== 'string') return false;
    try { const p = new URL(url); return p.protocol==='http:'||p.protocol==='https:'; } catch(_){return false;}
}
function escapeHtml(str) {
    return String(str).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[c]));
}

// ── Safe user data ─────────────────────────────────────────────
function getStoredUser() { return {username: "local_user", session_token: "local_token"}; }

// ── Model badge ────────────────────────────────────────────────
// Model badge removed from UI - function kept for compatibility
function updateModelBadge() {
    // Badge removed from header - no action needed
    return;
}

// ── Key visibility toggle (CSP-safe, no inline onclick) ───────
function toggleKeyVisibility(inputId, btn) {
    const inp = document.getElementById(inputId);
    if (!inp) return;
    if (inp.type === 'password') { inp.type = 'text'; btn.textContent = '🙈'; }
    else { inp.type = 'password'; btn.textContent = '👁'; }
}

// ── Header: active tab domain label ───────────────────────────
function updateTabLabel(tab) {
    // Disabled - AI detection header removed
    return;
}

// ── Header: exam-running-on-other-tab badge ────────────────────
function updateExamModeIndicator() {
    // Disabled - AI detection header removed
    return;
}

// ── Version compare ────────────────────────────────────────────
const isVersionOlder = (current,latest) => {
    if(!latest) return false;
    const v1=String(current).replace(/[^0-9.]/g,'').split('.').map(Number);
    const v2=String(latest).replace(/[^0-9.]/g,'').split('.').map(Number);
    for(let i=0;i<Math.max(v1.length,v2.length);i++){
        if((v1[i]||0)<(v2[i]||0)) return true;
        if((v1[i]||0)>(v2[i]||0)) return false;
    }
    return false;
};

function loadCurrentMode() {
    const s=localStorage.getItem('kenowa_current_mode');
    if(['quick','deep','image'].includes(s)) currentMode=s;
}

function loadBlockedWebsites() {
    try { blockedWebsites=JSON.parse(localStorage.getItem('kenowa_blocked_websites')||'[]'); }
    catch(_){ blockedWebsites=[]; }
}

function isWebsiteBlocked(url) {
    if(!url||!blockedWebsites.length) return false;
    const lc=url.toLowerCase();
    return blockedWebsites.some(b=>typeof b==='string'&&lc.includes(b.toLowerCase()));
}

// ── Announcement Modal ─────────────────────────────────────────
const showAnnouncement = (data, mandatory=true) => {
    const modal   = document.getElementById('announcement-modal');
    if(!modal) return;
    const titleEl = document.getElementById('announcement-title');
    const verEl   = document.getElementById('announcement-version-tag');
    const descEl  = document.getElementById('announcement-desc');
    const dlBtn   = document.getElementById('announcement-download-link');
    const helpBtn = document.getElementById('announcement-help-link');
    const closeBtn= document.getElementById('close-ann-btn');
    if(titleEl) titleEl.textContent = data.version_name||(mandatory?"New Update Available":"System Announcement");
    if(verEl)   verEl.textContent   = `v${sanitize(String(data.version_number||''))}`;
    if(descEl)  descEl.textContent  = data.description||'';
    if(dlBtn){
        if(data.download_link&&isSafeUrl(data.download_link)){ dlBtn.href=data.download_link; dlBtn.classList.remove('hidden'); }
        else dlBtn.classList.add('hidden');
    }
    if(helpBtn){
        if(data.help_link&&isSafeUrl(data.help_link)){ helpBtn.href=data.help_link; helpBtn.classList.remove('hidden'); }
        else helpBtn.classList.add('hidden');
    }
    if(closeBtn){
        if(mandatory){ closeBtn.style.display='none'; }
        else{ closeBtn.style.display='block'; closeBtn.onclick=()=>{ modal.classList.add('hidden'); document.body.classList.remove('modal-open'); }; }
    }
    modal.classList.remove('hidden');
    document.body.classList.add('modal-open');
};

// ── Push Notification ──────────────────────────────────────────
function showPushNotification(notif) {
    const modal = document.getElementById('notification-modal');
    const title = document.getElementById('notification-title');
    const msg   = document.getElementById('notification-message');
    const linkBtn = document.getElementById('notification-link-btn');
    const btn   = document.getElementById('close-notification-btn');
    if(!modal) return;
    if(title) title.textContent = notif.title||'Notification';
    if(msg)   msg.textContent   = notif.message||'';
    if(linkBtn) {
        if(notif.link) {
            linkBtn.href = notif.link;
            linkBtn.classList.remove('hidden');
        } else {
            linkBtn.classList.add('hidden');
        }
    }
    modal.classList.remove('hidden');
    if(btn) btn.onclick=()=>modal.classList.add('hidden');
}

// ── Account Status Check ───────────────────────────────────────
const checkAccountStatus = async () => { return true; };

// ── Maintenance View ───────────────────────────────────────────
const showMaintenanceView = (endTime) => {
//     if(!authModal) return;
//     authModal.classList.remove('hidden');
    if(authFormContainer) authFormContainer.classList.add('hidden');
    if(maintenanceMsg){
        maintenanceMsg.classList.remove('hidden');
        let existing=maintenanceMsg.querySelector('#maintenance-timer-line');
        if(existing) existing.remove();
        if(endTime){
            const endMs=new Date(endTime.replace(' ','T')).getTime();
            if(endMs>Date.now()){
                const timerLine=document.createElement('p');
                timerLine.id='maintenance-timer-line';
                timerLine.style.cssText='font-size:14px;color:#ff4757;font-weight:600;margin-top:15px;padding:8px 15px;background:rgba(255,71,87,0.1);border-radius:8px;display:inline-block;';
                timerLine.textContent='Back in: 00:00';
                maintenanceMsg.appendChild(timerLine);
                const tick=setInterval(()=>{
                    const diff=endMs-Date.now();
                    if(diff<=0){ clearInterval(tick); checkAccountStatus(); return; }
                    const m=Math.floor(diff/60000),s=Math.floor((diff%60000)/1000);
                    timerLine.textContent=`Back in: ${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
                },1000);
            }
        }
    }
    document.body.classList.add('modal-open');
};

const hideMaintenanceView = () => {
//     if(!authModal) return;
    const existing=maintenanceMsg?maintenanceMsg.querySelector('#maintenance-timer-line'):null;
    if(existing) existing.remove();
//     if(getStoredUser()){ authModal.classList.add('hidden'); document.body.classList.remove('modal-open'); }
    else{
        if(authFormContainer) authFormContainer.classList.remove('hidden');
        if(maintenanceMsg) maintenanceMsg.classList.add('hidden');
    }
};

const forceLogout = (msg) => {
    localStorage.removeItem('kenowa_user');
    if(statusCheckInterval){ clearInterval(statusCheckInterval); statusCheckInterval=null; }
    if(heartbeatInterval){ clearInterval(heartbeatInterval); heartbeatInterval=null; }
    document.body.classList.add('modal-open');
};

// ── Local cooldown cover (in-panel) ───────────────────────────
function showLocalCooldownCover(endTime) {
    if(!endTime) return;
    const app=document.querySelector('.app-container');
    if(!app) return;
    let cover=document.getElementById('local-cooldown-cover');
    if(cover) return;
    cover=document.createElement('div');
    cover.id='local-cooldown-cover';
    Object.assign(cover.style,{
        position:'absolute',top:'0',left:'0',width:'100%',height:'100%',
        background:'rgba(10,10,15,0.97)',zIndex:'9000',display:'flex',
        flexDirection:'column',alignItems:'center',justifyContent:'center',
        fontFamily:'DM Sans,sans-serif',textAlign:'center',padding:'20px',
        animation:'fadeIn 0.4s ease'
    });
    const card=document.createElement('div');
    Object.assign(card.style,{background:'#16161f',padding:'32px 28px',borderRadius:'20px',
        border:'1px solid rgba(255,255,255,0.08)',boxShadow:'0 20px 60px rgba(0,0,0,0.7)',
        maxWidth:'320px',width:'100%'});
    const emoji=document.createElement('div');
    emoji.textContent='⏳';
    emoji.style.cssText='font-size:2.5rem;margin-bottom:16px;animation:kenowaTimerPulse 1.5s ease-in-out infinite';
    const h=document.createElement('h3');
    h.textContent='Cooldown Active';
    h.style.cssText='font-size:1.2rem;font-weight:700;margin-bottom:8px;color:#f0f0fa;';
    const p=document.createElement('p');
    p.textContent='Take a short break. AI will be available again soon.';
    p.style.cssText='color:#8888aa;font-size:0.85rem;margin-bottom:20px;';
    const timer=document.createElement('div');
    timer.id='local-cooldown-timer';
    timer.style.cssText='font-size:2rem;font-weight:700;color:#4f8ef7;font-variant-numeric:tabular-nums;';
    timer.textContent='--:--';
    card.appendChild(emoji); card.appendChild(h); card.appendChild(p); card.appendChild(timer);
    const style=document.createElement('style');
    style.textContent='@keyframes kenowaTimerPulse{0%,100%{opacity:1;}50%{opacity:0.6;}}';
    cover.appendChild(card);
    document.head.appendChild(style);
    app.appendChild(cover);
    const tick=setInterval(()=>{
        if(!document.getElementById('local-cooldown-cover')){ clearInterval(tick); return; }
        const diff=new Date(endTime.replace(' ','T')).getTime()-Date.now();
        if(diff<=0){ hideLocalCooldownCover(); clearInterval(tick); return; }
        const m=Math.floor(diff/60000),s=Math.floor((diff%60000)/1000);
        const el=document.getElementById('local-cooldown-timer');
        if(el) el.textContent=`${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
    },1000);
}

function hideLocalCooldownCover() {
    const c=document.getElementById('local-cooldown-cover');
    if(c) c.remove();
}

// ── Tab Tracking ───────────────────────────────────────────────
// ── Load a chat silently (no sidebar toggle) ─────────────────
function loadChatSilent(id) {
    if (!chats[id]) return;
    currentChatId = id;
    if (messagesList) messagesList.innerHTML = '';
    const hasMsg = chats[id].messages?.length > 0;
    if (welcomeScreen) welcomeScreen.classList.toggle('hidden', hasMsg);
    if (hasMsg) {
        chats[id].messages.forEach(m => {
            try {
                appendMessage(m.role, m.content, m.images || [], false, true);
            } catch (e) {
                console.error("Error rendering message during reload:", e);
            }
        });
    }
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ── Switch panel to the chat for a given tab ──────────────────
function switchChatToTab(tabId, tab) {
    if (currentTabChatMap[tabId] && chats[currentTabChatMap[tabId]]) {
        const cid = currentTabChatMap[tabId];
        if (cid !== currentChatId) loadChatSilent(cid);
    } else {
        // New tab — fresh chat
        const newId = Date.now().toString();
        currentChatId = newId;
        currentTabChatMap[tabId] = newId;
        if (messagesList) messagesList.innerHTML = '';
        if (welcomeScreen) welcomeScreen.classList.remove('hidden');
        clearImages();
        isGenerating = false; toggleSendButton(false);
    }
    // FIX: If exam is running on a DIFFERENT tab, always hide the typing indicator
    // so it doesn't bleed into the view of the non-exam tab's chat.
    if (isExamMode && examModeTabId !== null && tabId !== examModeTabId) {
        hideTypingIndicator();
    }
    updateTabLabel(tab);
    updateExamModeIndicator();
}

function initTabTracking() {
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        if (tabs?.[0]) {
            currentActiveTabId = tabs[0].id;
            checkAndBlockWebsite(tabs[0].id, tabs[0].url);
            switchChatToTab(tabs[0].id, tabs[0]);
        }
    });
    chrome.tabs.onActivated.addListener(info => {
        currentActiveTabId = info.tabId;
        chrome.tabs.get(info.tabId, tab => {
            if (chrome.runtime.lastError) return;
            if (tab?.url) checkAndBlockWebsite(info.tabId, tab.url);
            switchChatToTab(info.tabId, tab);
        });
    });
    chrome.tabs.onUpdated.addListener((tabId, info, tab) => {
        if (info.status === 'complete' && tab.url) {
            checkAndBlockWebsite(tabId, tab.url);
            if (tabId === currentActiveTabId) updateTabLabel(tab);
        }
    });
    chrome.tabs.onRemoved.addListener(tabId => {
        delete currentTabChatMap[tabId];
        if (tabId === examModeTabId) {
            examAppendMessage('📌 Exam tab was closed. Stopping Exam Mode.');
            if (isExamMode) toggleExamMode();
        }
    });
    // Listen for keyboard shortcut commands forwarded from background.js
    chrome.storage.onChanged.addListener((changes, area) => {
        if (area !== 'local' || !changes.kenowa_command) return;
        const cmd = changes.kenowa_command.newValue;
        if (!cmd || (Date.now() - cmd.ts) > 3000) return; // ignore stale commands
        if (cmd.name === 'toggle_exam_mode') toggleExamMode();
        else if (cmd.name === 'solve_question') handleSQ();
    });
}

function checkAndBlockWebsite(tabId,url) {
    if(!tabId||!url||!isSafeUrl(url)) return;
    if(isWebsiteBlocked(url)){
        chrome.runtime.sendMessage({action:'block_website',tabId}).catch(()=>{});
    }
}

// ── Onboarding Lesson Steps ────────────────────────────────────
const lessonSteps = [
    { title:"Welcome to Kenowa AI 👋", icon:`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><path d="M8 14s1.5 2 4 2 4-2 4-2"></path><line x1="9" y1="9" x2="9.01" y2="9"></line><line x1="15" y1="9" x2="15.01" y2="9"></line></svg>`,
      text:"Let's get you set up in 3 steps. Your settings will sync to the server so you can switch devices instantly." },
    { title:"Choose Your Provider", icon:`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>`,
      text:"Open <strong>Settings</strong> and pick your AI provider: <strong>Google Gemini</strong> (free tier available), <strong>OpenRouter</strong> (many models), or <strong>Ollama</strong>." },
    { title:"Get Your API Key", icon:`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 2l-2 2m-7.61 7.61a5.5 5.5 0 1 1-7.778 7.778 5.5 5.5 0 0 1 7.778-7.778zm0 0L15.5 7.5m0 0 3 3L22 7l-3-3m-3.5 3.5L19 4"></path></svg>`,
      text:"For Gemini: <a href='https://aistudio.google.com/app/apikey' target='_blank'>aistudio.google.com</a><br>For OpenRouter: <a href='https://openrouter.ai/keys' target='_blank'>openrouter.ai/keys</a><br>Paste the key in Settings." },
    { title:"Pick a Model", icon:`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>`,
      text:"Select a model from the <strong>Default AI Model</strong> dropdown. <em>Gemini 2.0 Flash</em> is fastest. <em>GPT-4o Mini</em> via OpenRouter is great for free usage." },
    { title:"Settings Sync ✓", icon:`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg>`,
      text:"Your API keys and model preference are <strong>saved to the server</strong>. On any new device, just sign in and your settings will auto-load!" },
    { title:"You're All Set! 🎉", icon:`<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`,
      text:"Type your first message and start chatting. Use <strong>EX</strong> for Exam Mode, <strong>SQ</strong> to solve any question on the page, and the mic for voice input!" }
];

function renderLesson() {
    const step=lessonSteps[currentLessonIndex];
    if(lessonTitle)  lessonTitle.textContent=step.title;
    if(lessonText)   lessonText.innerHTML=step.text;
    if(lessonImage)  lessonImage.innerHTML=step.icon;
    if(lessonDots){
        lessonDots.innerHTML='';
        lessonSteps.forEach((_,i)=>{ const d=document.createElement('div'); d.className=`dot ${i===currentLessonIndex?'active':''}`; lessonDots.appendChild(d); });
    }
    if(lessonPrevBtn) lessonPrevBtn.disabled=currentLessonIndex===0;
    if(lessonNextBtn){
        lessonNextBtn.innerHTML=currentLessonIndex===lessonSteps.length-1
            ?`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg>`
            :`<svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"></polyline></svg>`;
    }
}
function nextLesson() {
    if(currentLessonIndex<lessonSteps.length-1){ currentLessonIndex++; renderLesson(); }
    else skipLessons();
}
function prevLesson() { if(currentLessonIndex>0){ currentLessonIndex--; renderLesson(); } }
function skipLessons() {
    localStorage.setItem('kenowa_lesson_completed','true');
    if(lessonModal){ lessonModal.classList.add('hidden'); document.body.classList.remove('modal-open'); }
}
function showLessons() { currentLessonIndex=0; renderLesson(); if(lessonModal){ lessonModal.classList.remove('hidden'); document.body.classList.add('modal-open'); } }

function startIntervals() {
}

// ── DOMContentLoaded ───────────────────────────────────────────
document.addEventListener('DOMContentLoaded', async () => {
    loadCurrentMode();
    loadBlockedWebsites();

    chatContainer    = document.getElementById('chat-container');
    messagesList     = document.getElementById('messages-list');
    userInput        = document.getElementById('user-input');
    sendBtn          = document.getElementById('send-btn');
    attachBtn        = document.getElementById('attach-btn');
    sqBtn            = document.getElementById('sq-btn');
    examModeBtn      = document.getElementById('exam-mode-btn');
    fileInput        = document.getElementById('file-input');
    imagePreviewContainer = document.getElementById('image-preview-container');
    iconSend         = document.getElementById('icon-send');
    iconStop         = document.getElementById('icon-stop');
    welcomeScreen    = document.getElementById('welcome-screen');
    historySidebar   = document.getElementById('history-sidebar');
    menuBtn          = document.getElementById('menu-btn');
    closeSidebarBtn  = document.getElementById('close-sidebar-btn');
    newChatBtn       = document.getElementById('new-chat-btn');
    exportChatBtn    = document.getElementById('export-chat-btn');
    historyList      = document.getElementById('history-list');
    typingIndicator  = document.getElementById('typing-indicator');
    examDelayInput   = document.getElementById('settings-exam-delay-input');
    scanPageBtn      = document.getElementById('scan-page-btn');
    personaSelector  = document.getElementById('settings-persona-input');
    syncPassInput    = document.getElementById('settings-sync-pass');
    btnSyncBackup    = document.getElementById('btn-sync-backup');
    btnSyncRestore   = document.getElementById('btn-sync-restore');
//     authModal        = document.getElementById('auth-modal');
    authFormContainer= document.getElementById('auth-form-container');
    maintenanceMsg   = document.getElementById('maintenance-msg');
    authUsernameInput= document.getElementById('auth-username');
    authPasswordInput= document.getElementById('auth-password');
//     authSubmitBtn    = document.getElementById('auth-submit-btn');
//     authError        = document.getElementById('auth-error');
    authTitle        = document.getElementById('auth-title');
    tabSignin        = document.getElementById('tab-signin');
    tabSignup        = document.getElementById('tab-signup');
    lessonModal      = document.getElementById('lesson-modal');
    lessonTitle      = document.getElementById('lesson-title');
    lessonText       = document.getElementById('lesson-text');
    lessonImage      = document.getElementById('lesson-image');
    lessonDots       = document.getElementById('lesson-dots');
    lessonPrevBtn    = document.getElementById('lesson-prev-btn');
    lessonNextBtn    = document.getElementById('lesson-next-btn');
    lessonSkipBtn    = document.getElementById('lesson-skip-btn');

    const tabForgot     = document.getElementById('tab-forgot');
    const forgotLink    = document.getElementById('forgot-password-link');
    const groupPassword = document.getElementById('group-password');
    const groupEmail    = document.getElementById('group-email');
    const authEmailInput= document.getElementById('auth-email');
    const lessonRetryBtn= document.getElementById('lesson-retry-btn');
    const scrim         = document.getElementById('sidebar-scrim');

    if(lessonNextBtn) lessonNextBtn.addEventListener('click',nextLesson);
    if(lessonPrevBtn) lessonPrevBtn.addEventListener('click',prevLesson);
    if(lessonSkipBtn) lessonSkipBtn.addEventListener('click',skipLessons);
    if(lessonRetryBtn) lessonRetryBtn.addEventListener('click',showLessons);
    if(scrim) scrim.addEventListener('click',toggleSidebar);
    if(menuBtn) menuBtn.addEventListener('click',toggleSidebar);
    if(closeSidebarBtn) closeSidebarBtn.addEventListener('click',toggleSidebar);
    if(newChatBtn) newChatBtn.addEventListener('click',startNewChat);
    if(exportChatBtn) exportChatBtn.addEventListener('click',exportCurrentChat);
    const shareChatBtn = document.getElementById('share-chat-btn');
    if(shareChatBtn) shareChatBtn.addEventListener('click',shareCurrentChat);
    if(sendBtn) sendBtn.addEventListener('click',()=>{ isGenerating?stopGeneration():handleSend(); });
    if(attachBtn&&fileInput){ attachBtn.addEventListener('click',()=>fileInput.click()); fileInput.addEventListener('change',handleFileSelect); }
    if(sqBtn) sqBtn.addEventListener('click',handleSQ);
    if(examModeBtn) examModeBtn.addEventListener('click',toggleExamMode);
    if(scanPageBtn) scanPageBtn.addEventListener('click',scanCurrentPage);
    if(btnSyncBackup) btnSyncBackup.addEventListener('click',backupToCloud);
    if(btnSyncRestore) btnSyncRestore.addEventListener('click',restoreFromCloud);

    const settingsBtn = document.getElementById('settings-btn');
    const settingsModal = document.getElementById('settings-modal');
    const closeSettingsBtn = document.getElementById('close-settings-btn');
    const saveSettingsBtn = document.getElementById('save-settings-btn');
    const providerInput = document.getElementById('settings-provider-input');
    const keyInput = document.getElementById('settings-key-input');
    const openRouterKeyInput = document.getElementById('settings-openrouter-key-input');
    const ollamaKeyInput = document.getElementById('settings-ollama-key-input');
    const modelInput = document.getElementById('settings-model-input');

    if (settingsBtn) settingsBtn.addEventListener('click', () => {
        if (providerInput) providerInput.value = localStorage.getItem('kenowa_provider') || 'gemini';
        if (keyInput) keyInput.value = localStorage.getItem('kenowa_api_key') || '';
        if (openRouterKeyInput) openRouterKeyInput.value = localStorage.getItem('kenowa_openrouter_key') || '';
        if (ollamaKeyInput) ollamaKeyInput.value = localStorage.getItem('kenowa_ollama_key') || '';
        if (modelInput) modelInput.value = localStorage.getItem('kenowa_model') || 'gemini-2.0-flash';
        if (personaSelector) personaSelector.value = localStorage.getItem('kenowa_persona') || 'default';
        if (examDelayInput) examDelayInput.checked = localStorage.getItem('kenowa_exam_delay') === 'true';
        if (settingsModal) { settingsModal.classList.remove('hidden'); document.body.classList.add('modal-open'); }
    });

    if (closeSettingsBtn) closeSettingsBtn.addEventListener('click', () => {
        if (settingsModal) { settingsModal.classList.add('hidden'); document.body.classList.remove('modal-open'); }
    });

    if (saveSettingsBtn) saveSettingsBtn.addEventListener('click', () => {
        if (providerInput) localStorage.setItem('kenowa_provider', providerInput.value);
        if (keyInput) localStorage.setItem('kenowa_api_key', keyInput.value);
        if (openRouterKeyInput) localStorage.setItem('kenowa_openrouter_key', openRouterKeyInput.value);
        if (ollamaKeyInput) localStorage.setItem('kenowa_ollama_key', ollamaKeyInput.value);
        if (modelInput) localStorage.setItem('kenowa_model', modelInput.value);
        if (personaSelector) localStorage.setItem('kenowa_persona', personaSelector.value);
        if (examDelayInput) localStorage.setItem('kenowa_exam_delay', examDelayInput.checked ? 'true' : 'false');
        if (settingsModal) { settingsModal.classList.add('hidden'); document.body.classList.remove('modal-open'); }
        showToast('Settings saved successfully', 'success');
    });

    // CSP-safe key-visibility toggles (replaces inline onclick)
    document.querySelectorAll('[data-key-toggle]').forEach(btn => {
        btn.addEventListener('click', () => toggleKeyVisibility(btn.getAttribute('data-key-toggle'), btn));
    });

    if(userInput){
        userInput.addEventListener('keydown',(e)=>{ if(e.key==='Enter'&&!e.shiftKey){ e.preventDefault(); handleSend(); } });
        userInput.addEventListener('input',function(){ this.style.height='auto'; this.style.height=(this.scrollHeight)+'px'; if(this.value==='') this.style.height='24px'; });
    }

    if(modeSelector){
        modeSelector.addEventListener('change',(e)=>{
            currentMode=e.target.value;
            localStorage.setItem('kenowa_current_mode',currentMode);
            if(userInput) userInput.placeholder=currentMode==='image'?"Describe the image you want to generate...":"Message Kenowa or @mention a tab";
        });
        modeSelector.value=currentMode;
    }

    if(micBtn) micBtn.addEventListener('click',toggleVoiceInput);

    // Dynamic Suggestions will be handled via renderSuggestions()

    if(messagesList){
        messagesList.addEventListener('click',(e)=>{
            const btn=e.target.closest('.copy-code-btn');
            if(btn){ const code=decodeURIComponent(btn.getAttribute('data-code')||''); copyToClipboard(code,btn); }
        });
    }

    // Model badge removed from UI - event listener removed
    

const logoutBtnDirect=document.getElementById('logout-btn');
if(logoutBtnDirect){
    logoutBtnDirect.addEventListener('click',()=>{ if(confirm("Are you sure you want to sign out?")) forceLogout('Signed out successfully.'); });
}
    await loadChats();
    startIntervals();
    initTabTracking();
});

// ── Toast notification ─────────────────────────────────────────
function showToast(message,type='info') {
    let toast=document.getElementById('kenowa-toast');
    if(!toast){
        toast=document.createElement('div');
        toast.id='kenowa-toast';
        toast.style.cssText=`
            position:fixed;bottom:88px;left:50%;transform:translateX(-50%) translateY(20px);
            background:#16161f;border:1px solid rgba(255,255,255,0.1);color:#f0f0fa;
            padding:10px 18px;border-radius:12px;font-size:0.83rem;font-family:'DM Sans',sans-serif;
            z-index:99999;opacity:0;transition:all 0.3s var(--ease-spring);pointer-events:none;
            box-shadow:0 8px 30px rgba(0,0,0,0.5);white-space:nowrap;`;
        document.body.appendChild(toast);
    }
    const colours={success:'#3ecf8e',error:'#f25c5c',info:'#4f8ef7'};
    toast.style.borderColor=colours[type]||colours.info;
    toast.textContent=message;
    toast.style.opacity='1'; toast.style.transform='translateX(-50%) translateY(0)';
    setTimeout(()=>{ toast.style.opacity='0'; toast.style.transform='translateX(-50%) translateY(20px)'; },2500);
}

// ── Core Chat ──────────────────────────────────────────────────
function updateGreeting(name) {
    if(!welcomeScreen) return;
    const el=welcomeScreen.querySelector('.greeting');
    if(el) el.textContent=`Hi ${name||'there'}, what should we dive into today?`;
}

async function loadChats() {
    if(chrome.storage){ const r=await chrome.storage.local.get(['chats','lastChatId']); chats=r.chats||{}; renderHistoryList(); return r.lastChatId; }
    return null;
}
async function saveChats() {
    if(chrome.storage){ await chrome.storage.local.set({chats,lastChatId:currentChatId}); renderHistoryList(); }
}

function toggleSidebar() {
    if(!historySidebar) return;
    historySidebar.classList.toggle('show');
    const scrim=document.getElementById('sidebar-scrim');
    if(scrim) scrim.classList.toggle('show',historySidebar.classList.contains('show'));
}

function updateShareButtonVisibility() {
    const shareChatBtn = document.getElementById('share-chat-btn');
    if (!shareChatBtn) return;
    const chat = chats[currentChatId];
    if (chat && chat.messages && chat.messages.length > 0) {
        shareChatBtn.classList.remove('hidden');
    } else {
        shareChatBtn.classList.add('hidden');
    }
}

function startNewChat() {
    currentChatId = Date.now().toString();
    if (messagesList) messagesList.innerHTML = '';
    if (welcomeScreen) welcomeScreen.classList.remove('hidden');
    if (userInput) { userInput.value = ''; userInput.focus(); userInput.style.height = '24px'; }
    if (historySidebar) { historySidebar.classList.remove('show'); document.getElementById('sidebar-scrim')?.classList.remove('show'); }
    clearImages();
    if (currentActiveTabId) currentTabChatMap[currentActiveTabId] = currentChatId;
    isGenerating = false; toggleSendButton(false);
    lastSuggestionContainer = null;
    updateShareButtonVisibility();
}

function clearImages() { currentDraftImages=[]; renderImagePreviews(); if(fileInput) fileInput.value=''; }

function handleFileSelect(e) {
    Array.from(e.target.files||[]).forEach(file=>{
        if(!file.type.startsWith('image/')) return;
        if(file.size>10*1024*1024){ appendMessage('ai','Image too large. Use images under 10MB.'); return; }
        const reader=new FileReader();
        reader.onload=(ev)=>{ if(currentDraftImages.length<5){ currentDraftImages.push(ev.target.result); renderImagePreviews(); } };
        reader.readAsDataURL(file);
    });
}

function renderImagePreviews() {
    if(!imagePreviewContainer) return;
    imagePreviewContainer.innerHTML='';
    if(!currentDraftImages.length){ imagePreviewContainer.classList.add('hidden'); return; }
    imagePreviewContainer.classList.remove('hidden');
    currentDraftImages.forEach((imgSrc,index)=>{
        const wrapper=document.createElement('div'); wrapper.className='image-thumbnail-wrapper';
        const img=document.createElement('img'); img.src=imgSrc; img.className='image-thumbnail';
        const removeBtn=document.createElement('button'); removeBtn.className='remove-image-btn'; removeBtn.textContent='×';
        removeBtn.onclick=()=>{ currentDraftImages.splice(index,1); renderImagePreviews(); };
        wrapper.appendChild(img); wrapper.appendChild(removeBtn); imagePreviewContainer.appendChild(wrapper);
    });
}

function deleteChat(e,chatId) {
    e.stopPropagation(); if(!confirm('Delete this chat?')) return;
    delete chats[chatId]; saveChats();
    if(currentChatId===chatId) startNewChat();
    for(let tid in currentTabChatMap){ if(currentTabChatMap[tid]===chatId) delete currentTabChatMap[tid]; }
}

function toggleSendButton(loading) {
    isGenerating=loading;
    if(iconSend) iconSend.classList.toggle('hidden',loading);
    if(iconStop) iconStop.classList.toggle('hidden',!loading);
    if(sendBtn)  sendBtn.classList.toggle('stop',loading);
}

function linkify(text) {
    if(typeof text!=='string'||text.includes('<a href')) return text;
    return text.replace(/(https?:\/\/[^\s<>"]+)/g,url=>`<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(url)}</a>`);
}

function copyToClipboard(text,btnEl) {
    navigator.clipboard.writeText(text).then(()=>{ 
        const orig = btnEl.innerHTML;
        const hasIcon = btnEl.querySelector('svg');
        btnEl.innerHTML = (hasIcon ? hasIcon.outerHTML : '') + ' <span style="color:var(--success)">Copied!</span>';
        setTimeout(()=>{ btnEl.innerHTML=orig; },2000); 
    }).catch(()=>{});
}

// ── Message Rendering ──────────────────────────────────────────
function appendMessage(role,content,images=[],animate=false,isReload=false,targetChatId=null) {
    // Use targetChatId if provided, otherwise use currentChatId
    const chatId = targetChatId || currentChatId;
    if(welcomeScreen) welcomeScreen.classList.add('hidden');
    const msgDiv=document.createElement('div'); msgDiv.className=`message ${role}`;
    if(images&&images.length>0){
        const imgsDiv=document.createElement('div'); imgsDiv.style.cssText='display:flex;gap:5px;margin-bottom:5px;flex-wrap:wrap';
        images.forEach(img=>{ const src=typeof img==='string'?img:(img.image_url&&img.image_url.url); if(!src) return; const imgEl=document.createElement('img'); imgEl.src=src; imgEl.style.cssText='max-width:100px;border-radius:5px'; imgsDiv.appendChild(imgEl); });
        msgDiv.appendChild(imgsDiv);
    }
    const textDiv=document.createElement('div');
    if(role==='ai'&&animate){
        textDiv.className='typewriter-text'; msgDiv.appendChild(textDiv); if(messagesList) messagesList.appendChild(msgDiv);
        if(chatContainer) chatContainer.scrollTop=chatContainer.scrollHeight;
        let i=0;
        function type(){ if(i<content.length){ textDiv.textContent+=content.charAt(i++); if(chatContainer) chatContainer.scrollTop=chatContainer.scrollHeight; setTimeout(type,10); } else { const finalHTML=typeof parseMarkdown==='function'?parseMarkdown(content):escapeHtml(content); textDiv.innerHTML=linkify(finalHTML); addActions(msgDiv,content); if(!isReload) saveToHistory(role,content,images,chatId); } }
        type();
    } else {
        let innerHTML='';
        if(role==='user') innerHTML=escapeHtml(content).replace(/\n/g,'<br>');
        else { innerHTML=typeof parseMarkdown==='function'?parseMarkdown(content):escapeHtml(content); innerHTML=linkify(innerHTML); }
        textDiv.innerHTML=innerHTML;
        if(role==='ai') addActions(msgDiv,content);
        else if(role==='user'){
            const editBtn=document.createElement('button'); editBtn.className='edit-msg-btn';
            editBtn.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9"></path><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4 9.5-9.5z"></path></svg>`;
            editBtn.title="Edit message";
            editBtn.onclick=()=>{ if(userInput){ userInput.value=content; userInput.focus(); } };
            msgDiv.appendChild(editBtn);
        }
        msgDiv.appendChild(textDiv);
        if(messagesList) messagesList.appendChild(msgDiv);
        if(chatContainer) chatContainer.scrollTop=chatContainer.scrollHeight;
        if(!animate&&!isReload) saveToHistory(role,content,images,chatId);
    }
}

function addActions(parentDiv,content) {
    const actionsDiv=document.createElement('div'); actionsDiv.className='message-actions';
    const copyBtn=document.createElement('button'); copyBtn.className='action-btn';
    copyBtn.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg> Copy`;
    copyBtn.onclick=()=>copyToClipboard(content,copyBtn);
    const regenBtn=document.createElement('button'); regenBtn.className='action-btn';
    regenBtn.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> Retry`;
    regenBtn.onclick=()=>regenerateMessage();
    actionsDiv.appendChild(copyBtn); actionsDiv.appendChild(regenBtn); parentDiv.appendChild(actionsDiv);
}

// ── Share Chat ─────────────────────────────────────────────────
async function shareCurrentChat() {
}

function saveToHistory(role,content,images,chatId=null) {
    const targetChatId = chatId || currentChatId;
    if(!chats[targetChatId]){ chats[targetChatId]={title:content.substring(0,40)+(content.length>40?'...':''),messages:[],timestamp:Date.now()}; }
    chats[targetChatId].messages.push({role,content,images}); saveChats();
    updateShareButtonVisibility();
    if(typeof updateExportButtonVisibility === 'function') updateExportButtonVisibility();
}

// ── Advanced Features Helpers ─────────────────────────────────────
function getSystemPrompt() {
    const persona = localStorage.getItem('kenowa_persona') || 'default';
    if (persona === 'developer') return "You are an elite Senior Developer. Provide only code and technical explanations. Be concise and accurate.";
    if (persona === 'proofreader') return "You are an expert Proofreader. Fix grammar, spelling, and tone. Output only the improved text with a brief explanation of changes.";
    if (persona === 'studybuddy') return "You are a Study Buddy. Instead of giving direct answers, ask leading questions to help the user learn and think critically.";
    return "You are Kenowa AI, a helpful, secure, and offline-first assistant.";
}

async function scanCurrentPage() {
    try {
        const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs?.length || !tabs[0].url || tabs[0].url.startsWith('chrome://')) {
            appendMessage('ai', '⚠️ Cannot scan this page.'); return;
        }
        appendMessage('user', 'Scan this webpage for context.', []);
        showTypingIndicator('📄 Scanning webpage...');
        const res = await chrome.scripting.executeScript({
            target: { tabId: tabs[0].id },
            func: () => document.body.innerText
        });
        const text = res[0]?.result || '';
        if (!text.trim()) throw new Error('Page is empty');
        hideTypingIndicator();
        handleSend(`I have extracted the following text from the current webpage. Please provide a brief summary, and wait for my questions.\\n\\n${text.substring(0, 15000)}`);
    } catch(err) {
        hideTypingIndicator();
        appendMessage('ai', `⚠️ Failed to scan page: ${err.message}`);
    }
}

async function backupToCloud() {
    const pass = syncPassInput?.value;
    if (!pass) { showToast('⚠️ Please enter a Master Password first', 'error'); return; }
    if (btnSyncBackup) btnSyncBackup.textContent = 'Encrypting...';
    try {
        // Strip images from backup to save space, sync quota is tiny (100KB)
        const strippedChats = JSON.parse(JSON.stringify(chats));
        for (let cid in strippedChats) {
            strippedChats[cid].messages.forEach(m => m.images = []);
        }
        
        const dataStr = JSON.stringify(strippedChats);
        const encrypted = await encryptData(dataStr, pass);
        
        // Chunking for chrome.storage.sync (8KB per item limit)
        const chunkSize = 7500;
        const numChunks = Math.ceil(encrypted.length / chunkSize);
        
        if (numChunks > 12) { 
            throw new Error('Data too large for Cloud Sync (100KB limit). Please delete some chats.');
        }

        const dataToSave = { kenowa_backup_chunks: numChunks };
        for (let i = 0; i < numChunks; i++) {
            dataToSave[`kenowa_backup_${i}`] = encrypted.substring(i * chunkSize, (i + 1) * chunkSize);
        }
        
        // Clear old chunks first to avoid dangling data
        await chrome.storage.sync.clear();
        await chrome.storage.sync.set(dataToSave);
        
        showToast('✅ Encrypted Backup Saved to Cloud', 'success');
    } catch(err) {
        showToast(`❌ Backup failed: ${err.message.substring(0,30)}`, 'error');
    }
    if (btnSyncBackup) btnSyncBackup.textContent = 'Backup to Cloud';
}

async function restoreFromCloud() {
    const pass = syncPassInput?.value;
    if (!pass) { showToast('⚠️ Please enter your Master Password', 'error'); return; }
    if (btnSyncRestore) btnSyncRestore.textContent = 'Decrypting...';
    try {
        const meta = await chrome.storage.sync.get('kenowa_backup_chunks');
        let assembled = '';
        
        if (!meta.kenowa_backup_chunks) {
            // Fallback for non-chunked legacy backup
            const legacy = await chrome.storage.sync.get('kenowa_backup');
            if (!legacy.kenowa_backup) throw new Error('No backup found in cloud');
            assembled = legacy.kenowa_backup;
        } else {
            const numChunks = meta.kenowa_backup_chunks;
            const keys = [];
            for (let i = 0; i < numChunks; i++) keys.push(`kenowa_backup_${i}`);
            
            const chunksData = await chrome.storage.sync.get(keys);
            for (let i = 0; i < numChunks; i++) {
                if (!chunksData[`kenowa_backup_${i}`]) throw new Error('Backup corrupted');
                assembled += chunksData[`kenowa_backup_${i}`];
            }
        }

        const decrypted = await decryptData(assembled, pass);
        chats = JSON.parse(decrypted);
        await saveChats();
        showToast('✅ Backup Restored Successfully', 'success');
        if (chats[currentChatId]) {
            if (messagesList) messagesList.innerHTML = '';
            chats[currentChatId].messages.forEach(m => appendMessage(m.role, m.content, m.images, false, true));
        }
    } catch(err) {
        showToast(`❌ Restore failed: ${err.message.substring(0,30)}`, 'error');
    }
    if (btnSyncRestore) btnSyncRestore.textContent = 'Restore Data';
}

// ── Send & API ─────────────────────────────────────────────────
async function handleSend(textOverride=null) {
    let text=textOverride||(userInput?userInput.value.trim():'');
    const hasImages=currentDraftImages.length>0;
    if(!text&&!hasImages) return;
    const isOk=await checkAccountStatus(); if(!isOk) return;
    const imagesToSend=[...currentDraftImages];
    if(!textOverride&&userInput){ userInput.value=''; userInput.style.height='24px'; appendMessage('user',text,imagesToSend); clearImages(); }
    
    // Web Search Trigger
    if (text.startsWith('/search ')) {
        const query = text.replace('/search ', '').trim();
        if (!textOverride) appendMessage('user', text, imagesToSend);
        showTypingIndicator(`🔍 Searching the web for: ${query}...`);
        try {
            const searchRes = await fetch(`https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`);
            const searchHtml = await searchRes.text();
            const doc = new DOMParser().parseFromString(searchHtml, 'text/html');
            const results = Array.from(doc.querySelectorAll('.result__snippet')).slice(0, 3).map(el => el.textContent.trim()).join('\\n\\n');
            text = `I searched the web for "${query}". Here are the top results:\\n\\n${results}\\n\\nBased on this, answer my query: ${query}`;
        } catch(err) {
            hideTypingIndicator(); appendMessage('ai', '⚠️ Web search failed.'); return;
        }
    }

    const indicatorText=currentMode==='deep'?"Thinking deeply...":currentMode==='image'?"Painting masterpiece...":"Kenowa is thinking...";
    showTypingIndicator(indicatorText); toggleSendButton(true);
    if(lastSuggestionContainer) {
        lastSuggestionContainer.remove();
        lastSuggestionContainer = null;
    }
    abortController = new AbortController();

    if (!currentChatId) currentChatId = Date.now().toString();
    const lockedChatId = currentChatId;
    const sysPrompt = getSystemPrompt();

    try {
        const provider=localStorage.getItem('kenowa_provider')||'gemini';
        let model=localStorage.getItem('kenowa_model')||MODEL_QUICK;
        let apiKey,url,body,headers={'Content-Type':'application/json'};

        if(provider==='gemini'){
            apiKey=localStorage.getItem('kenowa_api_key');
            if(!apiKey){ appendMessage('ai','⚙️ No Gemini API Key found. Open Settings to add one.'); return; }
            if(currentMode==='deep') model=MODEL_DEEP;
            else if(currentMode==='image') model=MODEL_IMAGE;
            if(currentMode==='image'&&!checkImageGenLimit()){ appendMessage('ai',"🔒 Daily image limit reached. Try again tomorrow!"); return; }
            const parts=[]; if(text) parts.push({text});
            for(const imgDataUrl of imagesToSend){ const[header,base64Data]=imgDataUrl.split(','); const mimeMatch=header.match(/:(.*?);/); if(mimeMatch) parts.push({inline_data:{mime_type:mimeMatch[1],data:base64Data}}); }
            if(!parts.length) return;
            url=`${BASE_URL}${model}:generateContent?key=${apiKey}`;
            body=JSON.stringify({system_instruction:{parts:[{text:sysPrompt}]},contents:[{parts}]});
        } else if(provider==='openrouter'){
            apiKey=localStorage.getItem('kenowa_openrouter_key');
            if(!apiKey){ appendMessage('ai','⚙️ No OpenRouter API Key found. Open Settings to add one.'); return; }
            const contentArr=[]; if(text) contentArr.push({type:'text',text});
            for(const img of imagesToSend) contentArr.push({type:'image_url',image_url:{url:img}});
            if(!contentArr.length) return;
            url='https://openrouter.ai/api/v1/chat/completions';
            body=JSON.stringify({model,messages:[{role:'system',content:sysPrompt},{role:'user',content:contentArr}]});
            headers['Authorization']=`Bearer ${apiKey}`; headers['HTTP-Referer']='https://kenowa.extension'; headers['X-Title']='Kenowa Extension';
        } else if(provider==='ollama'){
            apiKey=localStorage.getItem('kenowa_ollama_key');
            if(!apiKey){ appendMessage('ai','⚙️ No Ollama API Key found. Open Settings to add one.'); return; }
            const ollamaImages=imagesToSend.map(img=>img.split(',')[1]).filter(Boolean);
            url='https://ollama.com/api/chat';
            body=JSON.stringify({model,messages:[{role:'system',content:sysPrompt},{role:'user',content:text||"Analyze this image",...(ollamaImages.length?{images:ollamaImages}:{})}],stream:false});
            headers['Authorization']=`Bearer ${apiKey}`;
        }

        const response=await fetch(url,{method:'POST',headers,body,signal:abortController.signal});
        if(!response.ok){ let e=`API error ${response.status}`; try{const ed=await response.json();e=ed.error?.message||JSON.stringify(ed);}catch(_){} throw new Error(e); }
        const data=await response.json();
        let aiMessage=''; let imageResponses=[];
        if(provider==='gemini'){ const parts=data.candidates?.[0]?.content?.parts||[]; for(const p of parts){ if(p.text) aiMessage+=p.text; else if(p.inline_data) imageResponses.push(`data:${p.inline_data.mime_type||'image/png'};base64,${p.inline_data.data}`); } }
        else if(provider==='openrouter') aiMessage=data.choices?.[0]?.message?.content||'';
        else if(provider==='ollama') aiMessage=data.message?.content||'';
        hideTypingIndicator();
        if(imageResponses.length>0){ if(currentMode==='image'&&provider==='gemini') logImageGenSuccess(); appendMessage('ai',aiMessage||"Here's what I generated:",imageResponses,false,false,lockedChatId); }
        else {
            appendMessage('ai',aiMessage||"No content generated.",[],true,false,lockedChatId);
            // Dynamic suggestions after AI response
            if (!isExamMode && !isSQMode && currentMode !== 'image') {
                setTimeout(() => getAISuggestions(text, aiMessage), 500);
            }
        }
    } catch(err){
        hideTypingIndicator();
        if(err.name!=='AbortError') appendMessage('ai',`⚠️ Error: ${sanitize(err.message)}`,[],false,false,lockedChatId);
    } finally { toggleSendButton(false); abortController=null; }
}

function checkImageGenLimit() { const l=localStorage.getItem('kenowa_last_image_gen'); if(!l) return true; const d=new Date(parseInt(l)),now=new Date(); return d.getDate()!==now.getDate()||d.getMonth()!==now.getMonth()||d.getFullYear()!==now.getFullYear(); }
function logImageGenSuccess() { localStorage.setItem('kenowa_last_image_gen',Date.now().toString()); }
function stopGeneration() { if(abortController){ abortController.abort(); hideTypingIndicator(); toggleSendButton(false); } }

// ── SQ (Solve Question) ────────────────────────────────────────
async function handleSQ() {
    isSQMode = true;
    try {
        const tabs=await chrome.tabs.query({active:true,currentWindow:true});
        if(!tabs?.length) return;
        const tab=tabs[0];
        if(!tab.url||tab.url.startsWith('chrome://')){ appendMessage('ai','Cannot analyze system pages.'); return; }
        showTypingIndicator("Scanning page for questions & selecting answer...");
        
        const extraction=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>document.body.innerText});
        if(extraction?.[0]?.result){
            const pageText=extraction[0].result.substring(0,14000);
            const prompt=`You are an expert exam-answering assistant. Below is raw text scraped from an online quiz/exam page.

TASK:
1. Find every visible multiple-choice or multi-select question.
2. Pick the single best correct answer for each question.
3. Return ONLY a valid JSON array of exact answer texts, copied word-for-word from the page.
4. Include NOTHING else — no explanations, numbers, or commentary.
5. If the page has no answerable questions, return: []

IMPORTANT: Copy the answer text EXACTLY as it appears. Even minor differences will prevent selection.

Page text:
${pageText}`;

            const aiRaw = await apiGenerateText(prompt);
            hideTypingIndicator();
            
            if (!aiRaw?.trim() || aiRaw.trim() === '[]') {
                appendMessage('ai', 'ℹ️ No questions/answers detected on this page.');
            } else {
                appendMessage('ai', `✅ Answer: ${aiRaw.length > 100 ? aiRaw.substring(0, 100) + '…' : aiRaw}`);
                
                // Save to QA training cache
                const questionForHash = pageText.substring(0, 2000);
                saveQACache(questionForHash, aiRaw, 70);
                
                await executeExamClicker(tab.id, aiRaw, false, false, false, false);
            }
        } else { hideTypingIndicator(); appendMessage('ai','Could not read page content.'); }
    } catch(err){ hideTypingIndicator(); appendMessage('ai',`Error scanning page: ${sanitize(err.message)}`); }
    finally { isSQMode = false; }
}

// ── Summarize ──────────────────────────────────────────────────
async function summarizePage() {
    try {
        const tabs=await chrome.tabs.query({active:true,currentWindow:true});
        if(!tabs?.length) return;
        const tab=tabs[0];
        if(!tab.url||!isSafeUrl(tab.url)){ appendMessage('ai','I cannot summarize this page type.'); return; }
        const result=await chrome.scripting.executeScript({target:{tabId:tab.id},func:()=>document.body.innerText});
        if(result?.[0]?.result) handleSend(`Summarize the following page content in a concise, bulleted format:\n\n${result[0].result.substring(0,4000)}`);
        else appendMessage('ai','Could not read page content.');
    } catch(err){ appendMessage('ai',`Summarization failed: ${sanitize(err.message)}`); }
}

async function getAISuggestions(userMsg, aiMsg) {
    if (!userMsg || !aiMsg || isExamMode || isSQMode || currentMode === 'image') return;
    
    const prompt = `You are a helpful AI. Based on the user's message: "${userMsg.substring(0,200)}" and my response: "${aiMsg.substring(0,300)}", suggest 3 short, relevant follow-up questions the user might want to ask next. 
    Return ONLY the 3 suggestions, one per line, each starting with "- ". Keep each suggestion under 6 words.`;
    
    try {
        const raw = await apiGenerateText(prompt);
        if (raw) {
            const suggestions = raw.split('\n')
                .map(s => s.replace(/^-\s*/, '').replace(/^["']|["']$/g, '').trim())
                .filter(s => s.length > 5 && s.length < 100)
                .slice(0, 3);
            if (suggestions.length > 0) renderSuggestions(suggestions);
        }
    } catch (e) {}
}

function renderSuggestions(suggestions) {
    if (!messagesList || !suggestions.length) return;
    
    const container = document.createElement('div');
    container.className = 'suggestions-container';
    const grid = document.createElement('div');
    grid.className = 'suggestions-grid';
    
    suggestions.forEach(text => {
        const chip = document.createElement('button');
        chip.className = 'suggestion-chip';
        chip.textContent = text;
        chip.onclick = () => {
            if (lastSuggestionContainer) {
                lastSuggestionContainer.remove();
                lastSuggestionContainer = null;
            }
            if (userInput) {
                userInput.value = text;
                handleSend();
            }
        };
        grid.appendChild(chip);
    });
    
    container.appendChild(grid);
    messagesList.appendChild(container);
    lastSuggestionContainer = container;
    
    if (chatContainer) chatContainer.scrollTop = chatContainer.scrollHeight;
}

// ── Regenerate ─────────────────────────────────────────────────
function regenerateMessage() {
    const chat=chats[currentChatId]; if(!chat?.messages?.length) return;
    let lastUserMsg=null,spliceIndex=-1;
    for(let i=chat.messages.length-1;i>=0;i--){ if(chat.messages[i].role==='user'){ lastUserMsg=chat.messages[i]; spliceIndex=i+1; break; } }
    if(!lastUserMsg) return;
    const allMessages=messagesList?.querySelectorAll('.message');
    if(allMessages){ for(let i=spliceIndex;i<chat.messages.length;i++){ if(allMessages[i]) allMessages[i].remove(); } }
    chat.messages.splice(spliceIndex); saveChats();
    currentDraftImages=(lastUserMsg.images||[]).map(img=>typeof img==='string'?img:img?.image_url?.url).filter(Boolean);
    handleSend(lastUserMsg.content);
}

// ── Typing Indicator ───────────────────────────────────────────
function showTypingIndicator(message="Thinking...") {
    if(!typingIndicator) return;
    typingIndicator.innerHTML=`<span class="thinking-text">${sanitize(message)}</span>`;
    typingIndicator.classList.remove('hidden');
    if(chatContainer) chatContainer.scrollTop=chatContainer.scrollHeight;
}
function hideTypingIndicator() { typingIndicator?.classList.add('hidden'); }

// ── History ────────────────────────────────────────────────────
function renderHistoryList() {
    if(!historyList) return; historyList.innerHTML='';
    const ids=Object.keys(chats).sort((a,b)=>chats[b].timestamp-chats[a].timestamp);
    ids.forEach(id=>{
        const chat=chats[id]; const item=document.createElement('div'); item.className='history-item';
        const titleSpan=document.createElement('span'); titleSpan.className='history-item-title'; titleSpan.textContent=chat.title||'New Chat';
        const deleteBtn=document.createElement('button'); deleteBtn.className='delete-chat-btn';
        deleteBtn.innerHTML=`<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>`;
        deleteBtn.onclick=e=>deleteChat(e,id);
        item.appendChild(titleSpan); item.appendChild(deleteBtn);
        item.onclick=e=>{ if(!e.target.closest('.delete-chat-btn')) loadChat(id,true); };
        historyList.appendChild(item);
    });
}

function loadChat(id,closeSidebar=true) {
    currentChatId=id; const chat=chats[id]; saveChats();
    if(messagesList) messagesList.innerHTML='';
    if(welcomeScreen) welcomeScreen.classList.add('hidden');
    lastSuggestionContainer = null;
    if (chat && chat.messages) {
        chat.messages.forEach(msg => {
            try {
                appendMessage(msg.role, msg.content, msg.images || [], false, true);
            } catch (e) {
                console.error("Error rendering message during load:", e);
            }
        });
    }
    if(closeSidebar) toggleSidebar();
    if(chatContainer) chatContainer.scrollTop=chatContainer.scrollHeight;
    updateShareButtonVisibility();
}

// ── Voice Input ────────────────────────────────────────────────
let recognition;
function toggleVoiceInput() {
    if(!('webkitSpeechRecognition' in window)){ appendMessage('ai','Speech recognition not supported in this browser.'); return; }
    if(recognition&&recognition.active){ recognition.stop(); return; }
    recognition=new webkitSpeechRecognition();
    recognition.continuous=false; recognition.interimResults=true; recognition.lang='en-US';
    recognition.onstart=()=>{ recognition.active=true; micBtn?.classList.add('mic-active'); if(userInput) userInput.placeholder="Listening..."; };
    recognition.onresult=(event)=>{ let final='',interim=''; for(let i=event.resultIndex;i<event.results.length;i++){ if(event.results[i].isFinal) final+=event.results[i][0].transcript; else interim+=event.results[i][0].transcript; } if(userInput){ userInput.value=final+interim; userInput.style.height='auto'; userInput.style.height=userInput.scrollHeight+'px'; } };
    recognition.onerror=()=>stopRecognitionUI();
    recognition.onend=()=>stopRecognitionUI();
    recognition.start();
}
function stopRecognitionUI() { if(recognition) recognition.active=false; micBtn?.classList.remove('mic-active'); if(userInput) userInput.placeholder="Message Kenowa or @mention a tab"; }

// ── Settings Sync ──────────────────────────────────────────────
async function syncSettingsToServer() {
}

function exportCurrentChat() {
    const chat = chats[currentChatId];
    if (!chat || !chat.messages || chat.messages.length === 0) {
        showToast("No chat history to export.", "warn");
        return;
    }
    
    let markdown = `# ${chat.title || "Kenowa Chat Export"}\n\n`;
    markdown += `*Exported on: ${new Date().toLocaleString()}*\n\n---\n\n`;
    
    chat.messages.forEach(msg => {
        const roleName = msg.role === 'user' ? 'You' : 'Kenowa AI';
        markdown += `### ${roleName}\n${msg.content}\n\n`;
    });
    
    const blob = new Blob([markdown], { type: "text/markdown" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Kenowa_Chat_${currentChatId}.md`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    showToast("Chat exported successfully!", "success");
}

function updateExportButtonVisibility() {
    if (!exportChatBtn) return;
    const chat = chats[currentChatId];
    if (chat && chat.messages && chat.messages.length > 0) {
        exportChatBtn.classList.remove('hidden');
    } else {
        exportChatBtn.classList.add('hidden');
    }
}

// ════════════════════════════════════════════════════════════════
// EXAM MODE — Fully Rewritten
// ════════════════════════════════════════════════════════════════

async function apiGenerateText(prompt) {
    const isOk=await checkAccountStatus(); if(!isOk) return null;
    const provider=localStorage.getItem('kenowa_provider')||'gemini';
    const model=localStorage.getItem('kenowa_model')||MODEL_QUICK;
    let apiKey,url,body,headers={'Content-Type':'application/json'};
    if(provider==='gemini'){ apiKey=localStorage.getItem('kenowa_api_key'); if(!apiKey) return null; url=`${BASE_URL}${model}:generateContent?key=${apiKey}`; body=JSON.stringify({contents:[{parts:[{text:prompt}]}]}); }
    else if(provider==='openrouter'){ apiKey=localStorage.getItem('kenowa_openrouter_key'); if(!apiKey) return null; url='https://openrouter.ai/api/v1/chat/completions'; body=JSON.stringify({model,messages:[{role:'user',content:[{type:'text',text:prompt}]}]}); headers['Authorization']=`Bearer ${apiKey}`; headers['HTTP-Referer']='https://kenowa.extension'; headers['X-Title']='Kenowa Extension'; }
    else if(provider==='ollama'){ apiKey=localStorage.getItem('kenowa_ollama_key'); if(!apiKey) return null; url='https://ollama.com/api/chat'; body=JSON.stringify({model,messages:[{role:'user',content:prompt}],stream:false}); headers['Authorization']=`Bearer ${apiKey}`; }
    try {
        const res=await fetch(url,{method:'POST',headers,body});
        if(!res.ok) return null;
        const data=await res.json();
        if(provider==='gemini') return data.candidates?.[0]?.content?.parts?.map(p=>p.text).join('').trim()||null;
        if(provider==='openrouter') return data.choices?.[0]?.message?.content?.trim()||null;
        if(provider==='ollama') return data.message?.content?.trim()||null;
    } catch(_){ return null; }
}

// ── QA Training Cache ─────────────────────────────────────────
// Generates a stable hash key from question text (normalised)
async function hashQuestion(text) {
    const normalised = text.trim().toLowerCase().replace(/\s+/g, ' ').substring(0, 500);
    const encoded = new TextEncoder().encode(normalised);
    const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
    return Array.from(new Uint8Array(hashBuf)).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Check server QA cache — returns cached answer string or null
async function lookupQACache(questionText) {
    const user = getStoredUser();
    if (!user) return null;
    try {
        const qHash = await hashQuestion(questionText);
        const rawText = "";
        const data = JSON.parse(rawText);
        if (data.success && data.found) return { answer: data.answer, confidence: data.confidence, useCount: data.use_count, source: data.source };
    } catch(_) {}
    return null;
}

// Save a new question+answer to server QA cache
async function saveQACache(questionText, answerText, confidence = 70) {
    const user = getStoredUser();
    if (!user || !answerText || answerText.trim() === '[]') return;
    try {
        const qHash = await hashQuestion(questionText);
        
    } catch(_) {}
}

function examAppendMessage(text) {
    if (examModeTabId && currentTabChatMap[examModeTabId]) {
        const cid = currentTabChatMap[examModeTabId];
        if (currentActiveTabId === examModeTabId) {
            appendMessage('ai', text);
        } else {
            if (!chats[cid]) chats[cid] = { title: 'Exam Mode', messages: [], timestamp: Date.now() };
            chats[cid].messages.push({ role: 'ai', content: text, images: [] });
            saveChats();
            showToast(text.length > 55 ? text.substring(0, 55) + '…' : text, 'info');
        }
    } else {
        appendMessage('ai', text);
    }
}

function updateExamCountdown() {
    if (!isExamMode || !examModeStartTime) return;
    if (localStorage.getItem('kenowa_exam_delay') === 'false') return;
    const timeLeft = EXAM_DURATION - (Date.now() - examModeStartTime);
    if (timeLeft <= 0) return;
    const m = Math.floor(timeLeft / 60000), s = Math.floor((timeLeft % 60000) / 1000);
    const pad = n => String(n).padStart(2, '0');
    // Update panel UI only when user is on the exam tab
    if (currentActiveTabId === examModeTabId) {
        // FIX: Removed sidepanel countdown to prevent constant auto-scrolling and allow viewing message history.
    }
    // FIX: When on another tab, do NOT touch typingIndicator at all — that was causing the bleed-through.
    if (typeof examModeTabId === 'number') {
        chrome.scripting.executeScript({
            target: { tabId: examModeTabId },
            args: [`${pad(m)}:${pad(s)}`],
            func: t => { const el = document.getElementById('kenowa-exam-status'); if (el) el.textContent = `⏱ ${t}`; }
        }).catch(() => {});
    }
}

function toggleExamMode() {
    if (isExamMode) {
        // ── STOP ──
        isExamMode = false;
        examModeBtn?.classList.remove('active');
        if (examModeTabId) removeExamBanner(examModeTabId);
        clearTimeout(examModeTimeout);
        if (examCountdownInterval) { clearInterval(examCountdownInterval); examCountdownInterval = null; }
        hideTypingIndicator();
        examAppendMessage('🛑 Exam Mode stopped.');
        examModeTabId = null;
        updateExamModeIndicator();
        return;
    }
    // ── START ──
    chrome.tabs.query({ active: true, currentWindow: true }, tabs => {
        const tab = tabs?.[0];
        if (!tab || typeof tab.id !== 'number' || !isSafeUrl(tab.url)) {
            appendMessage('ai', '⚠️ Exam Mode needs an active http/https page. Navigate to your exam first.');
            return;
        }
        isExamMode = true;
        examModeBtn?.classList.add('active');
        examModeTabId = tab.id;
        // Bind exam tab to current chat so messages go to right place
        if (!currentTabChatMap[examModeTabId]) currentTabChatMap[examModeTabId] = currentChatId;
        examModeStartTime = Date.now();
        lastExamPageSignature = ''; lastExamAnswer = ''; examNoQuestionCount = 0;
        injectExamBanner(examModeTabId);
        examAppendMessage('🎓 **Exam Mode ON** — AI is analysing your exam page, selecting answers, and navigating questions automatically. You can freely switch tabs.');
        if (localStorage.getItem('kenowa_exam_delay') !== 'false') {
            examCountdownInterval = setInterval(updateExamCountdown, 1000);
        }
        updateExamModeIndicator();
        runExamModeStep();
    });
}

// Inject a visible banner in the exam tab
function injectExamBanner(tabId) {
    chrome.scripting.executeScript({
        target:{tabId},
        func:()=>{
            if(document.getElementById('kenowa-exam-banner')) return;
            const b=document.createElement('div');
            b.id='kenowa-exam-banner';
            b.style.cssText='position:fixed;top:0;left:0;right:0;z-index:2147483640;background:linear-gradient(90deg,#0a0a0f,#16161f);border-bottom:2px solid #f5a623;padding:6px 16px;display:flex;align-items:center;gap:12px;font-family:system-ui,sans-serif;font-size:13px;color:#f0f0fa;';
            b.innerHTML=`<span style="color:#f5a623;font-weight:700;">🎓 KENOWA EXAM MODE</span><span style="color:#8888aa;">Auto-answering active</span><span id="kenowa-exam-status" style="margin-left:auto;color:#4f8ef7;font-size:11px;">Scanning...</span>`;
            document.body.style.paddingTop=(parseInt(document.body.style.paddingTop||0)+38)+'px';
            document.body.prepend(b);
        }
    }).catch(()=>{});
}
function removeExamBanner(tabId) {
    chrome.scripting.executeScript({
        target:{tabId},
        func:()=>{ const b=document.getElementById('kenowa-exam-banner'); if(b){ document.body.style.paddingTop=Math.max(0,parseInt(document.body.style.paddingTop||0)-38)+'px'; b.remove(); } }
    }).catch(()=>{});
}

async function runExamModeStep() {
    if (!isExamMode || typeof examModeTabId !== 'number') return;
    try {
        // Verify exam tab still exists
        let tab;
        try { tab = await chrome.tabs.get(examModeTabId); }
        catch(_) { examAppendMessage('📌 Exam tab closed. Stopping.'); if (isExamMode) toggleExamMode(); return; }

        if (!tab?.url || !isSafeUrl(tab.url)) {
            examAppendMessage('⚠️ Exam tab is a system page. Stopping.'); if (isExamMode) toggleExamMode(); return;
        }

        updateExamBannerStatus(examModeTabId, 'Reading page…');

        // Extract page data FROM THE EXAM TAB (works regardless of active tab)
        const extraction = await chrome.scripting.executeScript({
            target: { tabId: examModeTabId },
            func: () => {
                const body = document.body;
                const text = body?.innerText || '';
                
                // Helper to find the "real" question text (avoiding headers/nav/metadata)
                const findQuestionText = () => {
                    // Priority 1: Moodle specific question text container
                    const moodleQ = document.querySelector('.qtext');
                    let mainText = moodleQ ? moodleQ.innerText.trim() : '';

                    // Priority 2: Try common LMS question containers
                    const qContainers = document.querySelectorAll('.que, .question, .form-question, .mc-question, .item-container');
                    if (qContainers.length > 0) {
                        const container = qContainers[0];
                        if (!mainText) {
                            // Extract main text while excluding sidebars
                            const clone = container.cloneNode(true);
                            clone.querySelectorAll('.info, .status, .grade, .question-number, .q-metadata, .answer, .ablock, .prompt').forEach(m => m.remove());
                            mainText = clone.innerText.trim();
                        }

                        // NEW: Extract options/choices to provide full context
                        const options = container.querySelectorAll('.answer, .ablock, .choice, .option, .choices');
                        if (options.length > 0) {
                            const optionList = Array.from(options[0].querySelectorAll('div, label, span'))
                                .map(el => el.innerText.trim())
                                .filter(t => t.length > 0 && !t.includes('Select one:') && !t.includes('Marked out of'));
                            
                            // Remove duplicates and keep only meaningful text
                            const uniqueOptions = [...new Set(optionList)].slice(0, 10);
                            if (uniqueOptions.length > 0) {
                                mainText += "\nChoices:\n" + uniqueOptions.join('\n');
                            }
                        }
                        return mainText;
                    }
                    
                    // Fallback: search for main content area
                    const main = document.querySelector('main, #main, #content, .content, #page-content, .region-main, #main-content');
                    if (main) return main.innerText.trim();
                    
                    // Final fallback: body text but trim the very top
                    return text.substring(Math.min(text.length, 300)).trim();
                };

                const qText = findQuestionText().substring(0, 2500);
                const lc = text.toLowerCase();
                // Count live answerable inputs
                const answerableInputs = document.querySelectorAll(
                    'input[type="radio"]:not([disabled]),input[type="checkbox"]:not([disabled])'
                ).length;
                // Detect finish button
                const hasFinishBtn = Array.from(document.querySelectorAll('button,input[type="submit"],a')).some(b => {
                    const t = (b.innerText || b.value || b.textContent || '').toLowerCase().trim();
                    return (t.includes('finish') || t.includes('submit all')) &&
                           (t.includes('attempt') || t.includes('quiz') || t.includes('exam') || t.includes('test') || t.length < 25);
                });
                return { text, qText, answerableInputs, hasFinishBtn };
            }
        });

        if (!extraction?.[0]?.result) throw new Error('Could not read exam page');
        const { text: pageText, qText: extractedQuestionText, answerableInputs, hasFinishBtn } = extraction[0].result;

        const textSig = pageText.replace(/\d+/g, '').replace(/\s+/g, ' ').trim().substring(0, 2500);
        const isDelayEnabled = localStorage.getItem('kenowa_exam_delay') !== 'false';
        const shouldSubmit = isDelayEnabled && (Date.now() - examModeStartTime >= EXAM_DURATION);

        // Same page + cached answer → just re-click navigation
        if (textSig === lastExamPageSignature && lastExamAnswer) {
            await executeExamClicker(examModeTabId, lastExamAnswer, shouldSubmit, isDelayEnabled, hasFinishBtn);
            if (shouldSubmit) { examAppendMessage('⏱ Time up. Final submit sent.'); if (isExamMode) toggleExamMode(); return; }
            if (isExamMode) examModeTimeout = setTimeout(runExamModeStep, 4000);
            return;
        }

        // New page — ask AI (but first check QA training cache)
        updateExamBannerStatus(examModeTabId, 'AI thinking…');
        const isWatching = (currentActiveTabId === examModeTabId);
        if (isWatching) showTypingIndicator('🎓 Exam Mode: Checking knowledge cache…');

        // ── 1. Try QA cache first ──────────────────────────────
        const questionForHash = extractedQuestionText || pageText.substring(0, 500);
        const cachedQA = await lookupQACache(questionForHash);
        if (cachedQA) {
            if (isWatching) hideTypingIndicator();
            const sourceLabel = cachedQA.source === 'admin' ? '✅ Verified' : `🧠 Trained (×${cachedQA.useCount})`;
            let formattedAns = cachedQA.answer;
            try { 
                const parsed = JSON.parse(cachedQA.answer);
                if (Array.isArray(parsed)) formattedAns = parsed.join(', ');
            } catch(_) {}
            const preview = formattedAns.length > 120 ? formattedAns.substring(0, 120) + '…' : formattedAns;
            examAppendMessage(`⚡ Cache hit! ${sourceLabel} — Answer: ${preview}`);
            examNoQuestionCount = 0;
            lastExamPageSignature = textSig;
            lastExamAnswer = cachedQA.answer;
            updateExamBannerStatus(examModeTabId, 'Selecting (cached)…');
            await executeExamClicker(examModeTabId, cachedQA.answer, shouldSubmit, isDelayEnabled, hasFinishBtn);
            if (shouldSubmit) { examAppendMessage('⏱ Time up. Final submit sent.'); if (isExamMode) toggleExamMode(); return; }
            if (isExamMode) examModeTimeout = setTimeout(runExamModeStep, 4000);
            return;
        }

        // ── 2. Cache miss — call AI ────────────────────────────
        if (isWatching) showTypingIndicator('🎓 Exam Mode: Analysing question…');

        const prompt = `You are an expert exam-answering assistant. Below is raw text scraped from an online quiz/exam page.

TASK:
1. Find every visible multiple-choice or multi-select question.
2. Pick the single best correct answer for each question.
3. Return ONLY a valid JSON array of exact answer texts, copied word-for-word from the page.
4. Include NOTHING else — no explanations, numbers, or commentary.
5. If the page has no answerable questions (result page, nav page), return: []

IMPORTANT: Copy the answer text EXACTLY as it appears. Even minor differences will prevent selection.

Page text:
${pageText.substring(0, 14000)}

Respond with ONLY a JSON array, e.g.: ["True","Paris","All of the above"]`;

        const aiRaw = await apiGenerateText(prompt);
        if (isWatching) hideTypingIndicator();

        if (!aiRaw?.trim() || aiRaw.trim() === '[]') {
            examNoQuestionCount++;
            examAppendMessage(`ℹ️ No questions detected. Trying navigation… (${examNoQuestionCount}/2)`);
            await clickNextOrFinish(examModeTabId, shouldSubmit, hasFinishBtn, isDelayEnabled);
            if (examNoQuestionCount >= 2) {
                examAppendMessage('🛑 No questions found after 2 attempts. Exam mode auto-stopped.');
                if (isExamMode) toggleExamMode();
                return;
            }
        } else {
            examNoQuestionCount = 0;
            lastExamPageSignature = textSig;
            lastExamAnswer = aiRaw;
            // ── Save to QA training cache (fire-and-forget) ───
            saveQACache(questionForHash, aiRaw, 70);
            let formattedAns = aiRaw;
            try {
                const parsed = JSON.parse(aiRaw);
                if (Array.isArray(parsed)) formattedAns = parsed.join(', ');
            } catch(_) {}
            const preview = formattedAns.length > 120 ? formattedAns.substring(0, 120) + '…' : formattedAns;
            examAppendMessage(`✅ Answer: ${preview}`);
            updateExamBannerStatus(examModeTabId, 'Selecting…');
            await executeExamClicker(examModeTabId, aiRaw, shouldSubmit, isDelayEnabled, hasFinishBtn);
            if (shouldSubmit) { examAppendMessage('⏱ Time up. Final submit sent.'); if (isExamMode) toggleExamMode(); return; }
        }
        if (isExamMode) examModeTimeout = setTimeout(runExamModeStep, 4000);

    } catch(err) {
        const msg = err?.message || String(err);
        // Stop on tab/permission errors — no point retrying
        if (msg.includes('tabId') || msg.includes('No tab') || msg.includes('Cannot access') || msg.includes('closed')) {
            examAppendMessage('⚠️ Exam tab inaccessible. Stopping.'); if (isExamMode) toggleExamMode(); return;
        }
        examAppendMessage(`⚠️ Error: ${sanitize(msg)} — Retrying…`);
        if (isExamMode) examModeTimeout = setTimeout(runExamModeStep, 5000);
    }
}

function updateExamBannerStatus(tabId, status) {
    if (typeof tabId !== 'number') return;
    chrome.scripting.executeScript({
        target: { tabId },
        args: [status],
        func: s => { const el = document.getElementById('kenowa-exam-status'); if (el) el.textContent = s; }
    }).catch(() => {});
}

// ── Core exam clicker ─────────────────────────────────────────
async function executeExamClicker(tabId, answerText, shouldSubmit, isDelayEnabled, hasFinishBtn, autoNavigate = true) {
    if (typeof tabId !== 'number') return;
    await chrome.scripting.executeScript({
        target: { tabId },
        args: [answerText, shouldSubmit, isDelayEnabled, hasFinishBtn, autoNavigate],
        func: (answerText, shouldSubmit, isDelayEnabled, hasFinishBtn, autoNavigate) => {

            // ── Parse JSON answer array from AI ──────────────
            let aiAnswers = [];
            try {
                const m = answerText.match(/\[[\s\S]*?\]/);
                aiAnswers = m ? JSON.parse(m[0]) : [answerText];
            } catch(_) { aiAnswers = [answerText]; }
            aiAnswers = aiAnswers.filter(a => typeof a === 'string' && a.trim().length > 0);

            // ── Fire all events frameworks need ──────────────
            function fire(el) {
                ['mousedown','mouseup','click'].forEach(type =>
                    el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true }))
                );
                el.dispatchEvent(new Event('change', { bubbles: true }));
                el.dispatchEvent(new Event('input',  { bubbles: true }));
            }

            // ── Text similarity score (0-100) ────────────────
            function score(a, b) {
                a = a.trim().toLowerCase().replace(/\s+/g, ' ');
                b = b.trim().toLowerCase().replace(/\s+/g, ' ');
                if (!a || !b) return 0;
                if (a === b) return 100;
                // Remove common prefixes like "a.", "b)", "1.", "a - " from the start of strings
                const cleanPrefix = (str) => str.replace(/^[a-z0-9][\.\-\)]\s+/i, '');
                const ca = cleanPrefix(a), cb = cleanPrefix(b);
                if (ca === cb) return 100;
                
                // If one string strictly contains the other, give a high score
                if (ca.includes(cb) || cb.includes(ca)) return 85;
                
                // Word overlap fallback
                const wa = new Set(ca.split(' ')), wb = cb.split(' ');
                const overlap = wb.filter(w => w.length > 2 && wa.has(w)).length;
                return overlap > 0 ? Math.floor((overlap / Math.max(wa.size, wb.length)) * 85) : 0;
            }

            // ── Select answers ────────────────────────────────
            aiAnswers.forEach(ans => {
                const clean = ans.trim();
                if (!clean) return;

                // Strategy A: radio/checkbox with label
                const inputs = Array.from(document.querySelectorAll(
                    'input[type="radio"]:not([disabled]),input[type="checkbox"]:not([disabled])'
                ));
                let best = null, bestScore = 0;
                inputs.forEach(inp => {
                    const forLabel = inp.id ? document.querySelector(`label[for="${CSS.escape(inp.id)}"]`) : null;
                    const wrapLabel = inp.closest('label');
                    const nearLabel = inp.parentElement;
                    const labelEl = forLabel || wrapLabel || nearLabel;
                    const labelTxt = (labelEl?.innerText || labelEl?.textContent || '').trim();
                    const valTxt   = (inp.value || '').trim();
                    const sc = Math.max(score(labelTxt, clean), score(valTxt, clean));
                    if (sc > bestScore) { bestScore = sc; best = inp; }
                });
                if (best && bestScore >= 65) {
                    if (!best.checked) { best.checked = true; fire(best); }
                    return; // matched — move to next answer
                }

                // Strategy B: clickable divs/spans/li (Moodle, Canvas, Kahoot, Google Forms…)
                const selectors = [
                    'label',
                    'div[class*="answer"]', 'div[class*="option"]', 'div[class*="choice"]',
                    'span[class*="option"]', 'span[class*="answer"]',
                    'li[class*="answer"]', 'li[class*="option"]',
                    'div[role="radio"]', 'div[role="option"]', 'div[role="checkbox"]',
                    '[data-answer]', '[data-option]', '[data-choice]',
                    'td[class*="answer"]', 'td[class*="option"]'
                ];
                const candidates = Array.from(document.querySelectorAll(selectors.join(',')));
                let bestEl = null, bestElScore = 0;
                candidates.forEach(el => {
                    const txt = (el.innerText || el.textContent || '').trim();
                    if (!txt || txt.length > 500) return;
                    const sc = score(txt, clean);
                    if (sc > bestElScore) { bestElScore = sc; bestEl = el; }
                });
                if (bestEl && bestElScore >= 65) {
                    fire(bestEl);
                    // Also check/fire nested input
                    const ni = bestEl.querySelector('input[type="radio"],input[type="checkbox"]')
                              || bestEl.parentElement?.querySelector('input[type="radio"],input[type="checkbox"]');
                    if (ni && !ni.checked) { ni.checked = true; fire(ni); }
                }
            });

            if (autoNavigate === false) return;

            // ── Navigate (Next / Finish / Submit) ────────────
            const allBtns = Array.from(document.querySelectorAll(
                'button:not([disabled]),input[type="button"]:not([disabled]),' +
                'input[type="submit"]:not([disabled]),a[role="button"]'
            )).filter(b => {
                const s = window.getComputedStyle(b);
                return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
            });

            function findBtn(kws, excl = []) {
                return allBtns.find(b => {
                    const t = (b.innerText || b.value || b.textContent || '').trim().toLowerCase();
                    return t && kws.some(k => t.includes(k)) && !excl.some(k => t.includes(k));
                });
            }

            const statusEl = document.getElementById('kenowa-exam-status');

            if (shouldSubmit) {
                const btn = findBtn(['finish attempt','finish quiz','finish exam','finish test','submit all','submit quiz','submit exam'])
                         || findBtn(['submit'], ['cancel','save answer','discard']);
                if (btn) { setTimeout(() => btn.click(), 900); if (statusEl) statusEl.textContent = 'Submitting…'; }
                return;
            }

            // Wait 1.5s for framework to register the selection, then click Next
            setTimeout(() => {
                const nextBtn =
                    findBtn(['save and next'], []) ||
                    findBtn(['next question'], []) ||
                    findBtn(['next'], ['finish','submit','previous','prev','back','cancel']) ||
                    findBtn(['continue'], ['finish','submit','cancel']) ||
                    findBtn(['forward'], ['finish','submit']);

                if (nextBtn) {
                    nextBtn.click();
                    if (statusEl) statusEl.textContent = 'Next →';
                } else if (hasFinishBtn) {
                    const finBtn = findBtn(['finish attempt','finish quiz','finish exam','finish test'])
                                || findBtn(['finish'], ['cancel']);
                    if (finBtn) { finBtn.click(); if (statusEl) statusEl.textContent = 'Finishing…'; }
                }
            }, 1500);
            // If nothing else, wait a bit
            setTimeout(() => { if (statusEl) statusEl.textContent = 'Waiting…'; }, 2000);
        }
    }).catch(() => {});
}

// ── Navigation-only clicker (no answer to select) ─────────────
async function clickNextOrFinish(tabId, shouldSubmit, hasFinishBtn, isDelayEnabled) {
    if (typeof tabId !== 'number') return;
    await chrome.scripting.executeScript({
        target: { tabId },
        args: [shouldSubmit, hasFinishBtn],
        func: (shouldSubmit, hasFinishBtn) => {
            const all = Array.from(document.querySelectorAll(
                'button:not([disabled]),input[type="button"]:not([disabled]),input[type="submit"]:not([disabled]),a[role="button"]'
            )).filter(b => { const s = window.getComputedStyle(b); return s.display !== 'none' && s.visibility !== 'hidden'; });
            const find = (kws, excl = []) => all.find(b => {
                const t = (b.innerText || b.value || b.textContent || '').trim().toLowerCase();
                return t && kws.some(k => t.includes(k)) && !excl.some(k => t.includes(k));
            });
            setTimeout(() => {
                if (shouldSubmit) {
                    const b = find(['finish attempt','finish quiz','finish exam','submit all','submit quiz']) || find(['submit'],['cancel','save']);
                    if (b) b.click();
                } else {
                    const b = find(['save and next','next question']) || find(['next'],['finish','submit','previous','back']) || find(['continue'],['finish','submit']);
                    if (b) { b.click(); return; }
                    if (hasFinishBtn) {
                        const fb = find(['finish attempt','finish quiz','finish exam','finish test']) || find(['finish'],['cancel']);
                        if (fb) fb.click();
                    }
                }
            }, 700);
        }
    }).catch(() => {});
}

// ── Context Menu Listener ──────────────────────────────────────
chrome.storage.onChanged.addListener((changes, namespace) => {
    if (namespace === 'local' && changes.pendingContextAction && changes.pendingContextAction.newValue) {
        const text = changes.pendingContextAction.newValue;
        chrome.storage.local.remove('pendingContextAction');
        setTimeout(() => handleSend(text), 500);
    }
});

chrome.storage.local.get('pendingContextAction', (res) => {
    if (res.pendingContextAction) {
        chrome.storage.local.remove('pendingContextAction');
        setTimeout(() => handleSend(res.pendingContextAction), 1000);
    }
});