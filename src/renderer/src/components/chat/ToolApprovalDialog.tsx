// ═══════════════════════════════════════════════════════════════════
// Lumiq — Tool Approval Dialog
// Modal showing tool details with Approve/Deny/Always Allow
// ═══════════════════════════════════════════════════════════════════

import React from 'react'
import { Modal } from '@renderer/components/ui/Modal'
import { Button } from '@renderer/components/ui/Button'
import type { ToolApprovalRequest } from '@shared/types'

interface ToolApprovalDialogProps {
  request: ToolApprovalRequest | null
  onRespond: (requestId: string, approved: boolean, alwaysAllow: boolean) => void
}

export function ToolApprovalDialog({ request, onRespond }: ToolApprovalDialogProps): React.JSX.Element | null {
  if (!request) return null

  return (
    <Modal
      isOpen={true}
      onClose={() => onRespond(request.requestId, false, false)}
      title="🔧 Tool Execution Request"
      width={520}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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

        {/* Arguments */}
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
            Arguments
          </div>
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
          <Button
            variant="outline"
            size="sm"
            onClick={() => onRespond(request.requestId, false, false)}
            style={{ color: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
          >
            Deny
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
            Approve ✓
          </Button>
        </div>
      </div>
    </Modal>
  )
}
