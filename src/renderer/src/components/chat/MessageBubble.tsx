// ═══════════════════════════════════════════════════════════════════
// Lumiq — Message Bubble Component (Premium Redesign v2)
// Glow avatars · Context markers · Enhanced hover reveal
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback, useMemo } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from '@renderer/components/ui/CodeBlock'
import { DiffViewer } from './DiffViewer'
import type { Message } from '@shared/types'

interface MessageBubbleProps {
  message: Message
  onRetry?: (messageId: string) => void
}

function isSafeExternalUrl(url: string): boolean {
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'https:' || parsed.protocol === 'http:'
  } catch {
    return false
  }
}

function formatTime(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  } catch {
    return ''
  }
}

export const MessageBubble = React.memo(function MessageBubble({ message, onRetry }: MessageBubbleProps): React.JSX.Element {
  const [showActions, setShowActions] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    window.electronAPI.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content])

  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'

  // Extract attached paths and clean content
  const { cleanContent, attachedPaths } = useMemo(() => {
    const text = message.content || ''
    const match = text.match(/(?:\r?\n\r?\n)?Attached paths:\s*(.*)/i)
    if (match) {
      const pathsText = match[1]
      const pathRegex = /"([^"]+)"/g
      const paths: string[] = []
      let pathMatch
      while ((pathMatch = pathRegex.exec(pathsText)) !== null) {
        paths.push(pathMatch[1])
      }
      const clean = text.replace(/(?:\r?\n\r?\n)?Attached paths:\s*(.*)/i, '').trim()
      return { cleanContent: clean, attachedPaths: paths }
    }
    return { cleanContent: text, attachedPaths: [] }
  }, [message.content])

  const renderedMarkdown = useMemo(() => (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      components={{
        a({ href, children }) {
          const safeHref = href && isSafeExternalUrl(href) ? href : undefined
          return (
            <button
              type="button"
              disabled={!safeHref}
              onClick={() => {
                if (safeHref) void window.electronAPI.shell.openExternal(safeHref)
              }}
              className={`${safeHref ? 'text-[var(--accent-blue)] cursor-pointer hover:underline' : 'text-[var(--text-muted)] cursor-not-allowed line-through'} bg-transparent border-none p-0 font-inherit`}
            >
              {children}
            </button>
          )
        },
        img() {
          return null
        },
        code({ className, children, node, ...props }) {
          void node // react-markdown extra prop, not needed
          const match = /language-(\w+)/.exec(className || '')
          const isInline = !match
          if (isInline) {
            return (
              <code
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  background: 'var(--bg-tertiary)',
                  padding: '1px 6px',
                  borderRadius: '4px',
                  color: 'var(--accent-blue)',
                  fontWeight: 500,
                  border: '1px solid var(--border)',
                }}
                {...props}
              >
                {children}
              </code>
            )
          }
          return (
            <CodeBlock language={match?.[1]}>
              {String(children).replace(/\n$/, '')}
            </CodeBlock>
          )
        }
      }}
    >
      {cleanContent}
    </ReactMarkdown>
  ), [cleanContent])

  if (isTool) {
    return <ToolMessage message={message} />
  }

  return (
    <div
      className="animate-slide-up"
      style={{
        display: 'flex',
        gap: '10px',
        padding: '4px 0',
        flexDirection: isUser ? 'row-reverse' : 'row',
        alignItems: 'flex-start',
      }}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      {/* Avatar — AI */}
      {!isUser && (
        <div
          style={{
            width: '32px',
            height: '32px',
            borderRadius: '12px',
            background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-purple))',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            flexShrink: 0,
            marginTop: '2px',
            boxShadow: '0 4px 12px rgba(59, 130, 246, 0.2)',
            position: 'relative',
          }}
        >
          {/* Subtle ring for streaming messages */}
          {message.id === 'streaming' && (
            <div style={{
              position: 'absolute',
              inset: '-3px',
              borderRadius: '15px',
              border: '2px solid rgba(96, 165, 250, 0.4)',
              animation: 'neonPulse 2s ease-in-out infinite',
            }} />
          )}
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/>
          </svg>
        </div>
      )}

      {/* Bubble */}
      <div
        style={{
          position: 'relative',
          maxWidth: '85%',
          padding: '12px 16px',
          fontSize: '14px',
          lineHeight: 1.65,
          ...(isUser ? {
            background: 'var(--user-bubble)',
            color: 'var(--text-primary)',
            borderRadius: 'var(--radius-lg) var(--radius-lg) 4px var(--radius-lg)',
            boxShadow: 'var(--shadow-sm)',
          } : {
            background: 'var(--ai-bubble)',
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius-lg) var(--radius-lg) var(--radius-lg) 4px',
            boxShadow: 'var(--shadow-md)',
            backdropFilter: 'blur(8px)',
            WebkitBackdropFilter: 'blur(8px)',
          }),
        }}
      >
        <div className="markdown-content">
          {renderedMarkdown}
        </div>

        {/* Visual attachment chips */}
        {attachedPaths.length > 0 && (
          <div style={{
            marginTop: '10px',
            display: 'flex',
            flexWrap: 'wrap',
            gap: '6px',
            borderTop: '1px solid var(--border)',
            paddingTop: '8px'
          }}>
            {attachedPaths.map((path) => {
              const fileName = path.split(/[/\\]/).pop() || path
              return (
                <div
                  key={path}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px',
                    padding: '3px 8px',
                    background: isUser ? 'rgba(255, 255, 255, 0.12)' : 'rgba(59, 130, 246, 0.08)',
                    border: isUser ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(59, 130, 246, 0.15)',
                    borderRadius: '4px',
                    fontSize: '11px',
                    color: isUser ? 'white' : 'var(--text-primary)',
                    cursor: 'default'
                  }}
                  title={path}
                >
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                  </svg>
                  <span>{fileName}</span>
                </div>
              )
            })}
          </div>
        )}

        {/* Action bar on hover — slides up from bottom */}
        {showActions && (
          <div
            className="animate-fade-in"
            style={{
              position: 'absolute',
              bottom: '-28px',
              ...(isUser ? { right: '0' } : { left: '0' }),
              display: 'flex',
              alignItems: 'center',
              gap: '4px',
              padding: '3px 6px',
              background: 'var(--glass-bg)',
              backdropFilter: 'blur(12px)',
              WebkitBackdropFilter: 'blur(12px)',
              border: '1px solid var(--glass-border)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-md)',
              zIndex: 10,
            }}
          >
            {/* Timestamp */}
            <span style={{
              fontSize: '10px',
              color: 'var(--text-muted)',
              padding: '0 4px',
              fontFamily: 'var(--font-mono)',
            }}>
              {formatTime(message.createdAt)}
            </span>

            {/* Token count if available */}
            {message.tokensUsed && (
              <span style={{
                fontSize: '9px',
                color: 'var(--text-muted)',
                padding: '1px 5px',
                background: 'var(--bg-tertiary)',
                borderRadius: 'var(--radius-sm)',
                fontFamily: 'var(--font-mono)',
              }}>
                {message.tokensUsed} tok
              </span>
            )}

            <div style={{ width: '1px', height: '14px', background: 'var(--border)', margin: '0 2px' }} />

            {/* Retry */}
            {isUser && onRetry && (
              <button
                onClick={() => onRetry(message.id)}
                title="Retry from here"
                style={{
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
                  padding: '3px',
                  borderRadius: '4px',
                  display: 'flex',
                  alignItems: 'center',
                  transition: 'color 0.15s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.color = 'var(--accent-blue)'}
                onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
              </button>
            )}

            {/* Copy */}
            <button
              onClick={handleCopy}
              title={copied ? 'Copied!' : 'Copy message'}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: copied ? 'var(--accent-green)' : 'var(--text-muted)',
                padding: '3px',
                borderRadius: '4px',
                display: 'flex',
                alignItems: 'center',
                transition: 'color 0.15s',
              }}
              onMouseEnter={(e) => { if (!copied) e.currentTarget.style.color = 'var(--accent-blue)' }}
              onMouseLeave={(e) => { if (!copied) e.currentTarget.style.color = 'var(--text-muted)' }}
            >
              {copied ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              ) : (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <rect x="9" y="9" width="13" height="13" rx="2" ry="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
              )}
            </button>
          </div>
        )}
      </div>

      {/* Avatar — User */}
      {isUser && (
        <div style={{
          width: '32px',
          height: '32px',
          borderRadius: '50%',
          background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'white',
          fontSize: '12px',
          fontWeight: 800,
          flexShrink: 0,
          marginTop: '2px',
          boxShadow: '0 4px 12px rgba(6, 182, 212, 0.15)',
        }}>
          U
        </div>
      )}
    </div>
  )
})

// ── Tool Message ────────────────────────────────────────────────
function ToolMessage({ message }: { message: Message }): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)

  // Detect if content is a unified diff (has --- and @@ markers)
  const isDiff = useMemo(() => {
    const c = message.content
    return c.includes('--- ') && c.includes('+++ ') && c.includes('@@ ')
  }, [message.content])

  // Check for inline diff in ```diff blocks (from FileEditTool)
  const inlineDiff = useMemo(() => {
    const match = message.content.match(/```diff\n([\s\S]*?)```/)
    if (match) {
      const diffBody = match[1].trim()
      // Convert simple -/+ lines into a basic unified diff
      const lines = diffBody.split('\n')
      const removed = lines.filter(l => l.startsWith('- ')).map(l => l.slice(2))
      const added = lines.filter(l => l.startsWith('+ ')).map(l => l.slice(2))
      if (removed.length > 0 || added.length > 0) {
        let unified = '--- original\n+++ modified\n'
        unified += `@@ -1,${removed.length} +1,${added.length} @@\n`
        for (const r of removed) unified += `-${r}\n`
        for (const a of added) unified += `+${a}\n`
        return unified
      }
    }
    return null
  }, [message.content])

  const diffContent = isDiff ? message.content : inlineDiff

  return (
    <div
      className="animate-slide-up"
      style={{ padding: '2px 0 2px 42px' }}
    >
      <div
        style={{
          background: 'var(--bg-tertiary)',
          borderLeft: `3px solid ${diffContent ? 'var(--accent-blue)' : 'var(--accent-yellow)'}`,
          borderRadius: '0 var(--radius-md) var(--radius-md) 0',
          overflow: 'hidden',
        }}
      >
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'none',
            border: 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            textAlign: 'left',
            transition: 'background 0.15s',
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(0,0,0,0.03)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'none'}
        >
          <span style={{
            transition: 'transform 0.2s ease',
            transform: isExpanded ? 'rotate(90deg)' : 'none',
            fontSize: '10px',
          }}>
            ▶
          </span>
          <span style={{
            width: '20px',
            height: '20px',
            borderRadius: '5px',
            background: diffContent ? 'rgba(59,130,246,0.1)' : 'rgba(245,158,11,0.1)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            flexShrink: 0,
          }}>
            {diffContent ? '📝' : '🔧'}
          </span>
          <span style={{ fontWeight: 600 }}>{message.toolName || 'Tool'}</span>
          <span style={{ color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            — {diffContent ? 'Diff output' : message.content.slice(0, 60)}{!diffContent && message.content.length > 60 ? '...' : ''}
          </span>
        </button>

        {isExpanded && (
          <div style={{ borderTop: '1px solid var(--border)' }}>
            {diffContent ? (
              <div style={{ padding: '4px' }}>
                <DiffViewer
                  diffContent={diffContent}
                  sessionId={message.sessionId}
                  messageId={message.id}
                  toolInputPath={(message.toolInput as any)?.path}
                />
              </div>
            ) : (
              <pre
                style={{
                  padding: '8px 12px',
                  margin: 0,
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-secondary)',
                  maxHeight: '300px',
                  overflow: 'auto',
                  whiteSpace: 'pre-wrap',
                  wordBreak: 'break-all'
                }}
              >
                {message.content}
              </pre>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
