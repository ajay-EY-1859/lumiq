# 🌌 Lumiq

<div align="center">

**One Interface. Every Model. The Ultimate AI-Native IDE Companion.**

[![License: GPL v3](https://img.shields.io/badge/License-GPL_v3-blue.svg)](LICENSE)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](package.json)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D%2020.0.0-brightgreen.svg)](https://nodejs.org/)
[![Electron Version](https://img.shields.io/badge/electron-v41.5.1-blue.svg)](https://www.electronjs.org/)
[![GitHub Issues](https://img.shields.io/github/issues/ajay-EY-1859/lumiq)](https://github.com/ajay-EY-1859/lumiq/issues)
[![GitHub Pull Requests](https://img.shields.io/github/issues-pr/ajay-EY-1859/lumiq)](https://github.com/ajay-EY-1859/lumiq/pulls)

</div>

---

## 🚀 About Lumiq

**Lumiq** is an advanced, offline-first, hybrid AI-native IDE companion built on **Electron**, **React**, and **TypeScript**. Developed and maintained by **Fairline tech** (founded and led by **Ajay Raj / ajay-EY-1859**), Lumiq delivers a premium desktop interface that bridges the gap between powerful agentic workflows, multi-provider AI reasoning, and your local development environment.

Lumiq acts as a standalone coding companion featuring a rich visual **Monaco Editor**, a full-featured **Git Version Control** panel, **Model Context Protocol (MCP)** server management, and state-of-the-art offline **Semantic Codebase Search (RAG)**. Additionally, it ships with a companion **VS Code Extension** for developers who prefer to remain inside their traditional VS Code editor while leveraging the power of Lumiq's local agentic engine.

---

## ✨ Key Features & Capabilities

Lumiq has transitioned into a highly mature, advanced development environment with **~92% of core IDE readiness** complete:

### 🧠 Core Agent Engine & Providers
- **Multi-Model Orchestration:** Native support for Anthropic (Claude), OpenAI (GPT-4o), Gemini 1.5, Ollama, DeepSeek, AWS Bedrock, GitHub Models, OpenRouter, Groq, and custom OpenAI-compatible endpoints.
- **Smart Context Engineering:** persistent chat sessions with streaming, token budget tracking, context window optimization (auto-pruning and summarization), and clipboard paste attachment support.
- **Dynamic Tool Actions:** Agent loops can execute terminal shell commands (Bash & PowerShell), perform complex file read/write operations, run regex searches (`grep`/`glob`), fetch webpages, and execute dynamic MCP tools.
- **Granular Permission Modes:** Flexible settings (`MANUAL`, `LIMITED`, `EXTENDED`, and `AUTO`) allowing per-tool security policies.

### 📝 Integrated Monaco Editor
- Rich embedded **Monaco Editor** interface providing syntax highlighting, autocomplete, code diagnostics, and a tabbed layout.
- Deep integration with the agent, enabling targeted code insertions, side-by-side diff comparisons, and direct edit applications.

### 🧠 Semantic Search (RAG) & Local Code Intelligence
- **Offline-First Vector Embeddings:** Locally indexes your workspace code conceptually using **Transformers.js** (for entirely offline embedding generation) or via remote API endpoints.
- **Natural Language Workspace Discovery:** Conceptual searching across the entire workspace (e.g. searching *"Find where we handle OAuth token expiration"* matches conceptually without requiring exact keyword patterns).
- **LSP-Backed Navigation:** Robust symbol mapping, structure outlines, definitions, and code intelligence.

### 🔌 Model Context Protocol (MCP) Hub
- **MCP Console:** A beautiful management hub to register, spin up, monitor, and configure stdio-based MCP servers (e.g., SQLite, Postgres, Puppeteer, GitHub, Brave Search).
- **Real-Time Diagnostics:** Monitor tool execution logs and connection statuses (Connected, Idle, Error).
- **Custom Scripting:** Build and run custom local tools instantly by writing lightweight Node.js or Python scripts directly in Lumiq settings.

### ⎇ Version Control (Git Integration)
- A clean, visual Git pane showing unstaged, staged, and modified files in the current workspace.
- Review modifications via diffs, stage/unstage files, draft commit messages, and execute commits directly from the UI.

---

## 📂 Project Structure

Lumiq is organized into a highly structured, module-oriented codebase:

```text
lumiq/
├── .github/              # GitHub Actions workflows, issue & PR templates
├── src/                  # Application Source Code
│   ├── main/             # Electron Main Process (System-level APIs)
│   │   ├── agent/        # Agent loop, tool execution, and token pruning
│   │   ├── auth/         # Google & GitHub OAuth integration helpers
│   │   ├── db/           # SQLite migrations & schema management modules
│   │   ├── ipc/          # Main-process IPC event handlers
│   │   ├── providers/    # Multi-provider LLM integrations
│   │   ├── security/     # Encryption, keychain storage, and permissions
│   │   ├── services/     # MCP managers, local gRPC server (127.0.0.1:43187)
│   │   └── tools/        # Core system tools (Bash, FS, Grep, Web)
│   ├── preload/          # Secure Electron contextBridge APIs
│   ├── renderer/         # React Frontend Application
│   │   └── src/
│   │       ├── components/ # Chat, Editor, Git, Tasks, Settings, Agents, UI
│   │       ├── store/    # Zustand state management (settings, sessions)
│   │       └── utils/    # Frontend formatting, timing, and parsing utils
│   └── shared/           # Shared interfaces and cross-process constants
├── extensions/
│   └── vscode/           # Companion VS Code Extension source
└── tests/                # Automated testing suites (Vitest)
```

---

## 🚀 Quick Start

Follow these simple steps to spin up your local Lumiq workspace:

### Prerequisites
- **Node.js:** `v20.0.0` or higher
- **Package Manager:** `npm` (v10+)
- **API Keys / Local Models:** An API key for your preferred provider (e.g. Anthropic, OpenAI, Gemini) or Ollama running locally.

### Installation
1. Clone the repository:
   ```bash
   git clone https://github.com/ajay-EY-1859/lumiq.git
   cd lumiq
   ```
2. Install all core application and native dependencies:
   ```bash
   npm install
   ```

### Running Development Servers
To start the Electron application in hot-reload development mode:
```bash
npm run dev
```

---

## 🛠️ Verification & Development Commands

Lumiq includes a suite of robust tools for testing, linting, and building the application:

```bash
# Run TypeScript compilation checks across Node (Main) & Web (Renderer)
npm run typecheck

# Run ESLint validation rules
npm run lint

# Automatically fix linting and formatting warnings
npm run lint:fix

# Run testing suite via Vitest
npm run test

# Launch companion VS Code extension build
cd extensions/vscode
npm run compile
```

---

## 📦 Build & Packaging

Lumiq compiles and builds optimized production bundles using `electron-builder`:

```bash
# Package for the current OS platform
npm run build

# Package explicitly for Windows
npm run build:win

# Package explicitly for macOS
npm run build:mac

# Package explicitly for Linux
npm run build:linux
```

All production-ready installers and packaged bundles will be written to the `dist/` directory.

---

## 🤝 Contributing

We welcome contributions from the developer community! Whether you want to fix a bug, suggest a new feature, or improve documentation, we are excited to work with you.

Please review our [Contributing Guidelines](CONTRIBUTING.md) and adhere to our [Code of Conduct](CODE_OF_CONDUCT.md).

---

## 🛡️ Security Policy

If you discover a security vulnerability in Lumiq, please review our [Security Policy](SECURITY.md) for instructions on how to report it privately. Please do not raise public GitHub issues for security-sensitive bugs.

---

## 📧 Support & Contact

If you have questions, run into setup issues, or want to share feedback, we are here to help:
- **GitHub Issues:** Open a ticket on our [GitHub Issues Page](https://github.com/ajay-EY-1859/lumiq/issues).
- **Troubleshooting:** Check out [SUPPORT.md](SUPPORT.md) for answers to common questions.
- **Maintainer Profile:** [@ajay-EY-1859](https://github.com/ajay-EY-1859)

---

## 📜 Copyright & License

Copyright © 2026 **Fairline tech** and contributors.

**Lumiq** is open-source software. The project is licensed under the terms of the **MIT License** and the **GNU General Public License v3 (GPL-3)**. You can choose to distribute and/or modify the software under the terms that suit your redistribution needs, aligning with the licensing guidelines specified in the root `LICENSE` file.

*Developed with ❤️ by **Fairline tech** for developers worldwide.*
