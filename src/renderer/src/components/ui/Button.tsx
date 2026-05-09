// ═══════════════════════════════════════════════════════════════════
// Lumiq — Button Component
// ═══════════════════════════════════════════════════════════════════

import React from 'react'

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger'
  size?: 'sm' | 'md' | 'lg'
  isLoading?: boolean
  children: React.ReactNode
}

const styles: Record<string, React.CSSProperties> = {
  base: {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontFamily: 'var(--font-sans)',
    fontWeight: 500,
    borderRadius: '8px',
    cursor: 'pointer',
    transition: 'all var(--transition-fast)',
    border: 'none',
    outline: 'none',
    whiteSpace: 'nowrap' as const
  },
  primary: {
    background: 'var(--accent-blue)',
    color: 'white'
  },
  secondary: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)'
  },
  outline: {
    background: 'transparent',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)'
  },
  ghost: {
    background: 'transparent',
    color: 'var(--text-secondary)'
  },
  danger: {
    background: 'var(--accent-red)',
    color: 'white'
  },
  sm: { padding: '4px 10px', fontSize: '12px' },
  md: { padding: '8px 16px', fontSize: '14px' },
  lg: { padding: '10px 20px', fontSize: '15px' },
  disabled: { opacity: 0.5, cursor: 'not-allowed' }
}

export function Button({
  variant = 'primary',
  size = 'md',
  isLoading = false,
  children,
  disabled,
  style,
  ...props
}: ButtonProps): React.JSX.Element {
  return (
    <button
      style={{
        ...styles.base,
        ...styles[variant],
        ...styles[size],
        ...(disabled || isLoading ? styles.disabled : {}),
        ...style
      }}
      disabled={disabled || isLoading}
      {...props}
    >
      {isLoading && (
        <span
          style={{
            width: '14px',
            height: '14px',
            border: '2px solid currentColor',
            borderTopColor: 'transparent',
            borderRadius: '50%',
            display: 'inline-block'
          }}
          className="animate-spin"
        />
      )}
      {children}
    </button>
  )
}
