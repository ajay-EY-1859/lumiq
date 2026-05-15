# Product Requirements: Lumiq Hybrid AI IDE

Last updated: 2026-05-12

## Product Direction

Lumiq will become a hybrid AI IDE:

- A standalone desktop IDE experience for agentic coding workflows.
- A VS Code companion client for users who want Lumiq's engine inside their existing editor.

Current readiness as a full AI IDE is about 35-40%. The AI agent foundation exists, but the IDE shell and code-editing workflow are still incomplete.

## Current Users

- Developers who want a desktop agent app with explicit tool approvals.
- Power users who need multiple model providers and routing.
- Teams experimenting with MCP and local developer-server workflows.
- VS Code users who want a companion bridge to Lumiq.

## Implemented Product Capabilities

- Multi-provider AI chat with persisted sessions.
- Agent tool calls with GUI approvals and permission modes.
- Provider settings, model selection, custom agents, routing, and skills.
- MCP server management MVP.
- Local gRPC developer server.
- VS Code extension scaffold.

## AI IDE Requirements

### Milestone 1: Stabilize Existing App

Acceptance:

- `npm run typecheck`, `npm run lint`, and `npm run build` pass.
- Tool approval works from chat and gRPC-triggered flows when the app window is open.
- Default tool settings include all built-in tools.
- README and docs describe current behavior accurately.

### Milestone 2: Workspace Shell

Acceptance:

- User can bind a session to a workspace folder.
- User can browse files in a project explorer.
- User can open files in editor tabs.
- Session state remembers workspace, open files, model, route, and todos.

### Milestone 3: Diff-First Editing

Acceptance:

- Agent edits are shown as diffs before applying.
- User can accept or reject per file and per hunk.
- Applied edits are persisted and visible in chat history.

### Milestone 4: Terminal, Tasks, and Problems

Acceptance:

- App includes an embedded terminal or controlled task runner.
- Build, lint, typecheck, and test output can feed a problems panel.
- Problems are clickable and can be sent to Lumiq for repair.

### Milestone 5: Code Intelligence

Acceptance:

- Symbols, outline, and go-to-definition are backed by LSP or equivalent language services.
- Chat context can include selected symbols, files, diagnostics, and workspace metadata.

### Milestone 6: VS Code Companion

Acceptance:

- Extension has connection status and sidebar/webview.
- Extension can preview and apply inline diffs.
- Extension can send selected code, files, diagnostics, and workspace context to Lumiq.

## Out of Scope For The Next Stabilization Pass

- Cloud sync.
- Remote gRPC hosting.
- Multi-agent swarms.
- Plugin marketplace.
- Voice and notebook workflows.
