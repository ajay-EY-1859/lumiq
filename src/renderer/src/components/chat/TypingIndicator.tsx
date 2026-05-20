// ═══════════════════════════════════════════════════════════════════
// Lumiq — Typing Indicator Component
// ═══════════════════════════════════════════════════════════════════

import React from 'react'

export function TypingIndicator(): React.JSX.Element {
  return (
    <div style={{ display: 'flex', padding: '8px 16px', gap: '8px' }}>
      {/* Avatar */}
      <div
        style={{
          width: '28px',
          height: '28px',
          borderRadius: '50%',
          background: 'var(--bg-tertiary)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '14px',
          flexShrink: 0
        }}
      >
        ✦
      </div>

      {/* Dots */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: '12px 16px',
          background: 'var(--ai-bubble)',
          border: '1px solid var(--border)',
          borderRadius: '12px 12px 12px 4px'
        }}
      >
        {[1, 2, 3].map((i) => (
          <div
            key={i}
            className={`animate-bounce bounce-delay-${i}`}
            style={{
              width: '6px',
              height: '6px',
              borderRadius: '50%',
              background: 'var(--accent-blue)'
            }}
          />
        ))}
      </div>
    </div>
  )
}
