// ═══════════════════════════════════════════════════════════════════
// Lumiq — Custom TitleBar Component (Premium Redesign v2)
// Branded status hub with ambient glow ring + glass window controls
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react'

type AIStatus = 'idle' | 'streaming' | 'error' | 'indexing'

function StatusRing({ status }: { status: AIStatus }): React.JSX.Element {
  const colorMap: Record<AIStatus, string> = {
    idle: 'rgba(16, 185, 129, 0.6)',
    streaming: 'rgba(96, 165, 250, 0.7)',
    error: 'rgba(239, 68, 68, 0.7)',
    indexing: 'rgba(139, 92, 246, 0.7)'
  }

  const animClass: Record<AIStatus, string> = {
    idle: '',
    streaming: 'animate-neon-pulse',
    error: 'animate-neon-pulse-red',
    indexing: 'animate-neon-pulse-purple'
  }

  return (
    <div
      className={animClass[status]}
      style={{
        position: 'relative',
        width: '32px',
        height: '32px',
        borderRadius: '10px',
        background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: 'white',
        fontSize: '15px',
        boxShadow: `0 2px 12px ${colorMap[status]}`,
        transition: 'box-shadow 0.5s ease',
      }}
    >
      {/* Inner glow ring */}
      <div style={{
        position: 'absolute',
        inset: '-3px',
        borderRadius: '13px',
        border: `2px solid ${colorMap[status]}`,
        opacity: status === 'idle' ? 0.3 : 0.6,
        transition: 'opacity 0.5s ease, border-color 0.5s ease',
        pointerEvents: 'none',
      }} />
      ✦
    </div>
  )
}

export function TitleBar(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)
  const [indexStats, setIndexStats] = useState<{ files: number; symbols: number; references: number } | null>(null)
  const [aiStatus, setAIStatus] = useState<AIStatus>('idle')

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
        // If symbols are being indexed, show indexing status
        if (stats && stats.symbols > 0) {
          setAIStatus((prev) => prev === 'idle' ? 'idle' : prev)
        }
      } catch {
        // Silent error
      }
    }

    fetchStats()
    // Poll every 5 seconds to keep counts live during indexing scans
    const interval = setInterval(fetchStats, 5000)
    return () => clearInterval(interval)
  }, [])

  // Listen for streaming events to update AI status
  useEffect(() => {
    if (!window.electronAPI?.chat) return
    const cleanupChunk = window.electronAPI.chat.onChunk(() => {
      setAIStatus('streaming')
    })
    const cleanupEnd = window.electronAPI.chat.onEnd(() => {
      setAIStatus('idle')
    })
    const cleanupError = window.electronAPI.chat.onError(() => {
      setAIStatus('error')
      setTimeout(() => setAIStatus('idle'), 3000)
    })
    return () => { cleanupChunk(); cleanupEnd(); cleanupError() }
  }, [])

  const statusLabel: Record<AIStatus, string> = {
    idle: 'Ready',
    streaming: 'AI Working...',
    error: 'Error',
    indexing: 'Indexing...'
  }

  const statusColor: Record<AIStatus, string> = {
    idle: 'var(--accent-green)',
    streaming: 'var(--accent-blue)',
    error: 'var(--accent-red)',
    indexing: 'var(--accent-purple)'
  }

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
        flexShrink: 0,
        position: 'relative',
        zIndex: 50,
      }}
    >
      {/* Left: Logo + Status */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <StatusRing status={aiStatus} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: '0px' }}>
          <span style={{
            fontSize: '14px',
            fontWeight: 800,
            letterSpacing: '0.04em',
            color: 'var(--text-primary)',
            lineHeight: 1.2,
          }}>
            Lumiq
          </span>
          <span style={{
            fontSize: '10px',
            fontWeight: 500,
            color: statusColor[aiStatus],
            letterSpacing: '0.02em',
            lineHeight: 1.2,
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            transition: 'color 0.3s ease',
          }}>
            <span style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: statusColor[aiStatus],
              display: 'inline-block',
              boxShadow: `0 0 6px ${statusColor[aiStatus]}`,
              transition: 'background 0.3s ease, box-shadow 0.3s ease',
            }} />
            {statusLabel[aiStatus]}
          </span>
        </div>

        {/* Index Status Badge */}
        {indexStats && indexStats.symbols > 0 && (
          <div
            title={`${indexStats.files} files, ${indexStats.symbols} symbols, ${indexStats.references} references indexed`}
            className="animate-fade-in"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              padding: '3px 10px',
              borderRadius: 'var(--radius-full)',
              background: 'rgba(139, 92, 246, 0.08)',
              border: '1px solid rgba(139, 92, 246, 0.15)',
              fontSize: '10px',
              color: '#A78BFA',
              fontWeight: 600,
              cursor: 'help',
              marginLeft: '4px',
              backdropFilter: 'blur(8px)',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M12 2a10 10 0 1 0 10 10" /><path d="M12 8v4l3 3" />
            </svg>
            <span>{indexStats.symbols.toLocaleString()} sym</span>
            <span style={{ opacity: 0.5 }}>·</span>
            <span>{indexStats.files} files</span>
          </div>
        )}
      </div>

      {/* Center: Empty for future breadcrumb */}
      <div className="titlebar-no-drag" style={{ flex: 1 }}></div>

      {/* Right: Window controls — Glass style */}
      <div
        className="titlebar-no-drag"
        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        {[
          {
            label: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="5" y1="12" x2="19" y2="12"/></svg>,
            action: () => window.electronAPI.window.minimize(),
            title: 'Minimize'
          },
          {
            label: isMaximized
              ? <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="7" width="14" height="14" rx="2"/><path d="M7 7V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-2"/></svg>
              : <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2"/></svg>,
            action: () => { window.electronAPI.window.maximize(); setIsMaximized(!isMaximized) },
            title: isMaximized ? 'Restore' : 'Maximize'
          },
          {
            label: <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>,
            action: () => window.electronAPI.window.close(),
            isDanger: true,
            title: 'Close'
          }
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.action}
            title={btn.title}
            aria-label={btn.title}
            className="transition-all duration-200 hover:scale-105 active:scale-95"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              backdropFilter: 'blur(8px)',
              WebkitBackdropFilter: 'blur(8px)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              width: '30px',
              height: '30px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: 'var(--radius-md)',
              fontSize: '12px',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              const target = e.currentTarget
              if ((btn as { isDanger?: boolean }).isDanger) {
                target.style.background = 'var(--accent-red)'
                target.style.color = 'white'
                target.style.borderColor = 'rgba(239, 68, 68, 0.5)'
                target.style.boxShadow = '0 0 16px rgba(239, 68, 68, 0.3)'
              } else {
                target.style.background = 'var(--bg-tertiary)'
                target.style.color = 'var(--text-primary)'
                target.style.borderColor = 'var(--border-glow)'
              }
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget
              target.style.background = 'var(--glass-bg)'
              target.style.color = 'var(--text-muted)'
              target.style.borderColor = 'var(--glass-border)'
              target.style.boxShadow = 'none'
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  )
}
