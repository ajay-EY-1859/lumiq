// Lumiq — Settings: Appearance Tab
import React from 'react'
import { useSettingsStore } from '@renderer/store/settingsStore'
import type { ThemeMode, FontSize } from '@shared/types'

const THEMES: { id: ThemeMode; label: string; emoji: string }[] = [
  { id: 'light', label: 'Light', emoji: '☀️' },
  { id: 'dark', label: 'Dark', emoji: '🌙' },
  { id: 'system', label: 'System', emoji: '💻' }
]

export function AppearanceTab(): React.JSX.Element {
  const { settings, setTheme, setFontSize } = useSettingsStore()

  return (
    <div style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Theme</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {THEMES.map((t) => (
            <button key={t.id} onClick={() => setTheme(t.id)} title={`Switch to ${t.label} theme`} style={{
              flex: 1, padding: '12px', background: settings.theme === t.id ? 'rgba(37,99,235,0.1)' : 'var(--bg-secondary)',
              border: `2px solid ${settings.theme === t.id ? 'var(--accent-blue)' : 'var(--border)'}`,
              borderRadius: '10px', cursor: 'pointer', textAlign: 'center', fontFamily: 'var(--font-sans)'
            }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>{t.emoji}</div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{t.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Font Size</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['12', '14', '16'] as FontSize[]).map((s) => (
            <button key={s} onClick={() => setFontSize(s)} title={`Set font size to ${s}px`} style={{
              padding: '8px 20px', background: settings.fontSize === s ? 'var(--accent-blue)' : 'var(--bg-secondary)',
              color: settings.fontSize === s ? 'white' : 'var(--text-primary)',
              border: `1px solid ${settings.fontSize === s ? 'var(--accent-blue)' : 'var(--border)'}`,
              borderRadius: '8px', cursor: 'pointer', fontSize: `${s}px`, fontFamily: 'var(--font-sans)', fontWeight: 500
            }}>{s}px</button>
          ))}
        </div>
      </div>
    </div>
  )
}
