# ✨ Lumiq
### One interface. Every model.

A cross-platform **Electron + React** desktop application that brings the full power of `openclaude`-style agentic workflows into a native GUI. Supports OpenAI, Anthropic Claude, Google Gemini, Amazon Bedrock, Ollama, DeepSeek, and 200+ models — with a proper windowed interface instead of a terminal.

---

## ✨ What This Is

`openclaude` is a powerful CLI agentic tool (terminal-based). This project wraps its core engine into a **real desktop GUI** — same agentic capabilities, same multi-provider support, but with:

- A proper windowed application (not a terminal)
- Visual chat interface with message bubbles
- Sidebar for session history, agents, settings
- GUI-based API key management
- Visual tool approval dialogs
- Dark/Light theme toggle

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+
- npm or yarn
- API key for at least one provider (OpenAI, Anthropic, Gemini, or local Ollama)

### Install & Run
```bash
git clone https://github.com/your-org/lumiq.git
cd lumiq
npm install
npm run dev
```

### First Launch
1. App opens → Settings panel appears
2. Add your API key (OpenAI / Anthropic / Gemini / Ollama)
3. Select a model
4. Start chatting

---

## 🧱 Tech Stack

| Layer | Technology |
|-------|------------|
| Desktop Shell | Electron 28+ |
| UI Framework | React 18 + TypeScript |
| Styling | Tailwind CSS |
| State | Zustand |
| Build | Vite + electron-builder |
| Database | SQLite (better-sqlite3) |
| AI SDK | @anthropic-ai/sdk, openai, @google/generative-ai |
| Packaging | electron-builder |

---

## 📁 Project Structure

```
lumiq/
├── docs/                      # 📚 All project documentation
│   ├── plan.md
│   ├── prd.md
│   ├── srs.md
│   ├── architecture.md
│   ├── ui-design.md
│   ├── api-integration.md
│   └── user-manual.md
├── src/
│   ├── main/                  # Electron main process
│   │   ├── index.ts           # App entry, window creation
│   │   ├── ipc/               # IPC handlers (bridge to renderer)
│   │   ├── providers/         # AI provider clients
│   │   ├── agent/             # Agentic engine (tools, planner)
│   │   ├── db/                # SQLite database
│   │   └── security/          # API key encryption
│   ├── renderer/              # React frontend
│   │   ├── components/        # UI components
│   │   ├── pages/             # App screens
│   │   ├── store/             # Zustand state
│   │   ├── hooks/             # Custom React hooks
│   │   └── utils/             # Helpers
│   └── shared/                # Types shared between main/renderer
├── public/                    # Static assets
├── README.md
├── package.json
├── vite.config.ts
├── electron-builder.yml
└── tsconfig.json
```

---

## 🤖 Supported AI Providers

| Provider | Models | Auth |
|----------|--------|------|
| Anthropic | claude-opus-4, claude-sonnet-4, claude-haiku | API Key |
| OpenAI | gpt-4o, gpt-4-turbo, gpt-3.5-turbo | API Key |
| Google | gemini-1.5-pro, gemini-1.5-flash | API Key |
| Amazon Bedrock | Claude, Llama, Mistral, Titan, Cohere, AI21 | AWS Keys |
| Ollama | llama3, mistral, qwen2.5-coder, any local | None |
| DeepSeek | deepseek-chat, deepseek-coder | API Key |
| Custom | Any OpenAI-compatible endpoint | Configurable |

---

## 🛠️ Agentic Tools

The app includes a built-in tool execution engine (inspired by openclaude):

- **BashTool** — Run shell commands (with permission prompt)
- **FileReadTool** — Read files from disk
- **FileWriteTool** / **FileEditTool** — Write and edit files
- **GlobTool** — Find files by pattern
- **GrepTool** — Search file contents
- **WebFetchTool** — Fetch web pages
- **WebSearchTool** — Search the web

All tool executions show a **GUI approval dialog** before running.

---

## 📄 Documentation

Saari docs `docs/` folder mein hain — source code se bilkul alag:

| File | Description |
|------|-------------|
| [docs/plan.md](./docs/plan.md) | Project phases and task breakdown |
| [docs/prd.md](./docs/prd.md) | Product requirements and user stories |
| [docs/srs.md](./docs/srs.md) | Software requirements specification |
| [docs/architecture.md](./docs/architecture.md) | System architecture and data flow |
| [docs/ui-design.md](./docs/ui-design.md) | UI/UX specifications and component library |
| [docs/api-integration.md](./docs/api-integration.md) | AI provider integration details |
| [docs/user-manual.md](./docs/user-manual.md) | End-user guide |

---

## 🌐 Environment Variables

```env
# Optional — can also be set via GUI Settings
ANTHROPIC_API_KEY=sk-ant-...
OPENAI_API_KEY=sk-...
GOOGLE_API_KEY=...
OLLAMA_BASE_URL=http://localhost:11434
```

---

## 🏗️ Build for Production

```bash
# Windows
npm run build:win

# macOS
npm run build:mac

# Linux
npm run build:linux

# All platforms
npm run build:all
```

Output: `dist/` folder with platform-specific installers.

---

## 🤖 Agent Instructions

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

**Version:** 1.0 | **Last Updated:** April 27, 2026
