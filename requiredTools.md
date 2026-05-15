# 🧰 Lumiq — Required Tools (Not Yet Available)

> **Date:** 2026-05-13  
> **Current Tool Count:** 11 built-in + MCP dynamic  
> **Benchmark:** Compared against Claude Code, Cursor, Windsurf, Cline, Aider

---

## 🔴 Critical — Must Have for IDE-grade Experience

### 1. `ListDirTool` — Directory Listing
**Priority:** P0 — Must have  
**Why missing is critical:** The agent cannot explore project structure. It relies on GlobTool with `*` to discover files, which is slow and noisy. Every agentic IDE (Cursor, Claude Code, Windsurf) has a dedicated directory listing tool.

**Expected behavior:**
```
Input:  { path: "./src", depth: 2 }
Output: src/
  ├── main/
  │   ├── agent/
  │   ├── tools/
  │   └── index.ts
  ├── renderer/
  │   └── src/
  └── shared/
```

**Implementation notes:**
- Recursive with configurable depth (default: 2)
- Tree-formatted output for readability
- Respect `.gitignore` patterns
- `isReadOnly: true`, `requiresApproval: false`

---

### 2. `FileDeleteTool` — Delete Files/Directories
**Priority:** P0 — Must have  
**Why missing is critical:** The agent can create and edit files but **cannot delete them**. Refactoring (renaming, moving, cleaning up) is impossible without shell commands, which are disabled by default.

**Expected behavior:**
```
Input:  { path: "./old-component.tsx" }
Output: [OK] Deleted old-component.tsx
```

**Implementation notes:**
- `requiresApproval: true` always
- Must be within workspace boundary
- Support both files and empty directories
- Show what will be deleted in approval dialog
- No recursive delete by default (separate flag)

---

### 3. `FileMoveTool` / `FileRenameTool` — Move/Rename Files
**Priority:** P0 — Must have  
**Why missing is critical:** Agent cannot rename files or move them between directories. Common operation during refactoring. Currently requires BashTool (`mv`) which is disabled by default.

**Expected behavior:**
```
Input:  { source: "./OldName.tsx", destination: "./NewName.tsx" }
Output: [OK] Moved OldName.tsx → NewName.tsx
```

---

### 4. `MultiFileEditTool` — Edit Multiple Files Atomically
**Priority:** P1 — Important  
**Why missing:** When refactoring (e.g., renaming a function), the agent needs to edit 5+ files. Currently it calls FileEditTool 5 separate times, each requiring approval. One failure leaves the codebase in a half-refactored state.

**Expected behavior:**
```
Input: {
  edits: [
    { path: "a.ts", old_string: "oldFn", new_string: "newFn" },
    { path: "b.ts", old_string: "oldFn", new_string: "newFn" }
  ]
}
Output: [OK] Edited 2 files atomically
```

**Implementation notes:**
- All-or-nothing: validate all edits before writing any
- Single approval for the batch
- Rollback on failure

---

## 🟠 High — Significantly Improves Agent Quality

### 5. `GitTool` — Git Operations
**Priority:** P1 — Important  
**Why needed:** Agent cannot check `git status`, `git diff`, `git log`, or `git blame`. This context is essential for understanding what changed, why code looks the way it does, and making informed edit decisions.

**Expected behavior:**
```
Input:  { command: "status" }   → git status output
Input:  { command: "diff" }     → git diff output
Input:  { command: "log", args: "-5 --oneline" }  → recent commits
Input:  { command: "blame", args: "src/main.ts" }  → blame output
```

**Implementation notes:**
- Read-only subset only: `status`, `diff`, `log`, `blame`, `show`, `branch`
- No `commit`, `push`, `reset`, `checkout` — those need explicit shell approval
- `requiresApproval: false` for read-only operations

---

### 6. `TerminalTool` — Interactive Terminal Session
**Priority:** P1 — Important  
**Why needed:** BashTool/PowerShellTool run one-shot commands. Agent cannot interact with REPLs, long-running dev servers, or see output over time. Needed for `npm run dev` → check if server started → debug errors.

**Expected behavior:**
```
Input:  { action: "start", command: "npm run dev" }  → starts persistent session
Input:  { action: "read", sessionId: "abc" }         → reads latest output
Input:  { action: "write", sessionId: "abc", input: "y\n" }  → sends input
Input:  { action: "stop", sessionId: "abc" }         → kills session
```

---

### 7. `NotebookTool` — Code Execution (JavaScript/Python)
**Priority:** P2 — Nice to have  
**Why needed:** Agent needs to test code snippets, evaluate expressions, or run calculations without writing temp files and using BashTool. Claude Code and Cursor both have sandboxed code execution.

**Expected behavior:**
```
Input:  { code: "console.log(2+2)", language: "javascript" }
Output: 4
```

---

## 🟡 Medium — Quality of Life

### 8. `DiffTool` — Show Unified Diff
**Priority:** P2  
**Why needed:** FileEditTool generates a simple diff, but there's no standalone diff tool for comparing two files or showing what changed after an edit. Useful for code review.

```
Input:  { pathA: "./old.ts", pathB: "./new.ts" }
Output: Unified diff
```

---

### 9. `ImageReadTool` — Read/Analyze Images
**Priority:** P2  
**Why needed:** Agent cannot look at screenshots, UI mockups, or diagrams. Multi-modal models (Claude, GPT-4o, Gemini) support vision but there's no tool to feed them images from the workspace.

```
Input:  { path: "./screenshot.png" }
Output: [base64 image data for model consumption]
```

---

### 10. `FileSearchTool` — Semantic Code Search
**Priority:** P2  
**Why needed:** GrepTool does exact/regex matching. But often the agent needs to find "where is the authentication logic?" or "where are database queries?" — semantic search across the codebase.

```
Input:  { query: "authentication middleware" }
Output: Ranked list of relevant files and snippets
```

---

### 11. `ClipboardTool` — Read/Write System Clipboard
**Priority:** P3  
**Why needed:** User might paste code or text from clipboard. Agent might want to put results on clipboard for the user.

```
Input:  { action: "read" }   → clipboard contents
Input:  { action: "write", content: "..." }  → set clipboard
```

---

### 12. `ArchiveTool` — Create/Extract Archives
**Priority:** P3  
**Why needed:** Agent needs to create zip/tar files for project exports, or extract downloaded archives. Currently requires BashTool.

```
Input:  { action: "create", format: "zip", source: "./dist", output: "./release.zip" }
Input:  { action: "extract", path: "./data.tar.gz", destination: "./data" }
```

---

### 13. `HttpTool` — Full HTTP Client (REST API Testing)
**Priority:** P3  
**Why needed:** WebFetchTool only does GET (and POST via Firecrawl). Agent cannot test APIs with custom methods (PUT, DELETE, PATCH), headers, or request bodies. Essential for API development.

```
Input:  { method: "POST", url: "...", headers: {...}, body: {...} }
Output: { status: 200, headers: {...}, body: {...} }
```

---

### 14. `EnvTool` — Read Environment Variables (Safe Subset)
**Priority:** P3  
**Why needed:** Agent often needs to check `NODE_ENV`, `PATH`, or custom env vars to debug build issues. Currently has no way to inspect environment.

```
Input:  { name: "NODE_ENV" }     → "development"
Input:  { name: "PATH" }         → filtered PATH
Input:  { action: "list" }       → safe subset of env vars
```

**Implementation notes:**
- Blocklist sensitive vars: `*_KEY`, `*_SECRET`, `*_TOKEN`, `*_PASSWORD`
- `requiresApproval: true` always

---

## 📊 Priority Summary

| Priority | Tools | Impact |
|----------|-------|--------|
| **P0 — Must Have** | ListDirTool, FileDeleteTool, FileMoveTool | Agent cannot explore/manage files without these |
| **P1 — Important** | MultiFileEditTool, GitTool, TerminalTool | Major quality improvement for real workflows |
| **P2 — Nice to Have** | NotebookTool, DiffTool, ImageReadTool, FileSearchTool | Enhanced capabilities |
| **P3 — Future** | ClipboardTool, ArchiveTool, HttpTool, EnvTool | Convenience tools |

---

## 🆚 Competitive Gap Analysis

| Tool | Lumiq | Claude Code | Cursor | Windsurf | Cline |
|------|-------|-------------|--------|----------|-------|
| File Read | ✅ | ✅ | ✅ | ✅ | ✅ |
| File Write | ✅ | ✅ | ✅ | ✅ | ✅ |
| File Edit | ✅ | ✅ | ✅ | ✅ | ✅ |
| File Delete | ❌ | ✅ | ✅ | ✅ | ✅ |
| File Move | ❌ | ✅ | ✅ | ✅ | ✅ |
| List Dir | ❌ | ✅ | ✅ | ✅ | ✅ |
| Glob/Find | ✅ | ✅ | ✅ | ✅ | ✅ |
| Grep/Search | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shell (Bash) | ✅ | ✅ | ✅ | ✅ | ✅ |
| Shell (PS) | ✅ | ❌ | ❌ | ❌ | ❌ |
| Git | ❌ | ✅ | ✅ | ✅ | ❌ |
| Web Search | ✅ | ✅ | ✅ | ✅ | ✅ |
| Web Fetch | ✅ | ✅ | ✅ | ✅ | ✅ |
| Multi-Edit | ❌ | ✅ | ✅ | ✅ | ❌ |
| Terminal | ❌ | ✅ | ✅ | ✅ | ✅ |
| Todo/Tasks | ✅ | ✅ | ❌ | ❌ | ❌ |
| MCP | ✅ | ✅ | ❌ | ❌ | ✅ |
| Vision | ❌ | ✅ | ✅ | ✅ | ❌ |
| Code Exec | ❌ | ✅ | ❌ | ✅ | ❌ |
| Sleep | ✅ | ❌ | ❌ | ❌ | ❌ |
