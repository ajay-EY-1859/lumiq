import React, { useEffect } from 'react'
import { useEditorStore } from '@renderer/store/editorStore'

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

  if (tabs.length === 0) {
    return (
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-primary)', color: 'var(--text-muted)' }}>
        <div style={{ fontSize: '48px', opacity: 0.2, marginBottom: '16px' }}>✦</div>
        <div style={{ fontSize: '14px' }}>Open a file to start editing</div>
      </div>
    )
  }

  const activeTab = tabs.find(t => t.id === activeTabId)

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
          <textarea
            value={activeTab.content}
            onChange={(e) => updateTabContent(activeTab.id, e.target.value)}
            onKeyDown={(e) => {
              if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault()
                saveTab(activeTab.id)
              }
            }}
            spellCheck={false}
            style={{
              width: '100%',
              height: '100%',
              border: 'none',
              resize: 'none',
              outline: 'none',
              padding: '16px',
              fontFamily: 'var(--font-mono)',
              fontSize: '13px',
              background: 'var(--bg-primary)',
              color: 'var(--text-primary)',
              lineHeight: 1.5,
              whiteSpace: 'pre'
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
