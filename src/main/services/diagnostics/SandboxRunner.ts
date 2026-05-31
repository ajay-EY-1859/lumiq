// ═══════════════════════════════════════════════════════════════════
// Lumiq — SandboxRunner
// Securely applies generated patch diffs, validates command outcomes
// in a safe subprocess pool, and performs atomic rollbacks.
// ═══════════════════════════════════════════════════════════════════

import { exec } from 'child_process'
import { existsSync, readFileSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getDatabase } from '../../db/database'
import { DiagnosticsWatcher, mapRowToSelfHealingAttempt } from './DiagnosticsWatcher'

interface ProposalDiff {
  explanation: string
  filePath: string
  targetContent: string
  replacementContent: string
}

export class SandboxRunner {
  private static fileBackups = new Map<string, string>()

  /**
   * Applies the proposed correction patch, executes a validation run,
   * and automatically rolls back if the repair fails to compile/test cleanly.
   */
  public static async applyAndValidate(attemptId: string): Promise<{ success: boolean; error?: string }> {
    console.log(`[SandboxRunner] Commencing gated repair validation for attempt: ${attemptId}`)

    const db = getDatabase()
    const row = db.prepare('SELECT * FROM self_healing_attempts WHERE id = ?').get(attemptId)
    
    if (!row) {
      return { success: false, error: 'Self-healing attempt record not found.' }
    }

    const attempt = mapRowToSelfHealingAttempt(row)

    if (attempt.status !== 'proposed' || !attempt.proposedDiff) {
      return { success: false, error: `Invalid state for repair: status must be "proposed". Current: ${attempt.status}` }
    }

    let proposal: ProposalDiff
    try {
      proposal = JSON.parse(attempt.proposedDiff)
    } catch (parseErr) {
      return { success: false, error: `Failed to parse proposed patch JSON: ${(parseErr as Error).message}` }
    }

    const fullFilePath = join(attempt.workspacePath, proposal.filePath)
    if (!existsSync(fullFilePath)) {
      return { success: false, error: `Target file for patch not found: ${proposal.filePath}` }
    }

    // 1. Take Backup for rolling rollback capability
    let originalContent = ''
    try {
      originalContent = readFileSync(fullFilePath, 'utf-8')
      this.fileBackups.set(fullFilePath, originalContent)
    } catch (backupErr) {
      return { success: false, error: `Failed to create target file backup: ${(backupErr as Error).message}` }
    }

    // 2. Apply Line Replacement Patch
    try {
      const targetContent = proposal.targetContent
      const replacementContent = proposal.replacementContent

      if (!originalContent.includes(targetContent)) {
        return { success: false, error: `Patch application failed: exact target block not found in source file.` }
      }

      // Drop-in replacement
      const patchedContent = originalContent.replace(targetContent, replacementContent)
      writeFileSync(fullFilePath, patchedContent, 'utf-8')
      console.log(`[SandboxRunner] Successfully applied patch to: ${proposal.filePath}`)

      // Notify renderer of file modification to trigger UI refresh
      DiagnosticsWatcher.broadcastToRenderer('fs:file-modified', fullFilePath)

    } catch (applyErr) {
      this.rollbackFile(fullFilePath)
      return { success: false, error: `Failed to write patch to file: ${(applyErr as Error).message}` }
    }

    // Update status to approved/analyzing execution
    db.prepare("UPDATE self_healing_attempts SET status = 'approved' WHERE id = ?").run(attemptId)

    // 3. SECURE SANDBOX RUNNER: Execute gated validation subprocess
    console.log(`[SandboxRunner] Executing validation suite: "${attempt.command}"`)
    const validationOutcome = await this.executeValidationSubprocess(attempt.command, attempt.workspacePath)

    if (validationOutcome.success) {
      // SUCCESS! Finalize repair
      db.prepare(`
        UPDATE self_healing_attempts 
        SET status = 'applied', execution_logs = ?, updated_at = ?
        WHERE id = ?
      `).run(
        validationOutcome.logs,
        new Date().toISOString(),
        attemptId
      )

      console.log(`[SandboxRunner] Gated repair SUCCEEDED! Attempt ${attemptId} finalized as APPLIED.`)
      
      // Clean up in-memory backups since changes succeeded
      this.fileBackups.delete(fullFilePath)
      DiagnosticsWatcher.clearActiveAttempt()

      // Broadcast update to Renderer
      attempt.status = 'applied'
      attempt.executionLogs = validationOutcome.logs
      DiagnosticsWatcher.broadcastToRenderer('self-healing:proposal-generated', attempt)

      return { success: true }
    } else {
      // FAILURE! Atomic Rollback
      console.warn(`[SandboxRunner] Gated repair FAILED validation. Reverting changes on ${proposal.filePath}...`)
      this.rollbackFile(fullFilePath)

      db.prepare(`
        UPDATE self_healing_attempts 
        SET status = 'failed', execution_logs = ?, updated_at = ?
        WHERE id = ?
      `).run(
        `[Validation Failure]\n${validationOutcome.logs}`,
        new Date().toISOString(),
        attemptId
      )

      DiagnosticsWatcher.clearActiveAttempt()

      attempt.status = 'failed'
      attempt.executionLogs = `[Validation Failure]\n${validationOutcome.logs}`
      DiagnosticsWatcher.broadcastToRenderer('self-healing:proposal-generated', attempt)

      return { success: false, error: `Validation failed: exit code ${validationOutcome.exitCode}. Changes rolled back.` }
    }
  }

  /**
   * Discards the repair proposal and reverts changes if they were applied.
   */
  public static async declineAndRevert(attemptId: string): Promise<void> {
    const db = getDatabase()
    const row = db.prepare('SELECT * FROM self_healing_attempts WHERE id = ?').get(attemptId)
    
    if (!row) return

    const attempt = mapRowToSelfHealingAttempt(row)

    try {
      if (attempt.proposedDiff) {
        const proposal = JSON.parse(attempt.proposedDiff)
        const fullFilePath = join(attempt.workspacePath, proposal.filePath)
        this.rollbackFile(fullFilePath)
      }
    } catch (err) {
      console.error('[SandboxRunner] Revert on decline failed:', err)
    }

    db.prepare(`
      UPDATE self_healing_attempts 
      SET status = 'rolled_back', updated_at = ?
      WHERE id = ?
    `).run(new Date().toISOString(), attemptId)

    DiagnosticsWatcher.clearActiveAttempt()
    attempt.status = 'rolled_back'
    DiagnosticsWatcher.broadcastToRenderer('self-healing:proposal-generated', attempt)
  }

  /**
   * Restores a target file to its backup content.
   */
  private static rollbackFile(filePath: string): void {
    const backup = this.fileBackups.get(filePath)
    if (backup !== undefined) {
      try {
        writeFileSync(filePath, backup, 'utf-8')
        console.log(`[SandboxRunner] Reverted file rollback successful: ${filePath}`)
        this.fileBackups.delete(filePath)
        DiagnosticsWatcher.broadcastToRenderer('fs:file-modified', filePath)
      } catch (err) {
        console.error(`[SandboxRunner] CRITICAL: Failed to rollback file ${filePath}:`, err)
      }
    }
  }

  /**
   * Executes command in dumb terminal subprocess to verify build/test status.
   */
  private static executeValidationSubprocess(
    command: string,
    cwd: string
  ): Promise<{ success: boolean; exitCode: number | null; logs: string }> {
    return new Promise((resolve) => {
      const shellPath = process.platform === 'win32' ? undefined : '/bin/bash'
      exec(
        command,
        {
          cwd,
          timeout: 45000, // Safe 45s execution ceiling
          maxBuffer: 1024 * 1024 * 5, // 5MB buffer
          shell: shellPath,
          env: { ...process.env, TERM: 'dumb' }
        },
        (error, stdout, stderr) => {
          const logs = stdout + (stderr ? `\n\n[STDERR]\n${stderr}` : '')
          const code = error ? error.code ?? 1 : 0
          
          // Verify exit code is 0 AND no critical stack errors exist
          const hasError = code !== 0 || this.hasFailureIndicators(logs)
          
          resolve({
            success: !hasError,
            exitCode: code,
            logs
          })
        }
      )
    })
  }

  private static hasFailureIndicators(output: string): boolean {
    const indicators = [
      /FAIL\s+src\//i,
      /ReferenceError:/i,
      /TypeError:/i,
      /SyntaxError:/i,
      /error TS\d+:/i,
      /\[vite\]\s+build\s+error/i
    ]
    return indicators.some((regex) => regex.test(output))
  }
}
