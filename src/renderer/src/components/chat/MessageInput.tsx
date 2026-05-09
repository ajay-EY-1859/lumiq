// ═══════════════════════════════════════════════════════════════════
// Lumiq — Message Input Component
// Auto-expanding textarea with send/stop button
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react'

interface MessageInputProps {
  onSend: (message: string) => void
  onCancel: () => void
  isStreaming: boolean
  disabled?: boolean
}

export function MessageInput({ onSend, onCancel, isStreaming, disabled }: MessageInputProps): React.JSX.Element {
  const [value, setValue] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const adjustHeight = useCallback(() => {
    const textarea = textareaRef.current
    if (!textarea) return
    textarea.style.height = 'auto'
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px'
  }, [])

  useEffect(() => {
    adjustHeight()
  }, [value, adjustHeight])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed) return
    onSend(trimmed)
    setValue('')
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, onSend])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        if (!isStreaming) handleSend()
      }
      if (e.key === 'Escape' && isStreaming) {
        onCancel()
      }
    },
    [handleSend, isStreaming, onCancel]
  )

  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        padding: '12px 16px',
        background: 'var(--bg-primary)'
      }}
    >
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end'
        }}
      >
        <textarea
          ref={textareaRef}
          id="input-message"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Message... (Enter to send, Shift+Enter for new line)"
          disabled={disabled}
          style={{
            flex: 1,
            minHeight: '44px',
            maxHeight: '200px',
            padding: '10px 14px',
            background: 'var(--bg-tertiary)',
            border: '1px solid var(--border)',
            borderRadius: '10px',
            color: 'var(--text-primary)',
            fontSize: '14px',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.5,
            resize: 'none',
            outline: 'none',
            transition: 'border-color var(--transition-fast)',
            overflow: 'auto'
          }}
          onFocus={(e) => {
            e.currentTarget.style.borderColor = 'var(--accent-blue)'
          }}
          onBlur={(e) => {
            e.currentTarget.style.borderColor = 'var(--border)'
          }}
        />

        {isStreaming ? (
          <button
            id="btn-stop-streaming"
            onClick={onCancel}
            title="Stop generating (Escape)"
            aria-label="Stop generating"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: 'var(--accent-red)',
              color: 'white',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              flexShrink: 0,
              transition: 'transform var(--transition-fast)'
            }}
          >
            ■
          </button>
        ) : (
          <button
            id="btn-send-message"
            onClick={handleSend}
            disabled={!value.trim() || disabled}
            title="Send message (Enter)"
            aria-label="Send message"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: value.trim() ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
              color: value.trim() ? 'white' : 'var(--text-muted)',
              border: 'none',
              cursor: value.trim() ? 'pointer' : 'not-allowed',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              flexShrink: 0,
              transition: 'all var(--transition-fast)'
            }}
          >
            ➤
          </button>
        )}
      </div>
    </div>
  )
}
