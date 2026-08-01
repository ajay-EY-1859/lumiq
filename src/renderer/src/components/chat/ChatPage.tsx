// ═══════════════════════════════════════════════════════════════════
// Lumiq — ChatPage Component (Premium Redesign v2)
// Aurora empty state · Gradient mesh background · Glass panels
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useCallback, useState, useMemo } from 'react'
import { useChatStore } from '@renderer/store/chatStore'
import { useSessionStore } from '@renderer/store/sessionStore'
import { useProviderStore } from '@renderer/store/providerStore'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { TypingIndicator } from './TypingIndicator'
import { ToolApprovalDialog } from './ToolApprovalDialog'
import { SelfHealingPanel } from './SelfHealingPanel'
import { Button } from '@renderer/components/ui/Button'
import type { ToolApprovalRequest } from '@shared/types'

// Sub-component to isolate streaming re-renders from the main ChatPage tree
const StreamingBubble = React.memo(function StreamingBubble({
  activeSessionId,
  messagesEndRef
}: {
  activeSessionId: string
  messagesEndRef: React.RefObject<HTMLDivElement | null>
}): React.JSX.Element | null {
  const isStreaming = useChatStore((s) => s.isStreaming)
  const streamingContent = useChatStore((s) => s.streamingContent)

  useEffect(() => {
    if (isStreaming) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [isStreaming, streamingContent, messagesEndRef])

  if (!isStreaming) return null

  if (!streamingContent) {
    return <div className="ml-4"><TypingIndicator /></div>
  }

  return (
    <MessageBubble
      message={{
        id: 'streaming',
        sessionId: activeSessionId,
        role: 'assistant',
        content: streamingContent,
        createdAt: new Date().toISOString()
      }}
    />
  )
})

// ── Scroll-to-bottom FAB ──────────────────────────────────────────
function ScrollToBottomFAB({ onClick, count }: { onClick: () => void; count: number }): React.JSX.Element {
  return (
    <button
      onClick={onClick}
      className="animate-slide-up"
      style={{
        position: 'absolute',
        bottom: '90px',
        right: '24px',
        width: '36px',
        height: '36px',
        borderRadius: 'var(--radius-full)',
        background: 'var(--glass-bg)',
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        border: '1px solid var(--glass-border)',
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        boxShadow: 'var(--shadow-float)',
        transition: 'all 0.2s ease',
        zIndex: 20,
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.background = 'var(--accent-blue)'
        e.currentTarget.style.color = 'white'
        e.currentTarget.style.boxShadow = '0 0 20px rgba(59, 130, 246, 0.3)'
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.background = 'var(--glass-bg)'
        e.currentTarget.style.color = 'var(--text-secondary)'
        e.currentTarget.style.boxShadow = 'var(--shadow-float)'
      }}
      title="Scroll to bottom"
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="6 9 12 15 18 9"/>
      </svg>
      {count > 0 && (
        <span style={{
          position: 'absolute',
          top: '-6px',
          right: '-6px',
          width: '18px',
          height: '18px',
          borderRadius: '50%',
          background: 'var(--accent-blue)',
          color: 'white',
          fontSize: '10px',
          fontWeight: 700,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 8px rgba(59, 130, 246, 0.4)',
        }}>
          {count > 9 ? '9+' : count}
        </span>
      )}
    </button>
  )
}

// ── Aurora Welcome Screen ─────────────────────────────────────────
function AuroraWelcome({
  onSend,
  cancelStream,
  isStreaming,
  error,
  setError,
  setTaskMode,
}: {
  onSend: (msg: string) => void
  cancelStream: () => void
  isStreaming: boolean
  error: string | null
  setError: (e: string | null) => void
  setTaskMode: (m: string | null) => void
}): React.JSX.Element {
  const quickActions = [
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>,
      title: 'New Chat',
      subtitle: 'Start a conversation',
      gradient: 'linear-gradient(135deg, rgba(59,130,246,0.15), rgba(6,182,212,0.1))',
      borderColor: 'rgba(59,130,246,0.2)',
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M13 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V9z"/><polyline points="13 2 13 9 20 9"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
      title: 'Analyze Code',
      subtitle: 'Review files & patterns',
      gradient: 'linear-gradient(135deg, rgba(139,92,246,0.15), rgba(244,63,94,0.1))',
      borderColor: 'rgba(139,92,246,0.2)',
    },
    {
      icon: <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.26.66.8 1.13 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
      title: 'Build Project',
      subtitle: 'Scaffold & compile',
      gradient: 'linear-gradient(135deg, rgba(16,185,129,0.15), rgba(59,130,246,0.1))',
      borderColor: 'rgba(16,185,129,0.2)',
    },
  ]

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 text-[var(--text-muted)] bg-transparent relative overflow-hidden">
      {/* Aurora mesh background */}
      <div
        className="animate-aurora"
        style={{
          position: 'absolute',
          inset: 0,
          background: `
            radial-gradient(ellipse at 20% 50%, hsla(228,80%,55%,0.12) 0%, transparent 60%),
            radial-gradient(ellipse at 80% 20%, hsla(280,70%,55%,0.10) 0%, transparent 60%),
            radial-gradient(ellipse at 50% 80%, hsla(200,100%,50%,0.08) 0%, transparent 60%),
            radial-gradient(ellipse at 90% 90%, hsla(340,80%,55%,0.06) 0%, transparent 50%)
          `,
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* Logo with shimmer */}
      <div className="animate-scale-in" style={{ position: 'relative', zIndex: 1 }}>
        <div
          className="animate-float"
          style={{
            width: '80px',
            height: '80px',
            borderRadius: '24px',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple), var(--accent-cyan))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '36px',
            color: 'white',
            boxShadow: '0 8px 32px rgba(59, 130, 246, 0.25), 0 0 60px rgba(139, 92, 246, 0.1)',
            position: 'relative',
          }}
        >
          {/* Glow ring */}
          <div style={{
            position: 'absolute',
            inset: '-6px',
            borderRadius: '28px',
            border: '2px solid rgba(96, 165, 250, 0.15)',
            animation: 'neonPulse 3s ease-in-out infinite',
          }} />
          ✦
        </div>
      </div>

      <div className="animate-slide-up" style={{ textAlign: 'center', position: 'relative', zIndex: 1 }}>
        <div style={{
          fontSize: '28px',
          fontWeight: 800,
          letterSpacing: '-0.02em',
          color: 'var(--text-primary)',
          marginBottom: '6px',
        }}>
          Welcome to <span className="shimmer-text">Lumiq</span>
        </div>
        <div style={{
          fontSize: '14px',
          maxWidth: '400px',
          textAlign: 'center',
          color: 'var(--text-secondary)',
          lineHeight: 1.6,
        }}>
          Your AI-powered coding companion. Start a conversation or pick a quick action below.
        </div>
      </div>

      {/* Quick action cards */}
      <div className="animate-slide-up" style={{
        display: 'flex',
        gap: '12px',
        position: 'relative',
        zIndex: 1,
        marginTop: '8px',
        animationDelay: '150ms',
      }}>
        {quickActions.map((action, i) => (
          <button
            key={i}
            className="glass-card"
            style={{
              width: '160px',
              padding: '20px 16px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              background: action.gradient,
              border: `1px solid ${action.borderColor}`,
              borderRadius: 'var(--radius-lg)',
              color: 'var(--text-primary)',
              transition: 'all 0.3s ease',
              animation: `slideUp 400ms cubic-bezier(0.34, 1.56, 0.64, 1) ${200 + i * 100}ms both`,
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-4px)'
              e.currentTarget.style.boxShadow = 'var(--shadow-xl)'
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)'
              e.currentTarget.style.boxShadow = 'var(--shadow-float)'
            }}
          >
            <span style={{ color: 'var(--accent-blue)' }}>{action.icon}</span>
            <span style={{ fontSize: '13px', fontWeight: 700 }}>{action.title}</span>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{action.subtitle}</span>
          </button>
        ))}
      </div>

      {/* Keyboard shortcut hints */}
      <div className="animate-fade-in" style={{
        display: 'flex',
        gap: '16px',
        position: 'relative',
        zIndex: 1,
        marginTop: '16px',
        animationDelay: '500ms',
      }}>
        {[
          { keys: 'Ctrl+N', label: 'New Session' },
          { keys: 'Ctrl+B', label: 'Toggle Sidebar' },
          { keys: 'Ctrl+Shift+E', label: 'Toggle Editor' },
        ].map((hint) => (
          <div key={hint.keys} style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            color: 'var(--text-muted)',
          }}>
            <kbd style={{
              padding: '2px 6px',
              borderRadius: '4px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              fontSize: '10px',
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
            }}>
              {hint.keys}
            </kbd>
            <span>{hint.label}</span>
          </div>
        ))}
      </div>

      {error && (
        <div className="absolute bottom-24 left-6 right-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 shadow-lg backdrop-blur-md animate-slide-up" style={{ zIndex: 2 }}>
          <span className="text-red-500 text-lg">⚠️</span>
          <span className="flex-1 text-sm text-red-500 font-medium">
            {error}
          </span>
          <Button variant="outline" size="sm" onClick={() => setError(null)}>
            Dismiss
          </Button>
        </div>
      )}

      {/* Message input at the bottom */}
      <div className="absolute bottom-6 left-6 right-6" style={{ zIndex: 2 }}>
        <MessageInput
          onSend={onSend}
          onCancel={cancelStream}
          isStreaming={isStreaming}
          onTaskModeChange={setTaskMode}
        />
      </div>
    </div>
  )
}

export function ChatPage(): React.JSX.Element {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const scrollContainerRef = useRef<HTMLDivElement>(null)
  const [showScrollFab, setShowScrollFab] = useState(false)

  const messages = useChatStore((s) => s.messages)
  const isStreaming = useChatStore((s) => s.isStreaming)
  const error = useChatStore((s) => s.error)
  const pendingApprovals = useChatStore((s) => s.pendingApprovals)

  const loadSession = useChatStore((s) => s.loadSession)
  const sendMessage = useChatStore((s) => s.sendMessage)
  const cancelStream = useChatStore((s) => s.cancelStream)
  const respondToApproval = useChatStore((s) => s.respondToApproval)
  const setStreaming = useChatStore((s) => s.setStreaming)
  const appendStreamChunk = useChatStore((s) => s.appendStreamChunk)
  const resetStream = useChatStore((s) => s.resetStream)
  const setError = useChatStore((s) => s.setError)
  const addPendingApproval = useChatStore((s) => s.addPendingApproval)
  const addMessage = useChatStore((s) => s.addMessage)
  const deleteMessagesFrom = useChatStore((s) => s.deleteMessagesFrom)
  const { activeSessionId, createSession, sessions, setWorkspace, setActiveSession } = useSessionStore()
  const { activeProvider, activeModel } = useProviderStore()
  const [taskMode, setTaskMode] = useState<string | null>(null)
  const [activeSelfHealingAttempt, setActiveSelfHealingAttempt] = useState<any>(null)
  const [toolActivity, setToolActivity] = useState<{ toolName: string; phase: 'running' | 'completed'; message?: string } | null>(null)

  const activeSession = sessions.find((s) => s.id === activeSessionId)

  // Extract all unique attached paths from the session messages history
  const sessionAttachments = useMemo(() => {
    const attachedPathsSet = new Set<string>()
    for (const msg of messages) {
      if (msg.content) {
        const text = msg.content
        const match = text.match(/Attached paths:\s*(.*)/i)
        if (match) {
          const pathsText = match[1]
          const pathRegex = /"([^"]+)"/g
          let pathMatch
          while ((pathMatch = pathRegex.exec(pathsText)) !== null) {
            attachedPathsSet.add(pathMatch[1])
          }
        }
      }
    }
    return Array.from(attachedPathsSet)
  }, [messages])

  // Handle scroll position to show/hide FAB
  const handleScroll = useCallback(() => {
    const container = scrollContainerRef.current
    if (!container) return
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 100
    setShowScrollFab(!isNearBottom)
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  const handleSelectWorkspace = async (): Promise<void> => {
    if (!activeSessionId) return
    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      await setWorkspace(activeSessionId, result.filePaths[0])
      await loadSession(activeSessionId)
    }
  }

  // Load session messages when active session changes
  useEffect(() => {
    if (activeSessionId) {
      loadSession(activeSessionId)
      window.electronAPI.selfHealing.getActive(activeSessionId)
        .then((attempt) => setActiveSelfHealingAttempt(attempt))
        .catch((err) => console.error('[ChatPage] Failed to fetch active self-healing:', err))
    } else {
      setActiveSelfHealingAttempt(null)
    }
  }, [activeSessionId, loadSession])

  // Set up IPC listeners for streaming
  useEffect(() => {
    const cleanupChunk = window.electronAPI.chat.onChunk((chunk: string) => {
      appendStreamChunk(chunk)
    })

    const cleanupActivity = window.electronAPI.tool.onActivity((activity) => {
      setToolActivity(activity)
    })

    const cleanupEnd = window.electronAPI.chat.onEnd((data: { content: string; tokensUsed: number }) => {
      setToolActivity(null)
      // Add the final assistant message
      addMessage({
        id: Date.now().toString(),
        sessionId: activeSessionId || '',
        role: 'assistant',
        content: data.content,
        tokensUsed: data.tokensUsed,
        createdAt: new Date().toISOString()
      })
      resetStream()
      // Reload session to get fresh messages
      if (activeSessionId) loadSession(activeSessionId)
    })

    const cleanupError = window.electronAPI.chat.onError((errorMsg: string) => {
      setToolActivity(null)
      setError(errorMsg)
      setStreaming(false)
    })

    const cleanupMessageUpdated = window.electronAPI.chat.onMessageUpdated(() => {
      if (activeSessionId) loadSession(activeSessionId)
    })

    const cleanupApproval = window.electronAPI.tool.onApprovalRequest((request) => {
      addPendingApproval(request as ToolApprovalRequest)
    })

    const cleanupSelfHealingFailure = window.electronAPI.selfHealing.onFailureDetected((attempt) => {
      if (attempt.sessionId === activeSessionId) {
        setActiveSelfHealingAttempt(attempt)
      }
    })

    const cleanupSelfHealingProposal = window.electronAPI.selfHealing.onProposalGenerated((attempt) => {
      if (attempt.sessionId === activeSessionId) {
        setActiveSelfHealingAttempt(attempt)
      }
    })

    return () => {
      cleanupChunk()
      cleanupActivity()
      cleanupEnd()
      cleanupError()
      cleanupMessageUpdated()
      cleanupApproval()
      cleanupSelfHealingFailure()
      cleanupSelfHealingProposal()
    }
  }, [activeSessionId, appendStreamChunk, resetStream, setError, setStreaming, setToolActivity, addPendingApproval, addMessage, loadSession])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(
    async (message: string) => {
      let sessionId = activeSessionId
      const msgLower = message.trim().toLowerCase()

      // Handle slash commands locally
      if (msgLower === '/clear') {
        if (sessionId) await useChatStore.getState().clearSessionDb(sessionId)
        return
      }
      
      if (msgLower === '/compact') {
        if (sessionId) await useChatStore.getState().compactSessionDb(sessionId, 5) // keep last 5 messages
        return
      }

      if (msgLower === '/new') {
        const session = await createSession(activeProvider, activeModel || 'default')
        setActiveSession(session.id)
        return
      }

      // Create a new session if none is active
      if (!sessionId) {
        try {
          const session = await createSession(activeProvider, activeModel || 'default')
          sessionId = session.id
        } catch (err) {
          setError(`Failed to create session: ${(err as Error).message}`)
          return
        }
      }

      // Add user message to local state immediately
      addMessage({
        id: Date.now().toString(),
        sessionId,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString()
      })

      const currentProvider = activeSession?.provider || activeProvider
      const currentModel = activeSession?.model || activeModel

      // Send via IPC
      await sendMessage(message, sessionId, currentProvider, currentModel, undefined, taskMode || undefined)
    },
    [activeSessionId, activeSession, activeProvider, activeModel, sendMessage, createSession, addMessage, taskMode, setActiveSession, setError]
  )

  const handleRetry = useCallback(
    async (messageId: string) => {
      const msg = messages.find((m) => m.id === messageId)
      if (!msg) return

      if (isStreaming) {
        await cancelStream()
      }

      await deleteMessagesFrom(activeSessionId!, messageId)

      addMessage({
        id: Date.now().toString(),
        sessionId: activeSessionId!,
        role: 'user',
        content: msg.content,
        createdAt: new Date().toISOString()
      })

      const currentProvider = activeSession?.provider || activeProvider
      const currentModel = activeSession?.model || activeModel

      await sendMessage(
        msg.content,
        activeSessionId!,
        currentProvider,
        currentModel || 'default',
        undefined,
        taskMode || undefined
      )
    },
    [
      messages,
      isStreaming,
      cancelStream,
      deleteMessagesFrom,
      activeSessionId,
      activeSession,
      addMessage,
      sendMessage,
      activeProvider,
      activeModel,
      taskMode
    ]
  )

  const handleRetryLast = useCallback(async () => {
    const userMessages = messages.filter((m) => m.role === 'user')
    if (userMessages.length === 0) return
    const lastUserMsg = userMessages[userMessages.length - 1]
    await handleRetry(lastUserMsg.id)
  }, [messages, handleRetry])

  // ── Empty State ──
  if (!activeSessionId && messages.length === 0) {
    return (
      <AuroraWelcome
        onSend={handleSend}
        cancelStream={cancelStream}
        isStreaming={isStreaming}
        error={error}
        setError={setError}
        setTaskMode={setTaskMode}
      />
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative bg-transparent">
      {/* Ambient gradient mesh */}
      <div style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--gradient-mesh)',
        pointerEvents: 'none',
        zIndex: 0,
        opacity: 0.5,
      }} />

      {/* Workspace Bar */}
      {activeSessionId && (
        <div
          className="glass-subtle animate-slide-down"
          style={{
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            flexDirection: 'column',
            flexShrink: 0,
            position: 'relative',
            zIndex: 2,
          }}
        >
          {/* First row: Workspace Info */}
          <div style={{
            padding: '8px 16px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            fontSize: '12px',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <span style={{
                color: 'var(--text-muted)',
                fontWeight: 500,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
              }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                </svg>
                Workspace:
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                {activeSession?.workspacePath ? (
                  <>
                    <span style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '11px',
                      color: 'var(--text-primary)',
                      background: 'var(--bg-tertiary)',
                      padding: '2px 8px',
                      borderRadius: 'var(--radius-sm)',
                      border: '1px solid var(--border)',
                    }}>
                      {activeSession.workspacePath}
                    </span>
                    <button 
                      onClick={handleSelectWorkspace}
                      style={{
                        color: 'var(--accent-blue)',
                        background: 'none',
                        border: 'none',
                        cursor: 'pointer',
                        fontSize: '11px',
                        fontWeight: 600,
                      }}
                    >
                      Change
                    </button>
                  </>
                ) : (
                  <Button variant="outline" size="sm" onClick={handleSelectWorkspace} className="py-1 px-3 h-auto text-xs">Bind Workspace...</Button>
                )}
              </span>
            </div>

            {/* Model Badge */}
            {activeSession && (
              <span style={{
                fontSize: '11px',
                color: 'var(--text-muted)',
                background: 'var(--bg-tertiary)',
                padding: '2px 8px',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--border)',
              }}>
                🤖 {activeSession.provider}: {activeSession.model}
              </span>
            )}
          </div>

          {/* Second row: Active Attachments list */}
          {sessionAttachments.length > 0 && (
            <div style={{
              padding: '6px 16px 8px 16px',
              borderTop: '1px solid rgba(255, 255, 255, 0.03)',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              flexWrap: 'wrap',
              background: 'rgba(0, 0, 0, 0.05)',
            }}>
              <span style={{
                color: 'var(--text-muted)',
                fontSize: '11px',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
              }}>
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                </svg>
                Active Attachments ({sessionAttachments.length}):
              </span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {sessionAttachments.map((path) => {
                  const fileName = path.split(/[/\\]/).pop() || path
                  return (
                    <div
                      key={path}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        padding: '2px 8px',
                        background: 'rgba(59, 130, 246, 0.06)',
                        border: '1px solid rgba(59, 130, 246, 0.15)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '11px',
                        color: 'var(--text-secondary)',
                      }}
                      title={path}
                    >
                      <span style={{ fontWeight: 500 }}>{fileName}</span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Message List */}
      <div
        ref={scrollContainerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar scroll-smooth"
        style={{ position: 'relative', zIndex: 1 }}
      >
        <div className="max-w-4xl mx-auto flex flex-col gap-5">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onRetry={handleRetry} />
          ))}

          {/* Tool activity indicator */}
          {isStreaming && toolActivity && (
            <div
              className="animate-slide-up glass-card"
              style={{
                padding: '12px 16px',
                borderRadius: 'var(--radius-lg)',
                border: '1px solid var(--border-glow)',
                position: 'relative',
                overflow: 'hidden',
              }}
            >
              {/* Animated progress line */}
              <div style={{
                position: 'absolute',
                top: 0,
                left: 0,
                right: 0,
                height: '2px',
                background: 'linear-gradient(90deg, transparent, var(--accent-blue), var(--accent-cyan), transparent)',
                backgroundSize: '200% 100%',
                animation: 'shimmer 1.5s ease-in-out infinite',
              }} />
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '13px' }}>
                <span className="status-dot status-dot--active" />
                <span style={{ fontWeight: 600, color: 'var(--text-primary)' }}>AI is working</span>
                <span style={{ color: 'var(--text-muted)', fontSize: '12px' }}>
                  • {toolActivity.message || 'Processing…'}
                </span>
              </div>
            </div>
          )}

          {/* Streaming content (isolated to avoid re-rendering entire ChatPage on every token) */}
          <StreamingBubble activeSessionId={activeSessionId || ''} messagesEndRef={messagesEndRef} />

          {/* Error display */}
          {error && (
            <div
              className="animate-slide-up"
              style={{
                padding: '14px 16px',
                marginTop: '4px',
                background: 'rgba(239, 68, 68, 0.06)',
                border: '1px solid rgba(239, 68, 68, 0.2)',
                borderRadius: 'var(--radius-lg)',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                boxShadow: '0 0 20px rgba(239, 68, 68, 0.05)',
              }}
            >
              <span style={{ fontSize: '16px' }}>⚠️</span>
              <span style={{ flex: 1, fontSize: '13px', color: 'var(--accent-red)', fontWeight: 500 }}>
                {error}
              </span>
              <div style={{ display: 'flex', gap: '6px' }}>
                {messages.some((m) => m.role === 'user') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetryLast}
                    style={{
                      borderColor: 'rgba(239, 68, 68, 0.2)',
                      color: 'var(--accent-red)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                      <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                    </svg>
                    Retry
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setError(null)}>
                  Dismiss
                </Button>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} className="h-4" />
        </div>
      </div>

      {/* Scroll to bottom FAB */}
      {showScrollFab && <ScrollToBottomFAB onClick={scrollToBottom} count={0} />}

      {/* Input */}
      <div className="p-6 pt-2 shrink-0 max-w-4xl mx-auto w-full" style={{ position: 'relative', zIndex: 2 }}>
        {activeSelfHealingAttempt && (
          <SelfHealingPanel
            sessionId={activeSessionId || ''}
            activeAttempt={activeSelfHealingAttempt}
            onClearActive={() => setActiveSelfHealingAttempt(null)}
          />
        )}
        <MessageInput
          onSend={handleSend}
          onCancel={cancelStream}
          isStreaming={isStreaming}
          onTaskModeChange={setTaskMode}
        />
      </div>

      {/* Tool Approval Dialogs */}
      {pendingApprovals.map((request) => (
        <ToolApprovalDialog
          key={request.requestId}
          request={request}
          onRespond={respondToApproval}
        />
      ))}
    </div>
  )
}
