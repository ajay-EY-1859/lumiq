// ═══════════════════════════════════════════════════════════════════
// Lumiq — Tool Approval Dialog
// Modal showing tool details with Approve/Deny/Always Allow
// ═══════════════════════════════════════════════════════════════════

import React, { useEffect, useMemo, useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import type { ToolApprovalRequest } from '@shared/types'

interface ToolApprovalDialogProps {
  request: ToolApprovalRequest | null
  onRespond: (requestId: string, approved: boolean, alwaysAllow: boolean) => void
}

export function ToolApprovalDialog({ request, onRespond }: ToolApprovalDialogProps): React.JSX.Element | null {
  const [cursorPosition, setCursorPosition] = useState({ x: 24, y: 24 })

  useEffect(() => {
    if (!request) return
    const updateCursorPosition = (event: MouseEvent) => {
      setCursorPosition({ x: event.clientX + 18, y: event.clientY + 18 })
    }

    updateCursorPosition({ clientX: window.innerWidth / 2, clientY: window.innerHeight / 2 } as MouseEvent)

    window.addEventListener('mousemove', updateCursorPosition)
    return () => window.removeEventListener('mousemove', updateCursorPosition)
  }, [request])

  const popoverStyle = useMemo<React.CSSProperties>(() => {
    const maxWidth = Math.min(420, window.innerWidth - 24)
    const maxHeight = Math.max(260, window.innerHeight - 24)
    const left = Math.min(cursorPosition.x, Math.max(12, window.innerWidth - maxWidth - 12))
    const top = Math.min(cursorPosition.y, Math.max(12, window.innerHeight - maxHeight - 12))

    return {
      position: 'fixed',
      left,
      top,
      zIndex: 1000,
      width: maxWidth,
      maxHeight,
      overflowY: 'auto',
      padding: '16px',
      background: 'var(--bg-secondary)',
      border: '1px solid var(--border)',
      borderRadius: '12px',
      boxShadow: '0 16px 32px rgba(0, 0, 0, 0.18)',
      display: 'flex',
      flexDirection: 'column',
      gap: '16px',
      pointerEvents: 'auto'
    }
  }, [cursorPosition])

  if (!request) return null

  return (
    <div style={popoverStyle}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: '14px', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span>🔧</span> Tool Execution Request
        </h3>
        <button
          onClick={() => onRespond(request.requestId, false, false)}
          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)' }}
        >✕</button>
      </div>
        {/* Tool name badge */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span
            style={{
              background: 'var(--bg-tertiary)',
              padding: '4px 10px',
              borderRadius: '6px',
              fontSize: '13px',
              fontWeight: 600,
              fontFamily: 'var(--font-mono)',
              color: 'var(--accent-yellow)'
            }}
          >
            {request.toolName}
          </span>
        </div>

        {/* Description */}
        <p style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
          {request.toolDescription}
        </p>

        {/* Arguments / Diff Viewer */}
        <div>
          <div
            style={{
              fontSize: '12px',
              fontWeight: 600,
              color: 'var(--text-muted)',
              marginBottom: '6px',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}
          >
            {request.toolName === 'FileEditTool' || request.toolName === 'FileWriteTool' ? 'Proposed Changes' : 'Arguments'}
          </div>
          
          {request.toolName === 'FileEditTool' && request.toolInput && typeof request.toolInput === 'object' && 'old_string' in request.toolInput ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                <strong>File:</strong> {(request.toolInput as any).path}
              </div>
              <div style={{ padding: '8px', background: 'rgba(239, 68, 68, 0.1)', color: '#FCA5A5', borderLeft: '2px solid #EF4444', fontFamily: 'var(--font-mono)', fontSize: '12px', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px', color: '#EF4444' }}>- Remove:</div>
                {(request.toolInput as any).old_string}
              </div>
              <div style={{ padding: '8px', background: 'rgba(34, 197, 94, 0.1)', color: '#86EFAC', borderLeft: '2px solid #22C55E', fontFamily: 'var(--font-mono)', fontSize: '12px', whiteSpace: 'pre-wrap', maxHeight: '150px', overflowY: 'auto' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px', color: '#22C55E' }}>+ Add:</div>
                {(request.toolInput as any).new_string}
              </div>
            </div>
          ) : request.toolName === 'FileWriteTool' && request.toolInput && typeof request.toolInput === 'object' && 'content' in request.toolInput ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', background: 'var(--bg-primary)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border)' }}>
              <div style={{ fontSize: '12px', color: 'var(--text-primary)', fontFamily: 'var(--font-mono)' }}>
                <strong>File:</strong> {(request.toolInput as any).path}
              </div>
              <div style={{ padding: '8px', background: 'rgba(34, 197, 94, 0.1)', color: '#86EFAC', borderLeft: '2px solid #22C55E', fontFamily: 'var(--font-mono)', fontSize: '12px', whiteSpace: 'pre-wrap', maxHeight: '200px', overflowY: 'auto' }}>
                <div style={{ fontWeight: 600, marginBottom: '4px', color: '#22C55E' }}>+ Write File Content:</div>
                {(request.toolInput as any).content}
              </div>
            </div>
          ) : (
            <pre
              style={{
                background: 'var(--code-bg)',
                padding: '12px',
                borderRadius: '8px',
                fontSize: '12px',
                fontFamily: 'var(--font-mono)',
                color: '#E2E8F0',
                overflow: 'auto',
                maxHeight: '200px',
                margin: 0
              }}
            >
              {JSON.stringify(request.toolInput, null, 2)}
            </pre>
          )}
        </div>

        {/* Working directory */}
        {request.workingDirectory && (
          <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
            📁 {request.workingDirectory}
          </div>
        )}

        {/* Actions */}
        <div
          style={{
            display: 'flex',
            gap: '8px',
            justifyContent: 'flex-end',
            paddingTop: '8px',
            borderTop: '1px solid var(--border)'
          }}
        >
          {(request.toolName === 'FileEditTool' || request.toolName === 'FileWriteTool') && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                let patch = ''
                if (request.toolName === 'FileEditTool') {
                  patch = `--- ${(request.toolInput as any).path}\n+++ ${(request.toolInput as any).path}\n- ${(request.toolInput as any).old_string}\n+ ${(request.toolInput as any).new_string}`
                } else {
                  patch = `--- /dev/null\n+++ ${(request.toolInput as any).path}\n+ ${(request.toolInput as any).content}`
                }
                window.electronAPI.clipboard.writeText(patch)
              }}
              style={{ marginRight: 'auto', color: 'var(--text-secondary)' }}
            >
              📋 Copy Patch
            </Button>
          )}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRespond(request.requestId, false, false)}
            style={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
          >
            Deny / Reject
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRespond(request.requestId, true, true)}
            style={{ color: 'var(--accent-green)', borderColor: 'var(--accent-green)' }}
          >
            Always Allow
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={() => onRespond(request.requestId, true, false)}
          >
            {request.toolName === 'FileEditTool' || request.toolName === 'FileWriteTool' ? 'Apply to File ✓' : 'Allow / Accept ✓'}
          </Button>
        </div>
    </div>
  )
}
