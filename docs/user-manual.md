# Lumiq User Manual

Last updated: 2026-05-12

## Getting Started

Run the desktop app from source:

```bash
npm install
npm run dev
```

On first use, configure at least one provider in Settings. Ollama can be used locally without a cloud API key if Ollama is installed and running.

## Providers

Open Settings and configure one or more providers:

- Anthropic
- OpenAI
- Gemini
- Ollama
- DeepSeek
- Bedrock
- GitHub Models
- OpenRouter
- Groq
- Custom OpenAI-compatible endpoint

Use Test Connection after saving credentials. API keys are encrypted locally.

## Chat Sessions

- Create a new session from the sidebar or app menu.
- Select provider, model, agent, and optional task mode.
- Type a message and press Enter to send.
- Use Shift+Enter for a newline.
- Stop cancels the active stream.
- Session messages are persisted in the local SQLite database.

## Tools

Lumiq can let the model use tools:

| Tool | Purpose | Default behavior |
| --- | --- | --- |
| FileReadTool | Read file contents | Enabled, usually allowed |
| FileWriteTool | Write files | Enabled, asks |
| FileEditTool | Replace exact text in files | Enabled, asks |
| GlobTool | Find files by pattern | Enabled, usually allowed |
| GrepTool | Search text in files | Enabled, usually allowed |
| WebFetchTool | Fetch web page content | Enabled, asks |
| WebSearchTool | Search the web | Enabled, usually allowed |
| TodoWriteTool | Update session checklist | Enabled, usually allowed |
| SleepTool | Pause briefly | Enabled, usually allowed |
| BashTool | Run shell commands | Disabled by default |
| PowerShellTool | Run PowerShell commands | Disabled by default |
| MCP_* | Dynamic tools from running MCP servers | Depends on server/tool settings |

## Permission Modes

Settings includes a global permission mode plus per-tool settings.

- `MANUAL`: most tool calls ask for approval.
- `LIMITED`: safe/read-oriented tools can be auto-approved.
- `EXTENDED`: a broader set of common tools can be auto-approved.
- `AUTO`: tools are auto-approved unless explicitly denied.

Per-tool settings can be:

- Always Ask
- Always Allow
- Always Deny

Always Deny wins over global mode.

## Tool Approvals

When approval is required, Lumiq shows a dialog with the tool name, description, input, and working directory. You can approve once, deny, or always allow that tool for the current runtime session.

For gRPC or VS Code companion requests, approvals still appear in the Lumiq desktop app.

## MCP Servers

The MCP settings panel can save, import, start, stop, restart, and test MCP servers. Starting an MCP server can execute a local command, so review the command and environment before approving it.

Running MCP servers can expose dynamic `MCP_*` tools to the agent.

## Routing and Skills

- Routing maps task modes to provider/model choices.
- Skills store reusable prompt templates and allowed tool context.
- Slash commands in the chat input can help insert skills or choose task modes.

## Local Developer Server

The local gRPC developer server runs on:

```text
127.0.0.1:43187
```

Use Settings to start or stop it. The VS Code extension uses this server by default.

## Troubleshooting

- Invalid API key: re-copy the key, save, and use Test Connection.
- Ollama not found: confirm `ollama serve` is running and the base URL is `http://localhost:11434`.
- Tool denied: check global permission mode and per-tool settings.
- MCP server fails: check command, args, env, and server logs/status in Settings.
- gRPC client cannot connect: confirm the local developer server is running and bound to `127.0.0.1:43187`.

## Local Data

Lumiq stores sessions, settings, provider configs, routes, skills, MCP servers, and todos locally. API keys are encrypted before storage. Messages are sent only to the provider selected for the session or route.
