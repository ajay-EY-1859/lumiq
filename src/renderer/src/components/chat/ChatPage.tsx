// ═══════════════════════════════════════════════════════════════════
// Lumiq — ChatPage Component
// Main chat interface with message list, streaming, and input
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useRef, useCallback } from 'react'
import { useChatStore } from '@renderer/store/chatStore'
import { useSessionStore } from '@renderer/store/sessionStore'
import { useProviderStore } from '@renderer/store/providerStore'
import { MessageBubble } from './MessageBubble'
import { MessageInput } from './MessageInput'
import { TypingIndicator } from './TypingIndicator'
import { ToolApprovalDialog } from './ToolApprovalDialog'
import { Button } from '@renderer/components/ui/Button'

export function ChatPage(): React.JSX.Element {
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const {
    messages,
    isStreaming,
    streamingContent,
    error,
    pendingApproval,
    loadSession,
    sendMessage,
    cancelStream,
    respondToApproval,
    setStreaming,
    appendStreamChunk,
    resetStream,
    setError,
    setPendingApproval,
    addMessage
  } = useChatStore()
  const { activeSessionId, createSession } = useSessionStore()
  const { activeProvider, activeModel } = useProviderStore()

  // Load session messages when active session changes
  useEffect(() => {
    if (activeSessionId) {
      loadSession(activeSessionId)
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
      setPendingApproval(request as typeof pendingApproval)
    })

    return () => {
      cleanupChunk()
      cleanupEnd()
      cleanupError()
      cleanupApproval()
    }
  }, [activeSessionId, appendStreamChunk, resetStream, setError, setStreaming, setPendingApproval, addMessage, loadSession])

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, streamingContent])

  const handleSend = useCallback(
    async (message: string) => {
      let sessionId = activeSessionId

      // Create a new session if none is active
      if (!sessionId) {
        const session = await createSession(activeProvider, activeModel)
        sessionId = session.id
      }

      // Add user message to local state immediately
      addMessage({
        id: Date.now().toString(),
        sessionId,
        role: 'user',
        content: message,
        createdAt: new Date().toISOString()
      })

      // Send via IPC
      await sendMessage(message, sessionId, activeProvider, activeModel)
    },
    [activeSessionId, activeProvider, activeModel, sendMessage, createSession, addMessage]
  )

  // ── Empty State ──
  if (!activeSessionId && messages.length === 0) {
    return (
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: '16px',
          color: 'var(--text-muted)'
        }}
      >
        <div style={{ fontSize: '48px', opacity: 0.3 }}>✦</div>
        <div style={{ fontSize: '18px', fontWeight: 600, color: 'var(--text-secondary)' }}>
          Start a conversation
        </div>
        <div style={{ fontSize: '13px', maxWidth: '300px', textAlign: 'center' }}>
          Select a session from the sidebar or type a message to begin
        </div>

        {/* Message input at the bottom */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0 }}>
          <MessageInput
            onSend={handleSend}
            onCancel={cancelStream}
            isStreaming={isStreaming}
          />
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {/* Message List */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '16px 0'
        }}
      >
        {messages.map((msg) => (
          <MessageBubble key={msg.id} message={msg} />
        ))}

        {/* Streaming content */}
        {isStreaming && streamingContent && (
          <MessageBubble
            message={{
              id: 'streaming',
              sessionId: activeSessionId || '',
              role: 'assistant',
              content: streamingContent,
              createdAt: new Date().toISOString()
            }}
          />
        )}

        {/* Typing indicator */}
        {isStreaming && !streamingContent && <TypingIndicator />}

        {/* Error display */}
        {error && (
          <div
            style={{
              margin: '8px 16px',
              padding: '12px 16px',
              background: 'rgba(220, 38, 38, 0.1)',
              border: '1px solid var(--accent-red)',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <span style={{ color: 'var(--accent-red)' }}>⚠️</span>
            <span style={{ flex: 1, fontSize: '13px', color: 'var(--accent-red)' }}>
              {error}
            </span>
            <Button variant="outline" size="sm" onClick={() => setError(null)}>
              Dismiss
            </Button>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <MessageInput
        onSend={handleSend}
        onCancel={cancelStream}
        isStreaming={isStreaming}
      />

      {/* Tool Approval Dialog */}
      <ToolApprovalDialog
        request={pendingApproval}
        onRespond={respondToApproval}
      />
    </div>
  )
}
