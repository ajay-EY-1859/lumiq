# AGENTS.md

## Purpose
This file is the compact operating guide for future AI coders and agents working on this repository.

Use this file before making changes so that the next assistant can understand:
- what has already been implemented,
- what is currently being stabilized,
- what should be done next,
- how to avoid wasting tokens or introducing regressions.

---

## Current Project Status
Lumiq is an Electron + React + Monaco desktop app for AI-assisted coding. The architecture is already mature:
- main/renderer split is in place,
- IPC bridge is implemented,
- Monaco editor is integrated,
- agent loop, tool execution, MCP, Git, LSP, and native code intelligence exist,
- the main focus now is reliability, safety, and editor stability rather than adding new surface area.

The current priorities are:
1. Make editor interactions safe and predictable.
2. Prevent data loss from unsaved edits and external file changes.
3. Make LSP and editor state reflect the live buffer, not stale disk state.
4. Keep changes small, test-backed, and reversible.

---

## What Has Already Been Done
The following work has already been completed or partially completed in this repository:
- editor dirty-tab protection against reload overwrite,
- live-buffer-based LSP calls for hover/completion/definition/reference/signature help,
- safer tab keyboard handling for shortcuts,
- save-state handling that avoids clearing dirty status too early,
- regression tests for editor store and LSP parser behavior,
- roadmap and bug audit documents updated.

Do not re-implement these behaviors unless a regression or missing case appears.

---

## What Should Be Done Next
When continuing work, follow this order:
1. Read the current relevant files before editing.
2. Prefer fixing one concrete problem at a time.
3. Add or update a regression test first when the issue is behavior-based.
4. Make the smallest fix that addresses the root cause.
5. Re-run the relevant tests and the full suite before claiming success.

### Priority order
- Editor safety and dirty-buffer handling
- LSP/live-buffer correctness
- Keyboard shortcut reliability
- Agent approval and destructive-action safety
- Collaboration and deployment features only after stabilization is solid

---

## Repository Conventions
- Keep changes scoped and low-risk.
- Prefer existing patterns in the codebase over introducing new abstractions.
- Preserve Electron main/renderer separation.
- Keep IPC contracts explicit and typed.
- Avoid broad refactors unless necessary for the current bug.
- Prefer regression tests over speculative fixes.

### Important files to consult
- [nextPlan.md](nextPlan.md)
- [editorBugs.md](editorBugs.md)
- [memory.md](memory.md)
- [src/renderer/src/store/editorStore.ts](src/renderer/src/store/editorStore.ts)
- [src/renderer/src/components/editor/EditorPane.tsx](src/renderer/src/components/editor/EditorPane.tsx)
- [src/main/services/LspService.ts](src/main/services/LspService.ts)
- [src/main/services/LspProcess.ts](src/main/services/LspProcess.ts)
- [src/main/ipc/lspHandlers.ts](src/main/ipc/lspHandlers.ts)
- [src/preload/index.ts](src/preload/index.ts)

---

## Verification Rules
Every claim of completion must be backed by fresh evidence.
Before saying something is fixed, verify it by running:
- the relevant focused test(s), and
- the broader suite if the change touches shared behavior.

Typical verification commands:
- npm test
- npx vitest run <target-test>
- npm run typecheck

---

## Guardrails for Token Efficiency
To avoid wasted tokens and confusion:
- do not rewrite large sections of code without explaining why,
- do not propose multiple unrelated fixes in one turn,
- do not add new features before the current stability issues are handled,
- do not repeat work already done unless a regression appeared,
- prefer a short plan, one fix, one verification cycle.

---

## Suggested Working Style for the Next Agent
If you are continuing this project:
1. Read [nextPlan.md](nextPlan.md) and [editorBugs.md](editorBugs.md).
2. Pick one concrete issue from the stabilization backlog.
3. Write or update a regression test if the issue is about user-visible behavior.
4. Fix the root cause.
5. Verify with tests and typecheck.
6. Summarize what changed and what remains.

---

## Bottom Line
The project is already architecturally strong. The next job is not to add flashy features, but to make the app trustworthy, safe, and predictable for day-to-day use.
