# Lumiq — Advanced Vision & Next Phase Roadmap

**Last Updated:** 2026-05-22  
**Current Status:** 🚀 **~92% Complete** (Production-Ready Code Intelligence & Version Control)

---

## 📈 Executive Summary

Lumiq has matured from a multi-provider chat wrapper into a **highly robust, desktop-first AI IDE companion**. With the successful completion of **Monaco Editor integration**, **Find in Files with Regex**, **Git Version Control integration**, **Code Intelligence (LSP, outline, definition routing)**, **Message Retry/Regenerate capabilities**, and **Clipboard file paste attachments**, Lumiq is ready to leap into the next frontier of agentic software engineering.

The next phases will focus on **Advanced Agentic Ecosystems (MCP)**, **Codebase RAG & Semantic Context**, **Autonomous Diagnostics (Self-Healing Loops)**, and **Multi-File Refactoring Suites**.

---

## ✅ Milestone 7: Model Context Protocol (MCP) & Advanced Tooling

Lumiq will serve as a central controller for agentic microservices using Anthropic's **Model Context Protocol (MCP)**, enabling models to interact with custom databases, browser instances, and custom enterprise tools.

- [x] **MCP Hub Console**
  - A beautiful settings hub to register, spin up, and manage standard MCP servers (e.g. SQLite, Postgres, Puppeteer, GitHub, Brave Search).
  - Status indicators (Connected / Idle / Error) with real-time logs for tool invocations.
- [x] **Dynamic Tool Binding**
  - Dynamically discover and parse schema definitions of active MCP servers.
  - Automatically populate custom tool descriptions and list them dynamically in slash commands (`/mcp-postgres`, `/mcp-brave`).
- [x] **Custom Script Tool Creator**
  - Enable users to paste lightweight Node.js/Python scripts inside Lumiq Settings to spin up dynamic local tools instantly without hosting external servers.

---

## ✅ Milestone 8: Semantic Search (RAG) & Smart Context Engineering

Traditional regex search requires keyword matches. Milestone 8 introduces conceptual indexing of workspaces using local vector databases.

- [x] **Local Codebase Semantic Indexing (RAG)**
  - Local background indexing using **Transformers.js** (for offline-first embedding generation) or remote API embeddings (Gemini/OpenAI/Cohere).
  - Lightweight vector store (e.g., SQLite-vec or in-memory index) to store codebase chunks.
- [x] **Smart Context Window Optimizer**
  - Automatic pruning of redundant context: dynamic sliding windows that auto-summarize long tool/agent execution blocks once they exceed 80% of context limits.
  - Interactive **Token Budget Visualizer** in the message input area showing estimated context usage and cost before sending.
- [x] **Natural Language Symbol Explorer**
  - Search code conceptually through a new "Semantic Search" panel tab: e.g., *"Find where we handle OAuth token expiration"* matches conceptually without requiring specific keywords.

---

## ⬜ Milestone 9: Autonomous Self-Healing & Agent Debugging

Bring true autonomy to local task execution. Lumiq will not just write code; it will monitor build states, analyze failures, and auto-correct itself.

- [ ] **Self-Healing Code Watcher**
  - Monitor terminal tasks (like `npm run dev`, `vitest`, or compilations).
  - Upon detecting stdout/stderr exceptions or failed tests, auto-trigger a background **Fix Subagent** that reads the failing code and exception, generates a corrective diff, and presents the solution to the user with a single-click "Apply Fix" option.
- [ ] **Step-by-Step Agent Execution Visualizer**
  - A beautiful, node-based flowchart/timeline visualizer in the chat showing:
    - *Thought process* (what the agent wants to do next).
    - *Tool Selection* (input arguments and schema).
    - *Manual Approval Gate* (step-through debugging).
- [ ] **Sandboxed Shell execution**
  - Option to spin up lightweight containerized environments or sandbox terminals for executing commands safely.

---

## ⬜ Milestone 10: Multi-File Diffing & Code Refactoring Suites

Expand single-file diff acceptance into powerful project-wide refactoring workflows.

- [ ] **Multi-File Interactive Diff Review**
  - Visual side-by-side or split diffing interface displaying changes across multiple files concurrently.
  - Bulk actions: "Accept all changes in `/src/components`", "Reject all changes in tests".
- [ ] **Tree-Context Menu Refactorings**
  - Right-click folders or files in the explorer tree to trigger automated bulk refactoring workflows:
    - `Convert JavaScript to TypeScript`
    - `Generate Unit Tests`
    - `Optimize Performance & Memoization`
    - `Write JSDoc / Documentation comments`

---

## 🏗 Architecture & Core Improvements

- [ ] **Request/Response Trace Logging**: Export complete request/response payloads (including system prompts and raw tool outputs) for debugging and auditing.
- [ ] **Offline-First Mode**: Automated configuration with local LLM providers (Ollama / Llama.cpp) and automatic model enumeration.
- [ ] **Cost Analytics & Budget Caps**: A visual dashboard plotting model utilization, token costs, and letting users set daily/monthly budget warnings.
- [ ] **Session Search & Archive**: Global search across all past chat sessions by date, provider, or content keywords.

---

## 📊 Roadmap Timeline & Completeness

| Module | Current Completeness | Status | Target Phase |
| :--- | :--- | :--- | :--- |
| **Agent Engine** | 95% | ✅ Strong | Maintained |
| **Tool Execution** | 92% | ✅ Strong | Maintained |
| **Monaco Editor Integration** | 95% | ✅ Complete | Maintained |
| **Code Intelligence (LSP)** | 100% | ✅ Complete | Maintained |
| **Search & Version Control (Git)** | 90% | ✅ Complete | Maintained |
| **Message Retry & Clipboard Paste** | 100% | ✅ Complete | Maintained |
| **Model Context Protocol (MCP)** | 100% | ✅ Complete | Milestone 7 |
| **Codebase Semantic RAG** | 100% | ✅ Complete | Milestone 8 |
| **Self-Healing Code Loops** | 0% | ⬜ Proposed | Milestone 9 |
| **Multi-File Diff Explorer** | 20% | ⬜ Proposed | Milestone 10 |

---

## 🎯 Immediate Tactical Priorities

1. **MCP Server Bridge**: Establish basic IPC channels to invoke local command-line based MCP tools.
2. [x] **Local Embedding Indexer**: Completed workspace scanning and hybrid embedding generation (MiniLM/Gemini).
3. **Multi-File diff view**: Create the layout for side-by-side multi-file edits.
