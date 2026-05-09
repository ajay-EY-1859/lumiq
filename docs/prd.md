# 📋 PRODUCT REQUIREMENTS DOCUMENT (PRD)
## Lumiq — openclaude GUI

**Version:** 1.0
**Date:** April 27, 2026
**Status:** Ready for Development

---

## 1. EXECUTIVE SUMMARY

### 1.1 Purpose
Build a **native desktop GUI application** that wraps the `openclaude` agentic engine. Users get all the power of openclaude (multi-provider AI, tool execution, session history, custom agents) without needing a terminal — through a clean, modern windowed interface.

### 1.2 The Problem
`openclaude` is powerful but terminal-only. Non-developers, business users, and anyone who prefers a GUI cannot use it comfortably. A proper desktop app removes this barrier.

### 1.3 Target Audience
- **Developers** who want a GUI alternative to CLI tools
- **Business users** who need AI assistance without terminal knowledge
- **Data scientists** who switch between multiple AI providers
- **Power users** who want agentic automation with visual control

### 1.4 Key Value Propositions
1. **No Terminal Required** — Full agentic power in a windowed app
2. **Multi-Provider** — Switch between Anthropic, OpenAI, Gemini, Ollama in one click
3. **Visual Tool Control** — See and approve every tool call before it runs
4. **Session History** — All conversations saved, searchable, resumable
5. **Custom Agents** — Build and save specialized AI agents via GUI

---

## 2. USER STORIES

### 2.1 As a Developer
| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US1 | I want to chat with different AI models | Provider dropdown in header, switch without losing context |
| US2 | I want to run agentic tasks with tool use | Tool approval dialog appears before each tool execution |
| US3 | I want to see file edits as diffs | FileEditTool shows before/after diff in approval dialog |
| US4 | I want to resume past sessions | Sidebar shows all sessions, click to load |
| US5 | I want keyboard shortcuts | Ctrl+N new session, Ctrl+Enter send, Ctrl+B sidebar |

### 2.2 As a Business User
| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US6 | I want to add my API key without editing files | Settings > API Providers > Add Key form |
| US7 | I want dark/light theme | Theme toggle in settings, persists across restarts |
| US8 | I want to export a conversation | Right-click session > Export as Markdown/JSON |
| US9 | I want clear error messages | Toast notification with error + suggested fix |

### 2.3 As a Power User
| # | Story | Acceptance Criteria |
|---|-------|---------------------|
| US10 | I want to create custom agents | Agent Builder page with name, system prompt, tools |
| US11 | I want to control which tools are allowed | Per-tool toggle in Settings > Tools |
| US12 | I want to use local Ollama models | Ollama provider auto-detects localhost:11434 |
| US13 | I want streaming responses | Tokens appear in real-time as AI generates |
| US14 | I want to cancel a running response | Cancel button appears during streaming |

---

## 3. FUNCTIONAL REQUIREMENTS

### F1: Chat Interface
- **F1.1** Multi-line message input with Shift+Enter for newlines
- **F1.2** Send on Enter or Send button click
- **F1.3** Streaming response — tokens appear in real-time
- **F1.4** Cancel button during streaming
- **F1.5** Markdown rendering in responses (headers, bold, code blocks, tables)
- **F1.6** Syntax-highlighted code blocks with copy button
- **F1.7** Typing indicator (animated dots) while waiting for first token
- **F1.8** Auto-scroll to latest message
- **F1.9** Message timestamps on hover

### F2: Provider & Model Selection
- **F2.1** Provider dropdown in header (Anthropic, OpenAI, Gemini, Ollama, DeepSeek, Custom)
- **F2.2** Model dropdown filtered by selected provider
- **F2.3** Provider connection status indicator (green dot = connected)
- **F2.4** Fallback to static model list if provider API unavailable

### F3: Tool Execution
- **F3.1** Before any tool runs, show approval dialog with:
  - Tool name and description
  - Tool arguments (formatted JSON)
  - Approve / Deny / Always Allow buttons
- **F3.2** Tool result shown inline in chat after execution
- **F3.3** FileEditTool shows diff view (before/after) in approval dialog
- **F3.4** BashTool shows command in monospace font
- **F3.5** Tool execution can be cancelled mid-run
- **F3.6** "Always Allow" saves permission for session duration

### F4: Session Management
- **F4.1** All sessions saved to SQLite automatically
- **F4.2** Sidebar shows session list (title, date, model badge)
- **F4.3** Session title auto-generated from first user message
- **F4.4** Click session to load full history
- **F4.5** New session button (Ctrl+N)
- **F4.6** Delete session with confirmation dialog
- **F4.7** Search sessions by title/content

### F5: API Key Management
- **F5.1** Settings > API Providers tab
- **F5.2** Per-provider form: API Key (masked), Base URL, Default Model
- **F5.3** "Test Connection" button — shows success/failure toast
- **F5.4** Keys encrypted at rest (AES-256-GCM)
- **F5.5** Keys stored in OS keychain (Windows Credential Manager / macOS Keychain)
- **F5.6** Keys never logged or transmitted except to the provider

### F6: Custom Agents
- **F6.1** Agent Builder page: Name, Description, System Prompt, Model, Tools
- **F6.2** Save agent to database
- **F6.3** Select agent from dropdown in chat header
- **F6.4** Agent's system prompt prepended to every conversation
- **F6.5** Per-agent tool permissions

### F7: Settings
- **F7.1** Theme: Light / Dark / System
- **F7.2** Default provider and model
- **F7.3** Tool permissions (global defaults)
- **F7.4** Font size (12px / 14px / 16px)
- **F7.5** Message history limit (context window management)
- **F7.6** Auto-save conversations toggle
- **F7.7** Keyboard shortcuts reference

### F8: Data Management
- **F8.1** Export session as Markdown
- **F8.2** Export session as JSON
- **F8.3** Import session from JSON file
- **F8.4** Clear all history (with confirmation)
- **F8.5** Auto-backup to user data folder daily

---

## 4. NON-FUNCTIONAL REQUIREMENTS

### Performance
- App startup: < 3 seconds
- First token from API: < 2 seconds (network dependent)
- UI frame rate: 60fps during streaming
- Memory: < 300MB during normal use
- SQLite queries: < 50ms

### Reliability
- App never crashes on API errors — shows error toast instead
- Sessions auto-saved after every message
- Graceful handling of network disconnection
- Tool execution errors shown in chat, don't crash app

### Security
- API keys encrypted at rest (AES-256-GCM)
- No API keys in logs or error messages
- All external calls over HTTPS
- Tool execution requires explicit user approval
- BashTool disabled by default, must be explicitly enabled

### Usability
- New user can send first message within 2 minutes of install
- All actions accessible via keyboard
- Error messages include suggested fix
- Loading states for all async operations

### Compatibility
- Windows 10+ (64-bit)
- macOS 10.15+ (Intel + Apple Silicon)
- Linux: Ubuntu 20.04+, Fedora 35+
- Installer size: < 150MB

---

## 5. UI LAYOUT

### Main Window
```
┌──────────────────────────────────────────────────────────────┐
│ TitleBar: [Logo] Agentic Desktop    [Provider▼] [Model▼] [─□×]│
├──────────────────────────────────────────────────────────────┤
│ Sidebar (240px)    │  Chat Area                              │
│                    │                                         │
│ [+ New Session]    │  ┌─────────────────────────────────┐   │
│                    │  │ MessageList (scrollable)         │   │
│ Sessions:          │  │                                  │   │
│ • Today            │  │  [User] Hello, help me with...   │   │
│   ○ Fix bug #123   │  │                                  │   │
│   ○ Write tests    │  │  [AI] Sure! Here's how...        │   │
│ • Yesterday        │  │  ```python                       │   │
│   ○ API design     │  │  def example():                  │   │
│                    │  │  ```                             │   │
│ ─────────────────  │  │                                  │   │
│ [Agents]           │  │  [Tool: BashTool] ← approval     │   │
│ [Settings]         │  │                                  │   │
│                    │  └─────────────────────────────────┘   │
│                    │                                         │
│                    │  ┌─────────────────────────────────┐   │
│                    │  │ MessageInput                     │   │
│                    │  │ Type a message...          [Send]│   │
│                    │  └─────────────────────────────────┘   │
├──────────────────────────────────────────────────────────────┤
│ StatusBar: Ready | claude-sonnet-4 | 1,234 tokens           │
└──────────────────────────────────────────────────────────────┘
```

### Tool Approval Dialog
```
┌─────────────────────────────────────────┐
│ 🔧 Tool Execution Request               │
├─────────────────────────────────────────┤
│ Tool: BashTool                          │
│                                         │
│ Command:                                │
│ ┌─────────────────────────────────────┐ │
│ │ npm test --coverage                 │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ Working Directory: /home/user/project   │
│                                         │
│ [Deny]  [Always Allow]  [Approve]       │
└─────────────────────────────────────────┘
```

---

## 6. ACCEPTANCE CRITERIA

### Functional
| Feature | Criteria |
|---------|----------|
| Chat | Send message → receive streaming response |
| Providers | All 5 providers connect and respond |
| Tools | Tool approval dialog appears, tool runs after approval |
| Sessions | Sessions persist after app restart |
| API Keys | Keys save encrypted, load on restart |
| Agents | Custom agent system prompt applied to conversation |
| Theme | Dark/light toggle works, persists |

### Technical
| Requirement | Criteria |
|-------------|----------|
| Startup | App opens in < 3 seconds |
| Streaming | Tokens appear in real-time, no batching |
| Memory | < 300MB after 30 minutes of use |
| Packaging | Installer works on Win/Mac/Linux |

---

## 7. OUT OF SCOPE (v1)

- Mobile app
- Cloud sync of sessions
- Real-time collaboration
- Voice input/output
- Plugin marketplace
- Fine-tuning integration
- Multi-window support

---

## 8. FUTURE ENHANCEMENTS

1. Plugin system (install community tools)
2. Voice input (Whisper integration)
3. Image input (vision models)
4. Cloud backup of sessions
5. Team sharing of agents
6. Workflow automation builder
7. MCP (Model Context Protocol) server support

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
**Author:** Project Team
**Last Updated:** April 27, 2026
**Status:** Ready for Development
