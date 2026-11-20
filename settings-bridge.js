chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.target !== 'kenowa-settings-bridge' || message?.type !== 'read-legacy-provider-settings') return;
  sendResponse({
    provider: localStorage.getItem('kenowa_provider') || '',
    model: localStorage.getItem('kenowa_model') || '',
    ollamaUrl: localStorage.getItem('kenowa_ollama_url') || 'http://localhost:11434',
    nooraUrl: localStorage.getItem('kenowa_noora_url') || 'http://10.30.197.9:8080/v1',
    keys: {
      gemini: localStorage.getItem('kenowa_api_key') || '',
      openrouter: localStorage.getItem('kenowa_openrouter_key') || '',
      ollama: localStorage.getItem('kenowa_ollama_key') || '',
      noora: localStorage.getItem('kenowa_noora_key') || 'YOUR_API_KEY_HERE'
    }
  });
});
