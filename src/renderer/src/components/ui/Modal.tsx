// ═══════════════════════════════════════════════════════════════════
// Lumiq — Modal Component
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useCallback } from 'react'

interface ModalProps {
  isOpen: boolean
  onClose: () => void
  title?: string
  children: React.ReactNode
  width?: number
}

export function Modal({ isOpen, onClose, title, children, width = 480 }: ModalProps): React.JSX.Element | null {
  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    },
    [onClose]
  )

  useEffect(() => {
    if (!isOpen) return

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, handleKeyDown])

  if (!isOpen) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0, 0, 0, 0.5)',
        backdropFilter: 'blur(4px)'
      }}
      className="animate-fade-in"
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--bg-primary)',
          borderRadius: '12px',
          boxShadow: 'var(--shadow-xl)',
          width: `min(${width}px, 90vw)`,
          maxHeight: '85vh',
          overflow: 'auto',
          border: '1px solid var(--border)'
        }}
        className="animate-modal-in"
        onClick={(e) => e.stopPropagation()}
      >
        {title && (
          <div
            style={{
              padding: '16px 20px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between'
            }}
          >
            <h2 style={{ fontSize: '16px', fontWeight: 600 }}>{title}</h2>
            <button
              onClick={onClose}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: '18px',
                padding: '4px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                borderRadius: '4px',
                transition: 'color var(--transition-fast)'
              }}
              aria-label="Close modal"
            >
              ✕
            </button>
          </div>
        )}
        <div style={{ padding: '20px' }}>{children}</div>
      </div>
    </div>
  )
}
