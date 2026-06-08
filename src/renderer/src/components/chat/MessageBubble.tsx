// ═══════════════════════════════════════════════════════════════════
// Lumiq — Message Bubble Component
// Renders user, assistant, and tool messages with markdown
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

export const MessageBubble = React.memo(function MessageBubble({ message, onRetry }: MessageBubbleProps): React.JSX.Element {
  const [showCopy, setShowCopy] = useState(false)
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(message.content)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [message.content])

  const isUser = message.role === 'user'
  const isTool = message.role === 'tool'
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
                className="font-mono text-[13px] bg-black/5 dark:bg-white/10 px-1.5 py-0.5 rounded border border-black/5 dark:border-white/5 text-[var(--accent-blue)] font-medium"
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
  ), [message.content])

  if (isTool) {
    return <ToolMessage message={message} />
  }

  return (
    <div
      className={`animate-slide-up flex gap-3 px-4 py-2 ${isUser ? 'flex-row-reverse' : ''}`}
      onMouseEnter={() => setShowCopy(true)}
      onMouseLeave={() => setShowCopy(false)}
    >
      {/* Avatar */}
      {!isUser && (
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-500 to-purple-500 flex items-center justify-center text-white text-xs shadow-md shrink-0 mt-1 ring-2 ring-white/10">
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
        </div>
      )}

      {/* Bubble */}
      <div
        className={`relative max-w-[85%] px-4 py-3 text-[14px] leading-relaxed shadow-sm ${
          isUser
            ? 'bg-[var(--user-bubble)] text-[var(--text-primary)] rounded-[16px_16px_4px_16px]'
            : 'bg-[var(--ai-bubble)] border border-[var(--border)] rounded-[16px_16px_16px_4px] shadow-lg backdrop-blur-sm'
        }`}
      >
        <div className="markdown-content">
          {renderedMarkdown}
        </div>

        {/* Copy / Retry buttons on hover */}
        {showCopy && (
          <div className="absolute top-2 right-2 flex gap-1.5 z-10">
            {isUser && onRetry && (
              <button
                onClick={() => onRetry(message.id)}
                className="px-2 py-1 bg-black/5 dark:bg-white/10 backdrop-blur-md rounded-md border border-[var(--border)] text-xs font-medium cursor-pointer transition-colors text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/10 dark:hover:bg-white/20 flex items-center gap-1"
                title="Retry message from here"
              >
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
                  <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
                </svg>
                Retry
              </button>
            )}
            <button
              onClick={handleCopy}
              className={`px-2 py-1 bg-black/5 dark:bg-white/10 backdrop-blur-md rounded-md border border-[var(--border)] text-xs font-medium cursor-pointer transition-colors ${copied ? 'text-green-500 border-green-500/30' : 'text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-black/10 dark:hover:bg-white/20'}`}
            >
              {copied ? '✓ Copied' : 'Copy'}
            </button>
          </div>
        )}
      </div>

      {/* User avatar */}
      {isUser && (
        <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[var(--accent-blue)] to-cyan-500 flex items-center justify-center text-white text-xs font-bold shadow-md shrink-0 mt-1 ring-2 ring-[var(--bg-primary)]">
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
      style={{ padding: '4px 16px 4px 52px' }}
    >
      <div
        style={{
          background: 'var(--bg-tertiary)',
          borderLeft: `3px solid ${diffContent ? 'var(--accent-blue)' : 'var(--accent-yellow)'}`,
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
          <span style={{ color: diffContent ? 'var(--accent-blue)' : 'var(--accent-yellow)' }}>
            {diffContent ? '📝' : '🔧'}
          </span>
          <span style={{ fontWeight: 500 }}>{message.toolName || 'Tool'}</span>
          <span style={{ color: 'var(--text-muted)' }}>
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
