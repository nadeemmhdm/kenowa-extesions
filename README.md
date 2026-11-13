# Kenowa AI Assistant ⚡

> **The Private, Multi-Model AI Companion & Web Copilot for Your Browser**

Kenowa AI is a high-performance Chrome Extension that integrates modern AI reasoning directly into your browser side panel. Built with an uncompromising commitment to **privacy, multi-model flexibility, and personal knowledge retrieval**, Kenowa runs entirely client-side. All API keys, chat histories, and personal reference files remain securely stored in your browser—zero middleman servers, zero telemetry.

---

## ✨ Core Superpowers

- **🤖 Multi-Model Intelligence:** Switch seamlessly between:
  - **Ollama Local** (`http://localhost:11434`): 100% private, offline, air-gapped AI models (LLaMA 3.2, DeepSeek R1, Qwen 2.5 Coder, Mistral) with automatic CORS bypass via `declarativeNetRequest`.
  - **Ollama Cloud** (`https://ollama.com`): Scalable inference on massive open-weights models (Gemma 4 31B, Qwen3 Coder 480B, DeepSeek V3.1 671B, GPT-OSS 120B).
  - **Google Gemini**: Lightning-fast responses with Gemini 2.0 Flash, Gemini 1.5 Pro, and experimental image generation.
  - **OpenRouter**: Access hundreds of models with flexible API routing.
  - **Groq**: Fast OpenAI-compatible inference using Llama and Mixtral models.
  - **Mistral AI**: Official Mistral API access for Large, Small, Codestral, and Pixtral models.
  - **Cloudflare AI Gateway**: Route compatible models through a Cloudflare AI Gateway for caching, analytics, and centralized routing.
- **📚 Personal Capsule RAG with Verifiable Citations:**
  - Choose one folder containing your course notes, textbooks, project specifications, or reference docs in Markdown (`.md`); Kenowa imports up to 5 files.
  - **Accurate Attribution:** Intelligently scores and includes only sources that were **actually used** to formulate the answer. If no documents provide useful context, the sources section is cleanly omitted.
  - Collapsible, clean UI displaying source names and exact passage snippets.
- **📋 1-Click Copy with Interactive Checkmark Feedback:**
  - Dedicated copy action with instant green checkmark and "Copied!" confirmation.
  - Built-in fallback to ensure copying always succeeds even if the side panel loses active focus.
  - Available on every AI response and syntax-highlighted code block.
- **✨ Active Streaming Animation:**
  - Real-time shimmering thinking indicator and pulsating cursor so you always know when the model is generating.
- **🔄 Auto-Update & GitHub Release Checker:**
  - Automatically queries the GitHub repository for new releases.
  - Displays update alerts with direct 1-click download options and detailed changelogs.
- **🔍 Instant On-Page Context & Exam / Solve Question Mode:**
  - Scan current tab content, solve on-screen multiple-choice questions, and summarize long web pages in seconds.
- **🎨 Obsidian Luxury Dark UI:**
  - Minimalist glassmorphic design, Boxicons icon library, smooth animations, and responsive layout.

---

## 🚀 Quick Start & Installation

### Option 1: Download from GitHub Releases
1. Download the latest version ZIP: [**Kenowa main branch (v2.19.4 code ZIP)**](https://github.com/nadeemmhdm/kenowa-extesions/archive/refs/heads/main.zip).
2. Unzip the downloaded folder to a location of your choice.
3. Open Google Chrome and navigate to `chrome://extensions/`.
4. Toggle **"Developer mode"** in the top right corner.
5. Click **"Load unpacked"** and select the unzipped `kenowa` folder.
6. Press `Ctrl + Shift + K` (`Cmd + Shift + K` on macOS) to open the Kenowa Side Panel!

### Option 2: Clone via Git
```bash
git clone https://github.com/nadeemmhdm/kenowa-extesions.git
cd kenowa-extesions
```
Load the directory into `chrome://extensions/` as an unpacked extension.

---

## ⚙️ Configuration & Setup

1. Open the Side Panel (`Ctrl + Shift + K`).
2. Click the **Settings (⚙️)** gear icon in the bottom left.
3. Choose your AI Provider:
   - **Google Gemini**: Enter your free [Google AI Studio API Key](https://aistudio.google.com/).
   - **OpenRouter**: Enter your [OpenRouter API Key](https://openrouter.ai/).
   - **Groq**: Enter your [Groq API Key](https://console.groq.com/keys). The default model is `openai/gpt-oss-120b` with streaming, medium reasoning, and a 2048-token completion budget.
   - **Mistral AI**: Enter your [Mistral API Key](https://console.mistral.ai/api-keys).
   - **Cloudflare AI Gateway**: Enter your Cloudflare API token with Account > Workers AI > Read permission, Account ID, and optional Gateway ID (default: `default`). Workers AI models use the `@cf/...` format.
   - **Ollama Cloud**: Enter your API key from [Ollama Cloud](https://ollama.com/).
   - **Ollama Local**: Ensure Ollama is running (`ollama serve` or Ollama desktop app). No API key required!
4. Click **Save** and start asking questions!

### Automatic provider fallback

Kenowa can automatically move to the next configured provider when the active provider returns a quota, rate-limit, authentication, billing, capacity, or temporary availability error. Enable **Automatically switch provider/model...** in Settings and set the comma-separated fallback order, for example `groq,mistral,cloudflare_ai_gateway,openrouter,gemini`. Providers are only used when a key is saved (or when Ollama Local is available), and the feature can be disabled at any time. Settings also includes a switch to turn suggested follow-up message chips on or off.

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| `Ctrl + Shift + K` / `Cmd + Shift + K` | Toggle Kenowa AI Side Panel |
| `/` | Focus prompt input composer |
| `Shift + Enter` | Insert new line in chat |
| `Enter` | Send message |
| `Esc` | Close modals and settings |

---

## 🔒 Security & Privacy Architecture

- **No Remote Telemetry:** Kenowa does not send analytics, telemetry, or user queries to any intermediate server.
- **Direct Origin Communication:** All API calls travel directly from your browser to the designated provider (Google, OpenRouter, or your local Ollama server).
- **Strict Content Security Policy (CSP):** Manifest V3 compliant with restricted script origins and sanitized DOM output to eliminate XSS risks.

---

## 📄 License & Credits

Distributed under the MIT License. Developed with ❤️ by [Nadeem Mhd](https://github.com/nadeemmhdm).
