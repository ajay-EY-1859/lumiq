// ═══════════════════════════════════════════════════════════════════
// Lumiq — ChatPage Component
// Main chat interface with message list, streaming, and input
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useCallback, useState } from 'react'
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

export function ChatPage(): React.JSX.Element {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  
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

  const activeSession = sessions.find((s) => s.id === activeSessionId)

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

    const cleanupEnd = window.electronAPI.chat.onEnd((data: { content: string; tokensUsed: number }) => {
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
      setError(errorMsg)
      setStreaming(false)
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
      cleanupEnd()
      cleanupError()
      cleanupApproval()
      cleanupSelfHealingFailure()
      cleanupSelfHealingProposal()
    }
  }, [activeSessionId, appendStreamChunk, resetStream, setError, setStreaming, addPendingApproval, addMessage, loadSession])

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
      <div className="flex-1 flex flex-col items-center justify-center gap-6 text-[var(--text-muted)] bg-transparent">
        <div className="text-6xl opacity-30 bg-gradient-to-tr from-[var(--accent-blue)] to-purple-500 bg-clip-text text-transparent drop-shadow-lg">✦</div>
        <div className="text-2xl font-bold text-[var(--text-primary)]">
          Start a conversation
        </div>
        <div className="text-sm max-w-[320px] text-center text-[var(--text-secondary)]">
          Select a session from the sidebar or type a message below to begin your journey.
        </div>

        {error && (
          <div className="absolute bottom-24 left-6 right-6 p-4 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 shadow-lg backdrop-blur-md animate-slide-up">
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
        <div className="absolute bottom-6 left-6 right-6">
          <MessageInput
            onSend={handleSend}
            onCancel={cancelStream}
            isStreaming={isStreaming}
            onTaskModeChange={setTaskMode}
          />
        </div>
      </div>
    )
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden relative bg-transparent">
      {/* Workspace Bar */}
      {activeSessionId && (
        <div className="px-4 py-2.5 bg-black/5 dark:bg-white/5 border-b border-[var(--border)] flex items-center gap-3 text-xs shrink-0 backdrop-blur-md">
          <span className="text-[var(--text-muted)] font-medium flex items-center gap-2">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path></svg>
            Workspace:
          </span>
          <span className="text-[var(--text-secondary)] font-medium flex items-center gap-2">
            {activeSession?.workspacePath ? (
              <>
                <span className="font-mono text-[var(--text-primary)] bg-[var(--bg-tertiary)] px-2 py-0.5 rounded-md border border-[var(--border)] shadow-sm">{activeSession.workspacePath}</span>
                <button 
                  onClick={handleSelectWorkspace}
                  className="text-[var(--accent-blue)] hover:text-[var(--accent-blue-hover)] font-medium hover:underline transition-colors ml-1"
                >
                  Change
                </button>
              </>
            ) : (
              <Button variant="outline" size="sm" onClick={handleSelectWorkspace} className="py-1 px-3 h-auto text-xs">Bind Workspace...</Button>
            )}
          </span>
        </div>
      )}

      {/* Message List */}
      <div className="flex-1 overflow-y-auto px-6 py-6 custom-scrollbar scroll-smooth">
        <div className="max-w-4xl mx-auto flex flex-col gap-6">
          {messages.map((msg) => (
            <MessageBubble key={msg.id} message={msg} onRetry={handleRetry} />
          ))}

          {/* Streaming content (isolated to avoid re-rendering entire ChatPage on every token) */}
          <StreamingBubble activeSessionId={activeSessionId || ''} messagesEndRef={messagesEndRef} />

          {/* Error display */}
          {error && (
            <div className="p-4 mt-2 bg-red-500/10 border border-red-500/30 rounded-xl flex items-center gap-3 shadow-sm backdrop-blur-sm animate-fade-in">
              <span className="text-red-500">⚠️</span>
              <span className="flex-1 text-sm text-red-500 font-medium">
                {error}
              </span>
              <div className="flex gap-2">
                {messages.some((m) => m.role === 'user') && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRetryLast}
                    className="flex items-center gap-1.5 border-red-500/20 hover:border-red-500/40 hover:bg-red-500/5 text-red-400"
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

      {/* Input */}
      <div className="p-6 pt-2 shrink-0 max-w-4xl mx-auto w-full">
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
