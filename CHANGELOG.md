# Changelog

All notable changes to the **Kenowa AI Assistant** browser extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.18.0] - 2026-11-03

### Added
- **Dual Ollama Integration (Local + Cloud):**
  - Added native **Ollama Local** connection support (`http://localhost:11434`) for 100% private, offline inference.
  - Added **Ollama Cloud** integration with official endpoints (`https://ollama.com/api`) and model catalogs (`gemma4:31b`, `qwen3-coder:480b`, `deepseek-v3.1:671b`, `gpt-oss:120b`, `llama3.3:70b`).
  - Added automatic model discovery (↻) for both local and cloud Ollama instances.
  - Integrated `declarativeNetRequest` header modification rules (`rules.json`) to seamlessly rewrite origins and bypass Ollama's HTTP 403 Forbidden check.
- **Personal Capsule RAG with Verifiable Citations:**
  - Implemented strict stopword filtering (`CAPSULE_STOPWORDS`) to ensure queries only trigger retrieval when substantive keywords are detected.
  - Implemented `filterActuallyUsedSources` post-generation analysis to verify that candidate documents actually provided useful, non-trivial facts used in the AI response.
  - Added a collapsible, clean Sources display that defaults to collapsed and renders strictly when citations exist.
- **Interactive Response Copy Button:**
  - Enhanced the Copy button with an instant checkmark icon and emerald "Copied!" feedback state.
  - Added automatic fallback to `document.execCommand('copy')` for dependable cross-context copying.
  - Extended copied feedback to code-block copy buttons (`.copy-code-btn`).
- **Live Response Generating Animation:**
  - Added real-time streaming thinking placeholder so users have continuous visual feedback during token generation.
- **Automated Update Notification System:**
  - Integrated GitHub API release checking with a modal notification prompting users when newer releases are available.
- **Official GitHub Pages Landing Page:**
  - Designed and deployed responsive landing page at `https://nadeemmhdm.github.io/kenowa-extesions/` featuring Bootstrap 5 and Boxicons.

### Fixed
- Fixed Content Security Policy (CSP) blocking connections to `http://localhost:11434`.
- Fixed `Unchecked runtime.lastError: The message port closed before a response was received` by adding explicit message listener returns and `lastError` checks.
- Fixed premature dismissal of typing indicator during streaming requests.
- Fixed horizontal layout overflow on suggested prompt chips.

---

## [2.17.0] - 2026-10-15

### Added
- **Gemini 2.0 Flash & Gemini 1.5 Pro Support:**
  - Upgraded default model endpoints to Gemini 2.0 Flash.
- **Capsule Knowledge Base (Initial Release):**
  - Enabled saving up to 5 Markdown reference files for context augmentation.
- **Syntax Highlighting & Code Actions:**
  - Added Prism-style syntax highlighting and code copy buttons.
- **Voice Input (Web Speech API):**
  - Integrated speech-to-text dictation into the composer.

### Fixed
- Fixed typewriter effect jittering during long text outputs.
- Enhanced storage migration logic across background and sidepanel contexts.

---

## [2.16.0] - 2026-09-01

### Added
- Initial Chrome Manifest V3 side panel implementation.
- Obsidian dark theme design system.
- Multi-provider configuration supporting Google Gemini and OpenRouter.
