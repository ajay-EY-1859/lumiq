// ═══════════════════════════════════════════════════════════════════
// Lumiq — CodeBlock Component
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useCallback } from 'react'

interface CodeBlockProps {
  language?: string
  children: string
}

export function CodeBlock({ language, children }: CodeBlockProps): React.JSX.Element {
  const [copied, setCopied] = useState(false)

  const handleCopy = useCallback(() => {
    navigator.clipboard.writeText(children)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [children])

  return (
    <div
      style={{
        position: 'relative',
        background: 'var(--code-bg)',
        borderRadius: '8px',
        margin: '8px 0',
        overflow: 'hidden'
      }}
    >
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          padding: '6px 12px',
          background: 'rgba(255, 255, 255, 0.05)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.1)'
        }}
      >
        <span
          style={{
            fontSize: '11px',
            color: '#94A3B8',
            fontFamily: 'var(--font-mono)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em'
          }}
        >
          {language || 'text'}
        </span>
        <button
          onClick={handleCopy}
          style={{
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: copied ? 'var(--accent-green)' : '#94A3B8',
            fontSize: '12px',
            fontFamily: 'var(--font-sans)',
            padding: '2px 8px',
            borderRadius: '4px',
            transition: 'all var(--transition-fast)'
          }}
        >
          {copied ? '✓ Copied' : 'Copy'}
        </button>
      </div>
      {/* Code content */}
      <pre
        style={{
          padding: '12px 16px',
          margin: 0,
          overflow: 'auto',
          maxHeight: '400px'
        }}
      >
        <code
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '13px',
            lineHeight: 1.6,
            color: '#E2E8F0',
            tabSize: 2
          }}
        >
          {children}
        </code>
      </pre>
    </div>
  )
}
