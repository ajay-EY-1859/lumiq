// ═══════════════════════════════════════════════════════════════════
// Lumiq — Custom TitleBar Component
// Frameless window titlebar with window controls
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react'

export function TitleBar(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)
  const [indexStats, setIndexStats] = useState<{ files: number; symbols: number; references: number } | null>(null)

  useEffect(() => {
    const checkMaximized = async (): Promise<void> => {
      const result = await window.electronAPI.window.isMaximized()
      setIsMaximized(result)
    }
    checkMaximized()
  }, [])

  useEffect(() => {
    if (!window.electronAPI || !window.electronAPI.lsp || !window.electronAPI.lsp.getIndexStats) return

    const fetchStats = async () => {
      try {
        const stats = await window.electronAPI.lsp.getIndexStats()
        setIndexStats(stats)
      } catch {
        // Silent error
      }
    }

    fetchStats()
    // Poll every 5 seconds to keep counts live during indexing scans
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  return (
    <div
      className="titlebar-drag"
      style={{
        height: '48px',
        background: 'transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      {/* Left: App icon and name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          width: '24px', height: '24px', borderRadius: '6px',
          background: 'linear-gradient(135deg, var(--accent-blue), #8B5CF6)',
          color: 'white', fontSize: '14px', boxShadow: '0 2px 5px rgba(0,0,0,0.2)'
        }}>✦</div>
        <span
          style={{
            fontSize: '14px',
            fontWeight: 700,
            letterSpacing: '0.03em',
            color: 'var(--text-primary)'
          }}
        >
          Lumiq
        </span>

        {/* Index Status Badge */}
        {indexStats && indexStats.symbols > 0 && (
          <div
            title={`${indexStats.files} files, ${indexStats.symbols} symbols, ${indexStats.references} references indexed`}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '2px 8px',
              borderRadius: '20px',
              background: 'rgba(139, 92, 246, 0.1)',
              border: '1px solid rgba(139, 92, 246, 0.2)',
              fontSize: '10px',
              color: '#A78BFA',
              fontWeight: 600,
              cursor: 'help',
              marginLeft: '6px'
            }}
          >
            <span>🧠</span>
            <span>{indexStats.symbols.toLocaleString()} symbols</span>
          </div>
        )}
      </div>

      {/* Center: Empty for future use */}
      <div className="titlebar-no-drag" style={{ flex: 1 }}></div>

      {/* Right: Window controls */}
      <div
        className="titlebar-no-drag"
        style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
      >
        {[
          { label: '─', action: () => window.electronAPI.window.minimize(), title: 'Minimize' },
          { label: isMaximized ? '❐' : '□', action: () => { window.electronAPI.window.maximize(); setIsMaximized(!isMaximized) }, title: isMaximized ? 'Restore' : 'Maximize' },
          { label: '✕', action: () => window.electronAPI.window.close(), isDanger: true, title: 'Close' }
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.action}
            title={btn.title}
            aria-label={btn.title}
            className="transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid var(--border)',
              backdropFilter: 'blur(4px)',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              width: '32px',
              height: '32px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            onMouseEnter={(e) => {
              const target = e.currentTarget
              target.style.background = (btn as { isDanger?: boolean }).isDanger ? 'var(--accent-red)' : 'var(--bg-tertiary)'
              if ((btn as { isDanger?: boolean }).isDanger) {
                target.style.color = 'white'
                target.style.borderColor = 'var(--accent-red)'
              }
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget
              target.style.background = 'rgba(255, 255, 255, 0.05)'
              target.style.color = 'var(--text-secondary)'
              target.style.borderColor = 'var(--border)'
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  )
}
