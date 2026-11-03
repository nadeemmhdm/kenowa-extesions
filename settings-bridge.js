chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'kenowa-settings-bridge' || message?.type !== 'read-legacy-provider-settings') return;
  sendResponse({
    provider: localStorage.getItem('kenowa_provider') || '',
    model: localStorage.getItem('kenowa_model') || '',
    keys: {
      gemini: localStorage.getItem('kenowa_api_key') || '',
      openrouter: localStorage.getItem('kenowa_openrouter_key') || '',
      ollama: localStorage.getItem('kenowa_ollama_key') || ''
    }
  });
});
