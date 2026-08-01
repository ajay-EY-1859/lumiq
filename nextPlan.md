# Lumiq — Updated Next Plan

**Last Updated:** 2026-07-29  
**Current Status:** 🔍 The core application architecture is in place: Electron + React + Monaco + agent loop + MCP + Git + LSP services are all present. The product is functionally advanced, but the next focus should be reliability, safety, and polish rather than new surface area.

---

## ✅ What is already working
- Core desktop shell, main/renderer split, and IPC bridge are implemented.
- Agent loop, tool execution, context management, and provider integrations are present.
- Monaco editor, LSP wiring, MCP hub, Git integration, and native code intelligence are already available.
- The project has a strong foundation, but it still needs hardening in editor flow and agent safety.

## ⚠️ Current health snapshot
- TypeScript validation is not fully green yet: the current check reports one unused import issue in [src/main/index.ts](src/main/index.ts).
- The roadmap still includes several known editor weaknesses around tab switching, dirty-buffer protection, and LSP sync behavior.
- The highest-value work now is to make the app feel trustworthy and stable before expanding into advanced collaboration and deployment features.

---

## 🚀 Next Plan: Stabilize First, Then Expand

### Phase 0: Stabilize the current experience — [🟢 Priority 1]
**Goal:** Make the app reliable for everyday use.

- Fix the current typecheck issue in [src/main/index.ts](src/main/index.ts).
- Resolve the editor bugs around tab switching, breakpoint decorations, and dirty-buffer overwrite behavior.
- Protect agent-written file updates so they do not silently destroy user edits.
- Improve LSP sync so hover/completion/diagnostics reflect the current editor buffer instead of stale disk content.
- Add regression tests around editor save/reload flow and LSP fallback behavior.

**Expected outcome:** A much safer and more predictable editor experience.

---

### Phase 1: Make the agent more trustworthy — [🟢 Priority 2]
**Goal:** Improve confidence in automated editing and tool execution.

- Add clearer approval prompts for destructive actions.
- Introduce undo/redo support for agent edits where possible.
- Improve error handling and visible recovery when a tool or LSP call fails.
- Surface better status, progress, and failure context in the UI.

**Expected outcome:** Users feel safer letting the agent modify files and run tools.

---

### Phase 2: Real collaboration upgrade — [🟡 Priority 3]
**Goal:** Move from simulated collaboration to real multi-user editing.

- Add real WebRTC signaling and peer discovery.
- Use Yjs/Monaco integration for shared documents.
- Add real-time presence cursors and remote user awareness.
- Replace mock encryption with stronger authenticated encryption.

**Expected outcome:** True collaborative editing inside the app.

---

### Phase 3: Preview and sandbox polish — [🟡 Priority 4]
**Goal:** Make web preview and inspector workflows more useful.

- Add live HMR-style refresh for previewed apps.
- Connect the preview window to a lightweight CDP-based inspector.
- Expose element inspection and style editing to the agent and UI.

**Expected outcome:** Better web development feedback and debugging flow.

---

### Phase 4: Production-ready deployment and containment — [🟡 Priority 5]
**Goal:** Prepare the app for broader real-world usage.

- Add deployment integrations for common cloud targets.
- Improve secure token handling and deployment logging.
- Explore containerized agent sandboxing to limit host impact.

**Expected outcome:** A stronger enterprise-style developer workflow.

---

## 🎯 Recommended immediate sprint
1. Fix the current typecheck issue.
2. Address the highest-risk editor bugs first: dirty-buffer overwrite, stale decoration handling, and save/reload consistency.
3. Add regression tests around the editor and LSP path.
4. Only after that, move into collaboration and preview enhancements.

## 📌 Bottom line
The project is already strong in architecture and feature depth. The next plan should focus on making it stable, safe, and trustworthy before investing heavily in advanced collaboration and deployment features.
