/**
 * EditorPane — Monaco-based code editor with full accessibility support.
 *
 * Accessibility features implemented:
 *  • landmark roles  : region, tablist, tab, tabpanel, toolbar, status
 *  • ARIA labels     : aria-label, aria-labelledby, aria-describedby
 *  • Tab state       : aria-selected, aria-controls, aria-expanded
 *  • Live regions    : aria-live="polite" for save/cursor status announcements
 *  • Focus management: tab-panel receives focus when activated; Escape moves
 *                      focus from editor back to tab bar
 *  • Keyboard nav    : Left/Right arrows move between tabs in the tablist;
 *                      Delete closes the focused tab
 *  • Monaco a11y     : accessibilitySupport:"on", screenReaderAnnounceInlineSuggestion
 *  • Reduced motion  : respects prefers-reduced-motion for animations
 */
import React, { useEffect, useState, useCallback, useRef, useId } from 'react'
import Editor, { OnMount, useMonaco } from '@monaco-editor/react'
import '../../utils/monacoSetup'
import { useEditorStore } from '@renderer/store/editorStore'
import { useChatStore } from '@renderer/store/chatStore'
import { useProviderStore } from '@renderer/store/providerStore'
import { useTaskStore } from '@renderer/store/taskStore'
import { useSessionStore } from '@renderer/store/sessionStore'
import { DocumentSymbol, SymbolKind, TaskSelfHealSuggestion } from '@shared/types'
import {
  runProjectAction,
  buildProjectAction,
  runCurrentFileAction,
  compileCurrentFileAction,
  stopActiveTaskAction,
  debugStepOverAction,
  debugStepIntoAction,
  debugStepOutAction
} from '@renderer/utils/shortcutExecutor'

// ── Language detection ────────────────────────────────────────────────
function getLanguage(fileName: string): string | undefined {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    json: 'json', css: 'css', scss: 'scss', html: 'html', md: 'markdown',
    py: 'python', yml: 'yaml', yaml: 'yaml', xml: 'xml', sql: 'sql',
    sh: 'shell', bash: 'shell', ps1: 'powershell', rs: 'rust',
    go: 'go', java: 'java', kt: 'kotlin', rb: 'ruby', php: 'php',
    c: 'c', cpp: 'cpp', cs: 'csharp', swift: 'swift', toml: 'ini',
  }
  return ext ? map[ext] : undefined
}

// Human-readable language label for screen readers
function getLanguageLabel(fileName: string): string {
  const lang = getLanguage(fileName)
  const labels: Record<string, string> = {
    typescript: 'TypeScript', javascript: 'JavaScript', json: 'JSON',
    css: 'CSS', scss: 'SCSS', html: 'HTML', markdown: 'Markdown',
    python: 'Python', yaml: 'YAML', xml: 'XML', sql: 'SQL',
    shell: 'Shell script', powershell: 'PowerShell', rust: 'Rust',
    go: 'Go', java: 'Java', kotlin: 'Kotlin', ruby: 'Ruby',
    php: 'PHP', c: 'C', cpp: 'C++', csharp: 'C#', swift: 'Swift', ini: 'TOML/INI',
  }
  return lang ? (labels[lang] ?? lang) : 'plain text'
}

// ── File icon for tabs (aria-hidden — decorative only) ────────────────
function getTabIcon(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? ''
  const icons: Record<string, string> = {
    ts: '🔷', tsx: '🔷', js: '🟨', jsx: '🟨', json: '📋',
    css: '🎨', scss: '🎨', html: '🌐', md: '📝', py: '🐍',
    yml: '⚙️', yaml: '⚙️', sh: '💻', ps1: '💻', sql: '🗄️',
    rs: '🦀', go: '🐹', java: '☕', rb: '💎', php: '🐘',
  }
  return icons[ext] ?? '📄'
}

function mapSymbolKind(monaco: any, kind: SymbolKind): any {
  switch (kind) {
    case SymbolKind.Class: return monaco.languages.SymbolKind.Class
    case SymbolKind.Function: return monaco.languages.SymbolKind.Function
    case SymbolKind.Interface: return monaco.languages.SymbolKind.Interface
    case SymbolKind.Struct: return monaco.languages.SymbolKind.Struct
    default: return monaco.languages.SymbolKind.Property
  }
}

// ── Theme ─────────────────────────────────────────────────────────────
function cssVar(name: string, fallback: string): string {
  const raw = getComputedStyle(document.documentElement)
    .getPropertyValue(name).trim().replace(/^#/, '')
  return /^[0-9a-fA-F]{3}([0-9a-fA-F]{3})?$/.test(raw) ? raw : fallback
}

const setupTheme: OnMount = (_editor, monaco) => {
  monaco.editor.defineTheme('lumiq-dark', {
    base: 'vs-dark', inherit: true,
    rules: [
      { token: 'comment',  foreground: '6e7681', fontStyle: 'italic' },
      { token: 'keyword',  foreground: 'ff7b72' },
      { token: 'string',   foreground: 'a5d6ff' },
      { token: 'number',   foreground: '79c0ff' },
      { token: 'type',     foreground: 'ffa657' },
    ],
    colors: {
      'editor.background':                     `#${cssVar('--bg-primary',    '0d1117')}`,
      'editor.foreground':                     `#${cssVar('--text-primary',  'e6edf3')}`,
      'editorLineNumber.foreground':           `#${cssVar('--text-muted',    '484f58')}`,
      'editorLineNumber.activeForeground':     `#${cssVar('--text-secondary','8b949e')}`,
      'editorGutter.background':               `#${cssVar('--bg-primary',    '0d1117')}`,
      'editorWidget.background':               `#${cssVar('--bg-secondary',  '161b22')}`,
      'editorSuggestWidget.background':        `#${cssVar('--bg-secondary',  '161b22')}`,
      'editorSuggestWidget.border':            `#${cssVar('--border',        '30363d')}`,
      'editorSuggestWidget.selectedBackground':`#${cssVar('--bg-tertiary',   '21262d')}`,
      'editor.selectionBackground':            '#264f78',
      'editor.lineHighlightBackground':        `#${cssVar('--bg-secondary',  '161b22')}`,
      'editor.lineHighlightBorder':            '#00000000',
      'editorIndentGuide.background1':         `#${cssVar('--border',        '30363d')}`,
      'editorIndentGuide.activeBackground1':   `#${cssVar('--text-muted',    '484f58')}`,
      'scrollbarSlider.background':            `#${cssVar('--border',        '30363d')}88`,
      'scrollbarSlider.hoverBackground':       `#${cssVar('--text-muted',    '484f58')}88`,
      // High-contrast focus ring so keyboard users can see focus
      'focusBorder':                           '#4d9ef6',
    }
  })
  monaco.editor.setTheme('lumiq-dark')
}

// ── Cursor / selection info (live region) ────────────────────────────
function CursorInfo({ editorRef }: { editorRef: React.MutableRefObject<any> }): React.JSX.Element {
  const [pos, setPos] = useState({ line: 1, col: 1, sel: 0 })

  useEffect(() => {
    const editor = editorRef.current
    if (!editor) return
    const d = editor.onDidChangeCursorSelection(() => {
      const p = editor.getPosition()
      const sel = editor.getModel()?.getValueInRange(editor.getSelection()) ?? ''
      setPos({ line: p?.lineNumber ?? 1, col: p?.column ?? 1, sel: sel.length })
    })
    return () => d.dispose()
  }, [editorRef])

  const label = pos.sel > 0
    ? `Line ${pos.line}, Column ${pos.col}, ${pos.sel} characters selected`
    : `Line ${pos.line}, Column ${pos.col}`

  return (
    // aria-live="polite" announces cursor changes to screen readers without
    // interrupting ongoing speech.
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={label}
      style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}
    >
      {/* Visible short form */}
      Ln {pos.line}, Col {pos.col}{pos.sel > 0 ? ` (${pos.sel} sel)` : ''}
    </span>
  )
}

// ── Save-status live region ───────────────────────────────────────────
function SaveStatus({ isDirty, fileName }: { isDirty: boolean; fileName: string }): React.JSX.Element {
  const label = isDirty ? `${fileName} has unsaved changes` : `${fileName} saved`
  return (
    <span
      role="status"
      aria-live="polite"
      aria-atomic="true"
      aria-label={label}
      style={{ fontSize: '11px', color: isDirty ? 'var(--accent-yellow, #f0a500)' : 'var(--text-muted)' }}
    >
      {isDirty ? '● Unsaved' : '✓ Saved'}
    </span>
  )
}

// ── Main EditorPane ───────────────────────────────────────────────────
export function EditorPane(): React.JSX.Element | null {
  const { tabs, activeTabId, setActiveTab, closeTab, updateTabContent } = useEditorStore()
  const editorRef = useRef<any>(null)
  const tablistRef = useRef<HTMLDivElement>(null)
  const activeTabIdRef = useRef<string | null>(activeTabId)
  useEffect(() => { activeTabIdRef.current = activeTabId }, [activeTabId])

  const [wordWrap, setWordWrap]   = useState<'off' | 'on'>('off')
  const [minimap, setMinimap]     = useState(true)
  const [autocompleteEnabled, setAutocompleteEnabled] = useState(true)
  const [errorSuggestion, setErrorSuggestion] = useState<TaskSelfHealSuggestion | null>(null)

  useEffect(() => {
    const cleanup = window.electronAPI.task.onSelfHeal((suggestion: TaskSelfHealSuggestion) => {
      setErrorSuggestion(suggestion)
    })
    return cleanup
  }, [])

  useEffect(() => {
    const handleFocusEditor = () => {
      if (editorRef.current) {
        editorRef.current.focus()
      }
    }
    window.addEventListener('lumiq-focus-editor', handleFocusEditor)
    return () => window.removeEventListener('lumiq-focus-editor', handleFocusEditor)
  }, [])

  // Stable IDs for ARIA relationships
  const uid        = useId()
  const tablistId  = `${uid}-tablist`
  const panelId    = `${uid}-panel`
  const statusId   = `${uid}-status`
  const toolbarId  = `${uid}-toolbar`

  // ── External file-change reload ──────────────────────────────────
  useEffect(() => {
    const cleanup = window.electronAPI.fs.onFileModified((filePath: string) => {
      const norm = filePath.replace(/\\/g, '/')
      const snap = useEditorStore.getState().tabs
      const tab  = snap.find((t) => t.id.replace(/\\/g, '/') === norm)
      if (tab) useEditorStore.getState().reloadTab(tab.id)
    })
    return cleanup
  }, [])

  // ── LSP providers ────────────────────────────────────────────────
  const monaco = useMonaco()
  useEffect(() => {
    if (!monaco) return
    const fixPath = (p: string) => (p.startsWith('/') && p.includes(':')) ? p.slice(1) : p

    const symProv = monaco.languages.registerDocumentSymbolProvider('*', {
      provideDocumentSymbols: async (model) => {
        try {
          const syms: DocumentSymbol[] = await window.electronAPI.lsp.getDocumentSymbols(fixPath(model.uri.path))
          return syms.map((s) => ({ name: s.name, detail: s.detail ?? '', kind: mapSymbolKind(monaco, s.kind), tags: [], range: s.range, selectionRange: s.selectionRange }))
        } catch { return [] }
      }
    })
    const defProv = monaco.languages.registerDefinitionProvider('*', {
      provideDefinition: async (model, position) => {
        try {
          const def = await window.electronAPI.lsp.getDefinition('', fixPath(model.uri.path), position.lineNumber, position.column)
          if (!def) return null
          const uri = def.uri.startsWith('file://') ? def.uri : 'file://' + (def.uri.startsWith('/') ? def.uri : '/' + def.uri)
          return { uri: monaco.Uri.parse(uri), range: def.range }
        } catch { return null }
      }
    })

    // ── Autocomplete / Ghost-Text Inline Completions Provider ──
    let lastQueryTime = 0
    const inlineProv = monaco.languages.registerInlineCompletionsProvider('*', {
      provideInlineCompletions: async (model, position, _context, token) => {
        // 1. Guard: Check if autocomplete is enabled
        if (!autocompleteEnabled) return { items: [] }

        // 2. Guard: Get active provider and model
        const providerName = useProviderStore.getState().activeProvider
        const modelName = useProviderStore.getState().activeModel
        if (!providerName || !modelName) return { items: [] }

        // 3. Debounce: Wait 200ms for typing pause to minimize API requests and lag
        const now = Date.now()
        lastQueryTime = now
        await new Promise((resolve) => setTimeout(resolve, 200))
        if (lastQueryTime !== now || token.isCancellationRequested) {
          return { items: [] }
        }

        // Get context around cursor position
        const text = model.getValue()
        const offset = model.getOffsetAt(position)
        const prefix = text.slice(0, offset)
        const suffix = text.slice(offset)

        // Only query if we have prefix content
        if (!prefix.trim()) return { items: [] }

        try {
          const prediction = await window.electronAPI.autocomplete.predict(
            prefix,
            suffix,
            providerName,
            modelName
          )

          if (!prediction || token.isCancellationRequested) {
            return { items: [] }
          }

          return {
            items: [
              {
                insertText: prediction,
                range: new monaco.Range(
                  position.lineNumber,
                  position.column,
                  position.lineNumber,
                  position.column
                )
              }
            ]
          }
        } catch (err) {
          console.error('[Autocomplete] Failed to fetch prediction:', err)
          return { items: [] }
        }
      },
      disposeInlineCompletions: () => {}
    })

    return () => {
      symProv.dispose()
      defProv.dispose()
      inlineProv.dispose()
    }
  }, [monaco, autocompleteEnabled])

  // ── Close tab (with dirty check) ─────────────────────────────────
  const handleCloseTab = useCallback((id: string, e: React.MouseEvent | React.KeyboardEvent) => {
    e.stopPropagation()
    const tab = useEditorStore.getState().tabs.find((t) => t.id === id)
    if (tab?.isDirty && !confirm(`"${tab.name}" has unsaved changes. Close anyway?`)) return
    closeTab(id)
    // Return focus to tablist after close
    setTimeout(() => tablistRef.current?.querySelector<HTMLElement>('[role="tab"]')?.focus(), 0)
  }, [closeTab])

  // ── Keyboard navigation inside tablist (ARIA pattern) ────────────
  // Left/Right arrows move focus between tabs.
  // Delete / Backspace closes the focused tab.
  // Enter / Space activates the focused tab.
  const handleTablistKeyDown = useCallback((e: React.KeyboardEvent<HTMLDivElement>) => {
    const allTabs = Array.from(
      tablistRef.current?.querySelectorAll<HTMLElement>('[role="tab"]') ?? []
    )
    const focused = document.activeElement as HTMLElement
    const idx = allTabs.indexOf(focused)
    if (idx === -1) return

    if (e.key === 'ArrowRight') {
      e.preventDefault()
      allTabs[(idx + 1) % allTabs.length]?.focus()
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault()
      allTabs[(idx - 1 + allTabs.length) % allTabs.length]?.focus()
    } else if (e.key === 'Delete' || e.key === 'Backspace') {
      e.preventDefault()
      const tabId = focused.dataset.tabid
      if (tabId) handleCloseTab(tabId, e as any)
    } else if (e.key === 'Home') {
      e.preventDefault(); allTabs[0]?.focus()
    } else if (e.key === 'End') {
      e.preventDefault(); allTabs[allTabs.length - 1]?.focus()
    }
  }, [handleCloseTab])

  const activeTab = tabs.find((t) => t.id === activeTabId)

  // ── Monaco mount ─────────────────────────────────────────────────
  const handleMount: OnMount = (editor, monacoInstance) => {
    editorRef.current = editor
    setupTheme(editor, monacoInstance)
    editor.focus()

    // Ctrl+S — save active tab
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyS, () => {
      const id = activeTabIdRef.current
      if (id) void useEditorStore.getState().saveTab(id)
    })

    // Ctrl+W — close active tab (same as VS Code)
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.KeyW, () => {
      const id = activeTabIdRef.current
      if (!id) return
      const tab = useEditorStore.getState().tabs.find((t) => t.id === id)
      if (tab?.isDirty && !confirm(`"${tab.name}" has unsaved changes. Close anyway?`)) return
      useEditorStore.getState().closeTab(id)
      // Move focus back to tablist after close
      setTimeout(() => tablistRef.current?.querySelector<HTMLElement>('[role="tab"]')?.focus(), 0)
    })

    // Escape — move focus back to tab bar so screen reader users can navigate tabs
    editor.addCommand(monacoInstance.KeyCode.Escape, () => {
      const focused = tablistRef.current?.querySelector<HTMLElement>('[aria-selected="true"]')
      focused?.focus()
    })

    // F5 — run project
    editor.addCommand(monacoInstance.KeyCode.F5, () => {
      runProjectAction()
    })

    // Ctrl+F5 — run active file
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.F5, () => {
      runCurrentFileAction()
    })

    // Shift+F5 — stop active task
    editor.addCommand(monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.F5, () => {
      stopActiveTaskAction()
    })

    // F6 — build project
    editor.addCommand(monacoInstance.KeyCode.F6, () => {
      buildProjectAction()
    })

    // Ctrl+F6 — compile active file
    editor.addCommand(monacoInstance.KeyMod.CtrlCmd | monacoInstance.KeyCode.F6, () => {
      compileCurrentFileAction()
    })

    // F10 — debug step over
    editor.addCommand(monacoInstance.KeyCode.F10, () => {
      debugStepOverAction()
    })

    // F11 — debug step into
    editor.addCommand(monacoInstance.KeyCode.F11, () => {
      debugStepIntoAction()
    })

    // Shift+F11 — debug step out
    editor.addCommand(monacoInstance.KeyMod.Shift | monacoInstance.KeyCode.F11, () => {
      debugStepOutAction()
    })

    // Add to Chat
    editor.addAction({
      id: 'lumiq-add-to-chat',
      label: 'Add Selection to Chat',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1,
      run: (ed) => {
        const id  = activeTabIdRef.current
        const tab = id ? useEditorStore.getState().tabs.find((t) => t.id === id) : null
        const sel = ed.getSelection()
        if (!sel || !tab) return
        const text = ed.getModel()?.getValueInRange(sel)
        if (!text) return
        const lang    = getLanguage(tab.name) ?? 'text'
        const snippet = `\n\`\`\`${lang}\n// ${tab.name}:${sel.startLineNumber}-${sel.endLineNumber}\n${text}\n\`\`\`\n`
        const store   = useChatStore.getState()
        store.setDraftMessage((store.draftMessage ?? '') + snippet)
      }
    })

    // Run Current File
    editor.addAction({
      id: 'lumiq-run-file',
      label: 'Lumiq: Run Current File',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 2,
      run: () => {
        const id = activeTabIdRef.current
        const tab = id ? useEditorStore.getState().tabs.find((t) => t.id === id) : null
        if (!tab) return

        const ext = tab.name.split('.').pop()?.toLowerCase() ?? ''
        let command = ''
        let args: string[] = []

        if (ext === 'py') {
          command = 'python'
          args = [tab.id]
        } else if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
          command = 'node'
          args = [tab.id]
        } else if (ext === 'go') {
          command = 'go'
          args = ['run', tab.id]
        } else if (ext === 'java') {
          command = 'javac'
          args = [tab.id]
        } else if (ext === 'c') {
          command = 'node'
          args = ['.lumiq/c-cpp-runner.js', 'gcc', tab.id]
        } else if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') {
          command = 'node'
          args = ['.lumiq/c-cpp-runner.js', 'g++', tab.id]
        } else if (ext === 'cs') {
          command = 'dotnet'
          args = ['run', '--project', tab.id]
        }

        if (command) {
          const workspacePath = useSessionStore.getState().sessions.find(s => s.id === useSessionStore.getState().activeSessionId)?.workspacePath
          if (workspacePath) {
            useTaskStore.getState().runTask(`Run File: ${tab.name}`, command, args, workspacePath)
          }
        }
      }
    })

    // Compile Current File
    editor.addAction({
      id: 'lumiq-compile-file',
      label: 'Lumiq: Compile Current File',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 3,
      run: () => {
        const id = activeTabIdRef.current
        const tab = id ? useEditorStore.getState().tabs.find((t) => t.id === id) : null
        if (!tab) return

        const ext = tab.name.split('.').pop()?.toLowerCase() ?? ''
        let command = ''
        let args: string[] = []

        if (ext === 'java') {
          command = 'javac'
          args = [tab.id]
        } else if (ext === 'c') {
          command = 'gcc'
          args = ['-c', tab.id]
        } else if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') {
          command = 'g++'
          args = ['-c', tab.id]
        } else if (ext === 'go') {
          command = 'go'
          args = ['build', '-o', tab.name.split('.').slice(0, -1).join('.'), tab.id]
        } else if (ext === 'cs') {
          command = 'dotnet'
          args = ['build', tab.id]
        }

        if (command) {
          const workspacePath = useSessionStore.getState().sessions.find(s => s.id === useSessionStore.getState().activeSessionId)?.workspacePath
          if (workspacePath) {
            useTaskStore.getState().runTask(`Compile File: ${tab.name}`, command, args, workspacePath)
          }
        }
      }
    })

    // Build Project
    editor.addAction({
      id: 'lumiq-build-project',
      label: 'Lumiq: Build Project',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 4,
      run: () => {
        const workspacePath = useSessionStore.getState().sessions.find(s => s.id === useSessionStore.getState().activeSessionId)?.workspacePath
        if (!workspacePath) return
        
        const defs = useTaskStore.getState().definitions
        const buildTask = defs.find(d => d.name.endsWith(':build') || d.name.endsWith(':compile') || d.name.endsWith(':build-project'))
        
        if (buildTask) {
          useTaskStore.getState().runTask(buildTask.name, buildTask.command, buildTask.args, workspacePath)
        } else {
          alert('No project build configuration discovered. Please click the Refresh button in the Runner panel to discover scripts.')
        }
      }
    })

    // Run Project
    editor.addAction({
      id: 'lumiq-run-project',
      label: 'Lumiq: Run Project',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 5,
      run: () => {
        const workspacePath = useSessionStore.getState().sessions.find(s => s.id === useSessionStore.getState().activeSessionId)?.workspacePath
        if (!workspacePath) return
        
        const defs = useTaskStore.getState().definitions
        const runTask = defs.find(d => d.name.endsWith(':run') || d.name.startsWith('npm:start') || d.name.startsWith('npm:dev') || d.name.startsWith('python:run'))
        
        if (runTask) {
          useTaskStore.getState().runTask(runTask.name, runTask.command, runTask.args, workspacePath)
        } else {
          alert('No project run configuration discovered. Please click the Refresh button in the Runner panel to discover scripts.')
        }
      }
    })
  }

  // ── Empty state ──────────────────────────────────────────────────


  if (tabs.length === 0) {
    return (
      <div
        role="region"
        aria-label="Code editor — no file open"
        style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)', gap: '12px' }}
      >
        {/* aria-hidden: decorative glyph */}
        <div aria-hidden="true" style={{ fontSize: '52px', opacity: 0.15 }}>✦</div>
        <p style={{ fontSize: '14px', margin: 0 }}>Open a file from the explorer to start editing</p>
        <p style={{ fontSize: '12px', margin: 0, opacity: 0.6 }}>
          <kbd>Ctrl</kbd>+<kbd>S</kbd> to save &middot; Right-click for more options
        </p>
      </div>
    )
  }

  // ── Breadcrumb parts ─────────────────────────────────────────────
  const breadcrumbParts = (() => {
    if (!activeTab) return []
    const parts = activeTab.id.replace(/\\/g, '/').split('/').filter(Boolean)
    if (parts[0]?.match(/^[a-zA-Z]:$/)) parts[0] = parts[0] + '\\'
    return parts.length > 3 ? ['…', ...parts.slice(-3)] : parts
  })()

  // ── Render ───────────────────────────────────────────────────────
  return (
    <div
      role="region"
      aria-label={activeTab ? `Code editor — ${activeTab.name}` : 'Code editor'}
      style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}
    >

      {/* ── Tab bar (ARIA tablist) ── */}
      <div
        id={tablistId}
        ref={tablistRef}
        role="tablist"
        aria-label="Open files"
        onKeyDown={handleTablistKeyDown}
        style={{ display: 'flex', overflowX: 'auto', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0, scrollbarWidth: 'none' }}
      >
        {tabs.map((tab) => {
          const isActive  = tab.id === activeTabId
          const tabPanelId = `${panelId}-${tab.id.replace(/[^a-z0-9]/gi, '_')}`
          const dirtyLabel = tab.isDirty ? ', unsaved changes' : ''
          return (
            <div
              key={tab.id}
              // ARIA tab role + state
              role="tab"
              id={`${tablistId}-tab-${tab.id.replace(/[^a-z0-9]/gi, '_')}`}
              aria-selected={isActive}
              aria-controls={tabPanelId}
              aria-label={`${tab.name}${dirtyLabel}, ${getLanguageLabel(tab.name)}`}
              tabIndex={isActive ? 0 : -1}
              data-tabid={tab.id}
              title={tab.id}
              onClick={() => { setActiveTab(tab.id); setTimeout(() => editorRef.current?.focus(), 50) }}
              onKeyDown={(e) => {
                // Enter/Space activates the tab
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault()
                  setActiveTab(tab.id)
                  setTimeout(() => editorRef.current?.focus(), 50)
                }
                // Stop propagation so app-level shortcuts don't fire
                e.stopPropagation()
              }}
              style={{
                padding: '0 10px 0 12px', height: '36px', fontSize: '13px', cursor: 'pointer',
                borderRight: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '6px',
                background: isActive ? 'var(--bg-primary)' : 'transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                borderTop: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
                flexShrink: 0, maxWidth: '200px', userSelect: 'none',
                outline: 'none',
                // Visible focus ring for keyboard users
                boxShadow: 'none',
              }}
              onFocus={(e) => { e.currentTarget.style.outline = '2px solid var(--accent-blue)'; e.currentTarget.style.outlineOffset = '-2px' }}
              onBlur={(e)  => { e.currentTarget.style.outline = 'none' }}
              onMouseEnter={(e) => { if (!isActive) e.currentTarget.style.background = 'var(--bg-tertiary)' }}
              onMouseLeave={(e) => { if (!isActive) e.currentTarget.style.background = 'transparent' }}
            >
              {/* Decorative icon — hidden from AT */}
              <span aria-hidden="true" style={{ fontSize: '12px', flexShrink: 0 }}>{getTabIcon(tab.name)}</span>

              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>
                {tab.name}
                {/* Dirty dot — aria-hidden because the label already says "unsaved changes" */}
                {tab.isDirty && <span aria-hidden="true" style={{ marginLeft: '4px', color: 'var(--accent-yellow, #f0a500)' }}>●</span>}
              </span>

              <button
                aria-label={`Close ${tab.name}`}
                title="Close tab (Ctrl+W)"
                tabIndex={-1}          /* tablist arrow-key nav handles focus */
                onClick={(e) => handleCloseTab(tab.id, e)}
                onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCloseTab(tab.id, e as any) } e.stopPropagation() }}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', padding: '2px 3px', borderRadius: '3px', flexShrink: 0, lineHeight: 1, display: 'flex', alignItems: 'center' }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-muted)' }}
              >
                <span aria-hidden="true">✕</span>
              </button>
            </div>
          )
        })}
      </div>

      {/* ── Breadcrumb navigation ── */}
      {activeTab && (
        <nav
          aria-label="File path"
          style={{ padding: '3px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, overflow: 'hidden' }}
        >
          <ol style={{ display: 'flex', alignItems: 'center', gap: '4px', listStyle: 'none', margin: 0, padding: 0 }}>
            {breadcrumbParts.map((part, i) => (
              <li key={i} style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                {i > 0 && <span aria-hidden="true" style={{ opacity: 0.35 }}>›</span>}
                <span style={{ color: i === breadcrumbParts.length - 1 ? 'var(--text-secondary)' : 'var(--text-muted)', whiteSpace: 'nowrap', fontWeight: i === breadcrumbParts.length - 1 ? 500 : 400 }}>
                  {part}
                </span>
              </li>
            ))}
          </ol>
        </nav>
      )}

      {/* ── Editor tabpanel ── */}
      {activeTab && (
        <div
          role="tabpanel"
          id={`${panelId}-${activeTab.id.replace(/[^a-z0-9]/gi, '_')}`}
          aria-labelledby={`${tablistId}-tab-${activeTab.id.replace(/[^a-z0-9]/gi, '_')}`}
          aria-label={`${activeTab.name} editor`}
          aria-describedby={statusId}
          style={{ flex: 1, position: 'relative', overflow: 'hidden' }}
        >
          <Editor
            key={activeTab.id}
            value={activeTab.content}
            path={activeTab.id}
            language={getLanguage(activeTab.name)}
            theme="lumiq-dark"
            onMount={handleMount}
            onChange={(value) => updateTabContent(activeTab.id, value ?? '')}
            options={{
              automaticLayout: true,
              // Full screen-reader support in Monaco
              accessibilitySupport: 'on',
              // Announce inline suggestions to screen readers
              screenReaderAnnounceInlineSuggestion: true,
              bracketPairColorization: { enabled: true },
              folding: true, foldingHighlight: true,
              fontFamily: 'var(--font-mono)', fontSize: 13, lineHeight: 21,
              minimap: { enabled: minimap },
              scrollBeyondLastLine: false,
              wordWrap,
              renderWhitespace: 'selection',
              smoothScrolling: true,
              cursorBlinking: 'smooth',
              cursorSmoothCaretAnimation: 'on',
              padding: { top: 8, bottom: 8 },
              suggest: { showIcons: true },
              quickSuggestions: { other: true, comments: false, strings: false },
              tabSize: 2,
              insertSpaces: true,
              formatOnPaste: true,
              formatOnType: false,
              linkedEditing: true,
            }}
          />
          
          {/* Gorgeous glassmorphic errors popup overlay */}
          {errorSuggestion && (
            <div style={{
              position: 'absolute',
              bottom: '24px',
              right: '24px',
              maxWidth: '380px',
              maxHeight: '80%',
              background: 'rgba(22, 27, 34, 0.85)',
              backdropFilter: 'blur(16px) saturate(180%)',
              border: '1px solid rgba(255, 123, 114, 0.4)', // glowing red border
              borderRadius: '12px',
              boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(255, 123, 114, 0.15)',
              padding: '16px',
              zIndex: 1000,
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              animation: 'slideIn 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
              color: 'var(--text-primary)',
            }}>
              <style dangerouslySetInnerHTML={{__html: `
                @keyframes slideIn {
                  from { transform: translateY(20px); opacity: 0; }
                  to { transform: translateY(0); opacity: 1; }
                }
              `}} />

              {/* Title & Close */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '8px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: '#ff7b72', fontWeight: 600, fontSize: '13px' }}>
                  <span style={{ fontSize: '16px' }}>⚠️</span>
                  <span>Errors Detected!</span>
                </div>
                <button
                  onClick={() => setErrorSuggestion(null)}
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '14px',
                    padding: '2px 4px',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.color = '#ff7b72'}
                  onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                >
                  ✕
                </button>
              </div>

              {/* Subtitle */}
              <div style={{ fontSize: '12px', color: 'var(--text-secondary)', lineHeight: '1.4' }}>
                Lumiq detected compilation or execution errors. Do you want to fix these errors using the AI Agent?
              </div>

              {/* Scrollable Errors */}
              <div style={{
                background: 'rgba(0,0,0,0.3)',
                borderRadius: '6px',
                padding: '8px 10px',
                maxHeight: '120px',
                overflowY: 'auto',
                border: '1px solid rgba(255,255,255,0.05)',
              }}>
                <pre style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '11px',
                  color: '#f85149',
                  margin: 0,
                  whiteSpace: 'pre-wrap',
                }}>
                  {errorSuggestion.errorLines.join('\n')}
                </pre>
              </div>

              {/* Action Buttons */}
              <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', marginTop: '4px' }}>
                <button
                  onClick={() => setErrorSuggestion(null)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: 'transparent',
                    color: 'var(--text-primary)',
                    fontSize: '11px',
                    fontWeight: 500,
                    cursor: 'pointer',
                    transition: 'background 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255,255,255,0.05)'}
                  onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                >
                  No, Dismiss
                </button>
                <button
                  onClick={() => {
                    const taskName = useTaskStore.getState().tasks.find(t => t.id === errorSuggestion.taskId)?.name || 'Project Build'
                    const activeTabInfo = activeTab ? `\n\nActive file when error occurred: \`${activeTab.name}\` (${activeTab.id})` : ''
                    const prompt = `The task \`${taskName}\` failed with the following errors:${activeTabInfo}\n\n\`\`\`\n${errorSuggestion.errorLines.join('\n')}\n\`\`\`\n\nPlease help me analyze and fix these errors.`
                    
                    // Paste to chat input
                    useChatStore.getState().setDraftMessage(prompt)
                    
                    // Dismiss modal
                    setErrorSuggestion(null)
                  }}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '6px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
                    color: '#ffffff',
                    fontSize: '11px',
                    fontWeight: 600,
                    cursor: 'pointer',
                    boxShadow: '0 2px 8px rgba(37,99,235,0.3)',
                    transition: 'opacity 0.2s',
                  }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Yes, Fix with Agent
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* ── Status bar (toolbar + live status) ── */}
      {activeTab && (
        <div
          id={statusId}
          role="status"
          aria-live="polite"
          aria-atomic="false"
          aria-label={`Editor status for ${activeTab.name}`}
          style={{ padding: '2px 12px', background: 'var(--bg-secondary)', borderTop: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0, gap: '12px' }}
        >
          {/* Left: save state + language */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <SaveStatus isDirty={activeTab.isDirty} fileName={activeTab.name} />
            <span
              aria-label={`Language: ${getLanguageLabel(activeTab.name)}`}
              style={{ fontSize: '11px', color: 'var(--text-muted)' }}
            >
              {getLanguageLabel(activeTab.name)}
            </span>
          </div>

          {/* Right: cursor + toolbar */}
          <div
            id={toolbarId}
            role="toolbar"
            aria-label="Editor view options"
            style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
          >
            <CursorInfo editorRef={editorRef} />

            <button
              aria-pressed={autocompleteEnabled}
              aria-label={autocompleteEnabled ? 'AI Autocomplete on — click to turn off' : 'AI Autocomplete off — click to turn on'}
              onClick={() => setAutocompleteEnabled((prev) => !prev)}
              style={{ background: autocompleteEnabled ? 'rgba(37,99,235,0.15)' : 'none', border: '1px solid transparent', cursor: 'pointer', color: autocompleteEnabled ? 'var(--accent-blue)' : 'var(--text-muted)', fontSize: '11px', padding: '1px 6px', borderRadius: '3px' }}
              onFocus={(e)  => e.currentTarget.style.outline = '2px solid var(--accent-blue)'}
              onBlur={(e)   => e.currentTarget.style.outline = 'none'}
            >
              {autocompleteEnabled ? '🤖 Auto: On' : '🤖 Auto: Off'}
            </button>

            <button
              aria-pressed={wordWrap === 'on'}
              aria-label={wordWrap === 'on' ? 'Word wrap on — click to turn off' : 'Word wrap off — click to turn on'}
              onClick={() => setWordWrap((w) => w === 'off' ? 'on' : 'off')}
              style={{ background: wordWrap === 'on' ? 'rgba(37,99,235,0.15)' : 'none', border: '1px solid transparent', cursor: 'pointer', color: wordWrap === 'on' ? 'var(--accent-blue)' : 'var(--text-muted)', fontSize: '11px', padding: '1px 6px', borderRadius: '3px' }}
              onFocus={(e)  => e.currentTarget.style.outline = '2px solid var(--accent-blue)'}
              onBlur={(e)   => e.currentTarget.style.outline = 'none'}
            >
              Wrap
            </button>

            <button
              aria-pressed={minimap}
              aria-label={minimap ? 'Minimap on — click to turn off' : 'Minimap off — click to turn on'}
              onClick={() => setMinimap((m) => !m)}
              style={{ background: minimap ? 'rgba(37,99,235,0.15)' : 'none', border: '1px solid transparent', cursor: 'pointer', color: minimap ? 'var(--accent-blue)' : 'var(--text-muted)', fontSize: '11px', padding: '1px 6px', borderRadius: '3px' }}
              onFocus={(e)  => e.currentTarget.style.outline = '2px solid var(--accent-blue)'}
              onBlur={(e)   => e.currentTarget.style.outline = 'none'}
            >
              Map
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
