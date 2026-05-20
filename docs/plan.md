# Lumiq Implementation Plan

Last updated: 2026-05-12

## Current Status

Lumiq is a capable agentic desktop app, not yet a full IDE. The immediate priority is to stabilize the existing implementation and then build the missing IDE shell.

## Milestone 1: Stabilize Current App

Status: in progress

- [x] Migrate ESLint 9 to flat config.
- [x] Preserve `toolCallId` through tool execution results.
- [x] Deliver tool approval to an active window, not only the focused window.
- [x] Add PowerShell and Sleep to default tool settings.
- [x] Remove dead TODO IPC declarations until a renderer todo surface exists.
- [x] Verify `npm run typecheck`.
- [x] Verify `npm run lint`.
- [x] Verify `npm run build`.
- [x] Verify `npm run compile` in `extensions/vscode`.
- [ ] Manually verify duplicate same-tool calls, gRPC approval, and Settings > Tools defaults.

## Milestone 2: Workspace Shell

Status: complete

- [x] Add workspace open/select flow.
- [x] Persist workspace binding per session.
- [x] Add project explorer.
- [x] Add file open/edit tabs.
- [x] Track dirty editor state.
- [x] Include workspace metadata in agent context.

## Milestone 3: Diff-First Editing

Status: complete

- [x] Normalize tool edit output into structured patches.
- [x] Add diff viewer.
- [x] Add accept/reject per hunk.
- [x] Add apply-to-file and copy-patch actions.
- [x] Record accepted/rejected edits in session history.

## Milestone 4: Terminal, Tasks, Problems

- [ ] Add controlled terminal or task runner panel.
- [ ] Add reusable tasks for build, lint, typecheck, test, and dev.
- [ ] Parse output into problems where possible.
- [ ] Add "ask Lumiq to fix" action from a problem.

## Milestone 5: Code Intelligence

- [ ] Add symbol index or LSP integration.
- [ ] Add outline and go-to-definition.
- [ ] Allow chat to reference symbols, diagnostics, and selected ranges.

## Milestone 6: VS Code Companion

- [ ] Add sidebar/webview.
- [ ] Add connection status and reconnect UX.
- [ ] Add inline diff preview.
- [ ] Add apply accepted edits.
- [ ] Package a local VSIX.

## Deferred

- Cloud sync.
- Remote server mode.
- Provider cost analytics.
- Multi-agent orchestration.
- Plugin marketplace.
- Voice and notebook workflows.
