// ═══════════════════════════════════════════════════════════════════
// Lumiq — BashTool
// SECURITY: Disabled by default. Requires explicit user approval
// before EVERY execution. Commands are sanitized and logged.
// ═══════════════════════════════════════════════════════════════════

import { exec } from 'child_process'
import { sanitizeForLogging } from '../security/encryption'
import type { Tool } from './Tool'

// SECURITY: Commands that should NEVER be executed
const BLOCKED_PATTERNS = [
  /rm\s+-rf\s+\//i, // rm -rf /
  /format\s+[a-z]:/i, // format C:
  /del\s+\/[sfq]\s+/i, // del /s /f /q
  /mkfs/i, // mkfs
  /dd\s+if=/i, // dd if=
  />\s*\/dev\/sda/i, // > /dev/sda
  /shutdown/i,
  /reboot/i,
  /init\s+0/i,
  /:(){ :|:& };:/i // fork bomb
]

export class BashTool implements Tool {
  name = 'BashTool'
  description = 'Execute a shell command in the terminal'
  requiresApproval = true // ALWAYS requires approval
  inputSchema = {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The shell command to execute' },
      cwd: { type: 'string', description: 'Working directory (optional)' },
      timeout: { type: 'number', description: 'Timeout in ms (default: 30000)' }
    },
    required: ['command']
  }

  async execute(
    input: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<string> {
    const command = input.command as string
    const cwd = (input.cwd as string) || process.cwd()
    const timeout = (input.timeout as number) || 30000

    // SECURITY: Check for dangerous commands
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(command)) {
        return `[BLOCKED] Command "${sanitizeForLogging(command)}" matches a dangerous pattern and was blocked for safety.`
      }
    }

    return new Promise((resolve) => {
      const child = exec(
        command,
        {
          cwd,
          timeout,
          maxBuffer: 1024 * 1024 * 5, // 5MB max output
          env: { ...process.env, TERM: 'dumb' } // Disable colors/formatting
        },
        (error, stdout, stderr) => {
          if (error) {
            if (error.killed) {
              resolve(`[TIMEOUT] Command timed out after ${timeout}ms`)
            } else {
              resolve(
                `[ERROR] Exit code ${error.code}\n\nSTDERR:\n${stderr}\n\nSTDOUT:\n${stdout}`
              )
            }
          } else {
            const output = stdout + (stderr ? `\n\n[STDERR]\n${stderr}` : '')
            resolve(output || '[OK] Command completed with no output')
          }
        }
      )

      // Support cancellation
      if (signal) {
        signal.addEventListener('abort', () => {
          child.kill('SIGTERM')
        })
      }
    })
  }
}
