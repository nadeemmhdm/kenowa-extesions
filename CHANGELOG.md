# Changelog

All notable changes to the **Kenowa AI Assistant** browser extension will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.19.10] - 2026-11-21

### Fixed & Enhanced
- **Settings Save Button & Base URL Update:**
  - Fixed a `ReferenceError` during settings save where `selectedProvider` was accessed prior to initialization, which caused the Save Settings button to fail silently and prevent saving updated Base URLs.
  - Initialized `selectedProvider` at the top of the save handler and added try/catch error handling to ensure user settings and background sync always save reliably.
  - Automatically pins the model to `local-ai` when saving Noora AI configurations.
- **Eliminated `@@CODEBLOCK0@@` Token Leak in AI Answers:**
  - Fixed a bug in `utils.js` (`parseMarkdown`) where placeholder tokens `@@CODEBLOCK0@@` failed to expand into formatted code blocks whenever they were embedded inside bullet lists or bold markdown styling (`- **...**`).
  - Added full post-processing replacement across output HTML so that all code block tokens render clean, styled code containers.
  - Sanitized answers in Question Solving (`handleSQ`) and Exam Mode (`runExamModeStep`) by stripping residual backticks, code fences, and tokens before presentation.
- **Capsule Knowledge Base Integration in Exam & Solve Question Modes:**
  - Integrated `getCapsuleReferenceData` into both **Exam Mode** (`runExamModeStep`) and **Solve Question Mode** (`handleSQ`).
  - The extension now actively scans the user's uploaded Capsule notes/materials for verified answers and relevant facts based on question keywords.
  - Injects high-priority instructions directing the AI model to align strictly with the Capsule reference material when answering.
  - Surfaces active Capsule sources in chat responses and dynamically updates the in-page exam banner (`Checking Capsule (<filename>)`).
- **Enhanced Exam Mode Option Matching:**
  - In `executeExamClicker`, answers are cleaned of markdown lists, backticks, and code tokens to ensure maximum string similarity and selector matching against webpage options (radio buttons, checkboxes, and clickable divs).

---

## [2.19.9] - 2026-11-20

### Fixed & Enhanced
- **Noora AI LAN Server (`http://10.30.197.9:8080/v1`):**
  - Updated live endpoint address to `http://10.30.197.9:8080/v1` matching the local LAN server configuration (`local-ai`).
  - Added dedicated CORS and private network rules in `rules.json` (Rule 3) for `http://10.30.197.9:8080`.
  - Added clear guidance when server returns 401 Unauthorized, prompting the user to copy their active API key from the Noora AI dashboard.
- **Ollama Local Downloaded Models Only:**
  - Settings dropdown for Ollama Local now strictly displays only downloaded models available via `GET /api/tags`.
  - Prevents non-downloaded, placeholder, or cloud models from showing when Ollama Local is selected.
  - Added background proxy fallback so origin/CORS restrictions never block local model discovery.
- **Ollama Local Answer Speed Boost:**
  - Added `keep_alive: "60m"` to prevent unloading models from memory.
  - Clamped Capsule RAG context and exam page analysis to 800-2400 characters, reducing local prompt evaluation latency by >85%.
  - Configured optimized generation parameters (`num_ctx: 2048-4096`, `num_predict: 512-1024`).
- **Eliminated Duplicate & Stuck Thinking Animations:**
  - Prevented dual typing indicators from running concurrently during text message generation.
  - Ensured `toggleSendButton(false)` and `hideTypingIndicator()` are triggered immediately upon completion, error, or abortion.
  - Added startup and modal reload purge to automatically destroy any orphaned `.streaming-thinking-placeholder` elements.

---

## [2.19.5] - 2026-11-19

### Added
- **Noora Local AI Provider Integration:**
  - Added OpenAI-compatible LAN/local server support (`http://10.30.197.9:8080/v1`) with configurable LAN Base URL, API keys, and model selection (`local-ai`).
  - Added declarativeNetRequest rule (Rule 3 in `rules.json`) with private network access permissions (`Access-Control-Allow-Private-Network: true`) and origin rewriting for local LAN servers.
  - Implemented background proxy fallback (`kenowa-proxy-fetch`) and reliable non-streaming fallback (`stream: false`) for local inference servers.
  - Added support for local reasoning/thinking models (`delta.reasoning_content`, `delta.reasoning`, `delta.thought`).
  - Added styled display for `### 🎯 Correct Answer` in Question Solving and Exam Mode.

### Fixed
- **Empty Response on Long Queries:**
  - Fixed empty model output caused by oversized Capsule context overflowing local LLM context windows by capping local Capsule reference length to a safe 3,500 characters.
  - Fixed SSE stream parser dropping multi-line formatted JSON responses by supporting both `text/event-stream` and `application/json` payloads.
  - Surfaces explicit backend errors (`Noora error: ...`) instead of masking them with generic empty response messages.
- **Multiple / Stuck Response Generating Animations:**
  - Eliminated duplicate and persisting thinking animations by replacing JavaScript interval timers with pure CSS animations (`thinkingDot`).
  - Added automatic stream destruction (`activeStreamGlobal.destroy()`) on error, abort, chat switch, or fallback to ensure no orphaned animations remain in the DOM.

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
