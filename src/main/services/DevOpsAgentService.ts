// ═══════════════════════════════════════════════════════════════════
// Lumiq — Background DevOps Pre-Commit Agent
// ═══════════════════════════════════════════════════════════════════

import { exec } from 'child_process'
import { existsSync, readFileSync } from 'fs'
import { join, dirname } from 'path'
import { getDatabase } from '../db/database'
import { DiagnosticsWatcher } from './diagnostics/DiagnosticsWatcher'

export class DevOpsAgentService {
  private static instance: DevOpsAgentService
  private debounceTimers = new Map<string, NodeJS.Timeout>()
  private runningChecks = new Set<string>()

  public static getInstance(): DevOpsAgentService {
    if (!DevOpsAgentService.instance) {
      DevOpsAgentService.instance = new DevOpsAgentService()
    }
    return DevOpsAgentService.instance
  }

  /**
   * Called whenever a file is saved.
   * Runs debounced background compilation and test checks.
   */
  public async onFileSave(filePath: string): Promise<void> {
    const workspacePath = this.resolveWorkspacePath(filePath)
    if (!workspacePath) return

    // Debounce checks per workspace to avoid multiple concurrent test/build process runs
    const existingTimer = this.debounceTimers.get(workspacePath)
    if (existingTimer) {
      clearTimeout(existingTimer)
    }

    const timer = setTimeout(() => {
      this.debounceTimers.delete(workspacePath)
      this.runValidationSweep(workspacePath)
    }, 2500)

    this.debounceTimers.set(workspacePath, timer)
  }

  /**
   * Resolves the workspace path of the file.
   */
  private resolveWorkspacePath(filePath: string): string | null {
    // Find workspace by looking for package.json or .git in parent directories
    let dir = dirname(filePath)
    while (dir && dir !== dirname(dir)) {
      if (existsSync(join(dir, 'package.json')) || existsSync(join(dir, '.git'))) {
        return dir
      }
      dir = dirname(dir)
    }

    // Fallback: use active session's workspace path
    try {
      const db = getDatabase()
      const activeSession = db.prepare(`
        SELECT workspace_path as workspacePath FROM sessions 
        ORDER BY updated_at DESC LIMIT 1
      `).get() as { workspacePath: string | null } | undefined
      return activeSession?.workspacePath || null
    } catch {
      return null
    }
  }

  /**
   * Performs the background compilation and test run.
   */
  private async runValidationSweep(workspacePath: string): Promise<void> {
    if (this.runningChecks.has(workspacePath)) {
      console.log(`[DevOpsAgentService] Validation sweep already in progress for: ${workspacePath}`)
      return
    }

    this.runningChecks.add(workspacePath)
    console.log(`[DevOpsAgentService] Commencing background validation sweep for: ${workspacePath}`)

    try {
      const command = this.resolveValidationCommand(workspacePath)
      if (!command) {
        this.runningChecks.delete(workspacePath)
        return
      }

      console.log(`[DevOpsAgentService] Executing check: "${command}"`)
      
      const shellPath = process.platform === 'win32' ? undefined : '/bin/bash'
      exec(
        command,
        {
          cwd: workspacePath,
          timeout: 60000, // 60s max
          maxBuffer: 1024 * 1024 * 5,
          shell: shellPath,
          env: { ...process.env, TERM: 'dumb' }
        },
        async (error, stdout, stderr) => {
          this.runningChecks.delete(workspacePath)
          const exitCode = error ? error.code ?? 1 : 0
          const output = stdout + (stderr ? `\n${stderr}` : '')

          if (exitCode !== 0) {
            console.warn(`[DevOpsAgentService] Background validation FAILED (Exit Code ${exitCode}) for ${workspacePath}`)
            
            // Forward failure to DiagnosticsWatcher to trigger self-healing Proposal
            await DiagnosticsWatcher.handleCommandOutcome(command, exitCode, output, workspacePath)
          } else {
            console.log(`[DevOpsAgentService] Background validation PASSED for ${workspacePath}`)
          }
        }
      )
    } catch (err) {
      this.runningChecks.delete(workspacePath)
      console.error('[DevOpsAgentService] Validation check failed to launch:', err)
    }
  }

  /**
   * Detects the best command to run for syntax/testing validation.
   */
  private resolveValidationCommand(workspacePath: string): string | null {
    const pkgPath = join(workspacePath, 'package.json')
    if (!existsSync(pkgPath)) {
      return null
    }

    try {
      const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'))
      const scripts = pkg.scripts || {}

      // Prioritize typecheck/lint/build checks to catch errors fast
      if (scripts.typecheck) {
        return 'npm run typecheck'
      }
      if (scripts.build) {
        return 'npm run build'
      }
      if (scripts.test) {
        return 'npm run test'
      }
    } catch (err) {
      console.error('[DevOpsAgentService] Failed to read package.json scripts:', err)
    }

    return null
  }
}

export const devOpsAgentService = DevOpsAgentService.getInstance()
