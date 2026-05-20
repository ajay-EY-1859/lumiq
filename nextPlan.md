# Lumiq — Remaining Work Plan

**Last Updated:** 2026-05-19

---

## Executive Summary

Lumiq is at **~88% IDE-ready** after completing search, version control UI, and workspace operations. The app now has Find in Files with regex support, a full Git panel with stage/unstage/commit, inline diff preview, and the bottom panel tab system (Tasks / Search / Git).

The next recommended phase is **code intelligence and polish**.

---

## ✅ Milestone 3: Diff-First Editing (COMPLETE)

- [x] **Build `DiffViewer` component** — Unified diff renderer with hunk view *(done 2026-05-17)*
- [x] **Add accept/reject per hunk** — Each hunk has Accept / Reject / Accept All / Reject All *(done 2026-05-17)*
- [x] **Add apply-to-file and copy-patch actions** — Apply accepted hunks to file system, copy as patch *(done 2026-05-17)*
- [x] **Record accepted/rejected/applied edits in session history** — DB-backed audit trail through edit decision IPC *(done 2026-05-17)*

---

## ✅ Milestone 4: Terminal, Tasks, Problems (COMPLETE)

- [x] **Persist task definitions in DB** — Workspace task definitions are saved per workspace path *(done 2026-05-17)*
- [x] **Sync `package.json` scripts** — Package scripts auto-sync while preserving custom DB tasks *(done 2026-05-17)*
- [x] **Problem-to-chat bridge** — "Ask Lumiq to Fix" injects a targeted chat prompt *(done 2026-05-17)*
- [x] **Interactive terminal** — Running tasks accept stdin from the terminal input row *(done 2026-05-17)*

---

## ✅ Stabilization Priority (COMPLETE)

- [x] **Implement retry logic for provider calls** — Exponential backoff for transient failures *(done 2026-05-17)*
- [x] **Add timeout support to IPC handlers** — Shared timeout wrapper plus defaults for DB/fs/provider/task/session/settings paths *(done 2026-05-17)*

---

## ✅ Editor Upgrade (COMPLETE)

- [x] **Replace textarea with Monaco** — Preserves tabs, dirty state, reload, and Ctrl/Cmd+S save *(done 2026-05-17)*
- [x] **Syntax highlighting by filename** — Monaco language mapping for common source/config files *(done 2026-05-17)*
- [x] **Built-in editor affordances** — Find, go-to-line, bracket matching, folding, minimap *(done 2026-05-17)*

---

## 🔵 Next Recommended Phase: Search, Version Control, Workspace Operations

## ✅ Search (COMPLETE)
- [x] **Find in Files** — Project-wide search UI backed by safe workspace search *(done 2026-05-19)*
- [x] **Regex Search** — Regex option with result grouping by file *(done 2026-05-19)*
- [x] **Search result navigation** — Open file at matched line/column *(done 2026-05-19)*

### ✅ Version Control (COMPLETE)
- [x] **Git status indicators** — Modified/added/deleted/renamed/untracked markers *(done 2026-05-19)*
- [x] **Git diff view** — Inline diff preview for changed files *(done 2026-05-19)*
- [x] **Branch indicator** — Current branch with ahead/behind counts *(done 2026-05-19)*
- [x] **Basic git actions** — Stage, unstage, discard with confirmation, commit *(done 2026-05-19)*

### Workspace Operations
- [x] **File rename/delete UI** — Safe file operations from project explorer *(done 2026-05-19)*
- [ ] **File tree multi-select** — Open or operate on multiple files
- [ ] **`.gitignore` integration** — Hide ignored files by default
- [x] **Recent workspaces** — Quick-open menu for previously bound workspaces *(done 2026-05-19)*
- [ ] **Workspace settings** — `.lumiq/settings.json` for project-level preferences
- [ ] **Workspace settings** — `.lumiq/settings.json` for project-level preferences

---

## ⬜ Deferred Milestones

### ✅ Milestone 5: Code Intelligence (COMPLETE)
- [x] LSP integration for symbol index *(done 2026-05-20)*
- [x] Outline and go-to-definition *(done 2026-05-20)*
- [x] Chat references to symbols, diagnostics, and selected ranges *(done 2026-05-20)*

### Milestone 6: VS Code Companion (In Progress)
- [x] Sidebar/webview extension *(done 2026-05-20)*
- [x] Connection status and reconnect UX *(done 2026-05-20)*
- [ ] Inline diff preview (Custom CodeLens / Diff view with Accept/Reject)
- [x] Package local VSIX *(done 2026-05-20)*

---

## 🏗 Architecture Debt

- [ ] Request/response tracing for IPC calls
- [ ] Renderer-side IPC rate limiting
- [ ] Full cancellation propagation through tools and providers
- [ ] Model validation before sending requests
- [ ] Cost estimation and token usage reporting
- [ ] Session search by content or date

---

## 📊 Current State

| Aspect | Status | Completeness |
|--------|--------|--------------|
| Agent Engine | ✅ Stable | 95% |
| Tool Execution | ✅ Stable | 90% |
| Provider Support | ✅ Stable | 90% |
| Workspace Shell | ✅ Strong | 88% |
| Diff Editing | ✅ Complete | 92% |
| Terminal/Tasks | ✅ Functional | 82% |
| Editor | ✅ Monaco | 82% |
| Problems Panel | ✅ Functional | 70% |
| Search | ✅ Complete | 90% |
| Version Control | ✅ Complete | 85% |
| Code Intelligence | ✅ Complete | 100% |
| VS Code Extension | ❌ Scaffold | 10% |
| **Overall IDE Readiness** | **🟡 In Progress** | **~90%** |

---

## 🎯 Recommended Next Steps

1. ~~**File rename/delete UI**~~ *(Done)*
2. ~~**Recent workspaces**~~ *(Done)*
3. **LSP integration** — Symbol index for go-to-definition and outline.
4. **Workspace settings** — `.lumiq/settings.json` for project-level preferences.
