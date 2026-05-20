// ═══════════════════════════════════════════════════════════════════
// Lumiq — Input Component
// ═══════════════════════════════════════════════════════════════════

import React from 'react'

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string
  error?: string
  icon?: React.ReactNode
}

export function Input({ label, error, icon, style, ...props }: InputProps): React.JSX.Element {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {label && (
        <label
          style={{
            fontSize: '13px',
            fontWeight: 500,
            color: 'var(--text-secondary)'
          }}
        >
          {label}
        </label>
      )}
      <div style={{ position: 'relative' }}>
        {icon && (
          <span
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center'
            }}
          >
            {icon}
          </span>
        )}
        <input
          style={{
            width: '100%',
            padding: icon ? '8px 12px 8px 36px' : '8px 12px',
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            color: 'var(--text-primary)',
            background: 'var(--bg-tertiary)',
            border: `1px solid ${error ? 'var(--accent-red)' : 'var(--border)'}`,
            borderRadius: '8px',
            outline: 'none',
            transition: 'border-color var(--transition-fast)',
            ...style
          }}
          {...props}
        />
      </div>
      {error && (
        <span style={{ fontSize: '12px', color: 'var(--accent-red)' }}>{error}</span>
      )}
    </div>
  )
}
