// ═══════════════════════════════════════════════════════════════════
// Lumiq — Toast Notification System
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useEffect } from 'react'

type ToastType = 'success' | 'error' | 'info' | 'warning'

interface Toast {
  id: string
  type: ToastType
  title: string
  message?: string
}

const TOAST_DURATION = 4000

const icons: Record<ToastType, string> = {
  success: '✓',
  error: '✕',
  info: 'ℹ',
  warning: '⚠'
}

const colors: Record<ToastType, string> = {
  success: 'var(--accent-green)',
  error: 'var(--accent-red)',
  info: 'var(--accent-blue)',
  warning: 'var(--accent-yellow)'
}

// Global toast state
let addToastGlobal: ((toast: Omit<Toast, 'id'>) => void) | null = null

export function showToast(type: ToastType, title: string, message?: string): void {
  addToastGlobal?.({ type, title, message })
}

export function ToastContainer(): React.JSX.Element {
  const [toasts, setToasts] = useState<Toast[]>([])

  const addToast = useCallback((toast: Omit<Toast, 'id'>) => {
    const id = Date.now().toString()
    setToasts((prev) => [...prev, { ...toast, id }])
  }, [])

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id))
  }, [])

  // Register global function
  useEffect(() => {
    addToastGlobal = addToast
    return () => {
      addToastGlobal = null
    }
  }, [addToast])

  return (
    <div
      style={{
        position: 'fixed',
        top: '44px',
        right: '16px',
        zIndex: 2000,
        display: 'flex',
        flexDirection: 'column',
        gap: '8px'
      }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} onRemove={removeToast} />
      ))}
    </div>
  )
}

function ToastItem({ toast, onRemove }: { toast: Toast; onRemove: (id: string) => void }): React.JSX.Element {
  useEffect(() => {
    const timer = setTimeout(() => onRemove(toast.id), TOAST_DURATION)
    return () => clearTimeout(timer)
  }, [toast.id, onRemove])

  return (
    <div
      className="animate-slide-in-right"
      style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '10px',
        padding: '12px 16px',
        minWidth: '280px',
        maxWidth: '360px',
        boxShadow: 'var(--shadow-lg)',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start'
      }}
    >
      <span
        style={{
          color: colors[toast.type],
          fontWeight: 700,
          fontSize: '16px',
          lineHeight: 1,
          flexShrink: 0,
          marginTop: '2px'
        }}
      >
        {icons[toast.type]}
      </span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 600, fontSize: '13px' }}>{toast.title}</div>
        {toast.message && (
          <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>
            {toast.message}
          </div>
        )}
      </div>
      <button
        onClick={() => onRemove(toast.id)}
        style={{
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-muted)',
          fontSize: '14px',
          padding: '2px',
          flexShrink: 0
        }}
      >
        ✕
      </button>
    </div>
  )
}
