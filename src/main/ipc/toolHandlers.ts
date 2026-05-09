// ═══════════════════════════════════════════════════════════════════
// Lumiq — Tool IPC Handlers
// Handles tool approval response from renderer
// ═══════════════════════════════════════════════════════════════════

import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { ToolApprovalResponse } from '@shared/types'
import { ToolExecutor } from '../agent/ToolExecutor'

export function registerToolHandlers(): void {
  // ── Handle tool approval response ──
  ipcMain.handle(IPC.TOOL_APPROVAL_RESPONSE, (_event, response: ToolApprovalResponse) => {
    ToolExecutor.handleApprovalResponse(response)
  })
}
