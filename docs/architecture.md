# Lumiq Architecture

Last updated: 2026-05-12

## System Shape

Lumiq is an Electron desktop application with a secure renderer/main split.

```text
React renderer
  Chat UI, settings, agents, sidebar, slash commands
  Zustand stores
  window.electronAPI from preload

Preload bridge
  Whitelisted IPC methods and event listeners

Electron main process
  IPC handlers
  AgentLoop and ToolExecutor
  ProviderFactory and provider clients
  SQLite persistence
  MCP server manager
  Local gRPC developer server
  Security, key encryption, permission evaluation
```

## Implemented Modules

- `src/main/index.ts`: app lifecycle, BrowserWindow, menu, startup loading for tool settings and permission mode.
- `src/preload/index.ts`: secure `contextBridge` surface for chat, tools, sessions, providers, settings, agents, MCP, routing, skills, gRPC, auth, shell, window controls, and dialogs.
- `src/main/agent/AgentLoop.ts`: streaming provider loop, tool-call handling, tool-result persistence, callbacks for GUI and gRPC callers.
- `src/main/agent/ToolExecutor.ts`: built-in and MCP tool registry, read-only concurrent batches, approval flow, per-tool settings, permission modes.
- `src/main/providers/*`: provider implementations for Anthropic, OpenAI, Gemini, Ollama, DeepSeek, Bedrock, GitHub, OpenRouter, Groq, and custom endpoints.
- `src/main/db/*`: SQLite migrations and CRUD modules for sessions, messages, providers, agents, routes, skills, MCP servers, OAuth, and todos.
- `src/main/services/mcp/McpServerManager.ts`: stdio MCP lifecycle, approval, tool discovery, and tool invocation.
- `src/main/services/grpc/DeveloperGrpcServer.ts`: local gRPC server bound to `127.0.0.1`.
- `extensions/vscode`: companion extension scaffold.

## Data Flow

1. Renderer calls `window.electronAPI.chat.send(...)`.
2. `chatHandlers.ts` validates session/provider/model and loads persisted context.
3. `AgentLoop` creates the provider, sends messages with available tool definitions, and streams chunks back to the renderer.
4. If the provider returns tool calls, `ToolExecutor` evaluates permission mode and tool settings.
5. Approval requests are sent to an active Lumiq window and resolved by `tool:approval-response`.
6. Tool results are persisted as `tool` messages and sent back to the provider.
7. Final assistant content is persisted and streamed to the UI.

## Security Model

- Renderer has no direct Node.js or database access.
- IPC channels are centralized in `src/shared/types.ts` and exposed explicitly in preload.
- API keys are encrypted before storage.
- Tool execution is gated by per-tool settings and global permission mode.
- gRPC binds only to localhost.
- MCP server startup requires explicit approval before spawning commands.

## Known Gaps

- No workspace explorer, editor tabs, diff-approval UI, embedded terminal, problems panel, or task runner yet.
- Tool approval is functional but not a full approval center with queue, source attribution, and history.
- MCP is MVP-level: resources, auth flows, registry integration, and richer protocol diagnostics are still future work.
- VS Code extension is output-channel oriented and lacks sidebar UX, inline diff preview, and apply-edit workflow.
- LSP-backed code intelligence is not implemented.
