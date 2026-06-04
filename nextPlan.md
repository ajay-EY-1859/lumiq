# Lumiq — Advanced Vision & Next Phase Roadmap

**Last Updated:** 2026-06-01  
**Current Status:** 🚀 **Phase 2 & Initial Phase 3 Complete!** Entering **Phase 3 advanced Code Intelligence (Milestone 13)**
- **Workspace:** `d:\agentic-desktop-app`

---

## 📈 Executive Summary

Lumiq has evolved from a multi-provider chat interface into a highly capable local AI development environment. With the completion of **Milestones 1 through 12** (including MCP integration, semantic search/RAG, autonomous self-healing diagnostics, multi-file side-by-side diff review, real-time autocomplete ghost-text, and xterm-based interactive terminal with Ctrl+K helper), the core agent engine is solid and production-ready.

To transition Lumiq into a **next-generation, complete AI IDE** (bridging the capabilities seen in VS Code, Zed, and Cursor), the next phases of development will focus on static symbol dependency modeling, multi-agent orchestrations, and interactive live runtime debugging.

---

## 🟢 Shipped & Verified Milestones (Phase 1, 2 & 3)

- [x] **Milestone 7: Model Context Protocol (MCP) & Dynamic Tooling**
  - Dynamic tool discovery and binding from local/remote MCP servers (SQLite, Brave Search, etc.).
- [x] **Milestone 8: Semantic Search (RAG) & Context Compaction**
  - Offline embedding generation with Transformers.js and smart context token budget visualizer.
- [x] **Milestone 9: Autonomous Self-Healing & Diagnostics**
  - Terminal-monitoring loop with diagnostic error capturing, background Fix Subagents, and safe sandbox dry-runs.
- [x] **Milestone 10: Multi-File Diff Explorer & Refactoring Suite**
  - Interactive multi-file side-by-side diff review workspace and folder-level bulk refactorings.
- [x] **Milestone 11: Real-Time Inline Autocomplete & Local Ghost-Text (FIM Engine)**
  - Local gray-text code autocompletions (ghost-text) in Monaco Editor with debounced low-latency and status-bar toggle control.
- [x] **Milestone 12: Immersive Interactive AI Terminal (Lumiq-Term xterm.js)**
  - Embedded high-performance interactive shell terminal (keystroke-to-stdin streaming) with Ctrl+K AI Command Companion and execution bridges.

---

## 🚀 Phase 3: The AI-First Complete IDE Horizon (Milestones 11 - 15)

In this phase, we design and build the premium, immersive developer workflow inspired by advanced modern IDE architectures (like VS Code, Cursor, and Zed), ensuring offline-first execution, strict user control, and maximum speed.

### VS Code-Inspired Workbench & Productivity Baseline
Capture the essential editor/productivity strengths of VS Code as part of the Lumiq roadmap:
- **Command Palette & Quick Open**: Fast keyboard-driven command execution and workspace file navigation.
- **Multi-root workspace support**: Open and manage multiple projects in a single window.
- **Integrated Source Control**: Full Git pane with staging, diff previews, history, and branch actions.
- **Extensions & Marketplace model**: An extensible plugin system with built-in extension management and easy install/update workflows.
- **Settings / Keybindings UI**: A graphical settings editor, profile support, and keyboard shortcut customization.
- **Panel layout & Activity Bar**: Flexible workbench layout with dockable panels, activity bar, sidebar, and status bar.
- **Split editors / Tabs**: Multi-column split editing, editor tabs, drag-and-drop tab rearrangement, and editor groups.
- **Search & Replace across workspace**: Regex-powered global search and replace with filters and results preview.
- **Markdown Preview / Notebook support**: Live Markdown rendering and support for interactive notebook documents.
- **Accessibility & theming**: High contrast UI modes, keyboard navigation, screen-reader-friendly interfaces, and theme/icon customization.
- **Built-in terminal + tasks**: Embedded terminal with task runner integration and shell task automation.
- **Language features via LSP/extension host**: Rich language support using LSP-style providers, hover, go-to-definition, and diagnostics.
- **Remote workspace connectivity**: Remote container, SSH, and WSL-style workspace concepts for seamless external dev environments.

### Milestone 11: Real-Time Inline Autocomplete & Local Ghost-Text (FIM Engine) [COMPLETED]
Bring instantaneous, context-aware code predictions to the Monaco Editor.
- [x] **Monaco Ghost-Text Extension**: Render inline gray suggestions directly in the active editor pane as the user types (similar to VS Code Copilot/Cursor Tab).
- [x] **Fill-in-the-Middle (FIM) Engine**: Leverage ultra-fast, local, lightweight LLMs (e.g., DeepSeek-Coder 1.5B/7B, Qwen2.5-Coder 1.5B, or StarCoder2) via Ollama/Llama.cpp or local Transformers.js.
- [x] **Smart Triggering & Debouncing**: Intelligent trigger points (whitespace, brackets, cursor pauses) and debouncing algorithms to keep typing latency at ~0ms.
- [x] **Cache-Ahead & Prefetching**: Prefetch context lines around the cursor to deliver suggestions with sub-50ms latency.

### Milestone 12: Immersive Interactive AI Terminal (Lumiq-Term xterm.js) [COMPLETED]
Bridge the gap between file editing and terminal command execution.
- [x] **Embedded xterm.js Panel**: Embed a fully interactive, GPU-accelerated terminal panel in the bottom dock of the Lumiq GUI.
- [x] **Terminal Inline helper (Ctrl+K)**: Allow users to open an inline chat overlay directly in the terminal to explain commands, auto-generate complex scripts, or ask the AI to perform commands.
- [x] **Visual Command Streaming**: Let the AI stream commands directly into the terminal, visually showing command outputs, with single-click human authorization before execution.
- [x] **Fail-Safe Diagnostics Interceptor**: Intercept compiler, build, and test exceptions in the terminal stream, prompting the user with an instant *"Auto-Fix with Lumiq"* diagnostic button.

### Milestone 13: AST Symbol Graph & Semantic Indexer (Code Intelligence) [COMPLETED]
Move beyond regex search to a structural, graph-based understanding of the user's codebase.
- [x] **Tree-Sitter AST Parsing**: Integrate a background worker that parses code files into Abstract Syntax Trees (AST) using `tree-sitter`.
- [x] **Global Dependency Symbol Table**: Build a high-fidelity graph database (using SQLite as storage) index mapping classes, interfaces, variables, functions, and import paths.
- [x] **Symbol Routing Queries**: Provide structural context tools for the AI agent to ask:
  - *"Where is this interface defined?"*
  - *"What are the dependencies or callers of this function?"*
  - *"Find all files implementing this specific class."*
- [x] **Incremental Index updates**: Efficient file system watchers (`chokidar`) that update the AST graph incrementally on file saves.

### Milestone 14: Composer Mode & Collaborative Multi-Agent Swarm
Orchestrate high-level, complex coding goals across parallel specialized AI agents.
- **Dedicated Composer Workspace**: A visual, widescreen interface designed for project-scale changes (e.g., *"Refactor our entire auth layer to use Clerk"*).
- **Specialized Multi-Agent Swarm**: Spawn specialized background subagents:
  - **The Architect**: Analyzes import graphs and plans file creations/deletions.
  - **The Coder**: Generates modifications using multi-file edit pools.
  - **The Tester**: Writes unit tests and executes them in parallel.
  - **The Reviewer**: Audits changed code for security risks, memory leaks, and performance bottlenecks.
- **Visual Agent Orchestration Tree**: A premium, real-time node graph showing agent statuses, thought blocks, active file locks, and data flows.

### Milestone 15: DAP Integration & Live Runtime Debugger Binding
Connect the AI directly to execution state for unparalleled debugging capabilities.
- **Debug Adapter Protocol (DAP) Client**: Implement a DAP-compliant client in the main process to connect to language-specific debuggers (Node inspector, Python debugpy, Go Delve).
- **Automatic Call-Stack Capture**: On uncaught exceptions or failed test assertions, automatically extract:
  - Complete stack trace.
  - Local variables, parameters, and global states.
  - Recent console stderr outputs.
- **State-Aware Interactive Explainer**: Let the user inspect runtime variables in the sidebar, with the AI agent providing a step-by-step explanation of the state mutation that led to the bug, along with a validated repair diff.

---

## 🔮 Phase 4: The Ultimate AI-First IDE Horizon (Milestones 16 - 25)

Moving beyond traditional coding utilities, Phase 4 expands Lumiq into an advanced, all-in-one software engineering workstation incorporating visual builders, live performance telemetry, isolated sandboxes, unified databases, and peer-to-peer collaboration.

### Milestone 16: Semantic Codebase Refactoring & Code Smell Sweeper
Establish an autonomous sweeping system to refactor legacy code patterns.
- **AST Refactoring Engine**: Enable agent to sweep directories to upgrade code structures (e.g. converting JavaScript to type-safe TypeScript, or old class-based components into React functional hooks).
- **Automated Anti-Pattern Detection**: Proactively identify dead code, duplicate utility methods, memory leaks in EventListeners, and promise-handling gaps.
- **Architectural Decomposition**: Automatically split monolithic code files into cleanly separated, tree-shaken ESM exports with generated documentation.

### Milestone 17: Interactive Visual Canvas Mode & UI Code Generator
Bridge the gap between design mockups and frontend code implementation.
- **Integrated Preview Canvas**: A visual drag-and-drop workspace builder where users can select UI blocks or paste external mockups (PNG/SVG).
- **AI UI-to-Code Compiler**: Automatically compile designs into pixel-perfect React/Tailwind code with clean component layouts.
- **Interactive Component Tree**: Let users click on any component in the visual preview to instantly jump to the corresponding code line in Monaco.

### Milestone 18: Live Performance Telemetry & Profiling Companion
Provide the AI agent with direct visibility into application runtime performance.
- **Telemetry Server Bridge**: Connect to Node.js V8 Profiler, Chrome DevTools Protocol, or Python cProfile.
- **AI-Driven Performance Bottleneck Alerter**: Track function call latency, database query bottlenecks, and component render cycles in real-time.
- **O(1) Optimization Suite**: Let the AI automatically suggest and write O(1) replacements for inefficient, resource-heavy O(N^2) search and iteration loops.

### Milestone 19: Isolated Web Sandbox & Runtime Preview Engine
Enable zero-config, immediate application previewing inside the Lumiq desktop app.
- **Integrated Browser Canvas**: Embed a Chromium Webview panel with HMR support.
- **In-App Sandbox Server**: Leverage in-memory node execution or WebContainers to execute, run, and preview complete Next.js, Vite, or Node backends without spawning external terminals.
- **Interactive Live Inspector**: Click elements inside the sandbox preview to inspect CSS variables and auto-generate style tweaks through the AI chat.

### Milestone 20: Zero-Config Cloud Deployment & Infrastructure-as-Code (IaC)
Bring deployments, serverless configurations, and database provisioning directly into the IDE.
- **One-Click Deploy Bridge**: Direct integrations with Vercel, Netlify, Cloudflare Workers, and Fly.io.
- **Agentic Infrastructure Architect**: AI automatically writes Dockerfiles, Terraforms, or Serverless configuration files based on workspace analysis.
- **Live Deployment Logs & Rollbacks**: View building logs in real-time in the sidebar, with one-click deployment rollback and hotfixes.

### Milestone 21: Autonomous Test Case Generation & TDD Orchestrator
Ensure robust software quality through automated continuous testing loops.
- **QA Test Suite Generator**: Agentic loop that scans modified files and automatically writes Vitest, Jest, or Playwright unit/integration tests.
- **Interactive Test Execution Dock**: Run tests natively within Lumiq's UI with a clean visual grid of passes, failures, and coverage metrics.
- **Autonomous Test repair loop**: Auto-trigger background fix loops to rewrite broken code blocks when tests fail, until test suites pass with >90% coverage.

### Milestone 22: Universal Database Schema Explorer & SQL Agent
Unify database management and AI generation into a single explorer window.
- **Visual DB Explorer Panel**: Support connections to SQLite, PostgreSQL, MySQL, and MongoDB.
- **Schema-Aware Query Generator**: AI auto-generates complex, optimized SQL queries or Prisma/Drizzle schemas based on database inspection.
- **Mock Data Engine & Schema Migrations**: Proactively generate migration paths and populate tables with high-fidelity, schema-compliant mock datasets.

### Milestone 23: VS Code / Cursor Workspace Mirroring Bridge
Bridge the user's active editor context with external development workflows.
- **Bidirectional Sync Client**: Mirror open editor tabs, cursor selection lines, and active workspaces between Lumiq and VS Code / Cursor.
- **Breakpoint & Diagnostic Sync**: Sync breakpoints, build issues, and console stack traces between editors.
- **Seamless Transfer Switch**: One-click button to transfer the active agent context into VS Code for rapid local debugging.

### Milestone 24: Codebase Architect Wiki & Mermaid diagrammer
Maintain self-updating, high-level documentation of complex software architectures.
- **Self-Updating Codebase Wiki**: Background worker that scans commits and keeps onboarding wikis, APIs, and folder architecture guidelines up to date.
- **Visual Mermaid.js Flow diagrammer**: Draw dependency architectures, state machines, and API data flows dynamically using Mermaid diagrams.
- **New Developer Onboarding Assistant**: Provide an interactive agent designed to guide new team members through the codebase architecture, design system, and setup steps.

### Milestone 25: P2P Multi-User Collaboration & Secure TeamSpaces
Unleash the power of real-time collaborative development with humans and AI swarms.
- **P2P Live Share Tunneling**: End-to-end encrypted connection between developers to co-edit files, share active terminals, and launch live voice calls.
- **Encrypted TeamSpaces**: Dedicated secure shared rooms where multiple developers can delegate parts of a task to a joint pool of autonomous AI agents.
- **Agent Hand-off & Collaboration Timeline**: View an interactive timeline showing which agent worked on which module, code revisions, and pull-request approvals.

---

## 🎯 Immediate Tactical Priorities (Next Sprint)

1. **Monaco Ghost-Text Scaffold**: Implement the frontend ghost-text editor extension in Monaco and connect it to a mock local prediction stream.
2. **xterm.js Integration**: Integrate the terminal shell inside the bottom dock of the Electron workspace.
3. **AST Parser Hook**: Set up the parser worker using `tree-sitter` for TypeScript/JavaScript files.
