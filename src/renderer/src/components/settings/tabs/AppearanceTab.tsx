// Lumiq — Settings: Appearance Tab (Redesigned)
import React from 'react'
import { useSettingsStore } from '@renderer/store/settingsStore'
import type { ThemeMode, FontSize } from '@shared/types'

const THEMES: { id: ThemeMode; label: string; icon: string; description: string }[] = [
  { id: 'light', label: 'Light', icon: '☀️', description: 'Clean white interface' },
  { id: 'dark', label: 'Dark', icon: '🌙', description: 'Easy on the eyes' },
  { id: 'system', label: 'System', icon: '💻', description: 'Follows OS setting' }
]

const FONT_SIZES: { value: FontSize; label: string; preview: string }[] = [
  { value: '12', label: 'Small', preview: '12px' },
  { value: '14', label: 'Default', preview: '14px' },
  { value: '16', label: 'Large', preview: '16px' }
]

export function AppearanceTab(): React.JSX.Element {
  const { settings, setTheme, setFontSize } = useSettingsStore()

  return (
    <div style={{ maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

      {/* Theme */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '14px' }}>🎨</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Color Theme</span>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', gap: '10px' }}>
          {THEMES.map((t) => {
            const isActive = settings.theme === t.id
            return (
              <button
                key={t.id}
                onClick={() => setTheme(t.id)}
                title={`Switch to ${t.label} theme`}
                style={{
                  flex: 1,
                  padding: '16px 12px',
                  background: isActive ? 'rgba(59, 130, 246, 0.08)' : 'var(--bg-tertiary)',
                  border: `2px solid ${isActive ? 'var(--accent-blue)' : 'var(--border)'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textAlign: 'center',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all var(--transition-fast)',
                  position: 'relative'
                }}
              >
                {isActive && (
                  <div style={{
                    position: 'absolute',
                    top: 6,
                    right: 6,
                    width: 8,
                    height: 8,
                    borderRadius: '50%',
                    background: 'var(--accent-blue)'
                  }} />
                )}
                <div style={{ fontSize: '22px', marginBottom: '6px' }}>{t.icon}</div>
                <div style={{ fontSize: '13px', fontWeight: 600, color: isActive ? 'var(--accent-blue)' : 'var(--text-primary)', marginBottom: '2px' }}>{t.label}</div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{t.description}</div>
              </button>
            )
          })}
        </div>
      </div>

      {/* Font Size */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          gap: '8px'
        }}>
          <span style={{ fontSize: '14px' }}>Aa</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Font Size</span>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', gap: '10px' }}>
          {FONT_SIZES.map((s) => {
            const isActive = settings.fontSize === s.value
            return (
              <button
                key={s.value}
                onClick={() => setFontSize(s.value)}
                title={`Set font size to ${s.value}px`}
                style={{
                  flex: 1,
                  padding: '14px 12px',
                  background: isActive ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                  color: isActive ? 'white' : 'var(--text-primary)',
                  border: `2px solid ${isActive ? 'var(--accent-blue)' : 'var(--border)'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all var(--transition-fast)',
                  textAlign: 'center'
                }}
              >
                <div style={{ fontSize: `${s.value}px`, fontWeight: 700, marginBottom: '4px' }}>Aa</div>
                <div style={{ fontSize: '11px', fontWeight: 600, opacity: isActive ? 1 : 0.7 }}>{s.label}</div>
                <div style={{ fontSize: '10px', opacity: 0.6 }}>{s.preview}</div>
              </button>
            )
          })}
        </div>
      </div>

    </div>
  )
}
