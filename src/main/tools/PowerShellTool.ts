// ═══════════════════════════════════════════════════════════════════
// Lumiq — PowerShellTool
// Windows-native PowerShell execution tool. Requires approval.
// Uses PowerShell Core (pwsh) with fallback to Windows PowerShell.
// ═══════════════════════════════════════════════════════════════════

import { exec } from 'child_process'
import { sanitizeForLogging } from '../security/encryption'
import type { Tool } from './Tool'
import { validatePathWithinWorkspace } from '../security/pathValidation'

// Absolute blocklist — never execute regardless of approval
const ABSOLUTE_BLOCK_PATTERNS = [
  { pattern: /Format-Volume/i, message: 'disk format' },
  { pattern: /Remove-Item\s+.*-Recurse\s+.*[A-Z]:\\/i, message: 'recursive root delete' },
  { pattern: /Stop-Computer/i, message: 'system shutdown' },
  { pattern: /Restart-Computer/i, message: 'system reboot' },
  { pattern: /Clear-Disk/i, message: 'disk wipe' },
  { pattern: /Initialize-Disk/i, message: 'disk initialization' },
  { pattern: /Set-ExecutionPolicy\s+Unrestricted/i, message: 'unrestricted execution policy' },
  { pattern: /Invoke-Expression.*\$\(/i, message: 'dynamic code execution' },
  { pattern: /\.\s+\$\(/i, message: 'dot-sourced dynamic expression' }
]

// Control characters
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/

export function validatePowerShellCommand(command: string): { safe: boolean; reason?: string } {
  for (const { pattern, message } of ABSOLUTE_BLOCK_PATTERNS) {
    if (pattern.test(command)) {
      return { safe: false, reason: `Blocked: ${message}` }
    }
  }

  if (CONTROL_CHAR_RE.test(command)) {
    return { safe: false, reason: 'Control characters detected (possible injection)' }
  }

  return { safe: true }
}

export class PowerShellTool implements Tool {
  name = 'PowerShellTool'
  description = 'Execute a PowerShell command on Windows. Use for Windows-specific operations, registry access, system management, and .NET scripting.'
  requiresApproval = true // ALWAYS requires approval
  isReadOnly = false
  inputSchema = {
    type: 'object',
    properties: {
      command: { type: 'string', description: 'The PowerShell command or script to execute' },
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
    const cwd = validatePathWithinWorkspace((input.cwd as string) || process.cwd())
    const timeout = (input.timeout as number) || 30000

    // Security validation
    const security = validatePowerShellCommand(command)
    if (!security.safe) {
      return `[SECURITY BLOCKED] ${security.reason}\nCommand: ${sanitizeForLogging(command)}`
    }

    const encodedCommand = Buffer.from(command, 'utf16le').toString('base64')

    return new Promise((resolve) => {
      const shell = process.env.PWSH_EXE || 'pwsh'
      const fullCommand = `${shell} -NoProfile -NonInteractive -EncodedCommand ${encodedCommand}`
      const execOptions = {
        cwd,
        timeout,
        maxBuffer: 1024 * 1024 * 5,
        env: { ...process.env }
      }

      const child = exec(
        fullCommand,
        execOptions,
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

      if (signal) {
        signal.addEventListener('abort', () => child.kill('SIGTERM'))
      }
    })
  }
}
