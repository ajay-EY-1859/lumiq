// ═══════════════════════════════════════════════════════════════════
// Lumiq — Self-Healing IPC Handlers
// Exposes IPC channels to let the React Renderer get the active failure,
// apply proposed fixes, and decline/rollback repair attempts.
// ═══════════════════════════════════════════════════════════════════

import { ipcMain } from 'electron'
import { IPC } from '../../shared/types'
import { getDatabase } from '../db/database'
import { SandboxRunner } from '../services/diagnostics/SandboxRunner'
import { DiagnosticsWatcher, mapRowToSelfHealingAttempt } from '../services/diagnostics/DiagnosticsWatcher'
import { fixSubagent } from '../services/diagnostics/FixSubagent'
import type { SelfHealingAttempt } from '../../shared/types'

export function registerSelfHealingHandlers(): void {
  // ── Get Active Failure Attempt ──
  ipcMain.handle(IPC.SELF_HEALING_GET_ACTIVE, async (): Promise<SelfHealingAttempt | null> => {
    try {
      const db = getDatabase()
      
      // Look for any self-healing attempt in 'detected', 'analyzing', or 'proposed' state
      const row = db.prepare(`
        SELECT * FROM self_healing_attempts 
        WHERE status IN ('detected', 'analyzing', 'proposed')
        ORDER BY created_at DESC LIMIT 1
      `).get()

      return row ? mapRowToSelfHealingAttempt(row) : null
    } catch (err) {
      console.error('[SelfHealingHandlers] Failed to query active attempt:', err)
      return null
    }
  })

  // ── Apply and Validate proposed fix ──
  ipcMain.handle(IPC.SELF_HEALING_APPLY, async (_event, attemptId: string): Promise<{ success: boolean; error?: string }> => {
    try {
      return await SandboxRunner.applyAndValidate(attemptId)
    } catch (err) {
      console.error('[SelfHealingHandlers] Error in apply handler:', err)
      return { success: false, error: (err as Error).message }
    }
  })

  // ── Decline / Revert attempt ──
  ipcMain.handle(IPC.SELF_HEALING_DECLINE, async (_event, attemptId: string): Promise<void> => {
    try {
      await SandboxRunner.declineAndRevert(attemptId)
    } catch (err) {
      console.error('[SelfHealingHandlers] Error in decline handler:', err)
    }
  })

  // ── Refine / Retry attempt (Self-Reflection Loop) ──
  ipcMain.handle(IPC.SELF_HEALING_REFINE, async (_event, attemptId: string): Promise<void> => {
    try {
      const db = getDatabase()
      const row = db.prepare('SELECT * FROM self_healing_attempts WHERE id = ?').get(attemptId)
      if (!row) return

      const attempt = mapRowToSelfHealingAttempt(row)
      attempt.status = 'analyzing'
      attempt.updatedAt = new Date().toISOString()

      db.prepare(`
        UPDATE self_healing_attempts 
        SET status = 'analyzing', updated_at = ?
        WHERE id = ?
      `).run(attempt.updatedAt, attemptId)

      // Broadcast update to Renderer
      DiagnosticsWatcher.broadcastToRenderer('self-healing:failure-detected', attempt)

      // Asynchronously trigger FixSubagent analysis with the reflection logs payload
      setTimeout(() => {
        fixSubagent.analyzeAndFix(attempt).catch((subagentErr) => {
          console.error('[SelfHealingHandlers] Reflection FixSubagent failed:', subagentErr)
        })
      }, 50)

    } catch (err) {
      console.error('[SelfHealingHandlers] Error in refine handler:', err)
    }
  })
}
