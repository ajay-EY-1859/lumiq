// Lumiq — Settings: Tools Tab
import React, { useEffect } from 'react'
import { useSettingsStore } from '@renderer/store/settingsStore'
import type { ToolPermission } from '@shared/types'

export function ToolsTab(): React.JSX.Element {
  const { toolSettings, loadToolSettings, updateToolSettings } = useSettingsStore()
  useEffect(() => { loadToolSettings() }, [loadToolSettings])
  const toggle = (name: string): void => { updateToolSettings(toolSettings.map((t) => t.name === name ? { ...t, enabled: !t.enabled } : t)) }
  const setPerm = (name: string, p: string): void => { updateToolSettings(toolSettings.map((t) => t.name === name ? { ...t, permission: p as ToolPermission } : t)) }

  return (
    <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {toolSettings.map((tool) => (
        <div key={tool.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button onClick={() => toggle(tool.name)} title={tool.enabled ? `Disable ${tool.name}` : `Enable ${tool.name}`} style={{ width: '36px', height: '20px', borderRadius: '10px', background: tool.enabled ? 'var(--accent-blue)' : 'var(--bg-tertiary)', border: 'none', cursor: 'pointer', position: 'relative' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: tool.enabled ? '18px' : '2px', transition: 'left var(--transition-fast)', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
          </button>
          <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{tool.name}</span>
          <select value={tool.permission} onChange={(e) => setPerm(tool.name, e.target.value)} title={`Permission for ${tool.name}`} style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
            <option value="always-ask">Always Ask</option><option value="always-allow">Always Allow</option><option value="always-deny">Always Deny</option>
          </select>
        </div>
      ))}
    </div>
  )
}
