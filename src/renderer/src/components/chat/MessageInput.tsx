// ═══════════════════════════════════════════════════════════════════
// Lumiq — Message Input Component (Premium Redesign v2)
// Floating glass card · Dynamic border glow · Arc budget visualizer
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react'
import type { AgentRoute, CustomSkill, CustomCommand } from '@shared/types'
import { useChatStore } from '@renderer/store/chatStore'
import { useSessionStore } from '@renderer/store/sessionStore'

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
  const [commands, setCommands] = useState<CustomCommand[]>([])
  const [routes, setRoutes] = useState<AgentRoute[]>([])
  const [taskMode, setTaskMode] = useState<string | null>(null)
  const [isFocused, setIsFocused] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Token and cost estimations for the interactive budget visualizer
  const messages = useChatStore((s) => s.messages)
  const { activeSessionId, sessions } = useSessionStore()
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const modelName = activeSession?.model || 'default'

  const estimateInputTokens = (text: string) => Math.ceil(text.length / 4)
  const estimateMessagesTokens = (msgs: typeof messages) => {
    let charCount = 0
    for (const m of msgs) {
      charCount += m.role.length + 2
      charCount += m.content.length
      if (m.toolName) charCount += m.toolName.length + 5
      if (m.toolResult) charCount += m.toolResult.length
      if (m.toolInput) charCount += JSON.stringify(m.toolInput).length
    }
    return Math.ceil(charCount / 4)
  }

  const totalTokenEstimate = estimateMessagesTokens(messages) + estimateInputTokens(value)

  const getCostPerToken = (model: string) => {
    const name = model.toLowerCase()
    if (name.includes('sonnet') || name.includes('claude')) return 3.0 / 1000000
    if (name.includes('gpt-4o')) return 5.0 / 1000000
    if (name.includes('gemini-1.5-pro') || name.includes('pro')) return 1.25 / 1000000
    if (name.includes('gemini-1.5-flash') || name.includes('flash')) return 0.075 / 1000000
    return 1.0 / 1000000
  }

  const getContextLimit = (model: string) => {
    const name = model.toLowerCase()
    if (name.includes('gemini-1.5-pro') || name.includes('pro')) return 1000000
    if (name.includes('gemini-1.5-flash') || name.includes('flash')) return 1000000
    if (name.includes('sonnet') || name.includes('claude')) return 200000
    if (name.includes('gpt-4o') || name.includes('gpt-4-turbo') || name.includes('gpt-4')) return 128000
    if (name.includes('gpt-3.5') || name.includes('o1') || name.includes('o3')) return 128000
    if (name.includes('deepseek') || name.includes('minimax') || name.includes('llama') || name.includes('nemotron') || name.includes('step-') || name.includes('stepfun')) {
      return 128000
    }
    return 128000 // Default to 128k fallback limit for unknown models to prevent API context errors
  }

  const contextLimit = getContextLimit(modelName)
  const estimatedCost = totalTokenEstimate * getCostPerToken(modelName)
  const budgetPercent = Math.min(100, (totalTokenEstimate / contextLimit) * 100)
  const budgetColor = budgetPercent > 80 ? 'var(--accent-red)' : budgetPercent > 50 ? 'var(--accent-yellow)' : 'var(--accent-blue)'

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
    if (window.electronAPI?.skill?.list) {
      window.electronAPI.skill.list().then((items) => setSkills(items as CustomSkill[])).catch(() => setSkills([]))
    }
    if (window.electronAPI?.command?.list) {
      window.electronAPI.command.list().then((items) => setCommands(items as CustomCommand[])).catch(() => setCommands([]))
    }
    if (window.electronAPI?.routing?.list) {
      window.electronAPI.routing.list().then((items) => setRoutes(items as AgentRoute[])).catch(() => setRoutes([]))
    }
  }, [])

  // Consume draft messages injected by other components (e.g. problems panel)
  const draftMessage = useChatStore(s => s.draftMessage)
  useEffect(() => {
    if (draftMessage) {
      setValue(draftMessage)
      useChatStore.getState().setDraftMessage(null)
      setTimeout(() => textareaRef.current?.focus(), 50)
    }
  }, [draftMessage])

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

  const handlePaste = useCallback(
    (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const files = e.clipboardData?.files
      const items = e.clipboardData?.items

      // 1. Check if there are files with system paths (e.g. copied from file explorer)
      if (files && files.length > 0) {
        const filePaths: string[] = []
        for (let i = 0; i < files.length; i++) {
          const file = files[i]
          const path = (file as any).path
          if (path) {
            filePaths.push(path)
          }
        }

        if (filePaths.length > 0) {
          e.preventDefault()
          setAttachments((prev) => {
            const newPaths = filePaths.filter((p) => !prev.includes(p))
            return [...prev, ...newPaths]
          })
          return // Handled
        }
      }

      // 2. Check if there is a raw clipboard image (e.g. screenshot or copied image from browser)
      let hasImage = false
      if (items) {
        for (let i = 0; i < items.length; i++) {
          if (items[i].type.startsWith('image/')) {
            hasImage = true
            break
          }
        }
      }

      if (hasImage) {
        e.preventDefault()
        window.electronAPI.clipboard.saveImage()
          .then((savedPath) => {
            if (savedPath) {
              setAttachments((prev) => {
                if (prev.includes(savedPath)) return prev
                return [...prev, savedPath]
              })
            }
          })
          .catch((err) => {
            console.error('Failed to paste clipboard image:', err)
          })
      }
    },
    []
  )

  const slashQuery = value.startsWith('/') ? value.slice(1).toLowerCase() : ''
  const slashItems = value.startsWith('/')
    ? [
        { kind: 'cmd' as const, label: 'clear', description: 'Clear all messages in current session', value: '/clear' },
        { kind: 'cmd' as const, label: 'compact', description: 'Keep only recent context (last 5 messages)', value: '/compact' },
        { kind: 'cmd' as const, label: 'new', description: 'Start a new chat session', value: '/new' },
        ...skills.map((skill) => ({ kind: 'skill' as const, label: skill.name, description: skill.description, value: skill.promptTemplate })),
        ...commands.map((cmd) => ({ kind: 'cmd' as const, label: cmd.name, description: cmd.description || (cmd.type === 'shell' ? 'Execute in terminal' : 'Inject prompt'), value: cmd.command })),
        ...routes.map((route) => ({ kind: 'route' as const, label: route.taskName, description: `${route.provider}/${route.model}`, value: route.taskName })),
        { kind: 'route' as const, label: 'review', description: 'Set task mode', value: 'review' },
        { kind: 'route' as const, label: 'plan', description: 'Set task mode', value: 'plan' }
      ].filter((item) => item.label.toLowerCase().includes(slashQuery))
    : []

  const selectSlashItem = (item: { kind: 'skill' | 'route' | 'cmd'; label: string; value: string }): void => {
    if (item.kind === 'skill') {
      setValue(item.value.includes('{{input}}') ? item.value.replace('{{input}}', '') : `${item.value}\n\n`)
    } else if (item.kind === 'route') {
      setTaskMode(item.value)
      onTaskModeChange?.(item.value)
      setValue('')
    } else if (item.kind === 'cmd') {
      if (item.label === 'clear' || item.label === 'compact' || item.label === 'new') {
        onSend(item.value)
        setValue('')
      } else {
        // Custom command (treat like skill injection for now, or just send directly)
        setValue(item.value)
      }
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

  // Dynamic border glow based on state
  const getBorderStyle = () => {
    if (isStreaming) return { borderColor: 'rgba(239, 68, 68, 0.3)', boxShadow: '0 0 20px rgba(239, 68, 68, 0.06)' }
    if (isFocused) return { borderColor: 'rgba(96, 165, 250, 0.4)', boxShadow: '0 0 24px rgba(96, 165, 250, 0.08), 0 8px 32px rgba(0,0,0,0.06)' }
    return { borderColor: 'var(--border)', boxShadow: 'var(--shadow-float)' }
  }

  const kindBadgeColors: Record<string, string> = {
    cmd: 'var(--accent-green)',
    skill: 'var(--accent-purple)',
    route: 'var(--accent-cyan)',
  }

  return (
    <div
      className="glass-card noise-overlay"
      style={{
        padding: '12px 14px',
        borderRadius: 'var(--radius-xl)',
        transition: 'border-color 0.3s ease, box-shadow 0.3s ease',
        ...getBorderStyle(),
      }}
    >
      {taskMode && (
        <div className="animate-slide-down" style={{
          marginBottom: '10px',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontSize: '12px',
          color: 'var(--text-secondary)',
        }}>
          <span style={{
            padding: '3px 10px',
            background: 'rgba(6, 182, 212, 0.1)',
            border: '1px solid rgba(6, 182, 212, 0.2)',
            borderRadius: 'var(--radius-full)',
            fontWeight: 600,
            fontSize: '11px',
            color: 'var(--accent-cyan)',
          }}>
            ⚡ {taskMode}
          </span>
          <button
            onClick={() => { setTaskMode(null); onTaskModeChange?.(null) }}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--text-muted)',
              fontSize: '11px',
              fontWeight: 500,
              transition: 'color 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-red)'}
            onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
          >
            Clear
          </button>
        </div>
      )}
      
      {/* Attachments UI */}
      {attachments.length > 0 && (
        <div style={{ marginBottom: '10px', display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
          {attachments.map((path) => (
            <div
              key={path}
              className="animate-scale-in"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 10px',
                background: 'rgba(59, 130, 246, 0.06)',
                border: '1px solid rgba(59, 130, 246, 0.15)',
                borderRadius: 'var(--radius-full)',
                fontSize: '11px',
                color: 'var(--text-primary)',
                maxWidth: '200px',
              }}
              title={path}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
              </svg>
              <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {getDisplayName(path)}
              </span>
              <button
                onClick={() => removeAttachment(path)}
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '0',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-red)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                </svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Slash command palette */}
      {slashItems.length > 0 && (
        <div
          className="animate-slide-up"
          style={{
            marginBottom: '10px',
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg)',
            overflow: 'hidden',
            boxShadow: 'var(--shadow-lg)',
            maxHeight: '280px',
            overflowY: 'auto',
          }}
        >
          <div style={{
            padding: '6px 12px',
            fontSize: '10px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.08em',
            borderBottom: '1px solid var(--border)',
          }}>
            Commands
          </div>
          {slashItems.slice(0, 8).map((item) => (
            <button
              key={`${item.kind}-${item.label}`}
              onClick={() => selectSlashItem(item)}
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '10px 12px',
                background: 'none',
                border: 'none',
                borderBottom: '1px solid var(--border)',
                cursor: 'pointer',
                textAlign: 'left',
                color: 'var(--text-primary)',
                transition: 'background 0.15s',
                fontSize: '13px',
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
            >
              <span style={{
                fontSize: '9px',
                fontWeight: 800,
                color: kindBadgeColors[item.kind] || 'var(--accent-blue)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
                padding: '2px 6px',
                borderRadius: 'var(--radius-sm)',
                background: `${kindBadgeColors[item.kind] || 'var(--accent-blue)'}15`,
                border: `1px solid ${kindBadgeColors[item.kind] || 'var(--accent-blue)'}30`,
              }}>
                {item.kind}
              </span>
              <span style={{ fontWeight: 600 }}>/{item.label}</span>
              <span style={{ flex: 1, fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {item.description}
              </span>
            </button>
          ))}
        </div>
      )}
      
      <div style={{ display: 'flex', gap: '8px', alignItems: 'flex-end' }}>
        {/* Attach buttons */}
        <div style={{ display: 'flex', gap: '4px', paddingBottom: '2px', flexShrink: 0 }}>
          <button
            onClick={() => handleAttach('file')}
            title="Attach File(s)"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-md)',
              background: 'none',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent-blue)'
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.background = 'none'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/>
            </svg>
          </button>
          <button
            onClick={() => handleAttach('folder')}
            title="Attach Folder"
            style={{
              width: '34px',
              height: '34px',
              borderRadius: 'var(--radius-md)',
              background: 'none',
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--text-muted)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.color = 'var(--accent-blue)'
              e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
              e.currentTarget.style.background = 'rgba(59, 130, 246, 0.06)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.color = 'var(--text-muted)'
              e.currentTarget.style.borderColor = 'var(--border)'
              e.currentTarget.style.background = 'none'
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
            </svg>
          </button>
        </div>

        {/* Textarea */}
        <textarea
          ref={textareaRef}
          id="input-message"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder="Message Lumiq... (Enter to send, / for commands)"
          disabled={disabled}
          style={{
            flex: 1,
            minHeight: '40px',
            maxHeight: '200px',
            padding: '8px 14px',
            background: 'transparent',
            border: 'none',
            borderRadius: 'var(--radius-md)',
            fontSize: '14px',
            color: 'var(--text-primary)',
            resize: 'none',
            outline: 'none',
            fontFamily: 'var(--font-sans)',
            lineHeight: 1.5,
            overflow: 'auto',
          }}
        />

        {/* Send / Stop button */}
        {isStreaming ? (
          <button
            id="btn-stop-streaming"
            onClick={onCancel}
            title="Stop Streaming (Esc)"
            className="animate-neon-pulse-red"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              background: 'rgba(239, 68, 68, 0.1)',
              border: '1px solid rgba(239, 68, 68, 0.3)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--accent-red)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
              <rect x="6" y="6" width="12" height="12" rx="2"/>
            </svg>
          </button>
        ) : (
          <button
            id="btn-send-message"
            onClick={handleSend}
            disabled={(!value.trim() && attachments.length === 0) || disabled}
            title="Send Message (Enter)"
            style={{
              width: '40px',
              height: '40px',
              borderRadius: 'var(--radius-md)',
              border: 'none',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: (!value.trim() && attachments.length === 0) || disabled ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
              flexShrink: 0,
              background: (!value.trim() && attachments.length === 0)
                ? 'var(--bg-tertiary)'
                : 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))',
              color: (!value.trim() && attachments.length === 0) ? 'var(--text-muted)' : 'white',
              boxShadow: (!value.trim() && attachments.length === 0) ? 'none' : '0 4px 16px rgba(59, 130, 246, 0.25)',
              opacity: disabled ? 0.5 : 1,
            }}
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/>
            </svg>
          </button>
        )}
      </div>
      
      {/* Token Budget Visualizer */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: '10px',
        fontSize: '10px',
        color: 'var(--text-muted)',
        paddingTop: '8px',
        borderTop: '1px solid var(--border)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          {/* Mini arc/ring visualizer */}
          <svg width="20" height="20" viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
            <circle cx="18" cy="18" r="14" fill="none" stroke="var(--border)" strokeWidth="3" />
            <circle
              cx="18" cy="18" r="14"
              fill="none"
              stroke={budgetColor}
              strokeWidth="3"
              strokeDasharray={`${budgetPercent * 0.88} 88`}
              strokeLinecap="round"
              style={{ transition: 'stroke-dasharray 0.5s ease, stroke 0.3s ease' }}
            />
          </svg>
          <span>
            <strong>{totalTokenEstimate.toLocaleString()}</strong>
            <span style={{ opacity: 0.6 }}> / {contextLimit >= 1000000 ? '1M' : `${(contextLimit / 1000).toFixed(0)}K`}</span>
          </span>
        </div>
        <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
          <span style={{ opacity: 0.6 }}>≈</span>
          <strong>${estimatedCost.toFixed(5)}</strong>
        </span>
      </div>
    </div>
  )
}
