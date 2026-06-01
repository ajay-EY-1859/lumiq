// Lumiq — Settings: Shortcuts Tab (Redesigned)
import React from 'react'

const SHORTCUT_GROUPS: { label: string; icon: string; shortcuts: { keys: string[]; action: string }[] }[] = [
  {
    label: 'Navigation',
    icon: '🧭',
    shortcuts: [
      { keys: ['Ctrl', 'N'], action: 'New session' },
      { keys: ['Ctrl', 'B'], action: 'Toggle sidebar' },
      { keys: ['Ctrl', ','], action: 'Open settings' },
      { keys: ['Escape'], action: 'Cancel / close dialog' }
    ]
  },
  {
    label: 'Chat',
    icon: '💬',
    shortcuts: [
      { keys: ['Enter'], action: 'Send message' },
      { keys: ['Shift', 'Enter'], action: 'Insert new line' }
    ]
  },
  {
    label: 'Application',
    icon: '⚙️',
    shortcuts: [
      { keys: ['Ctrl', 'Q'], action: 'Quit application' }
    ]
  }
]

export function ShortcutsTab(): React.JSX.Element {
  return (
    <div style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
      {SHORTCUT_GROUPS.map((group) => (
        <div
          key={group.label}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            overflow: 'hidden'
          }}
        >
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '14px' }}>{group.icon}</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{group.label}</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {group.shortcuts.map((s, i) => (
              <div
                key={s.action}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 18px',
                  borderBottom: i < group.shortcuts.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background var(--transition-fast)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.action}</span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {s.keys.map((key, ki) => (
                    <React.Fragment key={key}>
                      {ki > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+</span>}
                      <kbd style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderBottom: '2px solid var(--border)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        boxShadow: '0 1px 0 var(--border)'
                      }}>
                        {key}
                      </kbd>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}

      <div style={{
        padding: '12px 16px',
        background: 'rgba(59, 130, 246, 0.04)',
        border: '1px solid rgba(59, 130, 246, 0.15)',
        borderRadius: '10px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-start'
      }}>
        <span style={{ fontSize: '14px', flexShrink: 0 }}>💡</span>
        <span>Custom keybinding support is coming in a future update.</span>
      </div>
    </div>
  )
}
