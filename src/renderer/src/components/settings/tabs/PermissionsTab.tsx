// Lumiq — Settings: Permissions Tab
import React, { useState, useEffect } from 'react'
import { showToast } from '@renderer/components/ui/Toast'

type PermissionMode = 'MANUAL' | 'LIMITED' | 'EXTENDED' | 'AUTO'

const MODES: { id: PermissionMode; emoji: string; label: string; description: string }[] = [
  { id: 'MANUAL', emoji: '🔒', label: 'Manual', description: 'Every tool call requires your approval. Maximum control.' },
  { id: 'LIMITED', emoji: '⚡', label: 'Limited', description: 'Read-only tools (search, file read, grep) auto-approve. Write tools still ask.' },
  { id: 'EXTENDED', emoji: '🔧', label: 'Extended', description: 'Read-only tools and common write tools (file edit, bash, PowerShell) auto-approve. For power users who trust the agent.' },
  { id: 'AUTO', emoji: '🚀', label: 'Auto', description: 'All tools auto-approve. For trusted sessions and power users.' }
]

export function PermissionsTab(): React.JSX.Element {
  const [mode, setMode] = useState<PermissionMode>('MANUAL')
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    window.electronAPI.settings.getPermissionMode().then((m) => {
      setMode((m as PermissionMode) || 'MANUAL')
      setLoading(false)
    })
  }, [])

  const handleSelect = async (m: PermissionMode): Promise<void> => {
    setMode(m)
    await window.electronAPI.settings.setPermissionMode(m)
    showToast('success', 'Permission Mode Updated', `Switched to ${m} mode.`)
  }

  if (loading) return <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>Loading...</div>

  return (
    <div style={{ maxWidth: '480px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '4px' }}>Tool Permission Mode</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>
          Controls when Lumiq asks for your approval before running tools.
        </p>
      </div>
      {MODES.map((m) => (
        <button
          key={m.id}
          onClick={() => handleSelect(m.id)}
          style={{
            display: 'flex', alignItems: 'flex-start', gap: '12px', padding: '14px 16px',
            background: mode === m.id ? 'rgba(37,99,235,0.08)' : 'var(--bg-secondary)',
            border: `2px solid ${mode === m.id ? 'var(--accent-blue)' : 'var(--border)'}`,
            borderRadius: '10px', cursor: 'pointer', textAlign: 'left', width: '100%',
            fontFamily: 'var(--font-sans)', transition: 'all var(--transition-fast)'
          }}
        >
          <span style={{ fontSize: '22px', lineHeight: 1 }}>{m.emoji}</span>
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: '13px', fontWeight: 600, color: mode === m.id ? 'var(--accent-blue)' : 'var(--text-primary)', marginBottom: '3px' }}>
              {m.label}
              {mode === m.id && <span style={{ marginLeft: '8px', fontSize: '10px', padding: '1px 6px', background: 'var(--accent-blue)', color: 'white', borderRadius: '8px', fontWeight: 700 }}>ACTIVE</span>}
            </div>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.4 }}>{m.description}</div>
          </div>
        </button>
      ))}
      <div style={{ padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)', fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        <strong style={{ color: 'var(--text-secondary)' }}>Note:</strong> Per-tool settings in the Tools tab always override the mode.
        "Always Allow" and "Always Deny" take priority over the mode setting.
      </div>
    </div>
  )
}
