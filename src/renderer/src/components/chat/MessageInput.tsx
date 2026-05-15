// ═══════════════════════════════════════════════════════════════════
// Lumiq — Message Input Component
// Auto-expanding textarea with send/stop button and attachment pills
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react'
import type { AgentRoute, CustomSkill } from '@shared/types'

interface MessageInputProps {
  onSend: (message: string) => void
  onCancel: () => void
  isStreaming: boolean
  disabled?: boolean
  onTaskModeChange?: (taskMode: string | null) => void
}

export function MessageInput({ onSend, onCancel, isStreaming, disabled, onTaskModeChange }: MessageInputProps): React.JSX.Element {
  const [value, setValue] = useState('')
  const [attachments, setAttachments] = useState<string[]>([])
  const [skills, setSkills] = useState<CustomSkill[]>([])
  const [routes, setRoutes] = useState<AgentRoute[]>([])
  const [taskMode, setTaskMode] = useState<string | null>(null)
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

  useEffect(() => {
    window.electronAPI.skill.list().then((items) => setSkills(items as CustomSkill[])).catch(() => setSkills([]))
    window.electronAPI.routing.list().then((items) => setRoutes(items as AgentRoute[])).catch(() => setRoutes([]))
  }, [])

  const handleSend = useCallback(() => {
    const trimmed = value.trim()
    if (!trimmed && attachments.length === 0) return

    let finalMessage = trimmed
    if (attachments.length > 0) {
      const pathsText = attachments.map((p) => `"${p}"`).join(' ')
      // If there's text, append the paths properly, else just send paths
      if (finalMessage) {
        finalMessage = `${finalMessage}\n\nAttached paths: ${pathsText}`
      } else {
        finalMessage = `Attached paths: ${pathsText}`
      }
    }

    onSend(finalMessage)
    setValue('')
    setAttachments([])
    setTaskMode(null)
    onTaskModeChange?.(null)
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
    }
  }, [value, attachments, onSend, onTaskModeChange])

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

  const slashQuery = value.startsWith('/') ? value.slice(1).toLowerCase() : ''
  const slashItems = value.startsWith('/')
    ? [
        ...skills.map((skill) => ({ kind: 'skill' as const, label: skill.name, description: skill.description, value: skill.promptTemplate })),
        ...routes.map((route) => ({ kind: 'route' as const, label: route.taskName, description: `${route.provider}/${route.model}`, value: route.taskName })),
        { kind: 'route' as const, label: 'review', description: 'Set task mode', value: 'review' },
        { kind: 'route' as const, label: 'plan', description: 'Set task mode', value: 'plan' }
      ].filter((item) => item.label.toLowerCase().includes(slashQuery))
    : []

  const selectSlashItem = (item: { kind: 'skill' | 'route'; label: string; value: string }): void => {
    if (item.kind === 'skill') {
      setValue(item.value.includes('{{input}}') ? item.value.replace('{{input}}', '') : `${item.value}\n\n`)
    } else {
      setTaskMode(item.value)
      onTaskModeChange?.(item.value)
      setValue('')
    }
    textareaRef.current?.focus()
  }

  const handleAttach = useCallback(async (type: 'file' | 'folder') => {
    try {
      const properties = type === 'file' 
        ? ['openFile', 'multiSelections'] 
        : ['openDirectory', 'multiSelections']
      
      const result = await window.electronAPI.dialog.showOpenDialog({
        properties: properties as string[], // Cast required because we didn't type it fully in preload
        title: `Select ${type === 'file' ? 'Files' : 'Folders'} to Attach`
      })
      
      if (!result.canceled && result.filePaths.length > 0) {
        setAttachments((prev) => {
          // Avoid duplicates
          const newPaths = result.filePaths.filter(p => !prev.includes(p))
          return [...prev, ...newPaths]
        })
        textareaRef.current?.focus()
      }
    } catch (err) {
      console.error('Failed to attach:', err)
    }
  }, [])

  const removeAttachment = (pathToRemove: string) => {
    setAttachments((prev) => prev.filter((p) => p !== pathToRemove))
  }

  // Extract filename or directory name from path for display
  const getDisplayName = (path: string) => {
    const parts = path.split(/[/\\]/)
    return parts[parts.length - 1] || path
  }

  return (
    <div
      style={{
        borderTop: '1px solid var(--border)',
        padding: '12px 16px',
        background: 'var(--bg-primary)'
      }}
    >
      {taskMode && (
        <div style={{ marginBottom: '8px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '12px', color: 'var(--text-secondary)' }}>
          <span style={{ padding: '3px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '6px' }}>Task: {taskMode}</span>
          <button onClick={() => { setTaskMode(null); onTaskModeChange?.(null) }} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}>Clear</button>
        </div>
      )}
      
      {/* Attachments UI */}
      {attachments.length > 0 && (
        <div style={{ marginBottom: '8px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {attachments.map((path) => (
            <div
              key={path}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 8px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '6px',
                fontSize: '12px',
                color: 'var(--text-primary)',
                maxWidth: '200px'
              }}
              title={path}
            >
              <span style={{ color: 'var(--accent-blue)' }}>📎</span>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getDisplayName(path)}
              </span>
              <button
                onClick={() => removeAttachment(path)}
                style={{
                  background: 'none',
                  border: 'none',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '0 2px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '14px'
                }}
                onMouseOver={(e) => (e.currentTarget.style.color = 'var(--accent-red)')}
                onMouseOut={(e) => (e.currentTarget.style.color = 'var(--text-muted)')}
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {slashItems.length > 0 && (
        <div style={{ marginBottom: '8px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', overflow: 'hidden' }}>
          {slashItems.slice(0, 8).map((item) => (
            <button key={`${item.kind}-${item.label}`} onClick={() => selectSlashItem(item)} style={{ width: '100%', display: 'flex', gap: '10px', padding: '8px 10px', background: 'none', border: 'none', borderBottom: '1px solid var(--border)', color: 'var(--text-primary)', cursor: 'pointer', textAlign: 'left', fontFamily: 'var(--font-sans)' }}>
              <span style={{ width: '54px', fontSize: '11px', color: 'var(--accent-blue)', fontWeight: 700 }}>{item.kind}</span>
              <span style={{ flex: 1, fontSize: '13px' }}>/{item.label}</span>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{item.description}</span>
            </button>
          ))}
        </div>
      )}
      
      <div
        style={{
          display: 'flex',
          gap: '8px',
          alignItems: 'flex-end'
        }}
      >
        <div style={{ display: 'flex', gap: '4px', paddingBottom: '4px' }}>
          <button
            onClick={() => handleAttach('file')}
            title="Attach File(s)"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              transition: 'all var(--transition-fast)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'var(--accent-blue)' }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            📎
          </button>
          <button
            onClick={() => handleAttach('folder')}
            title="Attach Folder(s)"
            style={{
              width: '36px',
              height: '36px',
              borderRadius: '8px',
              background: 'var(--bg-tertiary)',
              color: 'var(--text-secondary)',
              border: '1px solid var(--border)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '16px',
              transition: 'all var(--transition-fast)'
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'var(--accent-blue)' }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            📁
          </button>
        </div>
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
            disabled={(!value.trim() && attachments.length === 0) || disabled}
            title="Send message (Enter)"
            aria-label="Send message"
            style={{
              width: '44px',
              height: '44px',
              borderRadius: '10px',
              background: (value.trim() || attachments.length > 0) ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
              color: (value.trim() || attachments.length > 0) ? 'white' : 'var(--text-muted)',
              border: 'none',
              cursor: (value.trim() || attachments.length > 0) ? 'pointer' : 'not-allowed',
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

