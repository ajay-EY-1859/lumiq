# 🔴 Editor Deep Audit — Bugs & Weaknesses

> Exhaustive analysis of the Monaco-based editor subsystem covering:
> `EditorPane.tsx`, `editorStore.ts`, `monacoSetup.ts`, `shortcutExecutor.ts`, `paths.ts`,
> `lspHandlers.ts`, `LspService.ts`, `LspProcess.ts`, `autocompleteHandlers.ts`,
> `AutocompleteService.ts`, `dapHandlers.ts`, and the preload IPC bridge.

---

## 🟥 CRITICAL BUGS (Will crash / corrupt data)

### BUG-01: `deltaDecorations` called on STALE editor instance (breakpoints)
**File:** [EditorPane.tsx L486-506](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L486-L506)

The `useEffect` that renders breakpoints uses `editorRef.current`, but `editorRef` is shared across ALL tabs. When the user switches tabs, `<Editor key={activeTab.id}>` unmounts the old Monaco instance and mounts a new one — **but `handleMount` only fires for the new mount**. During the brief window between `activeTab` changing (triggering this effect) and `handleMount` firing, `editorRef.current` still points to the **destroyed** previous editor.

```tsx
// Line 487 — races against the new mount
const editor = editorRef.current  // ← may point to the OLD, destroyed editor
if (!editor || !monaco || !activeTab) return
```

**Impact:** `deltaDecorations` on a disposed editor throws or silently fails; breakpoint decorations are never applied to the newly mounted editor.

**Fix:** Guard with `editor.getModel()` null-check, or move breakpoint rendering into `handleMount`.

---

### BUG-02: `breakpointDecorationsRef` is reset on every mount but shared across tabs
**File:** [EditorPane.tsx L515](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L515)

```tsx
breakpointDecorationsRef.current = []  // resets on every tab switch
```

When tab A has breakpoints displayed, switching to tab B resets the ref to `[]`. Switching BACK to tab A then calls `deltaDecorations([], newDecorations)` — but the actual decorations from the old mount are orphaned (the old editor is destroyed). This means:
- Old decorations from previous mounts are never cleaned up.
- After switching tabs, `breakpointDecorationsRef.current` has no memory of what the new editor currently shows.

**Impact:** Visual ghost breakpoints or missing breakpoints when switching tabs.

---

### BUG-03: `reloadTab` overwrites user edits without confirmation
**File:** [editorStore.ts L101-115](file:///d:/agentic-desktop-app/src/renderer/src/store/editorStore.ts#L101-L115), [EditorPane.tsx L222-230](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L222-L230)

When `fs:file-modified` fires (e.g. from agent writes via `AgentLoop.ts` L621), `reloadTab` unconditionally overwrites:
```tsx
// editorStore.ts L108 — no dirty check
? { ...t, content, originalContent: content, isDirty: false }
```

If the user has unsaved edits in that tab, they are **silently destroyed**. No confirmation dialog, no merge, no undo.

**Impact:** Silent data loss of user edits when the agent or external tool modifies the same file.

---

### BUG-04: `saveTab` uses stale content due to closure capture
**File:** [editorStore.ts L82-98](file:///d:/agentic-desktop-app/src/renderer/src/store/editorStore.ts#L82-L98)

```tsx
saveTab: async (id) => {
    const tab = get().tabs.find(t => t.id === normId)
    // ...
    await window.electronAPI.fs.writeFile(normId, tab.content) // ← could be stale
    set((state) => ({
      tabs: state.tabs.map(t =>
        t.id === normId
          ? { ...t, originalContent: tab.content, isDirty: false }
          //                          ^^^^^^^^^^^ OLD snapshot
```

After `writeFile` returns, it sets `originalContent` to the captured `tab.content` from the snapshot taken BEFORE the async write. If the user typed more content during the `writeFile` call, `isDirty` becomes `false` even though the saved content != current content.

**Fix:** Re-read `get().tabs.find(...)` inside the `set()` callback to compare against current content.

---

## 🟧 SERIOUS BUGS (Incorrect behavior)

### BUG-05: LSP provider registrations leak on `autocompleteEnabled` toggle
**File:** [EditorPane.tsx L234-394](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L234-L394)

The `useEffect` dependency array is `[monaco, autocompleteEnabled]`. Every time the user toggles the "AI Auto" button, the cleanup runs (disposing all 7 providers) and re-registers them ALL. This causes:
1. **Flicker** — All providers briefly disappear then reappear.
2. **Race conditions** — Any in-flight provider requests from the old registration get orphaned (promises never settled).
3. The `autocompleteEnabled` guard is INSIDE the provider, so there's no need to re-register. Simply reading the current state inside the callback would suffice.

**Fix:** Remove `autocompleteEnabled` from the dependency array. Use a ref (`autocompleteEnabledRef`) inside the inline provider callback instead.

---

### BUG-06: Inline completion debounce uses stale `lastQueryTime` closure
**File:** [EditorPane.tsx L324-341](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L324-L341)

```tsx
let lastQueryTime = 0  // ← captured in closure
const inlineProv = monaco.languages.registerInlineCompletionsProvider('*', {
  provideInlineCompletions: async (model, position, _context, token) => {
    const now = Date.now()
    lastQueryTime = now  // ← mutates outer let
    await new Promise((resolve) => setTimeout(resolve, 200))
    if (lastQueryTime !== now || token.isCancellationRequested) {
      return { items: [] }
    }
```

**Problem:** `lastQueryTime` is re-initialized to `0` every time the effect re-runs (because of BUG-05). If two registrations overlap, the old closure's `lastQueryTime` has no connection to the new one's, causing duplicate API calls during the transition.

Also: the debounce strategy is a **busy-wait** pattern — it always allocates a 200ms timer even if the result will be discarded. Under rapid typing this creates `O(n)` pending promises.

---

### BUG-07: `handleMount` captures stale `activeTabIdRef` for breakpoint toggling
**File:** [EditorPane.tsx L510-528](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L510-L528)

```tsx
const handleMount: OnMount = (editor, monacoInstance) => {
  // ...
  editor.onMouseDown((e: any) => {
    // ...
    const currentTabId = activeTabIdRef.current  // ← correct: uses ref
```

This is actually correct. **However**, `handleMount` is NOT wrapped in `useCallback` and is recreated on every render. The `<Editor>` component's `key={activeTab.id}` prop means it only calls `onMount` when the tab changes, so the stale closure for the event listeners is fine in practice. But the **keybinding closures** inside `handleMount` (lines 532-597) reference `activeTabIdRef` correctly, which is good.

*This item is informational — no bug here, just flagging the fragile pattern.*

---

### BUG-08: `e.stopPropagation()` on ALL tab keyDown events blocks shortcut propagation
**File:** [EditorPane.tsx L804-806](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L804-L806)

```tsx
onKeyDown={(e) => {
  if (e.key === 'Enter' || e.key === ' ') {
    // ...activate tab...
  }
  e.stopPropagation()  // ← ALWAYS stops propagation, even for unhandled keys
}}
```

This means that pressing `Ctrl+S`, `Ctrl+W`, `F5`, etc. while focus is on a tab element will be swallowed and never reach the global shortcut handler. Only Enter/Space are handled, but ALL events are stopped.

**Impact:** Keyboard shortcuts broken when focus is on the tab bar.

---

### BUG-09: `LspProcess.handleData` buffer parsing uses string conversion on binary data
**File:** [LspProcess.ts L135-176](file:///d:/agentic-desktop-app/src/main/services/LspProcess.ts#L135-L176)

```tsx
const str = this.buffer.toString('utf8')  // ← converts ENTIRE buffer to string each iteration
const headerIndex = str.indexOf('Content-Length:')
```

This is done inside a `while(true)` loop. For large LSP responses (e.g. 100KB+ completion lists), this:
1. Converts the entire buffer to a string on **every loop iteration**.
2. Searches the whole string for `Content-Length:` from the start.
3. The `subarray` at line 154/167 operates on the Buffer, but the `indexOf` at lines 140/145 operates on the string, introducing byte-vs-character offset mismatches for **multi-byte UTF-8** content.

**Impact:** Parser corruption or infinite loop when LSP response contains non-ASCII characters (e.g., unicode identifiers, CJK comments).

**Fix:** Parse headers using Buffer-level byte offsets, not string character offsets.

---

### BUG-10: `LspService.ensureDocumentSynced` reads from DISK, not from editor buffer
**File:** [LspService.ts L257-287](file:///d:/agentic-desktop-app/src/main/services/LspService.ts#L257-L287)

```tsx
const content = fs.readFileSync(filePath, 'utf-8')  // ← reads DISK
```

The user may have unsaved edits in the Monaco editor. The LSP document sync sends the **disk** version to the language server, not the **editor buffer** version. This means:
- Hover/completion/diagnostics will be based on stale saved content.
- Every hover request does a **synchronous disk read** in the main process, blocking the event loop.

**Impact:** LSP features show stale/wrong results for unsaved files. Main process freezes on large files.

---

### BUG-11: `lspHandlers.ts` reads files synchronously in IPC handlers
**File:** [lspHandlers.ts L109, L205](file:///d:/agentic-desktop-app/src/main/ipc/lspHandlers.ts#L109)

```tsx
const content = readFileSync(filePath, 'utf-8')  // ← blocks main process
```

Both `getDefinition` and `getReferences` use `readFileSync` inside `handleWithTimeout` handlers. These handlers run on the main Electron process. For large files (>1MB), this blocks the entire application.

**Impact:** UI freeze during Go-to-Definition or Find References on large files.

---

### BUG-12: `db.prepare().get(params)` called incorrectly with array
**File:** [lspHandlers.ts L172](file:///d:/agentic-desktop-app/src/main/ipc/lspHandlers.ts#L172)

```tsx
const params: any[] = [symbolWord]
// ...
params.push(cleanWorkspace)
queryStr += ' LIMIT 1'
definition = db.prepare(queryStr).get(params) as any  // ← passes ARRAY as single arg
```

`better-sqlite3`'s `.get()` expects spread arguments, not an array: `.get(...params)`. Passing `[symbolWord, cleanWorkspace]` as a single argument will bind the array object as the first `?` placeholder, causing an error or incorrect query.

**Impact:** Go-to-Definition fallback lookup ALWAYS fails when workspace path is available.

**Fix:** Use `db.prepare(queryStr).get(...params)`.

---

### BUG-13: `normalizePath` lowercases drive letters inconsistently
**File:** [paths.ts L9-18](file:///d:/agentic-desktop-app/src/renderer/src/utils/paths.ts#L9-L18)

```tsx
n = n[0].toLowerCase() + n.slice(1)
```

Paths are normalized to lowercase drive letters. However, many IPC responses from the main process (e.g., `readFileSync`, `existsSync`, `filePath` from `ast_symbols` DB) may return uppercase drive letters. The editor uses `normalizePath` to create tab IDs, but:
- `fs:file-modified` events from `AgentLoop.ts` send raw paths that may have uppercase `D:\`.
- The `EditorPane.tsx` file-modified handler normalizes the event path but compares against tab IDs that were already normalized.
- If the main process sends `D:\agentic-desktop-app\...` and `normalizePath` produces `d:/agentic-desktop-app/...`, the `find()` at line 226 works. But if a tab was opened via a code path that DIDN'T use `normalizePath`, the comparison fails.

**Impact:** External file change events may silently fail to trigger reload for some files.

---

## 🟨 MODERATE ISSUES (Performance / UX)

### BUG-14: `<Editor key={activeTab.id}>` destroys and recreates Monaco on every tab switch
**File:** [EditorPane.tsx L878-879](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L878-L879)

Using `key={activeTab.id}` forces React to unmount and remount the entire `<Editor>` component each time the active tab changes. This means:
1. Full Monaco editor destruction + reconstruction (expensive: ~50-200ms).
2. All editor state lost: scroll position, cursor position, selection, undo history.
3. Theme re-application (`setupTheme` called every mount).
4. All keybinding re-registration.

**Impact:** Sluggish tab switching. Loss of undo/redo history. Scroll position reset.

**Fix:** Use Monaco's built-in model-switching pattern: keep a single editor instance, swap the model via `editor.setModel()`.

---

### BUG-15: `CursorInfo` depends on `editorRef` which never triggers re-render
**File:** [EditorPane.tsx L129-161](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L129-L161)

```tsx
function CursorInfo({ editorRef }: { editorRef: React.MutableRefObject<any> }) {
  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return   // ← if editor is null at mount time, effect never retries
    const d = editor.onDidChangeCursorSelection(() => { ... })
    return () => d.dispose()
  }, [editorRef])  // ← editorRef object identity never changes (it's a ref)
```

The dependency `[editorRef]` is a React ref — its identity is stable across renders. This means the effect runs exactly once (on mount). If `editorRef.current` is `null` at that time (e.g., editor hasn't mounted yet), the listener is never attached, and `CursorInfo` shows stale "Ln 1, Col 1" forever.

After a tab switch (new `<Editor key={...}>`), the old editor is destroyed (disposing `d`), and the new editor is mounted — but this effect doesn't re-run because `editorRef` identity hasn't changed.

**Impact:** Cursor position indicator may become permanently stale after tab switches.

---

### BUG-16: `AutocompleteService` sends entire file content to the AI provider
**File:** [EditorPane.tsx L344-347](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L344-L347), [AutocompleteService.ts L27-43](file:///d:/agentic-desktop-app/src/main/services/AutocompleteService.ts#L27-L43)

```tsx
const text = model.getValue()   // ← entire file
const prefix = text.slice(0, offset)
const suffix = text.slice(offset)
```

For a 10,000-line file, `prefix` could be enormous. This is then sent to the AI provider as the full prompt. Issues:
1. **Token explosion** — may exceed provider's context window, causing errors.
2. **Cost** — every keystroke (after 200ms debounce) sends the entire file content.
3. **Latency** — large payloads increase network round-trip.

**Fix:** Limit prefix/suffix to ~100-200 lines around cursor position.

---

### BUG-17: `cleanCompletion` dedup logic can strip valid completions
**File:** [AutocompleteService.ts L159-177](file:///d:/agentic-desktop-app/src/main/services/AutocompleteService.ts#L159-L177)

```tsx
for (let len = Math.min(trimmedLastLine.length, 30); len > 0; len--) {
  const check = trimmedLastLine.slice(-len)
  if (clean.startsWith(check)) {
    clean = clean.slice(len)
    break
  }
}
```

This aggressively strips any overlap between the end of the last prefix line and the start of the completion. But if the completion legitimately starts with the same characters (e.g., prefix ends with `const ` and the completion is `const foo = bar`), valid content gets stripped.

**Impact:** Truncated/garbled autocomplete suggestions.

---

### BUG-18: `handleMount` registers duplicate `onMouseDown` listeners
**File:** [EditorPane.tsx L518-528](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L518-L528)

`handleMount` is called by `<Editor onMount={handleMount}>`. Since the component is keyed by `activeTab.id`, each tab switch creates a new editor and calls `handleMount`. However, `handleMount` is re-created on every render (it's a plain function, not memoized). The `onMouseDown` listener returned disposable is never stored or disposed.

When Monaco's `<Editor key=...>` destroys the old instance, the old listeners are implicitly cleaned up. So this is OK in practice, but the pattern is fragile and wastes closure allocations.

---

### BUG-19: `useSessionStore.getState()` called repeatedly inside providers
**File:** [EditorPane.tsx L249, L260](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L249-L260)

```tsx
const workspacePath = useSessionStore.getState().sessions.find(
  s => s.id === useSessionStore.getState().activeSessionId
)?.workspacePath || ''
```

`useSessionStore.getState()` is called **twice** in the same expression. While Zustand's `getState()` is synchronous and consistent, this is redundant and harder to read. More critically, if the session store update is in progress (React batched update), the second call might read a different state snapshot.

---

### BUG-20: `stopActiveTaskAction` finds task by OR condition — may stop wrong task
**File:** [shortcutExecutor.ts L157-164](file:///d:/agentic-desktop-app/src/renderer/src/utils/shortcutExecutor.ts#L157-L164)

```tsx
const runningTask = taskState.tasks.find(
  t => t.id === activeTaskId || t.status === 'running'
)
```

If `activeTaskId` points to a finished task, but another task is `'running'`, the OR condition will stop that OTHER running task instead of the intended one. The user expects Shift+F5 to stop the task they started, not an arbitrary running task.

**Impact:** Wrong task terminated when multiple tasks exist.

---

### BUG-21: No timeout on `LspProcess.sendRequest` — promises can hang forever
**File:** [LspProcess.ts L101-113](file:///d:/agentic-desktop-app/src/main/services/LspProcess.ts#L101-L113)

```tsx
sendRequest(method: string, params: any): Promise<any> {
  return new Promise((resolve, reject) => {
    const id = this.nextId++
    this.pendingRequests.set(id, { resolve, reject })
    this.writePayload(payload)
  })
}
```

If the language server crashes or becomes unresponsive after receiving the request, the promise **never resolves or rejects**. The IPC handler wrapping this has a 10-second timeout, but the `pendingRequests` Map entry leaks forever.

**Impact:** Memory leak in `pendingRequests` Map; hung promises accumulate.

---

### BUG-22: `LspProcess.stop()` calls `this.stop()` recursively from event handlers
**File:** [LspProcess.ts L41-49](file:///d:/agentic-desktop-app/src/main/services/LspProcess.ts#L41-L49)

```tsx
this.process.on('error', (err) => {
  this.stop()   // ← calls stop
})
this.process.on('close', (code) => {
  this.stop()   // ← also calls stop
})
```

When the process dies, BOTH `error` and `close` events fire. Each calls `stop()`. The `isShuttingDown` guard prevents infinite recursion, but the first `stop()` call sets `this.process = null` and then the `close` handler fires — calling `stop()` again which hits the guard. This is safe but wasteful.

More importantly: `stop()` is called from within `start()` on failure (line 76), and also from the `close` handler. If `start()` fails, `stop()` runs, kills the process, which triggers `close`, which calls `stop()` again. The `isShuttingDown` guard prevents damage, but the logic is fragile.

---

## 🟦 DESIGN WEAKNESSES

### WEAK-01: Single `editorRef` shared across all tabs
The editor ref should ideally be per-tab (stored in a Map), or the component should use a single persistent editor with model-switching. The current pattern of a single ref + key-based remounting causes most of BUG-01/02/14/15.

### WEAK-02: No debounce on `updateTabContent`
**File:** [EditorPane.tsx L885](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L885)

```tsx
onChange={(value) => updateTabContent(activeTab.id, value ?? '')}
```

Every keystroke triggers a Zustand store update with the entire file content. For large files, this creates massive GC pressure and can cause frame drops.

### WEAK-03: Inline styles everywhere
The entire component uses inline `style={{...}}` objects. These are re-created on every render, preventing React's style caching. More critically, hover effects are implemented via `onMouseEnter`/`onMouseLeave` JavaScript handlers instead of CSS `:hover`, causing unnecessary re-renders.

### WEAK-04: `confirm()` blocks the main thread
**File:** [EditorPane.tsx L437, L542](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L437)

The native `confirm()` dialog blocks the renderer process. In Electron, this freezes the entire window. Should use an async dialog (e.g., `window.electronAPI.dialog.showOpenDialog` or a custom React modal).

### WEAK-05: `dangerouslySetInnerHTML` for CSS animation keyframes
**File:** [EditorPane.tsx L950-955](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L950-L955)

```tsx
<style dangerouslySetInnerHTML={{__html: `
  @keyframes slideIn { ... }
`}} />
```

While safe here (static content), this pattern injects a new `<style>` tag into the DOM every time the error overlay renders. If the error popup is shown/hidden repeatedly, duplicate `<style>` tags accumulate. Should be in a CSS file or use `useEffect` + `document.styleSheets`.

### WEAK-06: `mapLspKindToMonacoKind` is a no-op
**File:** [LspService.ts L333-335](file:///d:/agentic-desktop-app/src/main/services/LspService.ts#L333-L335)

```tsx
private mapLspKindToMonacoKind(lspKind: number): number {
  return lspKind  // ← just returns the input
}
```

LSP `CompletionItemKind` values don't map 1:1 to Monaco's `CompletionItemKind`. E.g., LSP `Text=1` maps to Monaco `Method=0`. This causes incorrect icons in the completion widget.

### WEAK-07: `getLanguage()` extension map is incomplete
**File:** [EditorPane.tsx L38-49](file:///d:/agentic-desktop-app/src/renderer/src/components/editor/EditorPane.tsx#L38-L49)

Missing common extensions: `.vue`, `.svelte`, `.dart`, `.lua`, `.r`, `.scala`, `.zig`, `.proto`, `.graphql`, `.dockerfile`, `.env`, `.gitignore`, `.tf`, `.hcl`. Users opening these files get no syntax highlighting.

### WEAK-08: No error boundary around `<Editor>`
If Monaco crashes (e.g., corrupt WASM worker, OOM), the entire `EditorPane` unmounts with an unhandled React error, potentially crashing the whole application. Should wrap in an `ErrorBoundary`.

### WEAK-09: `LspService` document sync clears by language extension suffix, not language ID
**File:** [LspService.ts L69-75](file:///d:/agentic-desktop-app/src/main/services/LspService.ts#L69-L75)

```tsx
const suffix = `.${languageId}`  // e.g. ".typescript"
for (const doc of this.syncedDocuments) {
  if (doc.endsWith(suffix)) {  // file URIs end with ".ts", not ".typescript"
```

The URI stored in `syncedDocuments` is like `file:///path/to/file.ts`. The suffix `.typescript` will NEVER match any URI. So `stopLanguageServer` never clears the document sync state, causing `ensureDocumentSynced` to send `didChange` notifications for documents that the new server doesn't know about.

**Impact:** LSP protocol violation — `didChange` without prior `didOpen`.

---

## 📊 Summary

| Severity | Count |
|----------|-------|
| 🟥 Critical (data loss / crash) | 4 |
| 🟧 Serious (incorrect behavior) | 9 |
| 🟨 Moderate (performance / UX) | 5 |
| 🟦 Design Weakness | 9 |
| **Total** | **27** |

### Top 5 Priorities for Fixing:
1. **BUG-03** — `reloadTab` silently destroys user edits (data loss)
2. **BUG-04** — `saveTab` stale content race (data corruption)
3. **BUG-12** — `db.get(params)` array bug (Go-to-Definition broken)
4. **BUG-14** — Key-based remounting destroys editor state on tab switch
5. **WEAK-09** — Document sync cleanup never works (LSP protocol violation)
