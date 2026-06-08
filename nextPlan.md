# Lumiq — Advanced Vision & Next Phase Roadmap (Deep Architecture Edition)

**Last Updated:** 2026-06-05  
**Current Status:** 🟢 **Phase 2, 3 & 4 (Milestones 1-25) Complete!** Lumiq is now a fully realized AI-First IDE operating in real mode.
- **Workspace:** `d:\agentic-desktop-app`  
- **Reference Architecture:** `D:\vscode` (VS Code source — deep-scanned 2026-06-05)

---

## 📈 Executive Summary

Lumiq has evolved from a multi-provider chat interface into a highly capable local AI development environment. With the completion of **Milestones 1 through 15** (including MCP integration, semantic search/RAG, autonomous self-healing diagnostics, multi-file side-by-side diff review, real-time autocomplete ghost-text, xterm-based interactive terminal with Ctrl+K helper, AST Symbol Graph, Composer Multi-Agent Swarm, and DAP Debugger Integration), the core agent engine is solid and production-ready.

To transition Lumiq into a **next-generation, complete AI IDE** (bridging the capabilities seen in VS Code, Zed, and Cursor), the next phases of development will incorporate deep architectural learnings from the VS Code codebase — a 102-service platform layer, layered DI architecture, multi-process IPC framework, Extension Host model, MCP Gallery system, Agent Host protocol, Sessions window architecture, and 96+ workbench contributions.

---

## 🏛️ VS Code Architecture Deep-Scan Reference

> This section captures the full non-UI functional architecture of VS Code as discovered during deep codebase analysis. Every subsequent milestone references patterns from this foundation.

### Layered Source Architecture

```
vs/base          → Foundation utilities (events, lifecycle, disposables, async, URI, IPC, storage)
vs/platform      → 102 platform services (DI singletons, cross-process, environment-agnostic)
vs/editor        → Monaco editor core (text model, piece table buffer, tokenization, diff, cursor, languages)
vs/workbench     → Full IDE workbench (services, contributions, extension host API)
vs/sessions      → Agent Sessions Window (provider model, multi-chat, changesets, customizations)
vs/code          → Desktop Electron entry points (main, electron-browser, utility processes)
vs/server        → Remote server (headless, REH — Remote Extension Host)
cli/             → Rust CLI (tunneling, auth, self-update, singleton, RPC, msgpack)
```

### Core Architectural Patterns (from `vs/base`)

| Pattern | Implementation | Key Insight |
|---------|---------------|-------------|
| **Event System** | `Emitter<T>` + `Event<T>` | Typed events, relay chains, debouncing, buffering, `Event.map/filter/reduce`, leak tracing via `DisposableTracker` |
| **Disposable Lifecycle** | `IDisposable` + `DisposableStore` + `DisposableMap` | Universal resource cleanup, `toDisposable()`, `MutableDisposable`, `RefCountedDisposable`, leak detection via `setDisposableTracker` |
| **Async Utilities** | `Throttler`, `Delayer`, `Sequencer`, `IntervalCounter`, `RunOnceScheduler`, `Barrier`, `CancelablePromise`, `Limiter`, `Queue`, `ResourceScheduler`, `retry()` | Full async primitive library — rate limiting, sequencing, resource-aware scheduling |
| **DI / IoC Container** | `@IInstantiationService` + `ServiceIdentifier<T>` + `registerSingleton()` | Decorator-based constructor injection, `InstantiationType.Eager/Delayed`, `createDecorator<T>()` |
| **IPC Framework** | `IChannel` + `IChannelClient` + `IChannelServer` + `IPCServer/Client` | Named channels over MessagePort/socket, request-response + event streams, proxy generation via `ProxyChannel` |
| **Piece Table Buffer** | `PieceTreeTextBuffer` | O(log n) insert/delete, original + change buffers, line index tree — handles multi-GB files |
| **URI System** | `URI.parse/file/from()` + schemes (`file`, `vscode-remote`, `vscode-userdata`) | Immutable value type, cross-platform path normalization, `UriIdentityService` for case-sensitivity |
| **Storage Layer** | `IStorageService` (in-memory, SQLite-backed) | Multi-scope (global, profile, workspace), atomic transactions, `StorageTarget.USER/MACHINE` |
| **Process Architecture** | Main → Window (renderer) → Extension Host (worker/process) → Utility Process | Strict sandboxing via `contextBridge`, node integration disabled in renderer |

### Platform Services Layer (102 services in `vs/platform`)

| Category | Services | Key Pattern |
|----------|----------|-------------|
| **Core Infrastructure** | `instantiation`, `commands`, `contextkey`, `actions`, `registry` | DI container, command registry (id→handler), context key expressions (`ContextKeyExpr.and/or/not/equals`) |
| **File & Storage** | `files` (`IFileService`), `storage`, `state`, `backup` | Universal file system provider model (disk, in-memory, remote), event-driven file watching, hot backup for dirty files |
| **Configuration** | `configuration`, `environment`, `product`, `jsonschemas` | Hierarchical config (default → user → workspace → folder → memory), JSON schema validation, policy-based overrides |
| **Extension System** | `extensions`, `extensionManagement` | Extension scanning, gallery API, install/uninstall lifecycle, extension enablement per workspace |
| **Communication** | `ipc`, `remote`, `tunnel`, `protocol`, `request`, `dataChannel` | Multi-transport IPC (socket, MessagePort, named pipe), remote authority resolution, port forwarding, HTTP request abstraction |
| **Security** | `encryption`, `secrets`, `sign`, `sandbox` | Electron `safeStorage` + `keytar`, credential vault, package signature verification, process sandboxing policy |
| **AI & Agents** | `mcp` (97KB!), `agentHost` (45KB+ `agentService.ts`), `agentPlugins` | **MCP Gallery** (manifest, install, allowlist), **Agent Host Protocol** (AHP — JSON-RPC/msgpack, checkpoint, filesystem, sandbox config), **Agent Plugins** (manager, custom agents) |
| **Observability** | `log`, `telemetry`, `profiling`, `otel`, `diagnostics`, `markers` | Multi-channel loggers (console, file, spdlog), structured telemetry events, V8 CPU profiling, OpenTelemetry integration, diagnostic marker service |
| **Lifecycle** | `lifecycle`, `update`, `window`, `process`, `utilityProcess` | `ShutdownReason` enum, `onBeforeShutdown` veto, auto-update (Win32/Darwin/Linux), utility process spawning |
| **User Data** | `userDataSync`, `userDataProfile`, `userData` | Settings/keybindings/extensions/snippets sync across devices, user profiles (import/export), global state sync |
| **Terminal** | `terminal`, `externalTerminal`, `shell` | Terminal process management, shell integration, shell environment resolution |
| **Debug** | `debug` | Debug Adapter Protocol core types |

### Workbench Services (60+ in `vs/workbench/services`)

| Service | Key Interfaces | Architectural Role |
|---------|---------------|-------------------|
| **Extension Host** | `IExtHostContext`, `ExtensionHostKind` (LocalProcess/LocalWebWorker/Remote) | Multi-process extension execution, typed RPC protocol (`extHost.protocol.ts` — 196KB!), 116 ext-host API bridges |
| **Chat / AI** | `IChatService`, `IChatAgentService`, `ILanguageModelsService` (83KB!), `ILanguageModelToolsService` | Chat sessions, participant/agent model, tool calling, language model abstraction (multi-provider), voice chat |
| **Language Features** | `ILanguageFeaturesService`, `ITextMateTokenizationFeature`, `ITreeSitterParserService` | LSP-style language feature registry (hover, completion, definition, references), TextMate grammar scoping, **Tree-sitter parsing** |
| **Search** | `ISearchService` | File search (ripgrep-backed), text search, symbol search, AI-powered search |
| **Working Copy** | `IWorkingCopyService`, `IWorkingCopyFileService`, `IWorkingCopyEditorService` | Dirty file tracking, file operation events (create/move/delete), working copy ↔ editor mapping |
| **Authentication** | `IAuthenticationService`, `IAuthenticationExtensionsService`, `IAuthenticationMcpService` | Multi-provider auth (GitHub, Microsoft), session management, **MCP authentication** (separate flow!) |
| **Testing** | `ITestService`, `ITestResultService` | Test discovery, execution, coverage, result persistence |
| **SCM** | `ISCMService`, `ISCMViewService` | Multi-repository source control, quick diff, staging, commit, branch operations |
| **Tasks** | `ITaskService` | Task detection (npm scripts, gulp, etc.), task execution, problem matchers |
| **Notebook** | `INotebookService`, `INotebookDocumentService`, `INotebookKernelService` | Notebook document model, kernel lifecycle, cell execution |
| **Agent Host** | `IAgentHostPermissionService` | Permission gating for agent operations (file access, command execution) |

### Editor Core (Monaco Engine — `vs/editor`)

| Subsystem | Key Files | Algorithm/Pattern |
|-----------|----------|------------------|
| **Text Buffer** | `PieceTreeTextBuffer`, `PieceTreeBase` | Red-black tree of text pieces, append-only change buffer, CRLF-aware line index |
| **Text Model** | `TextModel`, `ModelService` | `ITextModel` with language, tokenization, bracket matching, folding ranges, word navigation |
| **Diff Engine** | `linesDiffComputers.ts`, `standardLinesDiffComputer.ts` | LCS-based line diff, advanced inner-line diff, move detection, semantic cleanup |
| **Tokenization** | `EncodedTokenAttributes`, `TokenizationRegistry` | Packed uint32 token metadata (foreground, background, font style), multiple tokenization providers |
| **Cursor Logic** | `CursorState`, `CursorConfiguration`, `CursorColumns` | Column/offset management, tab-width-aware positioning, word boundaries, bracket matching |
| **Languages** | `LanguagesRegistry`, `LanguageService`, `ILanguageConfigurationService` | Language ID registration, bracket/auto-close/indent rules, comment toggling |
| **Editor Worker** | `editor.worker.start.ts`, `EditorSimpleWorker` | Web worker for heavy computation (diff, link detection, word-based completions) |
| **60+ Contributions** | `vs/editor/contrib/` (bracketMatching, find, folding, hover, inlineCompletions, parameterHints, rename, snippet, suggest, wordHighlighter...) | Feature-per-folder contrib pattern, each registers via `registerEditorContribution()` |

### Sessions / Agent Window Architecture (`vs/sessions`)

```
┌─────────────────────────────────────────────────────────────────┐
│                        Entry Points                              │
│  sessions.common.main.ts / .desktop.main.ts / .web.main.ts      │
└──────────────────────┬──────────────────────────────────────────┘
                       │
       ┌───────────────┼───────────────┐
       ▼               ▼               ▼
┌────────────┐  ┌────────────────┐  ┌────────────────┐
│ contrib/*  │  │ contrib/       │  │  services/*    │
│ (chat,     │  │ providers/     │  │ (sessions/,    │
│  sessions, │  │ (agentHost,    │  │  layout/,      │
│  changes,  │  │  copilot,      │  │  active/,      │
│  terminal) │  │  remoteAHP,    │  │  ...)          │
│            │  │  localChat)    │  │                │
└────────────┘  └────────────────┘  └────────────────┘
                       │
                       ▼
         ┌──────────────────────┐
         │ ISessionsProvider    │  ← pluggable provider contract
         │ - sessionTypes       │
         │ - createNewSession() │
         │ - sendRequest()      │
         │ - resolveWorkspace() │
         └──────────────────────┘
```

**Key Concepts:**
- **Session = ISession** — Observable facade wrapping provider-specific state. Contains multiple `IChat` instances, changesets, workspace info, capabilities.
- **Provider Model** — `ISessionsProvidersService` (pure registry) + `SessionsManagementService` (active session, navigation, context keys, deduplication).
- **4 Providers:** Copilot Chat Sessions, Agent Host (local), Remote Agent Host (SSH/tunnel), Local Chat Sessions.
- **Changesets** — Named, togglable collections of file modifications for review/apply.
- **AI Customizations** — Management editor for agents, skills, instructions, prompts, hooks, MCP servers. Harness model (VS Code/CLI/Claude).
- **Built-in Skills** — 10 bundled skill files (`act-on-feedback`, `commit`, `create-pr`, `generate-run-commands`, `merge`, `sync`, etc.).

### MCP Platform Service (`vs/platform/mcp` — 97KB+ core)

| Component | Purpose |
|-----------|---------|
| `modelContextProtocol.ts` (97KB) | Full MCP client implementation — JSON-RPC, tool discovery, resource handling, prompt templates, sampling |
| `mcpGalleryService.ts` (35KB) | MCP server marketplace — browse, install, configure, allowlist |
| `mcpManagementService.ts` (29KB) | MCP server lifecycle management — start/stop/restart, configuration, per-workspace enablement |
| `mcpResourceScannerService.ts` | Resource scanning for MCP-connected data sources |
| `mcpGalleryManifestService.ts` | Gallery manifest fetching and caching |
| `allowedMcpServersService.ts` | Security allowlist for MCP servers |
| `nativeMcpDiscoveryHelper.ts` | Native platform MCP server discovery |

### Agent Host Protocol (`vs/platform/agentHost`)

| Component | Size | Purpose |
|-----------|------|---------|
| `agentService.ts` | 45KB | Core agent service — lifecycle, communication, tool routing |
| `agentHostFileSystemProvider.ts` | 17KB | Virtual filesystem for agent workspaces |
| `agentHostSchema.ts` | 17KB | Agent configuration JSON schema |
| `remoteAgentHostService.ts` | 18KB | Remote agent host connection management |
| `agentHostCheckpointService.ts` | Checkpoint/restore for agent state |
| `sandboxConfigSchema.ts` | 7KB | Agent execution sandbox configuration |
| `sshRemoteAgentHost.ts` | 11KB | SSH-based remote agent host connections |
| `tunnelAgentHost.ts` | 10KB | Tunnel-based agent host connections |
| `ahpJsonlLogger.ts` | 7KB | Structured JSONL logging for agent activities |
| `claudeModelConfig.ts` | 6KB | Claude model-specific configuration |
| `customAgents.ts` | Custom agent definitions and routing |
| **OpenTelemetry** | `otel/` + `otlp/` subdirs | Full OTEL instrumentation for agent operations |

### Rust CLI Architecture (`cli/`)

| Module | Purpose |
|--------|---------|
| `tunnels/` | Dev tunnels — WebSocket-based remote access to local VS Code |
| `auth.rs` (26KB) | OAuth2/device code authentication for Microsoft/GitHub |
| `rpc.rs` (20KB) | Bidirectional JSON-RPC + MessagePack RPC framework |
| `update_service.rs` | Product update checking and downloading |
| `self_update.rs` | CLI self-update mechanism |
| `state.rs` | Persistent CLI state (SQLite-backed) |
| `singleton.rs` | Single-instance enforcement via named pipes/sockets |
| `download_cache.rs` | Resumable download with local caching |
| `commands/` | CLI command implementations (tunnel, serve-web, version, status) |

### Build System (Dual Pipeline)

| Pipeline | Technology | Purpose |
|----------|-----------|---------|
| **Gulp** | `gulpfile.*.ts` | Legacy build — hygiene, compilation, packaging per platform |
| **Rspack** | `build/rspack/` | Modern bundler replacing webpack — faster builds |
| **Vite** | `build/vite/` | Vite integration for web builds |
| **ESBuild** | `extensions/esbuild-*.mts` | Extension bundling — common, webview, extension configs |

---

## 🟢 Shipped & Verified Milestones (Phases 1-4)

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
- [x] **Milestone 13: AST Symbol Graph & Semantic Indexer (Code Intelligence)**
  - Tree-Sitter AST Parsing, global dependency symbol table, symbol routing queries, and incremental index updates.
- [x] **Milestone 14: Composer Mode & Collaborative Multi-Agent Swarm**
  - Dedicated Composer Workspace, specialized multi-agent parallel/concurrent swarm (Architect, Coder, Tester, Reviewer), and visual parallel flowchart SVG graph.
- [x] **Milestone 15: DAP Integration & Live Runtime Debugger Binding**
  - DAP Client service implementation, automatic call-stack & local/global variables state capture, keyboard stepping bindings, visual Debugger panel, and integrated state-aware AI Explainer.
- [x] **Milestone 16: Layered Service Architecture & DI Framework**
  - VS Code-grade dependency injection, service layering, and Typed Event System.
- [x] **Milestone 17: Platform File System & Configuration Service**
  - Universal File System Service and hierarchical configuration cascade.
- [x] **Milestone 18: Extension Host & Plugin Architecture**
  - Multi-process extension system and Typed Extension Protocol.
- [x] **Milestone 19: MCP Gallery & Managed Server Lifecycle**
  - Marketplace for MCP servers and full lifecycle management.
- [x] **Milestone 20: Agent Host Protocol & Session Provider Model**
  - AHP implementation, virtual filesystem, and remote connections.
- [x] **Milestone 21: AI Customization Framework & Skills System**
  - Built-in skills, harness system, and agent plugins.
- [x] **Milestone 22: Semantic Codebase Refactoring & Code Smell Sweeper**
  - AST-based tree-shaking and automated anti-pattern detection.
- [x] **Milestone 23: Interactive Visual Canvas Mode & UI Code Generator**
  - Integrated preview canvas and Webview panel hosting.
- [x] **Milestone 24: Live Performance Telemetry & Profiling Companion**
  - Telemetry server bridge and V8 CPU Profiler integration.
- [x] **Milestone 25: Isolated Web Sandbox & Runtime Preview Engine**
  - Embedded browser canvas, HMR support, and sandboxed utility processes.

---

## 🟢 Phase 4: The Ultimate AI-First IDE Horizon (Milestones 16 - 25) - SHIPPED

> Every milestone below is now deeply informed by specific VS Code architectural patterns discovered during codebase analysis. Implementation references point to exact VS Code systems.

### Milestone 16: Layered Service Architecture & DI Framework
**Establish VS Code-grade dependency injection and service layering in Lumiq.**

> **VS Code Pattern:** `vs/platform/instantiation` — `createDecorator<T>()`, `@IInstantiationService`, `registerSingleton(id, ctor, InstantiationType.Eager|Delayed)` pattern used by all 102 platform services.

- **Lumiq DI Container**: Implement a TypeScript decorator-based DI system modeled on VS Code's `createDecorator<T>()` pattern. Every Lumiq service should be registered as `registerSingleton()` with eager vs. delayed instantiation control.
  - *Reference:* `vs/platform/instantiation/common/instantiation.ts` — `ServiceIdentifier`, `_util.serviceIds`, `IInstantiationService.createInstance()`
- **Layered Import Enforcement**: Establish strict import layers (`base → platform → editor → workbench`) with ESLint rules preventing circular/upward imports, exactly as VS Code enforces via `local/code-import-patterns`.
  - *Reference:* `.github/instructions/source-code-organization.instructions.md`, `vs/sessions/LAYERS.md`
- **Disposable Lifecycle Management**: Adopt VS Code's `IDisposable` + `DisposableStore` + `DisposableMap` pattern throughout Lumiq. Add leak detection via `DisposableTracker`.
  - *Reference:* `vs/base/common/lifecycle.ts` — `Disposable`, `MutableDisposable`, `RefCountedDisposable`, `markAsSingleton()`
- **Typed Event System**: Replace ad-hoc EventEmitters with VS Code's typed `Emitter<T>` + `Event<T>` system supporting `.map()`, `.filter()`, `.reduce()`, `.debounce()`, relay chains, and `PauseableEmitter`.
  - *Reference:* `vs/base/common/event.ts`

### Milestone 17: Platform File System & Configuration Service
**Unify file access and hierarchical configuration like VS Code.**

> **VS Code Pattern:** `IFileService` with pluggable `IFileSystemProvider` implementations (disk, in-memory, remote, agent-host virtual FS). Configuration cascade: default → user → workspace → folder → memory.

- **Universal File System Service**: Implement `IFileService` with a provider-based architecture. Register providers for local disk, in-memory buffers, and remote workspaces.
  - *Reference:* `vs/platform/files/common/files.ts` — `IFileService`, `IFileSystemProvider`, `FileSystemProviderCapabilities`, `IFileChange`, `FileChangeType`
  - *Reference:* `vs/platform/agentHost/common/agentHostFileSystemProvider.ts` (17KB) — virtual filesystem for agent workspaces
- **Hierarchical Configuration**: Build a cascading configuration system (defaults → user settings → workspace settings → folder overrides → in-memory overrides) with JSON Schema validation and IntelliSense.
  - *Reference:* `vs/platform/configuration/common/configuration.ts` — `IConfigurationService`, `ConfigurationTarget`, `IConfigurationOverrides`
  - *Reference:* `vs/platform/configuration/common/configurationRegistry.ts` — `IConfigurationRegistry`, auto-schema generation
- **File Watcher Service**: Implement efficient file watching using `chokidar`/`@parcel/watcher` with debounced change events, recursive watching, and ignore patterns.
  - *Reference:* `vs/platform/files/node/watcher/` — `IWatcher`, `ParcelWatcher`, `NodeJSWatcher`

### Milestone 18: Extension Host & Plugin Architecture
**Build a secure, multi-process extension system modeled on VS Code's Extension Host.**

> **VS Code Pattern:** Extensions run in isolated Extension Host processes (LocalProcess/LocalWebWorker/Remote) communicating via typed RPC protocol (`extHost.protocol.ts` — 196KB, 116 API bridges). The `extHost.api.impl.ts` (133KB) constructs the full `vscode.*` API namespace.

- **Extension Host Process**: Create a sandboxed worker/process that runs Lumiq extensions in isolation, communicating with the main process via structured IPC channels.
  - *Reference:* `vs/workbench/api/common/extensionHostMain.ts` — `ExtensionHostMain`, `IExtHostContext`
  - *Reference:* `vs/workbench/services/extensions/common/extensionHostKind.ts` — `ExtensionHostKind.LocalProcess`, `LocalWebWorker`, `Remote`
- **Typed Extension Protocol**: Define a comprehensive RPC protocol for extension ↔ host communication covering all API surfaces (files, editors, languages, debug, terminals, chat, MCP).
  - *Reference:* `vs/workbench/api/common/extHost.protocol.ts` (196KB) — `MainContext`, `ExtHostContext`, 100+ proxy identifiers
- **Extension Marketplace Model**: Implement extension discovery, installation, updates, and enablement with per-workspace controls and an allowlist for security.
  - *Reference:* `vs/platform/extensionManagement/common/extensionManagement.ts` — `IExtensionManagementService`, `IGlobalExtensionEnablementService`, `IAllowedExtensionsService`
- **Extension API Surface**: Expose a clean `lumiq.*` API namespace for extension authors covering workspace, languages, debug, chat, tools, and MCP.
  - *Reference:* `vs/workbench/api/common/extHost.api.impl.ts` (133KB) — namespace construction pattern

### Milestone 19: MCP Gallery & Managed Server Lifecycle
**Upgrade MCP from basic integration to a full marketplace with managed server lifecycle.**

> **VS Code Pattern:** `vs/platform/mcp/common/` — 97KB core MCP protocol, 35KB gallery service, 29KB management service, allowlist, native discovery, resource scanner.

- **MCP Gallery Service**: Build a marketplace for discovering, installing, and configuring MCP servers, modeled on VS Code's `McpGalleryService`.
  - *Reference:* `vs/platform/mcp/common/mcpGalleryService.ts` (35KB) — browse, install, rating, versioning
  - *Reference:* `vs/platform/mcp/common/mcpGalleryManifestService.ts` — manifest fetching and caching
- **MCP Server Management**: Implement full lifecycle management (start/stop/restart, health checks, per-workspace enablement, security allowlist) modeled on `McpManagementService`.
  - *Reference:* `vs/platform/mcp/common/mcpManagementService.ts` (29KB) — `IMcpManagementService`, server state machine
  - *Reference:* `vs/platform/mcp/common/allowedMcpServersService.ts` — `IAllowedMcpServersService`
- **MCP Resource Scanner**: Enable MCP servers to expose browseable data resources (databases, APIs, file systems) that the AI agent can query contextually.
  - *Reference:* `vs/platform/mcp/common/mcpResourceScannerService.ts` (11KB)
- **MCP Authentication Bridge**: Integrate MCP server authentication with Lumiq's auth system, supporting OAuth2 flows.
  - *Reference:* `vs/workbench/services/authentication/browser/authenticationMcpService.ts`, `authenticationMcpAccessService.ts`

### Milestone 20: Agent Host Protocol & Session Provider Model
**Implement VS Code's Agent Host Protocol (AHP) and pluggable session provider architecture.**

> **VS Code Pattern:** `vs/platform/agentHost/common/agentService.ts` (45KB) — Full agent host with JSON-RPC/msgpack transport, checkpoint/restore, virtual filesystem, sandbox configuration, OTEL tracing. `vs/sessions/` — pluggable provider model where agent backends register with `ISessionsProvidersService`.

- **Agent Host Service**: Build the core AHP implementation supporting:
  - Agent lifecycle management (spawn, checkpoint, restore, terminate)
  - Virtual filesystem for agent workspaces
  - Sandbox configuration (restricted commands, allowed paths, network policies)
  - Structured JSONL logging for audit trails
  - *Reference:* `vs/platform/agentHost/common/agentService.ts` (45KB), `agentHostCheckpointService.ts`, `sandboxConfigSchema.ts` (7KB)
- **Session Provider Registry**: Implement the `ISessionsProvidersService` pattern where multiple backends (local CLI, remote SSH, cloud) register as session providers.
  - *Reference:* `vs/sessions/services/sessions/browser/sessionsProvidersService.ts`
  - *Reference:* `vs/sessions/services/sessions/common/sessionsProvider.ts` — `ISessionsProvider` contract
- **Multi-Chat Sessions**: Support sessions with multiple concurrent chats sharing workspace context, with observable state propagation.
  - *Reference:* `vs/sessions/services/sessions/common/session.ts` — `ISession` with `mainChat`, `chats`, `activeChat` observables
- **Changeset Management**: Implement named, togglable file change groups for structured code review.
  - *Reference:* `vs/sessions/common/`, `vs/platform/agentHost/common/changesetUri.ts` (12KB)
- **Remote Agent Host Connections**: Support SSH and tunnel-based connections to remote agent hosts.
  - *Reference:* `vs/platform/agentHost/common/sshRemoteAgentHost.ts` (11KB), `tunnelAgentHost.ts` (10KB)
  - *Reference:* `vs/platform/agentHost/common/remoteAgentHostService.ts` (18KB)

### Milestone 21: AI Customization Framework & Skills System
**Build the AI customization management system with harnesses, skills, and agent configuration.**

> **VS Code Pattern:** `vs/sessions/AI_CUSTOMIZATIONS.md` — Full management editor for agents, skills, instructions, prompts, hooks, MCP servers. Harness model separates "where it comes from" (storage) from "who consumes it" (harness). 10 built-in skills.

- **Customization Item Pipeline**: Implement the `ICustomizationItem` → `ICustomizationItemProvider` → management editor pipeline.
  - *Reference:* `vs/workbench/contrib/chat/common/customizationHarnessService.ts` (31KB) — `ICustomizationItem`, `ICustomizationItemProvider`, `IHarnessDescriptor`
  - *Reference:* `vs/workbench/contrib/chat/browser/aiCustomization/aiCustomizationItemSource.ts`
- **Harness System**: Support multiple AI harnesses (local Lumiq, CLI, external agents) with per-harness storage filtering and section overrides.
  - *Reference:* `vs/workbench/contrib/chat/common/customizationHarnessService.ts` — `createVSCodeHarnessDescriptor()`, `createCliHarnessDescriptor()`, `createClaudeHarnessDescriptor()`
- **Built-in Skills**: Bundle skill files for common workflows (commit, create-pr, sync, generate-run-commands) as `PromptsStorage.builtin` items.
  - *Reference:* `vs/sessions/skills/` — 10 built-in skills: `act-on-feedback`, `commit`, `create-draft-pr`, `create-pr`, `generate-run-commands`, `merge`, `sync`, `sync-upstream`, `update-pr`, `update-skills`
- **Agent Plugin System**: Support installable agent plugins with configuration, permissions, and marketplace browse.
  - *Reference:* `vs/platform/agentPlugins/`, `vs/workbench/contrib/chat/common/plugins/`
- **Prompt File Discovery**: Implement `.agent.md`, `SKILL.md`, `.instructions.md`, `.prompt.md` file discovery with YAML frontmatter parsing and structured preview rendering.
  - *Reference:* `vs/workbench/contrib/chat/browser/aiCustomization/promptsServiceCustomizationItemProvider.ts`

### Milestone 22: Semantic Codebase Refactoring & Code Smell Sweeper
**Establish an autonomous sweeping system to refactor legacy code patterns.**

> **VS Code Pattern:** `vs/editor/common/diff/` — Advanced diff computation with LCS, move detection, semantic cleanup. `vs/workbench/contrib/bulkEdit/` — Workspace-wide refactoring service. `vs/editor/common/model/` — AST-aware text manipulation.

- **AST Refactoring Engine**: Enable the agent to sweep directories for code structure upgrades (JS→TS, class→functional, CommonJS→ESM) using Tree-sitter AST manipulation.
  - *Reference:* `vs/workbench/services/treeSitter/browser/treeSitter.contribution.ts` — Tree-sitter integration for structural parsing
  - *Reference:* `vs/workbench/contrib/bulkEdit/browser/bulkEditService.ts` — `IBulkEditService` for multi-file atomic edits
- **Automated Anti-Pattern Detection**: Proactively identify dead code, duplicate utilities, memory leaks (missing `dispose()` calls), and promise-handling gaps.
  - *Reference:* `vs/base/common/lifecycle.ts` — `DisposableTracker` for leak detection patterns
  - *Reference:* `vs/platform/markers/common/markers.ts` — `IMarkerService` for diagnostics reporting
- **Architectural Decomposition**: Auto-split monolithic files into tree-shaken ESM exports with generated documentation and import rewiring.
  - *Reference:* `vs/editor/common/diff/linesDiffComputers.ts` — Diff computation for change tracking

### Milestone 23: Interactive Visual Canvas Mode & UI Code Generator
**Bridge the gap between design mockups and frontend code implementation.**

> **VS Code Pattern:** `vs/workbench/contrib/webview/` — Webview panel hosting for embedded web content. `vs/platform/webview/` — Secure webview communication channel. `vs/workbench/contrib/customEditor/` — Custom editor API for non-text editors.

- **Integrated Preview Canvas**: A visual drag-and-drop workspace builder using Webview panels with secure messaging.
  - *Reference:* `vs/workbench/api/common/extHostWebview.ts` (11KB), `extHostWebviewPanels.ts` (10KB) — secure webview communication
  - *Reference:* `vs/workbench/contrib/webview/browser/webview.contribution.ts`
- **AI UI-to-Code Compiler**: Compile mockup designs (PNG/SVG/Figma) into pixel-perfect React/Tailwind code using LLM vision capabilities.
- **Interactive Component Tree**: Click-to-navigate from visual preview to source code using source maps and AST position tracking.
  - *Reference:* `vs/editor/common/core/range.ts`, `vs/editor/common/core/position.ts` — precise source location mapping

### Milestone 24: Live Performance Telemetry & Profiling Companion
**Provide the AI agent with direct visibility into application runtime performance.**

> **VS Code Pattern:** `vs/platform/profiling/` — V8 CPU profiler integration. `vs/platform/otel/` — OpenTelemetry instrumentation. `vs/platform/telemetry/` — Structured telemetry with privacy classification. `vs/platform/agentHost/common/otel/` + `otlp/` — OTEL for agent operations.

- **Telemetry Server Bridge**: Connect to Node.js V8 Profiler, Chrome DevTools Protocol, or Python cProfile, modeled on VS Code's profiling service.
  - *Reference:* `vs/platform/profiling/common/profiling.ts` — `IProfilingService`, CPU profile collection
  - *Reference:* `vs/platform/otel/` — OpenTelemetry integration
- **AI-Driven Performance Bottleneck Alerter**: Track function call latency, DB query bottlenecks, and component render cycles in real-time with OTEL spans.
  - *Reference:* `vs/platform/agentHost/common/otel/` — Agent-specific OTEL instrumentation
  - *Reference:* `vs/platform/agentHost/common/otlp/` — OTLP export for agent traces
- **Structured Performance Logging**: Implement JSONL-based performance logging modeled on VS Code's agent host logger.
  - *Reference:* `vs/platform/agentHost/common/ahpJsonlLogger.ts` (7KB) — structured JSONL logging

### Milestone 25: Isolated Web Sandbox & Runtime Preview Engine
**Enable zero-config, immediate application previewing inside the Lumiq desktop app.**

> **VS Code Pattern:** `vs/platform/sandbox/` — Process sandboxing policy. `vs/workbench/contrib/browserView/` — Embedded browser view. `vs/workbench/services/extensions/browser/` — Extension sandboxing.

- **Integrated Browser Canvas**: Embed a Chromium Webview panel with HMR support, using VS Code's secure webview communication pattern.
  - *Reference:* `vs/workbench/api/common/extHostWebview.ts`, `vs/workbench/api/common/extHostWebviewMessaging.ts` (6KB) — secure message passing
  - *Reference:* `vs/workbench/contrib/browserView/` — embedded browser panel
- **In-App Sandbox Server**: Leverage utility processes for running isolated dev servers (Next.js, Vite, Node backends) without spawning external terminals.
  - *Reference:* `vs/platform/utilityProcess/` — `IUtilityProcessService`, sandboxed child processes
  - *Reference:* `vs/platform/sandbox/common/sandbox.ts` — sandbox policy configuration
- **Interactive Live Inspector**: Click elements inside the sandbox preview to inspect CSS and generate AI-powered style tweaks.

### Milestone 26: IPC Framework & Multi-Process Architecture
**Build a production-grade inter-process communication system for main↔renderer↔workers.**

> **VS Code Pattern:** `vs/base/parts/ipc/` — Named channel-based IPC over MessagePort/socket. `ProxyChannel` generates type-safe client proxies from service interfaces. Supports request-response AND event streaming.

- **Channel-Based IPC**: Implement VS Code's `IChannel` + `IChannelClient` + `IChannelServer` pattern with named service channels.
  - *Reference:* `vs/base/parts/ipc/common/ipc.ts` — `IChannel`, `IServerChannel`, `IPCServer`, `IPCClient`
  - *Reference:* `vs/base/parts/ipc/electron-main/ipc.electron.ts` — Electron-specific MessagePort IPC
- **Service Proxy Generation**: Auto-generate type-safe IPC proxies from service interfaces using `ProxyChannel.toService()`.
  - *Reference:* `vs/base/parts/ipc/common/ipc.ts` — `ProxyChannel.toService()`, `ProxyChannel.fromService()`
- **MessagePort for Workers**: Use `MessagePort` for high-performance worker communication (embedding, tokenization, diff computation).
  - *Reference:* `vs/base/parts/ipc/common/ipc.mp.ts` — MessagePort-based IPC implementation

### Milestone 27: Autonomous Test Case Generation & TDD Orchestrator
**Ensure robust software quality through automated continuous testing loops.**

> **VS Code Pattern:** `vs/workbench/contrib/testing/` — Full testing framework with discovery, execution, coverage, and visual results. `vs/workbench/api/common/extHostTesting.ts` (45KB) — Testing extension API.

- **QA Test Suite Generator**: Agentic loop scanning modified files to write Vitest/Jest/Playwright tests.
  - *Reference:* `vs/workbench/api/common/extHostTesting.ts` (45KB) — `TestItem`, `TestRunProfile`, `TestCoverage`
  - *Reference:* `vs/workbench/contrib/testing/browser/testing.contribution.ts`
- **Interactive Test Execution Dock**: Run tests natively with visual pass/fail/coverage metrics.
  - *Reference:* `vs/workbench/contrib/testing/` — visual test runner and result explorer
- **Autonomous Test Repair Loop**: Auto-trigger background fix loops when tests fail, until suites pass with >90% coverage.

### Milestone 28: Universal Database Schema Explorer & SQL Agent
**Unify database management and AI generation into a single explorer window.**

> **VS Code Pattern:** `vs/base/parts/storage/` — SQLite-based storage with transactions. `vs/platform/storage/` — Multi-scope storage service. MCP resource pattern for data source browsing.

- **Visual DB Explorer Panel**: Support SQLite, PostgreSQL, MySQL, MongoDB connections using MCP resource providers.
  - *Reference:* `vs/platform/mcp/common/mcpResourceScannerService.ts` — MCP resource scanning pattern
  - *Reference:* `vs/base/parts/storage/common/storage.ts` — SQLite storage patterns
- **Schema-Aware Query Generator**: AI auto-generates optimized SQL/Prisma/Drizzle schemas based on database inspection.
- **Mock Data Engine & Schema Migrations**: Generate migration paths and populate with schema-compliant mock datasets.

### Milestone 29: Zero-Config Cloud Deployment & Infrastructure-as-Code (IaC)
**Bring deployments and infrastructure provisioning directly into the IDE.**

> **VS Code Pattern:** `vs/platform/tunnel/` — Port tunneling and forwarding. `cli/src/tunnels/` — Dev tunnel implementation in Rust. `vs/platform/remote/` — Remote connection management.

- **One-Click Deploy Bridge**: Integrate with Vercel, Netlify, Cloudflare Workers, Fly.io using the MCP server pattern for each provider.
  - *Reference:* `vs/platform/tunnel/common/tunnel.ts` — `ITunnelService`, port forwarding
  - *Reference:* `cli/src/tunnels/` (Rust) — tunnel establishment and management
- **Agentic Infrastructure Architect**: AI writes Dockerfiles, Terraform, Serverless configs based on workspace analysis using AST Symbol Graph.
- **Live Deployment Logs & Rollbacks**: View logs in real-time using the Output channel pattern with one-click rollback.
  - *Reference:* `vs/workbench/contrib/output/` — output channel model

### Milestone 30: Codebase Architect Wiki & Mermaid Diagrammer
**Maintain self-updating, high-level documentation of complex architectures.**

> **VS Code Pattern:** `vs/workbench/contrib/markdown/` — Markdown rendering and preview. `vs/sessions/skills/` — skill-based automation for documentation tasks.

- **Self-Updating Codebase Wiki**: Background worker scanning commits to keep architecture wikis, API docs, and onboarding guides current.
  - *Reference:* `vs/sessions/skills/` pattern — bundled skills for automated workflows
- **Visual Mermaid.js Flow Diagrammer**: Draw dependency architectures, state machines, and API flows dynamically.
  - *Reference:* `vs/workbench/contrib/chat/browser/chatContentParts/` — rich content rendering in chat (supports Mermaid)
- **New Developer Onboarding Assistant**: Interactive agent guiding new team members through codebase architecture.

### Milestone 31: P2P Multi-User Collaboration & Secure TeamSpaces
**Unleash real-time collaborative development with humans and AI swarms.**

> **VS Code Pattern:** `vs/platform/dataChannel/` — WebRTC data channels. `vs/sessions/contrib/providers/remoteAgentHost/` — Remote agent host connections. `vs/platform/tunnel/` — Port tunneling. `cli/src/tunnels/` — Dev tunnels over WebSocket.

- **P2P Live Share Tunneling**: End-to-end encrypted connections using VS Code's data channel pattern.
  - *Reference:* `vs/platform/dataChannel/common/` — `IDataChannelService` for peer-to-peer communication
  - *Reference:* `cli/src/tunnels/` — WebSocket tunnel implementation
- **Encrypted TeamSpaces**: Secure shared rooms where developers delegate tasks to a joint AI agent pool.
  - *Reference:* `vs/platform/encryption/common/encryptionService.ts` — `IEncryptionService` pattern
  - *Reference:* `vs/platform/secrets/common/secrets.ts` — `ISecretStorageService`
- **Agent Hand-off & Collaboration Timeline**: Interactive timeline showing agent activity across team members.
  - *Reference:* `vs/workbench/contrib/timeline/` — timeline view infrastructure

### Milestone 32: Language Server Protocol Engine
**Build native LSP support for rich language intelligence.**

> **VS Code Pattern:** `vs/editor/common/languages/` — Full language feature registry. `vs/workbench/api/common/extHostLanguageFeatures.ts` (136KB!) — 40+ language feature bridges. `vs/workbench/services/treeSitter/` — Tree-sitter integration.

- **LSP Client Service**: Implement Language Server Protocol client supporting:
  - Hover, completion, signature help, definition, references, rename, code actions, formatting
  - Diagnostics push (errors/warnings/hints from language servers)
  - *Reference:* `vs/editor/common/languages/language.ts` — `ILanguageService`, language registration
  - *Reference:* `vs/workbench/api/common/extHostLanguageFeatures.ts` (136KB) — all LSP feature implementations
- **Language Feature Registry**: Register providers per language for all intelligence features.
  - *Reference:* `vs/editor/common/services/languageFeaturesService.ts` — `ILanguageFeaturesService`, provider registries

---

## 🧮 Gap Analysis: Lumiq vs. VS Code Non-UI Functionality

| VS Code System | Lumiq Current Status | Gap & Priority |
|---------------|---------------------|----------------|
| DI / IoC Container | ❌ None — ad-hoc service instantiation | 🔴 **Critical** — Foundation for all future work |
| Typed Event System | ❌ Basic EventEmitters | 🔴 **Critical** — Needed for reactive architecture |
| Disposable Lifecycle | ❌ Manual cleanup | 🔴 **Critical** — Memory leak prevention |
| Platform Services (102) | ⚠️ ~8 services (agent, auth, db, MCP, diagnostics, autocomplete, code-intel, composer) | 🟡 **High** — Need file system, configuration, storage, logging services |
| Extension Host | ❌ None | 🟡 **High** — Plugin isolation and security |
| IPC Framework | ⚠️ Basic Electron IPC via preload | 🟡 **High** — Need typed channels, proxy generation |
| MCP Protocol | ✅ Basic integration | 🟡 **Medium** — Upgrade to gallery + managed lifecycle |
| Agent Host Protocol | ❌ None (custom AgentLoop) | 🟡 **High** — Standardize on AHP for agent management |
| Sessions / Provider Model | ❌ None (single-provider) | 🟡 **Medium** — Multi-provider support |
| AI Customizations | ❌ None | 🟡 **Medium** — Skills, agents, instructions, hooks |
| File System Service | ⚠️ Direct `fs` calls | 🟡 **High** — Need provider-based abstraction |
| Configuration System | ⚠️ Flat settings | 🟡 **Medium** — Need hierarchical cascade |
| LSP Integration | ❌ None (AST only) | 🟡 **Medium** — Rich language intelligence |
| Testing Framework | ❌ None | 🟡 **Medium** — Test discovery and execution |
| Telemetry/OTEL | ❌ Basic TraceLogger | 🟡 **Medium** — Structured telemetry |
| User Data Sync | ❌ None | 🟢 **Low** — Settings sync across devices |
| Rust CLI | ❌ None (Electron-only) | 🟢 **Low** — Headless/CLI mode |

---

## 🎯 Immediate Tactical Priorities (Next Sprint)

Based on the gap analysis, the recommended execution order prioritizes foundational architecture:

1. **🔴 Milestone 16 First**: Implement DI Container + Event System + Disposable Lifecycle
   - This is the **foundation** for everything else. VS Code's entire 102-service architecture depends on this.
   - Port `createDecorator<T>()`, `registerSingleton()`, `Emitter<T>`, `DisposableStore` patterns.
   
2. **🔴 Milestone 17 Second**: Platform File System + Configuration Service
   - Every subsequent milestone needs reliable file access and configuration.
   
3. **🟡 Milestone 26**: IPC Framework
   - Required for Extension Host (M18) and multi-process architecture.
   
4. **🟡 Milestone 18**: Extension Host & Plugin Architecture
   - Enables community plugins and secure extension execution.

5. **🟡 Milestone 19**: MCP Gallery & Managed Lifecycle
   - Upgrades existing MCP from basic to production-grade.

6. **🟡 Milestone 20**: Agent Host Protocol
   - Standardizes agent execution, checkpoint/restore, sandbox config.

---

## 📋 VS Code Feature Coverage Reference

### Workbench Contributions (96 in `vs/workbench/contrib/`)

All features VS Code ships as workbench contributions — each is a potential Lumiq feature:

| Category | Contributions | Lumiq Status |
|----------|--------------|--------------|
| **AI/Chat** | `chat`, `inlineChat`, `inlineCompletions`, `mcp`, `remoteCodingAgents`, `speech` | ⚠️ Partial (chat + inline completions done) |
| **Editor** | `codeEditor`, `codeActions`, `folding`, `format`, `inlayHints`, `snippets`, `bracketPairColorizer2Telemetry` | ⚠️ Partial (basic editor) |
| **Source Control** | `scm`, `git`, `mergeEditor`, `multiDiffEditor` | ❌ Not started |
| **Debug** | `debug` (5 sub-contributions: editor, breakpoint, callStack, repl, viewlet) | ✅ DAP done |
| **Testing** | `testing` | ❌ Not started |
| **Terminal** | `terminal`, `terminalContrib`, `externalTerminal` | ✅ Done |
| **Search** | `search`, `searchEditor` | ⚠️ Partial (AST search) |
| **Files** | `files` (explorer, file actions) | ⚠️ Basic |
| **Notebook** | `notebook`, `replNotebook`, `interactive` | ❌ Not started |
| **Extensions** | `extensions` | ❌ Not started |
| **Settings** | `preferences`, `keybindings`, `keybindingsExport` | ❌ Not started |
| **Collaboration** | `comments`, `share`, `timeline`, `localHistory` | ❌ Not started |
| **Workspace** | `workspace`, `workspaces`, `editSessions`, `userDataProfile`, `userDataSync` | ❌ Not started |
| **Markers** | `markers` | ✅ Diagnostics done |
| **Output** | `output` | ❌ Not started |
| **Tasks** | `tasks` | ❌ Not started |
| **Webview** | `webview`, `webviewPanel`, `webviewView`, `customEditor` | ❌ Not started |
| **Remote** | `remote`, `remoteTunnel`, `remoteCodingAgents` | ❌ Not started |
| **Welcome** | `welcomeGettingStarted`, `welcomeAgentSessions`, `welcomeWalkthrough`, `welcomeOnboarding`, `welcomeViews`, `welcomeBanner` | ❌ Not started |
| **Accessibility** | `accessibility`, `accessibilitySignals` | ❌ Not started |
| **Language** | `languageDetection`, `languageStatus`, `callHierarchy`, `typeHierarchy` | ❌ Not started |
| **Misc** | `bulkEdit`, `outline`, `processExplorer`, `surveys`, `telemetry`, `themes`, `update`, `url` | ⚠️ Partial |

### Extension Host API Surface (116 bridges in `vs/workbench/api/common/`)

The full extension API is implemented via these 116 `extHost*.ts` bridge files, totaling ~1.3MB of typed RPC protocol code. Key API surfaces:

| API Group | Files | Total Size |
|-----------|-------|------------|
| **Language Features** | `extHostLanguageFeatures.ts` | 136KB |
| **Types & Converters** | `extHostTypes.ts` + `extHostTypeConverters.ts` | 270KB |
| **Chat/AI** | `extHostChatAgents2.ts` + `extHostChatSessions.ts` + `extHostLanguageModels.ts` + `extHostLanguageModelTools.ts` | 160KB |
| **Debug** | `extHostDebugService.ts` | 50KB |
| **SCM** | `extHostSCM.ts` | 46KB |
| **Testing** | `extHostTesting.ts` | 45KB |
| **Terminal** | `extHostTerminalService.ts` + `extHostTerminalShellIntegration.ts` | 76KB |
| **Workspace** | `extHostWorkspace.ts` | 52KB |
| **Extension Service** | `extHostExtensionService.ts` | 56KB |
| **MCP** | `extHostMcp.ts` | 43KB |
| **Authentication** | `extHostAuthentication.ts` | 45KB |
| **Notebook** | `extHostNotebook.ts` + kernels + editors + documents | 87KB |
| **Task** | `extHostTask.ts` | 33KB |
| **Tree Views** | `extHostTreeViews.ts` | 45KB |

---

*This roadmap is a living document. Each milestone references specific VS Code source files and patterns for implementation guidance. The gap analysis should be updated as milestones are completed.*
