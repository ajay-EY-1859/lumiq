// ═══════════════════════════════════════════════════════════════════
// Lumiq — BashTool
// SECURITY: Disabled by default. Requires explicit user approval
// before EVERY execution. Commands are validated through a
// multi-layer security chain before execution.
// ═══════════════════════════════════════════════════════════════════

import { exec } from 'child_process'
import { sanitizeForLogging } from '../security/encryption'
import { getWorkspaceRoot, validatePathWithinWorkspace } from '../security/pathValidation'
import { DiagnosticsWatcher } from '../services/diagnostics/DiagnosticsWatcher'
import type { Tool } from './Tool'

const MAX_OUTPUT_LENGTH = 10000

function containsShellComment(command: string): boolean {
  const stripped = command.replace(/(['"])(?:\\.|[^\\])*?\1/g, '')
  return /(^|\s)#/.test(stripped)
}

// ─── Security Validator ─────────────────────────────────────────────

interface SecurityResult {
  safe: boolean
  reason?: string
}

// Control characters (null bytes, non-printable) — can hide commands
const CONTROL_CHAR_RE = /[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/

// Command substitution patterns
const COMMAND_SUBSTITUTION_PATTERNS = [
  { pattern: /\$\(/, message: 'command substitution $()' },
  { pattern: /`[^`]/, message: 'backtick command substitution' },
  { pattern: /<\(/, message: 'process substitution <()' },
  { pattern: />\(/, message: 'process substitution >()' },
  { pattern: /\$\[/, message: 'legacy arithmetic expansion $[]' },
]

// Zsh-specific dangerous commands that bypass security checks
const ZSH_DANGEROUS_COMMANDS = new Set([
  'zmodload', 'emulate', 'sysopen', 'sysread', 'syswrite',
  'zpty', 'ztcp', 'zsocket', 'zf_rm', 'zf_mv', 'zf_chmod',
])

// Absolute blocklist — never execute regardless of approval
const ABSOLUTE_BLOCK_PATTERNS = [
  { pattern: /rm\s+-rf\s+\//i, message: 'rm -rf /' },
  { pattern: /format\s+[a-z]:/i, message: 'disk format' },
  { pattern: /mkfs/i, message: 'filesystem creation' },
  { pattern: /dd\s+if=/i, message: 'dd disk write' },
  { pattern: />\s*\/dev\/sd/i, message: 'raw disk write' },
  { pattern: /:\(\)\s*\{.*\|.*&.*\}/s, message: 'fork bomb' },
  { pattern: /\bshutdown\b/i, message: 'system shutdown' },
  { pattern: /\breboot\b/i, message: 'system reboot' },
]

export function validateBashCommand(command: string): SecurityResult {
  // Layer 1: Absolute blocklist
  for (const { pattern, message } of ABSOLUTE_BLOCK_PATTERNS) {
    if (pattern.test(command)) {
      return { safe: false, reason: `Blocked: ${message}` }
    }
  }

  // Layer 2: Control characters
  if (CONTROL_CHAR_RE.test(command)) {
    return { safe: false, reason: 'Control characters detected (possible injection)' }
  }

  // Layer 3: Unicode whitespace (can hide commands)
  if (/[\u00A0\u1680\u2000-\u200A\u2028\u2029\u202F\u205F\u3000\uFEFF]/.test(command)) {
    return { safe: false, reason: 'Unicode whitespace detected (possible obfuscation)' }
  }

  // Layer 4: IFS injection
  if (/\$IFS|\$\{[^}]*IFS/.test(command)) {
    return { safe: false, reason: 'IFS variable injection detected' }
  }

  // Layer 5: /proc/environ access (exposes env vars / API keys)
  if (/\/proc\/.*\/environ/.test(command)) {
    return { safe: false, reason: '/proc/environ access blocked (exposes secrets)' }
  }

  // Layer 6: Command substitution patterns
  for (const { pattern, message } of COMMAND_SUBSTITUTION_PATTERNS) {
    if (pattern.test(command)) {
      return { safe: false, reason: `Requires approval: ${message}` }
    }
  }

  // Layer 7: Brace expansion (can hide dangerous flags)
  if (/\{[^}]*,[^}]*\}/.test(command)) {
    return { safe: false, reason: 'Brace expansion detected (possible flag obfuscation)' }
  }

  // Layer 8: ANSI-C quoting (can encode any character)
  if (/\$'[^']*'/.test(command)) {
    return { safe: false, reason: 'ANSI-C quoting detected (can hide characters)' }
  }

  // Layer 9: Obfuscated flags (empty quotes before dash)
  if (/(?:''|"")+\s*-/.test(command) || /(?:^|\s)['"]-/.test(command)) {
    return { safe: false, reason: 'Obfuscated flag pattern detected' }
  }

  // Layer 10: Zsh dangerous commands
  const baseCmd = command.trim().split(/\s+/)[0]?.split('/').pop() || ''
  if (ZSH_DANGEROUS_COMMANDS.has(baseCmd)) {
    return { safe: false, reason: `Dangerous command blocked: ${baseCmd}` }
  }

  // Layer 11: fc -e (executes arbitrary editor on history)
  if (/\bfc\s+.*-[a-z]*e/.test(command)) {
    return { safe: false, reason: 'fc -e blocked (arbitrary command execution via editor)' }
  }

  // Layer 12: Backslash before shell operators (parser differential)
  if (/\\[;|&<>]/.test(command)) {
    return { safe: false, reason: 'Backslash-escaped operator detected (parser differential)' }
  }

  // Layer 13: Comments starting with # outside of quotes
  if (containsShellComment(command)) {
    return { safe: false, reason: 'Shell comment detected (possible injection)' }
  }

  return { safe: true }
}

// ─── BashTool ────────────────────────────────────────────────────────

export class BashTool implements Tool {
  name = 'BashTool'
  description = 'Execute a shell command in the terminal'
  requiresApproval = true // ALWAYS requires approval
  isReadOnly = false
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
    const timeout = (input.timeout as number) || 30000
    let cwd: string

    try {
      cwd = validatePathWithinWorkspace((input.cwd as string) || getWorkspaceRoot())
    } catch (error) {
      return `[ERROR] ${(error as Error).message}`
    }

    // Run security validation
    const security = validateBashCommand(command)
    if (!security.safe) {
      return `[SECURITY BLOCKED] ${security.reason}\nCommand: ${sanitizeForLogging(command)}`
    }

    return new Promise((resolve) => {
      // SECURITY: On Windows use cmd.exe explicitly; never rely on SHELL env var
      // which may be undefined or point to an untrusted binary.
      const shellPath = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'
      const child = exec(
        command,
        {
          cwd,
          timeout,
          maxBuffer: 1024 * 1024 * 5,
          shell: shellPath,
          env: { ...process.env, TERM: 'dumb' }
        },
        (error, stdout, stderr) => {
          const exitCode = error ? error.code ?? 1 : 0
          const fullOutput = stdout + (stderr ? `\n\n[STDERR]\n${stderr}` : '')

          // Trigger DiagnosticsWatcher to inspect output and self-heal if necessary
          try {
            DiagnosticsWatcher.handleCommandOutcome(command, exitCode, fullOutput, cwd)
          } catch (err) {
            console.error('[BashTool] DiagnosticsWatcher trigger failed:', err)
          }

          if (error) {
            if (error.killed) {
              resolve(`[TIMEOUT] Command timed out after ${timeout}ms`)
            } else {
              resolve(
                `[ERROR] Exit code ${error.code}\n\nSTDERR:\n${stderr}\n\nSTDOUT:\n${stdout}`
              )
            }
          } else {
            let output = stdout + (stderr ? `\n\n[STDERR]\n${stderr}` : '')
            if (output.length > MAX_OUTPUT_LENGTH) {
              output = `${output.slice(0, MAX_OUTPUT_LENGTH)}\n\n...output truncated to ${MAX_OUTPUT_LENGTH} characters...`
            }
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
