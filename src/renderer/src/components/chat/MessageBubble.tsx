// ═══════════════════════════════════════════════════════════════════
// Lumiq — Message Bubble Component
// Renders user, assistant, and tool messages with markdown
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import { CodeBlock } from '@renderer/components/ui/CodeBlock'
import type { Message } from '@shared/types'

interface MessageBubbleProps {
  message: Message
}

export function MessageBubble({ message }: MessageBubbleProps): React.JSX.Element {
  const [showCopy, setShowCopy] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content])

  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'

  if (isTool) {
    return <ToolMessage message={message} />
  }

  return (
    <div
      className="animate-slide-up"
      style={{
        display: 'flex',
        justifyContent: isUser ? 'flex-end' : 'flex-start',
        padding: '4px 16px',
        gap: '8px'
      }}
      onMouseEnter={() => setShowCopy(true)}
      onMouseLeave={() => setShowCopy(false)}
    >
      {/* Avatar */}
      {!isUser && (
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--bg-tertiary)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '14px',
            flexShrink: 0,
            marginTop: '2px'
          }}
        >
          ✦
        </div>
      )}

      {/* Bubble */}
      <div
        style={{
          maxWidth: isUser ? '80%' : '85%',
          padding: '10px 14px',
          borderRadius: isUser ? '12px 12px 4px 12px' : '12px 12px 12px 4px',
          background: isUser ? 'var(--user-bubble)' : 'var(--ai-bubble)',
          border: isUser ? 'none' : '1px solid var(--border)',
          position: 'relative',
          fontSize: '14px',
          lineHeight: 1.6
        }}
      >
        <div className="markdown-content">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              code({ className, children, node, ...props }) {
                void node // react-markdown extra prop, not needed
                const match = /language-(\w+)/.exec(className || '')
                const isInline = !match
                if (isInline) {
                  return (
                    <code
                      style={{
                        fontFamily: 'var(--font-mono)',
                        fontSize: '13px',
                        background: 'var(--bg-tertiary)',
                        padding: '1px 5px',
                        borderRadius: '4px',
                        color: 'var(--accent-blue)'
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
            {message.content}
          </ReactMarkdown>
        </div>

        {/* Copy button on hover */}
        {showCopy && (
          <button
            onClick={handleCopy}
            style={{
              position: 'absolute',
              top: '4px',
              right: '4px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '4px',
              padding: '2px 6px',
              fontSize: '11px',
              color: copied ? 'var(--accent-green)' : 'var(--text-muted)',
              cursor: 'pointer'
            }}
          >
            {copied ? '✓' : '📋'}
          </button>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div
          style={{
            width: '28px',
            height: '28px',
            borderRadius: '50%',
            background: 'var(--accent-blue)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '12px',
            color: 'white',
            flexShrink: 0,
            marginTop: '2px'
          }}
        >
          U
        </div>
      )}
    </div>
  )
}

// ── Tool Message ────────────────────────────────────────────────
function ToolMessage({ message }: { message: Message }): React.JSX.Element {
  const [isExpanded, setIsExpanded] = useState(false)

  return (
    <div
      className="animate-slide-up"
      style={{ padding: '4px 16px 4px 52px' }}
    >
      <div
        style={{
          background: 'var(--bg-tertiary)',
          borderLeft: '3px solid var(--accent-yellow)',
          borderRadius: '0 8px 8px 0',
          overflow: 'hidden'
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
            gap: '6px',
            cursor: 'pointer',
            color: 'var(--text-secondary)',
            fontSize: '12px',
            fontFamily: 'var(--font-mono)',
            textAlign: 'left'
          }}
        >
          <span style={{ transition: 'transform var(--transition-fast)', transform: isExpanded ? 'rotate(90deg)' : 'none' }}>
            ▶
          </span>
          <span style={{ color: 'var(--accent-yellow)' }}>🔧</span>
          <span style={{ fontWeight: 500 }}>{message.toolName || 'Tool'}</span>
          <span style={{ color: 'var(--text-muted)' }}>— {message.content.slice(0, 60)}...</span>
        </button>

        {isExpanded && (
          <pre
            style={{
              padding: '8px 12px',
              margin: 0,
              fontSize: '12px',
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              maxHeight: '300px',
              overflow: 'auto',
              borderTop: '1px solid var(--border)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all'
            }}
          >
            {message.content}
          </pre>
        )}
      </div>
    </div>
  )
}
