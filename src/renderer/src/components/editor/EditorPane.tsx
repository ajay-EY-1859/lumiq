import React, { useEffect } from 'react'
import Editor, { OnMount, useMonaco } from '@monaco-editor/react'
import { useEditorStore } from '@renderer/store/editorStore'
import { useChatStore } from '@renderer/store/chatStore'
import { DocumentSymbol, SymbolKind } from '@shared/types'

function getLanguage(fileName: string): string | undefined {
  const extension = fileName.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript',
    tsx: 'typescript',
    js: 'javascript',
    jsx: 'javascript',
    json: 'json',
    css: 'css',
    html: 'html',
    md: 'markdown',
    py: 'python',
    yml: 'yaml',
    yaml: 'yaml',
    xml: 'xml',
    sql: 'sql',
    sh: 'shell',
    ps1: 'powershell'
  }
  return extension ? map[extension] : undefined
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

const handleEditorMount: OnMount = (editor, monaco) => {
  const styles = getComputedStyle(document.documentElement)
  const bg = styles.getPropertyValue('--bg-primary').trim().replace('#', '') || '0d1117'
  const fg = styles.getPropertyValue('--text-primary').trim().replace('#', '') || 'e6edf3'
  const line = styles.getPropertyValue('--border').trim().replace('#', '') || '30363d'

  monaco.editor.defineTheme('lumiq', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': `#${bg}`,
      'editor.foreground': `#${fg}`,
      'editorLineNumber.foreground': `#${line}`,
      'editorGutter.background': `#${bg}`,
      'editorWidget.background': `#${bg}`
    }
  })
  monaco.editor.setTheme('lumiq')
  editor.focus()
}

export function EditorPane(): React.JSX.Element | null {
  const { tabs, activeTabId, setActiveTab, closeTab, updateTabContent, saveTab } = useEditorStore()

  useEffect(() => {
    const cleanup = window.electronAPI.fs.onFileModified((filePath) => {
      // Normalize paths to forward slashes for robust matching
      const normalizedFilePath = filePath.replace(/\\/g, '/')
      const tabsSnapshot = useEditorStore.getState().tabs
      const openTab = tabsSnapshot.find(t => t.id.replace(/\\/g, '/') === normalizedFilePath)
      if (openTab) {
        useEditorStore.getState().reloadTab(openTab.id)
      }
    })
    return cleanup
  }, [])

  const monaco = useMonaco()
  useEffect(() => {
    if (!monaco) return
    const provider = monaco.languages.registerDocumentSymbolProvider('*', {
      provideDocumentSymbols: async (model) => {
        // model.uri.path typically looks like "/d:/path/to/file"
        // we strip the leading slash for windows paths, keeping for mac/linux if necessary.
        let filePath = model.uri.path
        if (filePath.startsWith('/') && filePath.includes(':')) {
          filePath = filePath.slice(1) // Remove leading slash on Windows
        }
        try {
          const symbols: DocumentSymbol[] = await window.electronAPI.lsp.getDocumentSymbols(filePath)
          return symbols.map(s => ({
            name: s.name,
            detail: s.detail || '',
            kind: mapSymbolKind(monaco, s.kind),
            tags: [],
            range: s.range,
            selectionRange: s.selectionRange
          }))
        } catch (err) {
          console.error('Failed to get symbols:', err)
          return []
        }
      }
    })

    const defProvider = monaco.languages.registerDefinitionProvider('*', {
      provideDefinition: async (model, position) => {
        let filePath = model.uri.path
        if (filePath.startsWith('/') && filePath.includes(':')) {
          filePath = filePath.slice(1)
        }
        try {
          const def = await window.electronAPI.lsp.getDefinition('', filePath, position.lineNumber, position.column)
          if (!def) return null
          
          let targetUri = def.uri
          // Ensure file scheme and correct format
          if (!targetUri.startsWith('file://')) {
            targetUri = 'file://' + (targetUri.startsWith('/') ? targetUri : '/' + targetUri)
          }

          return {
            uri: monaco.Uri.parse(targetUri),
            range: def.range
          }
        } catch (err) {
          console.error('Failed to get definition:', err)
          return null
        }
      }
    })

    return () => {
      provider.dispose()
      defProvider.dispose()
    }
  }, [monaco])

  if (tabs.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '48px', opacity: 0.2, marginBottom: '16px' }}>✦</div>
        <div style={{ fontSize: '14px' }}>Open a file to start editing</div>
      </div>
    )
  }

  const activeTab = tabs.find(t => t.id === activeTabId)

  const handleMount: OnMount = (editor, monaco) => {
    handleEditorMount(editor, monaco)
    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
      if (activeTab) void saveTab(activeTab.id)
    })

    editor.addAction({
      id: 'lumiq-add-to-chat',
      label: 'Add to Chat',
      contextMenuGroupId: 'navigation',
      contextMenuOrder: 1,
      run: (ed) => {
        const selection = ed.getSelection()
        if (!selection || !activeTab) return
        const selectedText = ed.getModel()?.getValueInRange(selection)
        if (!selectedText) return
        
        // Use chat store to inject text into the draft message
        const chatStore = (window as any)._chatStoreApi || useChatStore.getState()
        const currentDraft = chatStore.draftMessage || ''
        
        const referenceText = `\n\`\`\`${getLanguage(activeTab.name) || 'text'}\n// ${activeTab.name}:${selection.startLineNumber}-${selection.endLineNumber}\n${selectedText}\n\`\`\`\n`
        
        chatStore.setDraftMessage(currentDraft + referenceText)
      }
    })
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', overflowX: 'auto', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {tabs.map(tab => (
          <div
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '6px 12px',
              fontSize: '13px',
              cursor: 'pointer',
              borderRight: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              background: tab.id === activeTabId ? 'var(--bg-primary)' : 'transparent',
              color: tab.id === activeTabId ? 'var(--text-primary)' : 'var(--text-secondary)',
              borderTop: tab.id === activeTabId ? '2px solid var(--accent-blue)' : '2px solid transparent'
            }}
          >
            <span>{tab.name}{tab.isDirty ? ' *' : ''}</span>
            <button
              onClick={(e) => { e.stopPropagation(); closeTab(tab.id) }}
              title="Close tab"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '11px', padding: '2px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              ✕
            </button>
          </div>
        ))}
      </div>

      {/* Editor Content */}
      <div style={{ flex: 1, position: 'relative' }}>
        {activeTab ? (
          <Editor
            key={activeTab.id}
            value={activeTab.content}
            path={activeTab.id}
            language={getLanguage(activeTab.name)}
            theme="lumiq"
            onMount={handleMount}
            onChange={(value) => updateTabContent(activeTab.id, value ?? '')}
            options={{
              automaticLayout: true,
              bracketPairColorization: { enabled: true },
              folding: true,
              fontFamily: 'var(--font-mono)',
              fontSize: 13,
              lineHeight: 20,
              minimap: { enabled: true },
              scrollBeyondLastLine: false,
              wordWrap: 'off'
            }}
          />
        ) : (
          <div style={{ padding: '32px', textAlign: 'center', color: 'var(--text-muted)' }}>
            Select a file to edit
          </div>
        )}
      </div>
    </div>
  )
}
