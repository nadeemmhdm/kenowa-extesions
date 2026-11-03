# Kenowa AI Assistant — Documentation & Setup Guide

Welcome to the comprehensive documentation for **Kenowa AI Assistant**, your private multi-model browser copilot.

---

## Table of Contents
1. [Overview & Architecture](#overview--architecture)
2. [Supported AI Providers](#supported-ai-providers)
   - [Ollama Local (Offline & Private)](#1-ollama-local-offline--private)
   - [Ollama Cloud](#2-ollama-cloud)
   - [Google Gemini](#3-google-gemini)
   - [OpenRouter](#4-openrouter)
3. [Personal Capsule RAG](#personal-capsule-rag)
   - [Adding Reference Files](#adding-reference-files)
   - [How Verifiable Citations Work](#how-verifiable-citations-work)
4. [Exam & Solve Question Mode](#exam--solve-question-mode)
5. [Keyboard Shortcuts](#keyboard-shortcuts)
6. [Troubleshooting & FAQs](#troubleshooting--faqs)

---

## Overview & Architecture

Kenowa is constructed on **Chrome Extension Manifest V3**, using pure client-side execution:
- **Zero Middleman Servers:** Your browser talks directly to the AI provider APIs.
- **Client-Side Encryption & Storage:** Uses `chrome.storage.local` to store your API keys and chat histories locally on your disk.
- **Side Panel API:** Seamlessly sits on the right or left edge of your screen without stealing focus or obscuring your tabs.

---

## Supported AI Providers

### 1. Ollama Local (Offline & Private)
Run models like **LLaMA 3.2**, **DeepSeek R1 (8B/1.5B)**, **Qwen 2.5 Coder**, or **Mistral** completely locally on your hardware without internet.

- **Endpoint:** `http://localhost:11434`
- **Authentication:** None required.
- **Setup Instructions:**
  1. Install Ollama from [ollama.com](https://ollama.com/).
  2. Pull your favorite model in terminal:
     ```bash
     ollama pull llama3.2
     ollama pull deepseek-r1:8b
     ```
  3. Ensure Ollama is running (`ollama serve` or open the desktop app).
  4. In Kenowa Settings, select **Ollama (Local)**.
  5. Click **↻ (Refresh)** to auto-detect your local models.

> **Note on CORS:** Kenowa includes an automatic origin rewriter (`rules.json` via Chrome's `declarativeNetRequest`), meaning it bypasses HTTP 403 Forbidden errors out of the box! If you encounter connection issues on older versions, set the environment variable `OLLAMA_ORIGINS="*"` and restart Ollama.

### 2. Ollama Cloud
Access giant multi-hundred-billion parameter models via Ollama's official cloud service.

- **Endpoint:** `https://ollama.com/api`
- **Supported Models:** `gemma4:31b`, `qwen3-coder:480b`, `deepseek-v3.1:671b`, `gpt-oss:120b`, `llama3.3:70b`.
- **Setup:**
  1. Get an API key from [ollama.com](https://ollama.com/).
  2. In Kenowa Settings, choose **Ollama Cloud (ollama.com)**.
  3. Paste your key and click **Save**.

### 3. Google Gemini
- **Endpoint:** `https://generativelanguage.googleapis.com`
- **Default Model:** `gemini-2.0-flash` (lightning fast, high quota).
- **Setup:** Get a free API key at [Google AI Studio](https://aistudio.google.com/).

### 4. OpenRouter
- **Endpoint:** `https://openrouter.ai/api/v1`
- **Supported Models:** GPT-4o Mini, Claude 3.5 Sonnet, DeepSeek R1, LLaMA 3.1 8B Free, etc.
- **Setup:** Generate an API key at [openrouter.ai](https://openrouter.ai/).

---

## Personal Capsule RAG

The **Capsule** feature turns your Markdown files into a personal retrieval-augmented knowledge base for Kenowa.

### Adding Reference Files
1. Open **Settings** (⚙️).
2. Scroll to **Capsule · Topic references**.
3. Click **Add .md** and select up to 5 Markdown documents (e.g. `study_notes.md`, `project_spec.md`, `formulas.md`).
4. Kenowa indexes these files in your local storage.

### How Verifiable Citations Work
Unlike basic RAG systems that display all retrieved chunks regardless of use:
1. **Keyword Filtering:** Only queries containing non-trivial substantive terms activate document retrieval.
2. **Post-Generation Analysis:** Once the model generates an answer, Kenowa verifies whether the response actually used specific facts and terms from the retrieved passages.
3. **Clean Presentation:**
   - If a source was genuinely useful, it is cited under the answer in an expandable **Sources** box.
   - If the answer did not use the document, **no sources are shown**.

---

## Exam & Solve Question Mode

- **Solve Question (⚡):** Automatically inspects active multiple-choice questions or coding exercises on the current tab and drafts a structured explanation and answer.
- **Exam Mode:** Continuously tracks questions as you navigate through tests or training platforms.

---

## Keyboard Shortcuts

- `Ctrl + Shift + K` (`Cmd + Shift + K`): Toggle Side Panel
- `/`: Quick focus on prompt composer
- `Shift + Enter`: Multi-line prompt formatting
- `Enter`: Submit prompt

---

## Troubleshooting & FAQs

#### "Fetch API cannot load http://localhost:11434... Content Security Policy"
Ensure your extension is updated to **v2.18+**, then navigate to `chrome://extensions/` and click the **Reload (🔄)** icon to apply the updated CSP permissions.

#### "Ollama Local error 403"
This occurs if Ollama rejects the browser origin. Kenowa v2.18 handles this with `declarativeNetRequest`. If running older versions, run in PowerShell:
```powershell
[System.Environment]::SetEnvironmentVariable('OLLAMA_ORIGINS', '*', 'User')
```
Then restart the Ollama desktop app.

#### "The AI response generation animation was stuck"
Ensure you are running version **v2.18+**. The stream handler now includes dedicated stream thinking states and cleans up on completion or error.
