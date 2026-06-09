// ═══════════════════════════════════════════════════════════════════
// Lumiq — DiagnosticsWatcher
// Intercepts terminal/bash command execution failures, extracts error
// stack traces, captures workspace file snapshots, and kicks off
// the autonomous self-healing background agent cycle.
// ═══════════════════════════════════════════════════════════════════

import { BrowserWindow } from 'electron'
import { resolve } from 'path'
import { existsSync, readFileSync } from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../../db/database'
import { fixSubagent } from './FixSubagent'
import type { SelfHealingAttempt } from '../../../shared/types'

export class DiagnosticsWatcher {
  private static activeAttemptId: string | null = null

  /**
   * Evaluates if a shell command execution returned a failure.
   * If it did, triggers the full diagnostics and repair pipeline.
   */
  public static async handleCommandOutcome(
    command: string,
    exitCode: number | null,
    output: string,
    cwd: string
  ): Promise<void> {
    // Only intercept true failures (non-zero exit code or presence of critical failure stacks)
    const isFailure = exitCode !== 0 || this.hasFailureIndicators(output)
    if (!isFailure) {
      return
    }

    console.log(`[DiagnosticsWatcher] Intercepted shell command failure: "${command}" in ${cwd}`)

    try {
      const db = getDatabase()

      // Resolve the most recently active session
      const activeSession = db.prepare(`
        SELECT id, workspace_path as workspacePath FROM sessions 
        ORDER BY updated_at DESC LIMIT 1
      `).get() as { id: string; workspacePath: string | null } | undefined

      if (!activeSession) {
        console.warn('[DiagnosticsWatcher] No active session found to bind self-healing attempt.')
        return
      }

      const sessionId = activeSession.id
      const workspacePath = activeSession.workspacePath || cwd

      // Parse error details
      const parsedError = this.parseErrorDetails(output, workspacePath)

      // Capture snapshot of the relevant files
      const snapshot: Record<string, string> = {}
      if (parsedError.filePath && existsSync(parsedError.filePath)) {
        try {
          const content = readFileSync(parsedError.filePath, 'utf-8')
          const relativePath = parsedError.filePath.replace(workspacePath, '').replace(/^[\\/]/, '')
          snapshot[relativePath] = content
        } catch (readErr) {
          console.error('[DiagnosticsWatcher] Failed to capture file snapshot:', readErr)
        }
      }

      const attemptId = uuidv4()
      this.activeAttemptId = attemptId

      const attemptRecord: SelfHealingAttempt = {
        id: attemptId,
        sessionId,
        workspacePath,
        command,
        errorMessage: parsedError.message,
        stackTrace: parsedError.stackTrace || output.slice(0, 4000), // Fallback to raw output snippet
        capturedSnapshot: JSON.stringify(snapshot),
        status: 'analyzing',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }

      // Persist to database
      db.prepare(`
        INSERT INTO self_healing_attempts (id, session_id, workspace_path, command, error_message, stack_trace, captured_snapshot, status)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        attemptRecord.id,
        attemptRecord.sessionId,
        attemptRecord.workspacePath,
        attemptRecord.command,
        attemptRecord.errorMessage || 'Unknown Command Failure',
        attemptRecord.stackTrace,
        attemptRecord.capturedSnapshot,
        attemptRecord.status
      )

      console.log(`[DiagnosticsWatcher] Persisted diagnostic failure: ${attemptId} (${attemptRecord.errorMessage})`)

      // Broadcast to Renderer
      this.broadcastToRenderer('self-healing:failure-detected', attemptRecord)

      // Asynchronously trigger FixSubagent analysis and patch generation
      // We run this out-of-band to prevent blocking the tool execution thread
      setTimeout(() => {
        fixSubagent.analyzeAndFix(attemptRecord).catch((subagentErr) => {
          console.error(`[DiagnosticsWatcher] FixSubagent failed:`, subagentErr)
        })
      }, 50)

    } catch (err) {
      console.error('[DiagnosticsWatcher] Failed to register failure event:', err)
    }
  }

  /**
   * Checks if raw output string contains indicators of terminal compiler/test failures.
   */
  private static hasFailureIndicators(output: string): boolean {
    const indicators = [
      /FAIL\s+src\//i, // Vitest / Jest test failure
      /ReferenceError:/i,
      /TypeError:/i,
      /SyntaxError:/i,
      /error TS\d+:/i, // TypeScript compilation error
      /\[vite\]\s+build\s+error/i,
      /Compilation failed/i,
      /Build Failed/i
    ]
    return indicators.some((regex) => regex.test(output))
  }

  /**
   * Attempts to extract structured error details (failing file, line, message) from raw console output.
   */
  private static parseErrorDetails(
    output: string,
    workspacePath: string
  ): { message: string; filePath?: string; line?: number; stackTrace?: string } {
    let message = 'Command execution failed'
    let filePath: string | undefined
    let line: number | undefined

    // 1. Try matching standard JS/TS stack trace: at Object.<anonymous> (file_path:line:col)
    const jsStackMatch = output.match(/at\s+.*?\((.*?):(\d+):(\d+)\)/)
    if (jsStackMatch && jsStackMatch[1]) {
      const parsedPath = resolve(jsStackMatch[1])
      if (existsSync(parsedPath)) {
        filePath = parsedPath
        line = parseInt(jsStackMatch[2]!, 10)
      }
    }

    // 2. Try matching compiler file/line headers (e.g. /path/to/file.ts:12:34 or D:\path.ts:12)
    if (!filePath) {
      const fileHeaderMatch = output.match(/((?:[a-zA-Z]:)?[\\/][^:\n]+):(\d+):(\d+)/)
      if (fileHeaderMatch && fileHeaderMatch[1]) {
        const parsedPath = resolve(fileHeaderMatch[1].trim())
        if (existsSync(parsedPath)) {
          filePath = parsedPath
          line = parseInt(fileHeaderMatch[2]!, 10)
        }
      }
    }

    // 3. Extract the primary error message line
    const errorMsgMatch = output.match(/(?:Error|TypeError|ReferenceError|SyntaxError):\s+(.*)/i)
    if (errorMsgMatch && errorMsgMatch[1]) {
      message = errorMsgMatch[1].trim()
    } else {
      // Fallback: look for lines starting with 'error' or 'fail'
      const errorLines = output.split('\n').filter(l => /error|fail|exception/i.test(l))
      if (errorLines.length > 0) {
        message = errorLines[0].trim()
      }
    }

    // Format final message to include location details if extracted
    if (filePath) {
      const relativeFile = filePath.replace(workspacePath, '').replace(/^[\\/]/, '')
      message = `Error in ${relativeFile}:${line || '?'} — ${message}`
    }

    return {
      message,
      filePath,
      line,
      stackTrace: output
    }
  }

  /**
   * Returns the active failure event ID.
   */
  public static getActiveAttemptId(): string | null {
    return this.activeAttemptId
  }

  /**
   * Resets active failure state.
   */
  public static clearActiveAttempt(): void {
    this.activeAttemptId = null
  }

  /**
   * Emits live events to Electron's focused renderer windows securely.
   */
  public static broadcastToRenderer(channel: string, data: any): void {
    const windows = BrowserWindow.getAllWindows()
    for (const win of windows) {
      if (!win.isDestroyed()) {
        win.webContents.send(channel, data)
      }
    }
  }
}

export function mapRowToSelfHealingAttempt(row: any): SelfHealingAttempt {
  return {
    id: row.id,
    sessionId: row.session_id,
    workspacePath: row.workspace_path,
    command: row.command,
    errorMessage: row.error_message || undefined,
    stackTrace: row.stack_trace || undefined,
    capturedSnapshot: row.captured_snapshot || undefined,
    proposedDiff: row.proposed_diff || undefined,
    status: row.status,
    executionLogs: row.execution_logs || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}
