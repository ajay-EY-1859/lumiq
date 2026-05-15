# Implementation Guide

Last updated: 2026-05-12

This guide replaces the old OpenClaude parity checklist with the current Lumiq implementation path. Use it with `docs/architecture.md`, `docs/prd.md`, `docs/srs.md`, and `docs/plan.md`.

## Stabilization First

Before adding new IDE features:

1. Keep `npm run typecheck`, `npm run lint`, and `npm run build` passing.
2. Keep `npm run compile` passing in `extensions/vscode`.
3. Preserve tool call IDs end to end.
4. Keep approval delivery working from both GUI chat and gRPC-originated requests.
5. Keep docs current when implemented behavior changes.

## Existing Foundation

Already built:

- Provider factory and provider clients.
- Agent loop with streaming and tool calls.
- Tool executor with permission modes and concurrent read-only batches.
- Built-in local tools and dynamic MCP tools.
- SQLite persistence.
- Settings UI for providers, tools, permission mode, MCP, routing, skills, and gRPC.
- Local gRPC server.
- VS Code extension scaffold.

## Next Implementation Slices

### Workspace Binding

- Add workspace path to session metadata.
- Add a folder picker using existing dialog IPC.
- Persist selected workspace per session.
- Include workspace path in tool defaults and agent context.

### Explorer and Tabs

- Add a file tree component backed by main-process file listing.
- Open files into editor tabs.
- Track dirty state locally.
- Use explicit save calls through IPC; do not give the renderer raw file-system access.

### Diff-First Edits

- Convert FileEdit/FileWrite outcomes into structured proposed edits where possible.
- Render proposed edits in a diff viewer.
- Apply accepted hunks through main-process file APIs.
- Store accepted/rejected edit decisions in message metadata.

### Terminal and Problems

- Start with a controlled task runner before a fully interactive terminal.
- Provide built-in tasks for lint, typecheck, build, test, and dev.
- Parse output into problem entries with file, line, severity, source, and message.
- Make problem entries actionable from chat.

### Code Intelligence

- Add LSP only after explorer, tabs, and problems exist.
- Start with outline and symbol search.
- Add go-to-definition and selected-symbol context next.

### VS Code Companion

- Add connection status and reconnect UX.
- Move from output-channel-only results to sidebar/webview.
- Add inline diff preview and apply-edit commands.
- Package a local VSIX when the protocol stabilizes.

## Manual Verification Checklist

- Same tool called twice in one assistant turn maps each result to the correct `toolCallId`.
- Tool approval appears when the app window is open but not focused.
- Settings > Tools shows PowerShellTool and SleepTool on fresh/default settings.
- Permission mode behavior matches the user manual.
- README quick start works from a clean clone.
- gRPC server binds only to `127.0.0.1:43187`.
- VS Code extension can compile and connect to the local server.
