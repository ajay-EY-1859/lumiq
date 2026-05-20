// ═══════════════════════════════════════════════════════════════════
// Lumiq — Tool IPC Handlers
// Handles tool approval response from renderer
// ═══════════════════════════════════════════════════════════════════

import { IPC } from '@shared/types'
import type { ToolApprovalResponse } from '@shared/types'
import { ToolExecutor } from '../agent/ToolExecutor'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

export function registerToolHandlers(): void {
  // ── Handle tool approval response ──
  handleWithTimeout(IPC.TOOL_APPROVAL_RESPONSE, IPC_TIMEOUT.short, (_event, response: ToolApprovalResponse) => {
    ToolExecutor.handleApprovalResponse(response)
  })
}
