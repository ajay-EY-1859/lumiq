# 🌌 Lumiq — Repository Memory & Architecture Guide

**Project Name:** Lumiq  
**Maintainer / Author:** Fairline tech (Ajay Raj / `ajay-EY-1859`)  
**License:** MIT / GPL v3  
**Description:** One interface. Every model. An advanced, hybrid AI-native IDE desktop app built with Electron, React, Monaco Editor, TypeScript, and Rust native code intelligence capabilities.

---

## 🏗️ Technical Stack & Architecture

Lumiq follows a standard **Electron Multi-Process Architecture** with native module extensions:

| Layer | Technologies & Frameworks | Description |
| :--- | :--- | :--- |
| **Main Process** | Electron 42, Node.js, Better-SQLite3, Keytar, gRPC | Handles OS-level operations, SQLite database, secure key storage, multi-provider LLM API streaming, system shell execution, and MCP server lifecycle. |
| **Preload Bridge** | ContextBridge, `ipcRenderer.invoke` / `ipcRenderer.on` | Exposes a strictly typed, whitelisted `window.electronAPI` bridge connecting renderer views with main services. |
| **Renderer UI** | React 18, TypeScript, Tailwind CSS, Monaco Editor, Zustand | Renders the primary IDE interface including multi-tab code editor, chat session view, Git panel, MCP management console, database explorer, visual architect wiki, and settings. |
| **Native Module** | Rust (`napi-rs`), `@lumiq/native` | Ultra-fast AST parsing, workspace code chunking, vector similarity calculation, and codebase scanning. |
| **VS Code Extension**| TypeScript, VS Code API | Companion extension allowing users to run Lumiq's local agent host and workflows inside VS Code (`extensions/vscode`). |

---

## 📂 Codebase Folder Structure

```text
/home/ajay/Downloads/agentic-desktop-app
├── .github/                # GitHub Actions CI/CD workflows and issue/PR templates
├── extensions/
│   └── vscode/             # Companion VS Code Extension source code
├── native/                 # Rust N-API native module (@lumiq/native)
│   └── src/                # ast.rs, chunker.rs, scanner.rs, search.rs, similarity.rs
├── src/
│   ├── main/               # Main Electron process
│   │   ├── agent/          # Agent loop (AgentLoop.ts), RAG, context compaction, indexing
│   │   ├── auth/           # OAuth handlers (Google & GitHub)
│   │   ├── db/             # Better-sqlite3 schema, migrations, and query interfaces
│   │   ├── ipc/            # 34 channel IPC request handlers (chat, fs, git, lsp, mcp, etc.)
│   │   ├── providers/      # LLM provider implementations (Anthropic, OpenAI, Gemini, Bedrock, Ollama, etc.)
│   │   ├── security/       # Keytar storage, path validation, permissions, regex sandboxing
│   │   ├── services/       # Code intelligence (LSP), Composer, TDD Test Orchestrator, DevOps, Wiki, DAP
│   │   └── tools/          # 30+ System tools (Bash, PowerShell, File CRUD, Grep, Web, McpDynamic)
│   ├── preload/            # Electron secure IPC bridge exposing window.electronAPI
│   ├── renderer/           # React frontend UI
│   │   └── src/
│   │       ├── components/ # Chat, Editor, Git, Tasks, Settings, Agents, UI, Composer, Debugger
│   │       ├── store/      # Zustand state management (editorStore, chatStore, settingsStore, etc.)
│   │       └── utils/      # Client-side utility functions & formatters
│   └── shared/             # Cross-process shared types, IPC channel constants, service contracts
├── editorBugs.md           # Audit notes tracking Monaco editor bugs & edge cases
├── nextPlan.md             # Feature roadmap (Simulated to Real Mode upgrades)
├── package.json            # Application dependencies and scripts
└── vitest.config.ts        # Vitest test configuration
```

---

## 🧠 Core Subsystems & Components

### 1. Agent Loop & Multi-Provider AI Engine (`src/main/agent/`, `src/main/providers/`)
* **Agent Execution Loop (`AgentLoop.ts`)**: Manages step-by-step reasoning, tool call decisions, user permission approval gates, auto-healing error loops, and streaming responses.
* **Context Compactor (`ContextCompactor.ts` & `ContextManager.ts`)**: Optimizes context limits by automatically pruning or summarizing conversation turns when token budgets are reached.
* **LLM Provider Suite (`ProviderFactory.ts`)**:
  * **Anthropic**: Claude 3.5 Sonnet, Claude 3 Opus, Claude 3 Haiku
  * **OpenAI**: GPT-4o, GPT-4o-mini, o1, o3-mini
  * **Google Gemini**: Gemini 1.5 Pro, Gemini 1.5 Flash, Gemini 2.0 Flash
  * **Ollama**: Local open-source model auto-discovery & inference
  * **AWS Bedrock**: Claude / Llama models via Bedrock SDK
  * **DeepSeek, Groq, GitHub Models, OpenRouter, Nvidia, Custom OpenAI-Compatible Endpoints**

### 2. Native Rust Code Intelligence & RAG (`native/`, `src/main/agent/EmbeddingManager.ts`)
* **Rust Native Module (`@lumiq/native`)**:
  * `ast.rs`: High-performance AST generation for TypeScript/JavaScript/Python code symbols.
  * `chunker.rs`: Code snippet chunking with window overlap strategies.
  * `scanner.rs`: Fast workspace file scanning ignoring `.git` and `node_modules`.
  * `similarity.rs` & `search.rs`: Cosine similarity calculation for vector embeddings.
* **Offline Embedding RAG (`EmbeddingManager.ts`, `RAGQueryEngine.ts`)**: Local conceptual vector search using `@xenova/transformers` or API embedding providers.

### 3. Integrated Monaco Editor & Debugger (`src/renderer/src/components/editor/`, `src/main/services/LspService.ts`)
* Multi-tab code editor with syntax highlighting, line decorations, diagnostic markers, auto-completion, and inline suggestion preview.
* **LSP Engine (`LspService.ts` & `LspProcess.ts`)**: Connects Monaco with active language servers via JSON-RPC protocol to provide real-time code diagnostics and hover info.
* **Visual Debugger (DAP)**: Supports step over/into/out, breakpoint management, stack frames, and variable scope inspection via Debug Adapter Protocol handlers (`dapHandlers.ts`).

### 4. Model Context Protocol (MCP) Hub (`src/main/services/mcp/`, `src/main/ipc/mcpHandlers.ts`)
* Lifecycle manager for stdio-based MCP servers (e.g., SQLite, Postgres, Puppeteer, GitHub, Brave Search).
* Provides dynamic tool registration into the LLM Agent's tool palette via `McpDynamicTool.ts`.

### 5. Git Source Control (SCM) Integration (`src/main/tools/GitTool.ts`, `src/main/ipc/gitHandlers.ts`)
* Inspect workspace branch status, unstaged/staged files, generate visual side-by-side diffs, stage/unstage changes, and commit directly from the IDE UI.

### 6. Developer Hub Services (`src/main/services/`)
* **Database Explorer (`DatabaseExplorerService.ts`)**: Interactive SQLite inspect UI, query execution, Prisma/Drizzle schema generator, and mock dataset population.
* **TDD Center & Autonomous Self-Healing (`TestOrchestratorService.ts`)**: Runs Vitest test suites and launches self-healing agent loops to automatically fix failing tests.
* **Architect Wiki Generator (`ArchitectWikiService.ts`)**: Parses workspace code imports to construct an `ARCHITECTURE.md` wiki and interactive Mermaid graph visualizations.
* **DevOps & IaC Service (`DeploymentService.ts` / `DevOpsAgentService.ts`)**: Generates Dockerfiles & Serverless configurations, and validates pre-deploy TypeScript builds.

---

## 🔒 Security & Data Persistence

* **Database (`src/main/db/database.ts`)**: Uses `better-sqlite3` to store persistent application states:
  * `sessions` & `messages`: Chat turn histories and token usage logs.
  * `api_configs`: Encrypted provider credentials.
  * `mcp_servers`: Stdio MCP server definitions and status logs.
  * `workspace_tasks`, `custom_skills`, `custom_commands`, `plugins`.
* **Keychain & Security (`src/main/security/`)**: Secure API key storage via `keytar` / native credentials vault, path traversal validation (`pathValidation.ts`), and tool approval permissions (`MANUAL`, `LIMITED`, `EXTENDED`, `AUTO`).

---

## 🛠️ Verification & Development Commands

```bash
# 1. Run local development mode with hot-reloading
npm run dev

# 2. Compile TypeScript for Node main process and Web renderer
npm run typecheck

# 3. Build native Rust module (@lumiq/native)
npm run build:native

# 4. Run ESLint code checks
npm run lint

# 5. Run test suite via Vitest
npm run test

# 6. Package production application installers (Windows/Mac/Linux)
npm run build
```

---

## 📌 Project Roadmap Status (`nextPlan.md`)

* **Phase 1: Real LSP Engine** — 🟢 **Completed** (Operational via `LspProcess` JSON-RPC bridge & Monaco markers).
* **Phase 2: True WebRTC & Yjs P2P Collaboration** — 🔴 **Pending** (Currently using local simulation).
* **Phase 3: CDP Sandbox Browser & Inspector** — 🔴 **Pending** (Planned Chrome DevTools Protocol injection).
* **Phase 4: Production Cloud Deployments** — 🔴 **Pending** (Vercel, Fly.io, Cloudflare integrations).
* **Phase 5: Docker Containerized Agent Sandbox** — 🔴 **Pending** (Agent host confinement via `dockerode`).

---

## ⚠️ Known Editor Edge Cases (`editorBugs.md`)
* `BUG-01`: Potential decoration racing when switching Monaco editor tabs.
* `BUG-03`: File modification events (`fs:file-modified`) should prompt before overwriting dirty editor buffers.
* `BUG-04`: Auto-save closure snapshot timing when fast-typing during async file writes.
