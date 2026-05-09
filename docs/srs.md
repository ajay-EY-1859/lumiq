# 📖 SOFTWARE REQUIREMENTS SPECIFICATION (SRS)
## Lumiq — openclaude GUI

**Version:** 1.0
**Date:** April 27, 2026

---

## 1. INTRODUCTION

### 1.1 Purpose
This SRS defines all functional and non-functional requirements for Lumiq — an Electron-based GUI wrapper around the `openclaude` agentic engine.

### 1.2 Scope
The system provides:
- A native desktop application (Windows, macOS, Linux)
- GUI for multi-provider AI chat (Anthropic, OpenAI, Gemini, Ollama, DeepSeek)
- Visual tool execution with approval dialogs
- Session history with SQLite persistence
- Secure API key management
- Custom agent creation and management

### 1.3 Definitions

| Term | Definition |
|------|------------|
| Main Process | Electron's Node.js process — has full system access |
| Renderer Process | Electron's Chromium process — runs React UI |
| IPC | Inter-Process Communication — bridge between main and renderer |
| contextBridge | Electron API for safely exposing main process APIs to renderer |
| Tool | A capability the AI can invoke (BashTool, FileReadTool, etc.) |
| Agent Loop | The cycle of: AI responds → tool called → result returned → AI continues |
| Provider | An AI API service (Anthropic, OpenAI, Gemini, Ollama) |
| Session | A conversation thread with its full message history |
| Streaming | Receiving AI response tokens in real-time as they're generated |

### 1.4 References

| Reference | URL |
|-----------|-----|
| Electron Docs | https://www.electronjs.org/docs |
| Anthropic SDK | https://github.com/anthropic-ai/sdk-python |
| OpenAI SDK | https://github.com/openai/openai-node |
| openclaude Source | D:\openclaude |
| React Docs | https://react.dev |
| Tailwind CSS | https://tailwindcss.com |
| better-sqlite3 | https://github.com/WiseLibs/better-sqlite3 |

---

## 2. OVERALL DESCRIPTION

### 2.1 Product Perspective
This app is a GUI frontend for the `openclaude` agentic engine. The core logic (provider clients, tool execution, session storage, agent loop) is ported from openclaude's Node.js codebase into Electron's main process. The React UI replaces openclaude's Ink terminal renderer.

### 2.2 Operating Environment

| Environment | Specification |
|-------------|---------------|
| Windows | 10+ (64-bit), NSIS installer |
| macOS | 10.15+ (Intel + Apple Silicon), DMG |
| Linux | Ubuntu 20.04+, AppImage + .deb |
| RAM | Minimum 4GB, Recommended 8GB |
| Storage | 500MB for app + data |
| Network | Required for cloud providers, optional for Ollama |
| Node.js | Bundled in Electron (no separate install) |

### 2.3 User Classes

| Class | Description | Technical Level |
|-------|-------------|-----------------|
| Developer | Uses AI for coding, debugging, automation | High |
| Business User | Uses AI for writing, analysis, Q&A | Low-Medium |
| Data Scientist | Uses multiple AI providers for research | High |
| Power User | Creates custom agents, uses tools | High |

---

## 3. FUNCTIONAL REQUIREMENTS

### 3.1 Module: Chat Interface

| ID | Requirement | Priority |
|----|-------------|----------|
| CH1 | Multi-line text input with auto-resize | Must |
| CH2 | Send on Enter key (Shift+Enter for newline) | Must |
| CH3 | Send button, disabled when input empty | Must |
| CH4 | Streaming response — tokens appear in real-time | Must |
| CH5 | Cancel button visible during streaming | Must |
| CH6 | Markdown rendering (headers, bold, italic, lists, tables) | Must |
| CH7 | Syntax-highlighted code blocks with copy button | Must |
| CH8 | Typing indicator (animated dots) before first token | Must |
| CH9 | Auto-scroll to latest message | Must |
| CH10 | Message timestamps shown on hover | Should |
| CH11 | Copy message content button | Should |
| CH12 | Regenerate last response button | Should |

### 3.2 Module: Provider Management

| ID | Requirement | Priority |
|----|-------------|----------|
| PM1 | Provider dropdown: Anthropic, OpenAI, Gemini, Ollama, DeepSeek, Custom | Must |
| PM2 | Model dropdown filtered by selected provider | Must |
| PM3 | Connection status indicator per provider | Must |
| PM4 | Settings > API Providers tab for key management | Must |
| PM5 | Per-provider form: API Key, Base URL, Default Model | Must |
| PM6 | "Test Connection" button with success/failure feedback | Must |
| PM7 | API keys encrypted at rest (AES-256-GCM) | Must |
| PM8 | API keys stored in OS keychain | Should |
| PM9 | Ollama auto-detect at localhost:11434 | Must |
| PM10 | Custom provider: configurable base URL + auth header | Should |

### 3.3 Module: Tool Execution

| ID | Requirement | Priority |
|----|-------------|----------|
| TL1 | BashTool: execute shell commands | Must |
| TL2 | FileReadTool: read file contents | Must |
| TL3 | FileWriteTool: write file contents | Must |
| TL4 | FileEditTool: edit specific text in file | Must |
| TL5 | GlobTool: find files by pattern | Must |
| TL6 | GrepTool: search file contents | Must |
| TL7 | WebFetchTool: fetch URL content | Should |
| TL8 | WebSearchTool: DuckDuckGo search | Should |
| TL9 | Tool approval dialog before execution | Must |
| TL10 | Dialog shows: tool name, description, arguments | Must |
| TL11 | Approve / Deny / Always Allow buttons | Must |
| TL12 | FileEditTool shows diff view in dialog | Should |
| TL13 | Tool result shown inline in chat | Must |
| TL14 | Tool execution can be cancelled | Must |
| TL15 | BashTool disabled by default, must be enabled in settings | Must |

### 3.4 Module: Session Management

| ID | Requirement | Priority |
|----|-------------|----------|
| SM1 | All sessions auto-saved to SQLite | Must |
| SM2 | Session title auto-generated from first message | Must |
| SM3 | Sidebar shows session list (title, date, model) | Must |
| SM4 | Click session to load full history | Must |
| SM5 | New session button (Ctrl+N) | Must |
| SM6 | Delete session with confirmation | Must |
| SM7 | Search sessions by title | Should |
| SM8 | Export session as Markdown | Should |
| SM9 | Export session as JSON | Should |
| SM10 | Session persists across app restarts | Must |

### 3.5 Module: Custom Agents

| ID | Requirement | Priority |
|----|-------------|----------|
| AG1 | Agent Builder page: Name, Description, System Prompt | Must |
| AG2 | Per-agent model selection | Must |
| AG3 | Per-agent tool permissions | Must |
| AG4 | Save agent to SQLite | Must |
| AG5 | Select agent from dropdown in chat header | Must |
| AG6 | Agent system prompt prepended to conversation | Must |
| AG7 | Edit existing agent | Must |
| AG8 | Delete agent with confirmation | Must |

### 3.6 Module: Settings

| ID | Requirement | Priority |
|----|-------------|----------|
| ST1 | Theme: Light / Dark / System | Must |
| ST2 | Default provider and model | Must |
| ST3 | Global tool permissions (always-ask / always-allow / always-deny) | Must |
| ST4 | Font size: 12px / 14px / 16px | Should |
| ST5 | Context window limit (max messages to send) | Should |
| ST6 | Auto-save conversations toggle | Should |
| ST7 | Keyboard shortcuts reference | Should |
| ST8 | Settings persist across restarts | Must |

### 3.7 Module: Application Shell

| ID | Requirement | Priority |
|----|-------------|----------|
| AP1 | Custom title bar (frameless window) | Should |
| AP2 | Sidebar toggle (Ctrl+B) | Must |
| AP3 | Status bar: current model, token count | Should |
| AP4 | App menu: File, Edit, View, Help | Must |
| AP5 | Keyboard shortcuts for all major actions | Must |
| AP6 | Toast notifications for errors and success | Must |
| AP7 | Auto-updater (electron-updater) | Should |
| AP8 | Crash reporting (optional, opt-in) | Should |

---

## 4. NON-FUNCTIONAL REQUIREMENTS

### 4.1 Performance

| Metric | Target |
|--------|--------|
| App startup time | < 3 seconds |
| First token from API | < 2 seconds (network dependent) |
| UI frame rate during streaming | 60fps |
| Memory usage (normal) | < 300MB |
| Memory usage (large session) | < 500MB |
| SQLite query time | < 50ms |
| Session load time | < 200ms |

### 4.2 Reliability

| Requirement | Criteria |
|-------------|----------|
| API error handling | Show toast, never crash app |
| Network disconnection | Graceful error, retry option |
| Session auto-save | After every message |
| Tool execution error | Show in chat, continue session |
| App crash recovery | Restore last session on restart |

### 4.3 Security

| Requirement | Implementation |
|-------------|----------------|
| API key storage | AES-256-GCM encrypted |
| API key access | Only in main process, never in renderer |
| External calls | HTTPS only |
| Tool execution | Requires explicit user approval |
| IPC validation | All IPC inputs validated in main process |
| No key logging | API keys stripped from all logs |

### 4.4 Accessibility

| Requirement | Criteria |
|-------------|----------|
| Keyboard navigation | All features accessible via keyboard |
| Screen reader | ARIA labels on all interactive elements |
| Color contrast | WCAG 2.1 AA (4.5:1 minimum) |
| Focus indicators | Visible focus ring on all focusable elements |
| Font scaling | Respects system font size |

### 4.5 Compatibility

| Platform | Version | Installer |
|----------|---------|-----------|
| Windows | 10+ 64-bit | NSIS (.exe) |
| macOS | 10.15+ | DMG |
| Linux | Ubuntu 20.04+ | AppImage, .deb |
| Installer size | < 150MB | All platforms |

---

## 5. INTERFACE REQUIREMENTS

### 5.1 IPC Channels

```typescript
// Renderer → Main (invoke)
'chat:send'           // { message, sessionId, provider, model }
'chat:cancel'         // {}
'tool:approval-response' // { requestId, approved, alwaysAllow }
'session:list'        // {}
'session:load'        // { sessionId }
'session:delete'      // { sessionId }
'provider:save'       // { config: ProviderConfig }
'provider:test'       // { provider, apiKey, baseUrl }
'settings:get'        // {}
'settings:set'        // { key, value }
'agent:list'          // {}
'agent:save'          // { agent: Agent }
'agent:delete'        // { agentId }

// Main → Renderer (on)
'chat:stream-chunk'   // { chunk: string }
'chat:stream-end'     // { tokensUsed: number }
'chat:error'          // { error: string }
'tool:approval-request' // { ToolApprovalRequest }
'tool:result'         // { toolName, result }
```

### 5.2 Provider API Interfaces

All providers implement:
```typescript
interface AIProvider {
  sendMessage(messages: Message[], options: SendOptions): Promise<SendResult>;
  listModels(): Promise<string[]>;
  testConnection(): Promise<TestResult>;
}
```

### 5.3 Tool Interface

All tools implement:
```typescript
interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  requiresApproval: boolean;
  execute(input: unknown, signal?: AbortSignal): Promise<string>;
}
```

---

## 6. DATABASE REQUIREMENTS

### 6.1 Tables

| Table | Purpose |
|-------|---------|
| sessions | Conversation threads |
| messages | Individual messages per session |
| api_configs | Provider API configurations |
| agents | Custom agent definitions |
| settings | App settings key-value store |

### 6.2 Data Retention
- Sessions: Kept indefinitely (user can delete manually)
- Messages: Cascade delete with session
- API configs: Kept until user removes provider
- Settings: Persistent

---

## 7. ACCEPTANCE CRITERIA

### 7.1 Functional

| Feature | Test | Pass Criteria |
|---------|------|---------------|
| Chat | Send message | Response received and displayed |
| Streaming | Send message | Tokens appear in real-time |
| Cancel | Click cancel during stream | Stream stops immediately |
| Tool | AI calls BashTool | Approval dialog appears |
| Tool Approve | Click Approve | Tool runs, result shown in chat |
| Tool Deny | Click Deny | "Denied" shown, AI continues |
| Session | Restart app | Previous session loads from sidebar |
| API Key | Save key, restart | Key loads and works |
| Agent | Create agent, select it | System prompt applied to conversation |
| Theme | Toggle dark/light | Theme changes, persists on restart |

### 7.2 Performance

| Test | Pass Criteria |
|------|---------------|
| App startup | Opens in < 3 seconds |
| First token | Appears in < 2 seconds |
| Streaming | No visible lag or batching |
| Memory | < 300MB after 30 min use |
| Session load | 100 messages load in < 200ms |

---

## 8. RISKS AND MITIGATIONS

| Risk | Impact | Mitigation |
|------|--------|------------|
| Electron security vulnerabilities | High | contextBridge, no nodeIntegration in renderer |
| API key exposure | Critical | AES-256-GCM + OS keychain, never in renderer |
| Streaming performance | Medium | useTransition, virtual scroll |
| Cross-platform packaging | Medium | electron-builder, CI/CD for each platform |
| Tool execution safety | High | Approval dialog, BashTool disabled by default |
| Context window overflow | Medium | ContextManager trims old messages |

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
**Next Review:** After Phase 1 completion
