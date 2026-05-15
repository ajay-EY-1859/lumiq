// Lumiq — Settings: Shortcuts Tab
import React from 'react'

const SHORTCUTS = [
  { keys: 'Ctrl+N', action: 'New session' },
  { keys: 'Enter', action: 'Send message' },
  { keys: 'Shift+Enter', action: 'New line' },
  { keys: 'Ctrl+B', action: 'Toggle sidebar' },
  { keys: 'Ctrl+,', action: 'Settings' },
  { keys: 'Escape', action: 'Cancel / close' },
  { keys: 'Ctrl+Q', action: 'Quit' }
]

export function ShortcutsTab(): React.JSX.Element {
  return (
    <div style={{ maxWidth: '400px' }}>
      {SHORTCUTS.map((s) => (
        <div key={s.keys} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.action}</span>
          <kbd style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-mono)', border: '1px solid var(--border)' }}>{s.keys}</kbd>
        </div>
      ))}
    </div>
  )
}
