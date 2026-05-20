// ═══════════════════════════════════════════════════════════════════
// Lumiq — GitTool
// Read-only git operations: status, diff, log, blame, show, branch
// ═══════════════════════════════════════════════════════════════════

import { execSync } from 'child_process'
import { existsSync } from 'fs'
import type { Tool } from './Tool'
import { validatePathWithinWorkspace } from '../security/pathValidation'

type GitCommand = 'status' | 'diff' | 'log' | 'blame' | 'show' | 'branch'

interface GitInput {
  command: GitCommand
  path?: string
  args?: string
}

const ALLOWED_COMMANDS: Set<GitCommand> = new Set(['status', 'diff', 'log', 'blame', 'show', 'branch'])
const MAX_OUTPUT_LINES = 1000

export class GitTool implements Tool {
  name = 'GitTool'
  description = 'Read-only git operations: status, diff, log, blame, show, branch'
  requiresApproval = false
  isReadOnly = true
  inputSchema = {
    type: 'object',
    properties: {
      command: {
        type: 'string',
        enum: ['status', 'diff', 'log', 'blame', 'show', 'branch'],
        description: 'Git command to run'
      },
      path: {
        type: 'string',
        description: 'Path to a file for blame/diff (optional)'
      },
      args: {
        type: 'string',
        description: 'Additional git arguments (e.g., "-5 --oneline" for log)'
      }
    },
    required: ['command']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const gitInput: GitInput = {
      command: input.command as GitCommand,
      path: input.path as string | undefined,
      args: input.args as string | undefined
    }

    // Validate command
    if (!ALLOWED_COMMANDS.has(gitInput.command)) {
      return `[ERROR] Command not allowed: ${gitInput.command}. Allowed: ${Array.from(ALLOWED_COMMANDS).join(', ')}`
    }

    // Validate and sanitize arguments
    if (gitInput.args && !this.isSafeArgs(gitInput.args)) {
      return '[ERROR] Unsafe git arguments detected'
    }

    let filePath = ''
    if (gitInput.path) {
      try {
        filePath = validatePathWithinWorkspace(gitInput.path)
        if (!existsSync(filePath)) {
          return `[ERROR] File not found: ${filePath}`
        }
      } catch (error) {
        return `[ERROR] ${(error as Error).message}`
      }
    }

    try {
      const result = this.runGitCommand(gitInput.command, filePath, gitInput.args)
      return result
    } catch (error) {
      const message = (error as Error).message
      if (message.includes('fatal: not a git repository')) {
        return '[ERROR] Not a git repository'
      }
      if (message.includes('pathspec did not match')) {
        return '[ERROR] File not tracked in git'
      }
      return `[ERROR] Git command failed: ${message}`
    }
  }

  private runGitCommand(command: GitCommand, filePath: string, args?: string): string {
    let gitCmd = `git ${command}`

    if (args) {
      gitCmd += ` ${args}`
    }

    if (filePath) {
      gitCmd += ` "${filePath}"`
    }

    try {
      const output = execSync(gitCmd, {
        encoding: 'utf8',
        stdio: ['pipe', 'pipe', 'pipe'],
        maxBuffer: 1024 * 1024 * 10 // 10MB
      })

      // Limit output to prevent overwhelming the UI
      const lines = output.split('\n')
      if (lines.length > MAX_OUTPUT_LINES) {
        const truncated = lines.slice(0, MAX_OUTPUT_LINES)
        const remaining = lines.length - MAX_OUTPUT_LINES
        return (
          truncated.join('\n') +
          `\n\n[... ${remaining} more lines truncated (max ${MAX_OUTPUT_LINES}) ...]`
        )
      }

      return output
    } catch (error) {
      const stderr = (error as any).stderr?.toString() || (error as Error).message
      throw new Error(stderr)
    }
  }

  private isSafeArgs(args: string): boolean {
    // Block dangerous flags
    const dangerous = [
      '--format=',
      '--exec=',
      '-p', // could be ambiguous with other meanings
      '--patch',
      '--reverse',
      '--remotes',
      '--all'
      // most git args are actually safe for read-only; we're mostly checking for injection
    ]

    // Basic injection check: no semicolons, pipes, redirects
    if (/[;&|><$`]/.test(args)) {
      return false
    }

    // Disallow dangerous git arguments that can alter repository state or show unwanted data.
    if (dangerous.some((token) => args.includes(token))) {
      return false
    }

    return true
  }
}
