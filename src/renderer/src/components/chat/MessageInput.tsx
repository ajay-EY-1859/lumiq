// ═══════════════════════════════════════════════════════════════════
// Lumiq — Message Input Component
// Auto-expanding textarea with send/stop button and attachment pills
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useRef, useCallback, useEffect } from 'react'
import type { AgentRoute, CustomSkill, CustomCommand } from '@shared/types'
import { useChatStore } from '@renderer/store/chatStore'

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
        }
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

  return (
    <div className="px-4 py-3 bg-white/10 dark:bg-black/20 backdrop-blur-xl border-t border-[var(--border)] rounded-b-2xl">
      {taskMode && (
        <div className="mb-2 flex items-center gap-2 text-xs text-[var(--text-secondary)]">
          <span className="px-2.5 py-1 bg-[var(--bg-tertiary)] border border-[var(--border)] rounded-md font-medium shadow-sm">Task: {taskMode}</span>
          <button onClick={() => { setTaskMode(null); onTaskModeChange?.(null) }} className="text-[var(--text-muted)] hover:text-[var(--accent-red)] transition-colors">Clear</button>
        </div>
      )}
      
      {/* Attachments UI */}
      {attachments.length > 0 && (
        <div className="mb-2 flex flex-wrap gap-2">
          {attachments.map((path) => (
            <div
              key={path}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-black/5 dark:bg-white/5 border border-[var(--border)] rounded-md text-xs text-[var(--text-primary)] max-w-[200px] shadow-sm backdrop-blur-md"
              title={path}
            >
              <svg className="w-3.5 h-3.5 text-[var(--accent-blue)]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
              <span className="truncate">
                {getDisplayName(path)}
              </span>
              <button
                onClick={() => removeAttachment(path)}
                className="ml-auto text-[var(--text-muted)] hover:text-red-500 hover:bg-red-500/10 rounded-full p-0.5 transition-colors flex items-center justify-center"
              >
                <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
              </button>
            </div>
          ))}
        </div>
      )}

      {slashItems.length > 0 && (
        <div className="mb-2 bg-[var(--bg-secondary)] border border-[var(--border)] rounded-xl overflow-hidden shadow-lg backdrop-blur-xl">
          {slashItems.slice(0, 8).map((item) => (
            <button key={`${item.kind}-${item.label}`} onClick={() => selectSlashItem(item)} className="w-full flex gap-3 px-3 py-2.5 border-b border-[var(--border)] last:border-0 hover:bg-black/5 dark:hover:bg-white/5 text-left text-[var(--text-primary)] transition-colors">
              <span className="w-14 text-[10px] font-bold text-[var(--accent-blue)] uppercase tracking-wider mt-0.5">{item.kind}</span>
              <span className="flex-1 text-[13px] font-medium">/{item.label}</span>
              <span className="text-xs text-[var(--text-muted)] truncate max-w-[200px]">{item.description}</span>
            </button>
          ))}
        </div>
      )}
      
      <div className="flex gap-2 items-end relative">
        <div className="flex gap-1.5 pb-1 shrink-0">
          <button
            onClick={() => handleAttach('file')}
            title="Attach File(s)"
            className="h-9 px-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-[var(--accent-blue)] hover:text-white border border-[var(--border)] hover:border-[var(--accent-blue)] flex items-center justify-center gap-1.5 text-[var(--text-secondary)] transition-all duration-200 shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"></path><polyline points="13 2 13 9 20 9"></polyline></svg>
            <span className="text-xs font-medium">File</span>
          </button>
          <button
            onClick={() => handleAttach('folder')}
            title="Attach Folder"
            className="h-9 px-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-[var(--accent-blue)] hover:text-white border border-[var(--border)] hover:border-[var(--accent-blue)] flex items-center justify-center gap-1.5 text-[var(--text-secondary)] transition-all duration-200 shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            <span className="text-xs font-medium">Folder</span>
          </button>
        </div>
        <textarea
          ref={textareaRef}
          id="input-message"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Message... (Enter to send, Shift+Enter for new line)"
          disabled={disabled}
          className="flex-1 min-h-[44px] max-h-[200px] py-2.5 px-4 bg-black/5 dark:bg-white/5 border border-[var(--border)] rounded-xl text-[14px] text-[var(--text-primary)] resize-none outline-none focus:border-[var(--accent-blue)] focus:ring-2 focus:ring-[var(--accent-blue)] focus:ring-opacity-20 transition-all duration-200 overflow-auto shadow-inner"
        />

        {isStreaming ? (
          <button
            id="btn-stop-streaming"
            onClick={onCancel}
            title="Stop Streaming"
            className="h-10 px-4 rounded-xl bg-red-500/10 hover:bg-red-500 hover:text-white border border-red-500/20 flex items-center justify-center gap-2 text-red-500 transition-all duration-200 shadow-sm shrink-0"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect></svg>
            <span className="text-sm font-bold">Stop</span>
          </button>
        ) : (
          <button
            id="btn-send-message"
            onClick={handleSend}
            disabled={(!value.trim() && attachments.length === 0) || disabled}
            title="Send Message"
            className={`h-10 px-4 rounded-xl border flex items-center justify-center gap-2 transition-all duration-200 shadow-md shrink-0 ${
              !value.trim() && attachments.length === 0
                ? 'bg-black/5 dark:bg-white/5 border-[var(--border)] text-[var(--text-muted)] cursor-not-allowed'
                : 'bg-gradient-to-r from-[var(--accent-blue)] to-cyan-500 border-transparent text-white hover:shadow-lg hover:scale-[1.02] active:scale-95'
            }`}
          >
            <span className="text-sm font-bold">Send</span>
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
          </button>
        )}
      </div>
    </div>
  )
}
