# 🗺️ PROJECT PLAN
## Lumiq — openclaude GUI Wrapper

**Version:** 1.0
**Date:** April 27, 2026
**Type:** Electron + React Desktop Application

---

## 1. PROJECT IDENTITY

**Project Name:** Lumiq
**Core Idea:** Take `openclaude`'s agentic engine (multi-provider AI, tools, sessions) and wrap it in a proper Electron GUI — same power, no terminal required.
**Design:** Clean dark/light theme, sidebar + chat layout, inspired by Claude Code but windowed.

---

## 2. WHAT WE'RE BUILDING

`openclaude` is a CLI tool. It runs in a terminal using React + Ink (terminal renderer). This project:

1. Extracts the core logic (provider clients, tool engine, session storage, agent loop)
2. Replaces the Ink terminal renderer with a proper React + Electron GUI
3. Adds GUI-specific features: visual tool approval dialogs, settings panel, session sidebar

---

## 3. TECH STACK

| Layer | Technology | Why |
|-------|------------|-----|
| Desktop Shell | Electron 28+ | Cross-platform, Node.js access |
| UI | React 18 + TypeScript | Component-based, same as openclaude |
| Styling | Tailwind CSS | Fast, consistent |
| State | Zustand | Lightweight, no boilerplate |
| Build | Vite + electron-builder | Fast dev, proper packaging |
| Database | SQLite (better-sqlite3) | Same as openclaude |
| AI SDKs | @anthropic-ai/sdk, openai, @google/generative-ai | Direct provider SDKs |
| IPC | Electron contextBridge | Secure main↔renderer bridge |

---

## 4. PROJECT PHASES

### Phase 1: Setup & Scaffolding (Days 1-2)

#### Task 1.1: Project Initialization
- [ ] Create Electron + React + TypeScript + Vite project
- [ ] Configure Tailwind CSS
- [ ] Set up electron-builder for packaging
- [ ] Configure TypeScript paths for main/renderer/shared
- [ ] Set up ESLint + Prettier

#### Task 1.2: Electron Main Process Setup
- [ ] Create `src/main/index.ts` — BrowserWindow creation
- [ ] Configure window size (1200×800 default, resizable)
- [ ] Set up contextBridge + preload script
- [ ] Configure IPC channel structure
- [ ] Set up app menu (File, Edit, View, Help)

#### Task 1.3: Folder Structure
```
src/
├── main/           # Electron main process (Node.js)
│   ├── index.ts
│   ├── ipc/        # IPC handlers
│   ├── providers/  # AI provider clients
│   ├── agent/      # Tool engine + agent loop
│   ├── db/         # SQLite operations
│   └── security/   # API key encryption
├── renderer/       # React app (browser context)
│   ├── components/
│   ├── pages/
│   ├── store/
│   ├── hooks/
│   └── utils/
└── shared/         # Types used by both
    ├── types.ts
    └── ipc-channels.ts
```

---

### Phase 2: Core Backend (Main Process) (Days 3-5)

#### Task 2.1: Database Setup
- [ ] Create SQLite schema (sessions, messages, api_configs, agents, settings)
- [ ] Write migration scripts
- [ ] Create CRUD helpers for each table
- [ ] Seed default settings

#### Task 2.2: AI Provider Clients
- [ ] `AnthropicProvider` — using @anthropic-ai/sdk, streaming support
- [ ] `OpenAIProvider` — using openai SDK, streaming support
- [ ] `GeminiProvider` — using @google/generative-ai
- [ ] `OllamaProvider` — HTTP client to localhost:11434
- [ ] `DeepSeekProvider` — OpenAI-compatible client
- [ ] `CustomProvider` — configurable base URL + auth
- [ ] `ProviderFactory` — creates correct client from config
- [ ] Unified `sendMessage()` interface across all providers

#### Task 2.3: Tool Engine (from openclaude)
- [ ] `BashTool` — shell command execution with approval
- [ ] `FileReadTool` — read file contents
- [ ] `FileWriteTool` — write file contents
- [ ] `FileEditTool` — edit specific lines/sections
- [ ] `GlobTool` — find files by pattern
- [ ] `GrepTool` — search file contents with ripgrep
- [ ] `WebFetchTool` — fetch URL content
- [ ] `WebSearchTool` — DuckDuckGo search
- [ ] Tool permission system (always-ask / always-allow / always-deny)

#### Task 2.4: Agent Loop
- [ ] Message queue manager
- [ ] Tool call parser (extract tool calls from AI response)
- [ ] Tool executor (run tool, return result)
- [ ] Context window manager (truncate old messages)
- [ ] Session state manager

#### Task 2.5: Security
- [ ] API key encryption (AES-256-GCM)
- [ ] OS keychain integration (Windows Credential Manager / macOS Keychain)
- [ ] Secure IPC validation

#### Task 2.6: IPC Handlers
- [ ] `chat:send` — send message, stream response
- [ ] `chat:cancel` — cancel in-flight request
- [ ] `session:list` / `session:load` / `session:delete`
- [ ] `provider:list` / `provider:save` / `provider:test`
- [ ] `tool:approve` / `tool:deny` — user approval for tool calls
- [ ] `settings:get` / `settings:set`
- [ ] `agent:list` / `agent:save` / `agent:delete`

---

### Phase 3: Frontend (Renderer) (Days 5-9)

#### Task 3.1: App Shell
- [ ] `App.tsx` — root component, router setup
- [ ] `MainLayout.tsx` — sidebar + main content split
- [ ] `Sidebar.tsx` — navigation, session list
- [ ] `TitleBar.tsx` — custom title bar (frameless window)
- [ ] Theme provider (dark/light, system auto-detect)

#### Task 3.2: Chat Interface
- [ ] `ChatPage.tsx` — main chat screen
- [ ] `MessageList.tsx` — virtualized message list
- [ ] `MessageBubble.tsx` — user/assistant message rendering
- [ ] `MarkdownRenderer.tsx` — render markdown + code blocks
- [ ] `CodeBlock.tsx` — syntax highlighted code with copy button
- [ ] `MessageInput.tsx` — textarea with send button, Shift+Enter support
- [ ] `TypingIndicator.tsx` — animated dots while AI responds
- [ ] `StreamingMessage.tsx` — real-time token streaming display

#### Task 3.3: Tool Approval Dialog
- [ ] `ToolApprovalDialog.tsx` — modal showing tool name + args
- [ ] Approve / Deny / Always Allow buttons
- [ ] Show tool output after execution
- [ ] Diff view for file edits (FileEditTool)

#### Task 3.4: Session Sidebar
- [ ] `SessionList.tsx` — list of past sessions
- [ ] `SessionItem.tsx` — session title, date, model badge
- [ ] New session button
- [ ] Session search
- [ ] Delete session with confirmation

#### Task 3.5: Settings Panel
- [ ] `SettingsPage.tsx` — tabbed settings
- [ ] `ApiProvidersTab.tsx` — add/edit/test API keys
- [ ] `ProviderCard.tsx` — per-provider config form
- [ ] `ModelsTab.tsx` — default model selection
- [ ] `AppearanceTab.tsx` — theme, font size
- [ ] `AgentsTab.tsx` — manage custom agents
- [ ] `ToolsTab.tsx` — enable/disable tools, permissions
- [ ] `ShortcutsTab.tsx` — keyboard shortcuts reference

#### Task 3.6: Agent Builder
- [ ] `AgentBuilderPage.tsx` — create/edit agents
- [ ] Name, description, system prompt fields
- [ ] Model selection
- [ ] Tool permissions per agent
- [ ] Test agent button

#### Task 3.7: State Management (Zustand)
- [ ] `chatStore` — current session messages, streaming state
- [ ] `sessionStore` — session list, active session
- [ ] `providerStore` — configured providers, active provider
- [ ] `settingsStore` — app settings
- [ ] `agentStore` — custom agents

---

### Phase 4: Polish & Features (Days 10-12)

#### Task 4.1: Streaming
- [ ] Real-time token streaming from all providers
- [ ] Smooth text rendering (no flicker)
- [ ] Cancel button during streaming
- [ ] Streaming progress indicator

#### Task 4.2: Keyboard Shortcuts
- [ ] `Ctrl+N` — New session
- [ ] `Ctrl+Enter` — Send message
- [ ] `Ctrl+,` — Open settings
- [ ] `Ctrl+B` — Toggle sidebar
- [ ] `Ctrl+F` — Search in session
- [ ] `Escape` — Cancel streaming / close modal

#### Task 4.3: Notifications & Feedback
- [ ] Toast notifications (success, error, info)
- [ ] Tool execution status in chat
- [ ] API error messages with recovery hints
- [ ] Connection status indicator

#### Task 4.4: Data Management
- [ ] Export session as Markdown / JSON
- [ ] Import session from file
- [ ] Clear all history
- [ ] Auto-backup to user data folder

---

### Phase 5: Testing & Packaging (Days 13-14)

#### Task 5.1: Testing
- [ ] Unit tests for provider clients
- [ ] Unit tests for tool engine
- [ ] Unit tests for IPC handlers
- [ ] E2E test: send message, receive response
- [ ] E2E test: tool approval flow
- [ ] Cross-platform smoke test (Win/Mac/Linux)

#### Task 5.2: Build & Package
- [ ] Configure electron-builder (win/mac/linux targets)
- [ ] Code signing setup (Windows: .pfx, macOS: Developer ID)
- [ ] Auto-updater (electron-updater)
- [ ] Installer customization (icon, name, license)
- [ ] Test installers on each platform

#### Task 5.3: Final Verification
- [ ] All providers connect and respond
- [ ] Tool execution works end-to-end
- [ ] Session persistence works across restarts
- [ ] Settings save and load correctly
- [ ] No console errors in production build

---

## 5. COMPONENT STRUCTURE

```
renderer/components/
├── chat/
│   ├── ChatPage.tsx
│   ├── MessageList.tsx
│   ├── MessageBubble.tsx
│   ├── MessageInput.tsx
│   ├── StreamingMessage.tsx
│   ├── TypingIndicator.tsx
│   └── ToolApprovalDialog.tsx
├── sidebar/
│   ├── Sidebar.tsx
│   ├── SessionList.tsx
│   └── SessionItem.tsx
├── settings/
│   ├── SettingsPage.tsx
│   ├── ApiProvidersTab.tsx
│   ├── ProviderCard.tsx
│   ├── ModelsTab.tsx
│   └── AppearanceTab.tsx
├── agents/
│   ├── AgentBuilderPage.tsx
│   └── AgentCard.tsx
├── layout/
│   ├── MainLayout.tsx
│   ├── TitleBar.tsx
│   └── StatusBar.tsx
└── ui/
    ├── Button.tsx
    ├── Input.tsx
    ├── Modal.tsx
    ├── Toast.tsx
    ├── Spinner.tsx
    └── CodeBlock.tsx
```

---

## 6. IPC CHANNEL MAP

```
Main Process (Node.js)          Renderer (React)
─────────────────────           ────────────────
chat:send          ◄────────── user sends message
chat:stream-chunk  ──────────► token arrives
chat:stream-end    ──────────► response complete
chat:error         ──────────► error occurred
chat:cancel        ◄────────── user cancels

tool:approval-request ────────► show approval dialog
tool:approval-response ◄─────── user approves/denies
tool:result        ──────────► show tool output

session:list       ◄────────── request sessions
session:list-result ─────────► return sessions
session:load       ◄────────── load session
session:delete     ◄────────── delete session

provider:save      ◄────────── save API config
provider:test      ◄────────── test connection
provider:test-result ────────► connection result

settings:get       ◄────────── request settings
settings:result    ──────────► return settings
settings:set       ◄────────── save settings
```

---

## 7. DATABASE SCHEMA

```sql
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT,
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  agent_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
  content TEXT NOT NULL,
  tool_name TEXT,
  tool_input TEXT,
  tool_result TEXT,
  tokens_used INTEGER,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

CREATE TABLE api_configs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  api_key_encrypted TEXT,
  base_url TEXT,
  default_model TEXT,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT,
  provider TEXT,
  model TEXT,
  tools TEXT,  -- JSON array of enabled tool names
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
```

---

## 8. MILESTONE TIMELINE

| Milestone | Target | Deliverables |
|-----------|--------|--------------|
| M1: Scaffold | Day 2 | Electron window opens, React renders |
| M2: Backend | Day 5 | Providers work, tools work, DB ready |
| M3: Chat UI | Day 8 | Can send/receive messages in GUI |
| M4: Full Features | Day 11 | Sessions, settings, agents, tools all work |
| M5: Packaged | Day 14 | Installers for Win/Mac/Linux |

---

## 9. SUCCESS CRITERIA

- [ ] App opens on Windows, macOS, Linux
- [ ] Can chat with at least 3 providers (Anthropic, OpenAI, Ollama)
- [ ] Tool execution works with GUI approval
- [ ] Sessions persist across app restarts
- [ ] API keys stored encrypted
- [ ] Streaming responses render smoothly
- [ ] No terminal required — pure GUI

---

## 🤖 AGENT INSTRUCTIONS

### On Error
Jab bhi koi error aaye task execute karte waqt, turant ek file banao:
**Filename:** `ERROR_LOG.md`

File mein yeh sab likho:
- Kaunsa task chal raha tha jab error aaya
- Error ka poora message (exact text)
- Kaunsi file ya line mein error tha
- Sambhavit karan (possible cause)
- Kya try kiya tha solve karne ke liye
- Agle steps kya hone chahiye

### On Interruption or Risk
Jab bhi task execution achanak band ho ya khatre mein ho, turant ek file banao:
**Filename:** `REMAINING_PLAN.md`

File mein yeh sab likho:
- Kya kaam poora ho chuka hai (completed tasks)
- Kaunsa kaam chal raha tha jab ruka (in-progress task)
- Kya kaam abhi bacha hai (pending tasks)
- Koi important context jo agli baar kaam aaye

---

**Document Version:** 1.0
**Last Updated:** April 27, 2026
**Status:** Ready for Development
