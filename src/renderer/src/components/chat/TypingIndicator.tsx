// ═══════════════════════════════════════════════════════════════════
// Lumiq — Typing Indicator Component (Premium Redesign v2)
// Animated pulse-glow indicator with streaming text
// ═══════════════════════════════════════════════════════════════════

import React from 'react'

export function TypingIndicator(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', padding: '8px 16px', gap: '10px', alignItems: 'flex-start' }}>
      {/* Avatar with neon pulse */}
      <div
        className="animate-neon-pulse"
        style={{
          width: '32px',
          height: '32px',
          borderRadius: '12px',
          background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '13px',
          flexShrink: 0,
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
        </svg>
      </div>

      {/* Thinking bubble with shimmer */}
      <div
        className="animate-slide-up"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '12px 20px',
          background: 'var(--ai-bubble)',
          border: '1px solid var(--border-glow)',
          borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px',
          boxShadow: 'var(--shadow-glow)',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Shimmer overlay */}
        <div
          className="animate-shimmer"
          style={{
            position: 'absolute',
            inset: 0,
            pointerEvents: 'none',
            borderRadius: 'inherit',
          }}
        />

        {/* Animated dots */}
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`animate-bounce bounce-delay-${i}`}
            style={{
              width: '7px',
              height: '7px',
              borderRadius: '50%',
              background: `linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))`,
              boxShadow: '0 0 8px rgba(59, 130, 246, 0.3)',
            }}
          />
        ))}

        <span style={{
          fontSize: '12px',
          color: 'var(--text-muted)',
          marginLeft: '6px',
          fontWeight: 500,
        }}>
          Thinking...
        </span>
      </div>
    </div>
  )
}
