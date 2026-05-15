# Software Requirements: Lumiq Hybrid AI IDE

Last updated: 2026-05-12

## Scope

This document defines requirements for stabilizing the current Lumiq app and evolving it into a hybrid AI IDE.

## Existing System Requirements

- The app shall run as an Electron desktop application.
- The renderer shall communicate with the main process only through the preload bridge.
- The main process shall own database access, provider calls, tool execution, MCP processes, and gRPC server lifecycle.
- The local developer server shall bind to `127.0.0.1`.
- Provider API keys shall be encrypted at rest.
- Tool execution shall respect global permission mode and per-tool settings.
- Read-only tool calls may run concurrently; mutating tools shall preserve serial order.

## Tool Execution Requirements

- Each provider tool call shall preserve its `toolCallId` from request through tool result.
- Multiple calls to the same tool in one assistant turn shall not be matched by tool name alone.
- Approval requests shall be delivered to an active Lumiq window even if it is not focused.
- Built-in default tool settings shall include Bash, PowerShell, file tools, glob, grep, web fetch/search, todo write, and sleep.

## Permission Modes

- `MANUAL`: require approval unless a per-tool setting or session always-allow permits it.
- `LIMITED`: auto-approve safe/read-oriented tools according to the permission evaluator.
- `EXTENDED`: auto-approve a broader set of common tools while still asking for higher-risk tools.
- `AUTO`: auto-approve all tools except tools explicitly denied by settings.

Per-tool `always-deny` shall override global mode.

## AI IDE Requirements

- A session may be bound to a workspace path.
- Workspace explorer shall show project files and allow opening files.
- Editor tabs shall track unsaved changes.
- Agent file edits shall be represented as diffs before application.
- User shall be able to accept/reject edits at hunk granularity.
- Terminal/task output shall be captured and surfaced as diagnostics where possible.
- Problems panel entries shall include file, line, severity, source, and message when available.
- LSP-backed features shall provide symbols, outline, and go-to-definition in later milestones.

## VS Code Companion Requirements

- Extension shall connect to the local Lumiq server on `127.0.0.1:43187` by default.
- Extension shall expose connection status.
- Extension shall send selected code or current document content to Lumiq.
- Future extension versions shall preview and apply diffs.

## Non-Functional Requirements

- The UI must remain responsive while providers stream, tools run, or MCP servers execute.
- Long-running operations must support cancellation where practical.
- Tool and MCP errors must return actionable messages to chat and logs.
- Documentation must distinguish implemented features from roadmap features.
