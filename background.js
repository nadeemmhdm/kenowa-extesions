// ============================================================
// KENOWA AI — background.js
// ============================================================

chrome.sidePanel
    .setPanelBehavior({ openPanelOnActionClick: true })
    .catch((error) => console.error(error));

chrome.runtime.onInstalled.addListener(() => {
    console.log("Kenowa AI Extension Installed");
    
    chrome.contextMenus.create({
        id: "kenowa-explain",
        title: "Explain with Kenowa",
        contexts: ["selection"]
    });
    
    chrome.contextMenus.create({
        id: "kenowa-summarize",
        title: "Summarize with Kenowa",
        contexts: ["selection"]
    });
    
    chrome.contextMenus.create({
        id: "kenowa-translate",
        title: "Translate to English with Kenowa",
        contexts: ["selection"]
    });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
    let action = '';
    if (info.menuItemId === "kenowa-explain") action = "Explain this: ";
    if (info.menuItemId === "kenowa-summarize") action = "Summarize this: ";
    if (info.menuItemId === "kenowa-translate") action = "Translate this to English: ";
    
    const textToProcess = action + "\\n\\n" + info.selectionText;
    
    chrome.storage.local.set({ pendingContextAction: textToProcess }, () => {
        chrome.sidePanel.open({ tabId: tab.id });
    });
});