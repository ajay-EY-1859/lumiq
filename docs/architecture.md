# 🏗️ TECHNICAL ARCHITECTURE DOCUMENT
## Lumiq — openclaude GUI

**Version:** 1.0
**Date:** April 27, 2026

---

## 1. SYSTEM OVERVIEW

### 1.1 Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                    ELECTRON APPLICATION                         │
│                                                                 │
│  ┌──────────────────────────┐  ┌──────────────────────────┐    │
│  │   RENDERER PROCESS       │  │    MAIN PROCESS          │    │
│  │   (Chromium / React)     │  │    (Node.js)             │    │
│  │                          │  │                          │    │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │    │
│  │  │  React UI          │  │  │  │  IPC Handlers      │  │    │
│  │  │  - ChatPage        │  │  │  │  - chat:send       │  │    │
│  │  │  - Sidebar         │  │  │  │  - tool:approve    │  │    │
│  │  │  - Settings        │  │  │  │  - session:*       │  │    │
│  │  │  - AgentBuilder    │  │  │  │  - provider:*      │  │    │
│  │  └────────────────────┘  │  │  └────────────────────┘  │    │
│  │           │              │  │           │               │    │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │    │
│  │  │  Zustand Store     │  │  │  │  Agent Engine      │  │    │
│  │  │  - chatStore       │  │  │  │  - MessageQueue    │  │    │
│  │  │  - sessionStore    │  │  │  │  - ToolExecutor    │  │    │
│  │  │  - providerStore   │  │  │  │  - ContextManager  │  │    │
│  │  └────────────────────┘  │  │  └────────────────────┘  │    │
│  │           │              │  │           │               │    │
│  │  ┌────────────────────┐  │  │  ┌────────────────────┐  │    │
│  │  │  contextBridge     │◄─┼──┼─►│  Provider Clients  │  │    │
│  │  │  (preload.ts)      │  │  │  │  - Anthropic       │  │    │
│  │  └────────────────────┘  │  │  │  - OpenAI          │  │    │
│  └──────────────────────────┘  │  │  - Gemini          │  │    │
│                                │  │  - Ollama          │  │    │
│                                │  └────────────────────┘  │    │
│                                │           │               │    │
│                                │  ┌────────────────────┐  │    │
│                                │  │  SQLite Database   │  │    │
│                                │  │  (better-sqlite3)  │  │    │
│                                │  └────────────────────┘  │    │
│                                │           │               │    │
│                                │  ┌────────────────────┐  │    │
│                                │  │  Security Layer    │  │    │
│                                │  │  - Key Encryption  │  │    │
│                                │  │  - OS Keychain     │  │    │
│                                │  └────────────────────┘  │    │
│                                └──────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                          │
                    ┌─────────────────────┼─────────────────────┐
                    │                     │                     │
          ┌─────────▼──────┐   ┌──────────▼──────┐   ┌─────────▼──────┐
          │  Anthropic API  │   │   OpenAI API    │   │  Ollama Local  │
          │  claude-sonnet  │   │   gpt-4o        │   │  localhost:    │
          └────────────────┘   └─────────────────┘   │  11434         │
                                                      └────────────────┘
```

### 1.2 Key Architectural Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| Desktop Framework | Electron | Node.js access, mature ecosystem, same JS stack as openclaude |
| IPC Pattern | contextBridge + ipcRenderer | Secure, no nodeIntegration in renderer |
| State Management | Zustand | Lightweight, no boilerplate, works well with React |
| Database | SQLite (better-sqlite3) | Same as openclaude, no server needed, fast |
| AI SDKs | Official SDKs per provider | Best streaming support, type safety |
| Styling | Tailwind CSS | Fast development, consistent design |

---

## 2. ELECTRON PROCESS ARCHITECTURE

### 2.1 Main Process (`src/main/`)

The main process runs in Node.js and has full system access.

```
src/main/
├── index.ts              # BrowserWindow creation, app lifecycle
├── preload.ts            # contextBridge API exposed to renderer
├── ipc/
│   ├── chatHandlers.ts   # chat:send, chat:cancel
│   ├── sessionHandlers.ts # session CRUD
│   ├── providerHandlers.ts # provider config + test
│   ├── toolHandlers.ts   # tool approval flow
│   ├── agentHandlers.ts  # agent CRUD
│   └── settingsHandlers.ts # app settings
├── providers/
│   ├── ProviderFactory.ts
│   ├── AnthropicProvider.ts
│   ├── OpenAIProvider.ts
│   ├── GeminiProvider.ts
│   ├── OllamaProvider.ts
│   ├── DeepSeekProvider.ts
│   └── CustomProvider.ts
├── agent/
│   ├── AgentLoop.ts      # Main agentic loop
│   ├── ToolExecutor.ts   # Runs tools, handles approval
│   ├── ContextManager.ts # Context window management
│   └── MessageQueue.ts   # Message ordering
├── tools/
│   ├── BashTool.ts
│   ├── FileReadTool.ts
│   ├── FileWriteTool.ts
│   ├── FileEditTool.ts
│   ├── GlobTool.ts
│   ├── GrepTool.ts
│   ├── WebFetchTool.ts
│   └── WebSearchTool.ts
├── db/
│   ├── database.ts       # SQLite connection + migrations
│   ├── sessions.ts       # Session CRUD
│   ├── messages.ts       # Message CRUD
│   ├── apiConfigs.ts     # Provider config CRUD
│   └── agents.ts         # Agent CRUD
└── security/
    ├── encryption.ts     # AES-256-GCM encrypt/decrypt
    └── keychain.ts       # OS keychain integration
```

### 2.2 Renderer Process (`src/renderer/`)

The renderer runs in Chromium (like a browser). No direct Node.js access — communicates via contextBridge.

```
src/renderer/
├── App.tsx               # Root component, router
├── main.tsx              # React entry point
├── components/
│   ├── chat/
│   │   ├── ChatPage.tsx
│   │   ├── MessageList.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageInput.tsx
│   │   ├── StreamingMessage.tsx
│   │   ├── TypingIndicator.tsx
│   │   └── ToolApprovalDialog.tsx
│   ├── sidebar/
│   │   ├── Sidebar.tsx
│   │   ├── SessionList.tsx
│   │   └── SessionItem.tsx
│   ├── settings/
│   │   ├── SettingsPage.tsx
│   │   ├── ApiProvidersTab.tsx
│   │   ├── ProviderCard.tsx
│   │   └── AppearanceTab.tsx
│   ├── agents/
│   │   └── AgentBuilderPage.tsx
│   ├── layout/
│   │   ├── MainLayout.tsx
│   │   └── TitleBar.tsx
│   └── ui/               # Reusable primitives
│       ├── Button.tsx
│       ├── Input.tsx
│       ├── Modal.tsx
│       ├── Toast.tsx
│       └── CodeBlock.tsx
├── store/
│   ├── chatStore.ts
│   ├── sessionStore.ts
│   ├── providerStore.ts
│   └── settingsStore.ts
├── hooks/
│   ├── useChat.ts        # Send message, handle streaming
│   ├── useSessions.ts    # Load/switch sessions
│   └── useProviders.ts   # Provider management
└── utils/
    ├── markdown.ts       # Markdown rendering helpers
    └── formatters.ts     # Token count, date formatting
```

### 2.3 Shared Types (`src/shared/`)

```typescript
// src/shared/types.ts

export interface Message {
  id: string;
  sessionId: string;
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  toolName?: string;
  toolInput?: Record<string, unknown>;
  toolResult?: string;
  tokensUsed?: number;
  createdAt: Date;
}

export interface Session {
  id: string;
  title: string;
  provider: string;
  model: string;
  agentId?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ProviderConfig {
  id: string;
  provider: 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'deepseek' | 'custom';
  apiKey?: string;  // encrypted in storage
  baseUrl?: string;
  defaultModel: string;
  isActive: boolean;
}

export interface Agent {
  id: string;
  name: string;
  description?: string;
  systemPrompt: string;
  provider?: string;
  model?: string;
  tools: string[];  // enabled tool names
}

export interface ToolApprovalRequest {
  requestId: string;
  toolName: string;
  toolDescription: string;
  toolInput: Record<string, unknown>;
  workingDirectory?: string;
}

// IPC channel names
export const IPC = {
  CHAT_SEND: 'chat:send',
  CHAT_STREAM_CHUNK: 'chat:stream-chunk',
  CHAT_STREAM_END: 'chat:stream-end',
  CHAT_ERROR: 'chat:error',
  CHAT_CANCEL: 'chat:cancel',
  TOOL_APPROVAL_REQUEST: 'tool:approval-request',
  TOOL_APPROVAL_RESPONSE: 'tool:approval-response',
  TOOL_RESULT: 'tool:result',
  SESSION_LIST: 'session:list',
  SESSION_LOAD: 'session:load',
  SESSION_DELETE: 'session:delete',
  PROVIDER_SAVE: 'provider:save',
  PROVIDER_TEST: 'provider:test',
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
} as const;
```

---

## 3. DATA FLOW

### 3.1 Sending a Message

```
User types message → clicks Send
         │
         ▼
MessageInput.tsx
  calls window.electronAPI.chat.send(message, sessionId, provider, model)
         │
         ▼ (IPC: chat:send)
chatHandlers.ts (main process)
  1. Save user message to SQLite
  2. Load session history from SQLite
  3. Call ProviderFactory.createClient(provider, config)
  4. Call client.sendMessage(messages, { stream: true })
         │
         ▼
Provider Client (e.g. AnthropicProvider)
  Streams tokens from API
         │
         ▼ (IPC: chat:stream-chunk) for each token
StreamingMessage.tsx
  Appends token to displayed text
         │
         ▼ (IPC: chat:stream-end)
chatHandlers.ts
  Save complete assistant message to SQLite
         │
         ▼
ChatPage.tsx
  Updates message list, scrolls to bottom
```

### 3.2 Tool Execution Flow

```
AI response contains tool call (e.g. BashTool)
         │
         ▼
AgentLoop.ts
  Parses tool call from response
  Checks tool permission (always-ask / always-allow / always-deny)
         │
         ▼ (if always-ask)
IPC: tool:approval-request → Renderer
         │
         ▼
ToolApprovalDialog.tsx
  Shows tool name, args, working directory
  User clicks Approve / Deny / Always Allow
         │
         ▼ (IPC: tool:approval-response)
ToolExecutor.ts
  If approved: runs the tool
  If denied: returns "Tool execution denied by user"
         │
         ▼
Tool result sent back to AI as next message
         │
         ▼
AI continues generating response
```

### 3.3 Session Loading

```
User clicks session in sidebar
         │
         ▼
SessionItem.tsx
  calls window.electronAPI.session.load(sessionId)
         │
         ▼ (IPC: session:load)
sessionHandlers.ts
  SELECT * FROM messages WHERE session_id = ? ORDER BY created_at
         │
         ▼
Returns Message[] to renderer
         │
         ▼
chatStore.setMessages(messages)
         │
         ▼
MessageList.tsx re-renders with loaded messages
```

---

## 4. PROVIDER ARCHITECTURE

### 4.1 Unified Interface

```typescript
interface AIProvider {
  sendMessage(
    messages: Message[],
    options: {
      model: string;
      stream: boolean;
      systemPrompt?: string;
      maxTokens?: number;
      onChunk?: (chunk: string) => void;
      signal?: AbortSignal;
    }
  ): Promise<{ content: string; tokensUsed: number }>;

  listModels(): Promise<string[]>;
  testConnection(): Promise<{ success: boolean; error?: string }>;
}
```

### 4.2 Provider Implementations

```typescript
// AnthropicProvider.ts
class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({ apiKey: config.apiKey });
  }

  async sendMessage(messages, options) {
    const stream = await this.client.messages.stream({
      model: options.model,
      max_tokens: options.maxTokens ?? 8096,
      system: options.systemPrompt,
      messages: messages.map(m => ({ role: m.role, content: m.content }))
    });

    let content = '';
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta') {
        content += chunk.delta.text;
        options.onChunk?.(chunk.delta.text);
      }
    }
    return { content, tokensUsed: stream.finalUsage?.output_tokens ?? 0 };
  }
}
```

---

## 5. SECURITY ARCHITECTURE

### 5.1 API Key Storage

```typescript
// encryption.ts
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'crypto';

const ALGORITHM = 'aes-256-gcm';

export function encryptApiKey(apiKey: string, masterPassword: string): string {
  const salt = randomBytes(16);
  const key = scryptSync(masterPassword, salt, 32);
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const encrypted = Buffer.concat([cipher.update(apiKey, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return JSON.stringify({
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    encrypted: encrypted.toString('hex'),
    authTag: authTag.toString('hex')
  });
}
```

### 5.2 IPC Security

```typescript
// preload.ts — only expose what renderer needs
contextBridge.exposeInMainWorld('electronAPI', {
  chat: {
    send: (msg, sessionId, provider, model) =>
      ipcRenderer.invoke(IPC.CHAT_SEND, { msg, sessionId, provider, model }),
    cancel: () => ipcRenderer.invoke(IPC.CHAT_CANCEL),
    onChunk: (cb) => ipcRenderer.on(IPC.CHAT_STREAM_CHUNK, (_, chunk) => cb(chunk)),
    onEnd: (cb) => ipcRenderer.on(IPC.CHAT_STREAM_END, (_, data) => cb(data)),
  },
  tool: {
    onApprovalRequest: (cb) =>
      ipcRenderer.on(IPC.TOOL_APPROVAL_REQUEST, (_, req) => cb(req)),
    respond: (requestId, approved, alwaysAllow) =>
      ipcRenderer.invoke(IPC.TOOL_APPROVAL_RESPONSE, { requestId, approved, alwaysAllow }),
  },
  // ... other namespaces
});
```

---

## 6. DATABASE SCHEMA

```sql
-- Sessions
CREATE TABLE sessions (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL DEFAULT 'New Session',
  provider TEXT NOT NULL,
  model TEXT NOT NULL,
  agent_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Messages
CREATE TABLE messages (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
  content TEXT NOT NULL,
  tool_name TEXT,
  tool_input TEXT,   -- JSON
  tool_result TEXT,
  tokens_used INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
);

-- API Configurations
CREATE TABLE api_configs (
  id TEXT PRIMARY KEY,
  provider TEXT NOT NULL UNIQUE,
  api_key_encrypted TEXT,
  base_url TEXT,
  default_model TEXT NOT NULL,
  is_active INTEGER DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Custom Agents
CREATE TABLE agents (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  system_prompt TEXT NOT NULL,
  provider TEXT,
  model TEXT,
  tools TEXT DEFAULT '[]',  -- JSON array
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- App Settings
CREATE TABLE settings (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- Indexes
CREATE INDEX idx_messages_session ON messages(session_id, created_at);
CREATE INDEX idx_sessions_updated ON sessions(updated_at DESC);
```

---

## 7. TOOL ENGINE

### 7.1 Tool Interface

```typescript
interface Tool {
  name: string;
  description: string;
  inputSchema: JSONSchema;
  requiresApproval: boolean;
  execute(input: Record<string, unknown>, signal?: AbortSignal): Promise<string>;
}
```

### 7.2 Tool Implementations (from openclaude)

| Tool | Input | Output | Approval |
|------|-------|--------|----------|
| BashTool | `{ command: string, cwd?: string }` | stdout/stderr | Always |
| FileReadTool | `{ path: string }` | file contents | Never |
| FileWriteTool | `{ path: string, content: string }` | success/error | Always |
| FileEditTool | `{ path: string, old_string: string, new_string: string }` | diff | Always |
| GlobTool | `{ pattern: string, cwd?: string }` | file list | Never |
| GrepTool | `{ pattern: string, path?: string }` | matches | Never |
| WebFetchTool | `{ url: string }` | page content | Ask |
| WebSearchTool | `{ query: string }` | search results | Never |

---

## 8. PERFORMANCE OPTIMIZATION

### 8.1 Streaming
- Tokens sent via IPC as they arrive (no batching)
- React state updated with `useTransition` to avoid blocking UI
- Virtual scroll for long message lists (react-virtual)

### 8.2 Database
- All DB operations in main process (no renderer DB access)
- Prepared statements for all queries
- Index on `messages(session_id, created_at)`
- Lazy load message history (load last 50, paginate on scroll)

### 8.3 Memory
- Context window trimming: keep last N messages within token limit
- Image/attachment cleanup on session close
- Electron `webContents.setBackgroundThrottling(false)` for streaming

---

## 9. DEPLOYMENT

### 9.1 electron-builder Config

```yaml
# electron-builder.yml
appId: com.yourorg.lumiq
productName: Lumiq
directories:
  output: dist

win:
  target: nsis
  icon: public/icon.ico
  signingHashAlgorithms: [sha256]

mac:
  target: dmg
  icon: public/icon.icns
  category: public.app-category.developer-tools

linux:
  target: [AppImage, deb]
  icon: public/icon.png
  category: Development
```

### 9.2 Auto-Update

```typescript
// main/index.ts
import { autoUpdater } from 'electron-updater';

autoUpdater.checkForUpdatesAndNotify();
autoUpdater.on('update-available', () => {
  // Show update notification in UI
});
```

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
