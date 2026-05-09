# 📘 USER MANUAL
## Lumiq — openclaude GUI

**Version:** 1.0
**Date:** April 27, 2026

---

## 1. GETTING STARTED

### 1.1 Installation

**Windows:**
1. Download `Lumiq-Setup-1.0.0.exe`
2. Run the installer, follow the wizard
3. Launch from Start Menu or Desktop shortcut

**macOS:**
1. Download `Lumiq-1.0.0.dmg`
2. Open DMG, drag app to Applications
3. Launch from Applications or Spotlight

**Linux:**
1. Download `Lumiq-1.0.0.AppImage`
2. `chmod +x Lumiq-1.0.0.AppImage`
3. Run: `./Lumiq-1.0.0.AppImage`

---

### 1.2 First Launch

When you open the app for the first time:

1. **Settings panel opens automatically** — you need at least one API key
2. **Add an API key** (see Section 2)
3. **Click "Test Connection"** to verify
4. **Close Settings** — you're ready to chat

---

### 1.3 Quick Start: Your First Chat

1. Click **"+ New Session"** in the sidebar (or press `Ctrl+N`)
2. Select your **Provider** from the dropdown in the title bar (e.g., "Anthropic")
3. Select a **Model** (e.g., "claude-sonnet-4-5")
4. Type your message in the input box at the bottom
5. Press **Enter** to send
6. Watch the response stream in real-time

---

## 2. API KEY SETUP

### 2.1 Opening Settings

- Click **⚙️ Settings** in the sidebar bottom
- Or press `Ctrl+,` (Windows/Linux) / `Cmd+,` (macOS)
- Go to the **"API Providers"** tab

### 2.2 Adding Anthropic (Claude)

1. Click the **Anthropic** card
2. Paste your API key in the "API Key" field
   - Get one at: https://console.anthropic.com/settings/keys
3. Select default model (recommended: `claude-sonnet-4-5`)
4. Click **"Test Connection"** — should show ✅ green
5. Click **Save**

### 2.3 Adding OpenAI

1. Click the **OpenAI** card
2. Paste your API key (starts with `sk-...`)
   - Get one at: https://platform.openai.com/api-keys
3. Select default model (recommended: `gpt-4o`)
4. Click **"Test Connection"**
5. Click **Save**

### 2.4 Adding Google Gemini

1. Click the **Google Gemini** card
2. Paste your API key
   - Get one at: https://aistudio.google.com/app/apikey
3. Select default model (recommended: `gemini-1.5-flash`)
4. Click **"Test Connection"**
5. Click **Save**

### 2.5 Using Ollama (Local Models)

Ollama runs AI models locally — no API key needed.

1. Install Ollama: https://ollama.ai
2. Pull a model: `ollama pull llama3.2`
3. In the app, click the **Ollama** card
4. Base URL should be `http://localhost:11434` (default)
5. Click **"Test Connection"** — should auto-detect your models
6. Select a model from the dropdown
7. Click **Save**

### 2.6 Custom Provider

For any OpenAI-compatible API (LM Studio, vLLM, etc.):

1. Click **"+ Add Custom Provider"**
2. Enter a name (e.g., "LM Studio")
3. Enter Base URL (e.g., `http://localhost:1234/v1`)
4. Enter API key (if required, or leave blank)
5. Enter model name manually
6. Click **"Test Connection"**

---

## 3. CHATTING

### 3.1 Sending Messages

- Type in the input box at the bottom
- **Enter** = Send message
- **Shift+Enter** = New line (multi-line message)
- Click the **Send →** button

### 3.2 Streaming Responses

Responses appear in real-time as the AI generates them. You'll see:
- A **typing indicator** (animated dots) while waiting for the first token
- Text appearing word by word as it streams
- A **■ Stop** button to cancel mid-response

### 3.3 Cancelling a Response

Click the **■ Stop** button that appears during streaming, or press **Escape**.

### 3.4 Message Actions

Hover over any message to see action buttons:
- **📋 Copy** — Copy message text to clipboard
- **🔄 Regenerate** — Re-generate the AI's last response (AI messages only)

### 3.5 Code Blocks

AI responses with code show:
- Syntax highlighting
- Language label (e.g., "python", "javascript")
- **Copy** button in the top-right corner of the code block

---

## 4. TOOL EXECUTION

The AI can use tools to perform actions on your computer. Every tool execution requires your approval.

### 4.1 Tool Approval Dialog

When the AI wants to use a tool, a dialog appears:

```
┌─────────────────────────────────────────┐
│ 🔧 Tool Execution Request               │
│                                         │
│ Tool: BashTool                          │
│                                         │
│ Command:                                │
│ ┌─────────────────────────────────────┐ │
│ │ npm test --coverage                 │ │
│ └─────────────────────────────────────┘ │
│                                         │
│ [Deny]  [Always Allow]  [Approve]       │
└─────────────────────────────────────────┘
```

**Buttons:**
- **Deny** — Reject this tool call. The AI will be told it was denied.
- **Always Allow** — Approve this tool AND all future calls to the same tool in this session.
- **Approve** — Approve just this one call.

### 4.2 Available Tools

| Tool | What it does | Default |
|------|-------------|---------|
| FileReadTool | Read file contents | Enabled, no approval |
| FileWriteTool | Write to a file | Enabled, approval required |
| FileEditTool | Edit specific text in a file | Enabled, approval required |
| GlobTool | Find files by pattern | Enabled, no approval |
| GrepTool | Search file contents | Enabled, no approval |
| WebFetchTool | Fetch a web page | Enabled, approval required |
| WebSearchTool | Search the web | Enabled, no approval |
| BashTool | Run shell commands | **Disabled by default** |

### 4.3 Enabling BashTool

BashTool is disabled by default for safety. To enable:
1. Go to **Settings > Tools**
2. Find **BashTool**
3. Toggle it **On**
4. Set permission to **"Always Ask"** (recommended)

### 4.4 File Edit Diff View

When the AI uses FileEditTool, the approval dialog shows a diff:
- **Red lines** = text being removed
- **Green lines** = text being added

Review carefully before approving.

---

## 5. SESSION MANAGEMENT

### 5.1 Creating a New Session

- Click **"+ New Session"** in the sidebar
- Or press `Ctrl+N` / `Cmd+N`

### 5.2 Switching Sessions

Click any session in the sidebar to load it. The full conversation history loads instantly.

### 5.3 Session Titles

Session titles are auto-generated from your first message. To rename:
1. Right-click the session in the sidebar
2. Click **"Rename"**
3. Type new name, press Enter

### 5.4 Deleting a Session

1. Right-click the session in the sidebar
2. Click **"Delete"**
3. Confirm in the dialog

### 5.5 Searching Sessions

Click the 🔍 search icon in the sidebar and type to filter sessions by title.

### 5.6 Exporting a Session

1. Right-click the session in the sidebar
2. Click **"Export"**
3. Choose format: **Markdown** or **JSON**
4. Choose save location

---

## 6. CUSTOM AGENTS

Agents are AI assistants with a custom system prompt and specific tool permissions.

### 6.1 Creating an Agent

1. Click **🤖 Agents** in the sidebar
2. Click **"+ New Agent"**
3. Fill in:
   - **Name** — e.g., "Code Reviewer"
   - **Description** — e.g., "Reviews code for bugs and improvements"
   - **System Prompt** — Instructions for the AI (e.g., "You are an expert code reviewer...")
   - **Model** — Optional, uses default if not set
   - **Tools** — Check which tools this agent can use
4. Click **"Save Agent"**

### 6.2 Using an Agent

1. In the chat header, click the **Agent dropdown** (shows "Default" by default)
2. Select your agent
3. Start a new session — the agent's system prompt is applied automatically

### 6.3 Example Agents

**Code Reviewer:**
```
System Prompt: You are an expert code reviewer. When reviewing code:
1. Check for bugs and logic errors
2. Suggest performance improvements
3. Point out security vulnerabilities
4. Recommend better patterns
Be specific and provide examples.
```

**Writing Assistant:**
```
System Prompt: You are a professional writing assistant. Help improve
writing by: fixing grammar, improving clarity, suggesting better word
choices, and maintaining the author's voice. Always explain your changes.
```

---

## 7. SETTINGS

### 7.1 Theme

**Settings > Appearance > Theme:**
- **Light** — White background
- **Dark** — Dark slate background
- **System** — Follows your OS setting

### 7.2 Default Provider & Model

**Settings > Models:**
- Set which provider and model to use by default for new sessions

### 7.3 Tool Permissions

**Settings > Tools:**
- Toggle each tool on/off
- Set default permission: Always Ask / Always Allow / Always Deny

### 7.4 Font Size

**Settings > Appearance > Font Size:**
- 12px (compact)
- 14px (default)
- 16px (large)

---

## 8. KEYBOARD SHORTCUTS

| Shortcut | Action |
|----------|--------|
| `Ctrl+N` / `Cmd+N` | New session |
| `Enter` | Send message |
| `Shift+Enter` | New line in message |
| `Escape` | Cancel streaming / close dialog |
| `Ctrl+B` / `Cmd+B` | Toggle sidebar |
| `Ctrl+,` / `Cmd+,` | Open settings |
| `Ctrl+F` / `Cmd+F` | Search sessions |
| `Ctrl+Q` / `Cmd+Q` | Quit app |

---

## 9. TROUBLESHOOTING

### "API key is invalid"
- Double-check the key was copied correctly (no extra spaces)
- Verify the key is active in your provider's dashboard
- Try "Test Connection" in Settings

### "Cannot connect to Ollama"
- Make sure Ollama is running: `ollama serve`
- Check the base URL is `http://localhost:11434`
- Make sure you've pulled at least one model: `ollama pull llama3.2`

### "Response is very slow"
- Try a faster model (e.g., claude-haiku instead of claude-opus)
- For local models, ensure your machine has enough RAM
- Check your internet connection for cloud providers

### "Tool execution failed"
- Check the error message shown in the chat
- For BashTool: ensure the command is valid for your OS
- For FileWriteTool: ensure the app has write permission to the directory

### "App won't start"
- Windows: Run as Administrator once to install
- macOS: Go to System Preferences > Security > Allow app
- Linux: `chmod +x AgenticDesktop.AppImage`

### Clearing App Data
If you need to reset everything:
- Windows: `%APPDATA%\lumiq\`
- macOS: `~/Library/Application Support/lumiq/`
- Linux: `~/.config/lumiq/`

Delete the folder and restart the app.

---

## 10. PRIVACY & SECURITY

### What data is stored locally
- All conversation history (SQLite database)
- API keys (encrypted with AES-256-GCM)
- App settings and preferences

### What is sent to external services
- Your messages are sent to the AI provider you selected
- Nothing is sent to our servers
- API keys are only sent to their respective providers

### API Key Security
- Keys are encrypted before storage
- Keys are stored in your OS keychain when possible
- Keys are never written to log files
- Keys are never sent anywhere except the provider's API

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
**Status:** Ready for Use
