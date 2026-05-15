# Lumiq

Lumiq is an Electron and React desktop app for agentic AI chat, local tools, MCP servers, and a local developer-server bridge. The product direction is hybrid: Lumiq is becoming a standalone AI IDE while the VS Code extension remains a companion client for users who want to stay in VS Code.

Current IDE readiness is about 35-40%. The agent engine, tools, providers, routing, skills, MCP MVP, gRPC server, and VS Code extension scaffold exist. The full IDE shell is still missing: workspace explorer, editor tabs, diff approval/apply, embedded terminal, problems panel, task runner, and LSP-backed navigation.

## Quick Start

Prerequisites:

- Node.js 20 or newer
- npm
- At least one provider API key, or Ollama running locally

```bash
npm install
npm run dev
```

Useful validation commands:

```bash
npm run typecheck
npm run lint
npm run build
cd extensions/vscode
npm run compile
```

## Current Capabilities

- Electron `^41.5.1`, React 18, TypeScript, Vite, Zustand, SQLite via `better-sqlite3`.
- Providers: Anthropic, OpenAI, Gemini, Ollama, DeepSeek, Bedrock, GitHub Models, OpenRouter, Groq, and custom OpenAI-compatible endpoints.
- Authentication: API keys for most providers, plus Google and GitHub OAuth setup paths.
- Agent loop with streaming, context trimming, tool calls, cancellation, and persisted sessions/messages.
- Tools: Bash, PowerShell, file read/write/edit, glob, grep, web fetch, web search, todo write, sleep, and dynamic MCP tools.
- Permission modes: `MANUAL`, `LIMITED`, `EXTENDED`, and `AUTO`, plus per-tool allow/ask/deny settings.
- MCP MVP: save/import/start/stop/test stdio servers, list tools, and expose running MCP tools to the agent.
- Routing and skills MVP: task mode routing, custom skills, and slash-command insertion in chat input.
- Local developer gRPC server on `127.0.0.1:43187`.
- VS Code extension scaffold that can send selected editor text to the local Lumiq server.

## Project Structure

```text
src/
  main/
    agent/          Agent loop, context manager, tool executor
    auth/           Google and GitHub OAuth helpers
    db/             SQLite migrations and CRUD modules
    ipc/            Main-process IPC handlers
    providers/      AI provider implementations
    security/       Encryption, keychain, permission evaluation
    services/       MCP manager and gRPC server
    tools/          Built-in and dynamic tools
  preload/          Secure contextBridge API
  renderer/
    src/components/ Chat, settings, agents, sidebar, UI primitives
    src/store/      Zustand stores
  shared/           Shared types and IPC channel constants
extensions/vscode/  Companion VS Code extension
docs/               Product, architecture, plan, and user docs
```

## Documentation

- [Architecture](docs/architecture.md)
- [Product Requirements](docs/prd.md)
- [Software Requirements](docs/srs.md)
- [Implementation Plan](docs/plan.md)
- [User Manual](docs/user-manual.md)
- [Implementation Guide](docs/pln/IMPLEMENTATION_GUIDE.md)

## Roadmap

1. Stabilize the existing agent app, tooling, and docs.
2. Add workspace binding, project explorer, file open/edit tabs, and session-to-workspace persistence.
3. Add diff-first editing with accept/reject per hunk.
4. Add terminal/task runner and problems panel from lint, typecheck, build, and runtime output.
5. Add LSP-backed symbols, outline, go-to-definition, and richer code context.
6. Mature the VS Code extension with sidebar UX, connection status, inline diff preview, and apply edits.

## Build

```bash
npm run build
npm run build:win
npm run build:mac
npm run build:linux
```

Packaged app output is written to `dist/`.
