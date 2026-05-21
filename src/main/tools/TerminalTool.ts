// ═══════════════════════════════════════════════════════════════════
// Lumiq — TerminalTool
// Interactive persistent terminal sessions with output streaming
// ═══════════════════════════════════════════════════════════════════

import { spawn, ChildProcess } from 'child_process'
import { v4 as uuidv4 } from 'uuid'
import { getWorkspaceRoot, validatePathWithinWorkspace } from '../security/pathValidation'
import type { Tool } from './Tool'
import { validateBashCommand } from './BashTool'
import { validatePowerShellCommand } from './PowerShellTool'

interface TerminalSession {
  id: string
  process: ChildProcess
  output: string[]
  inputQueue: string[]
  isRunning: boolean
  command: string
  createdAt: number
  exitCode: number | null
}

type TerminalAction = 'start' | 'read' | 'write' | 'stop'

interface TerminalInput {
  action: TerminalAction
  sessionId?: string
  command?: string
  input?: string
  cwd?: string
}

const SESSIONS = new Map<string, TerminalSession>()
const MAX_OUTPUT_LINES = 500
const SESSION_TIMEOUT = 30 * 60 * 1000 // 30 minutes
const MAX_SESSIONS = 10

export class TerminalTool implements Tool {
  name = 'TerminalTool'
  description = 'Interactive persistent terminal with session management'
  requiresApproval = true
  isReadOnly = false
  inputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['start', 'read', 'write', 'stop'],
        description: 'Terminal action'
      },
      command: {
        type: 'string',
        description: 'Command to run (required for action: "start")'
      },
      sessionId: {
        type: 'string',
        description: 'Session ID (required for action: "read", "write", "stop")'
      },
      input: {
        type: 'string',
        description: 'Input to send (required for action: "write")'
      },
      cwd: {
        type: 'string',
        description: 'Working directory (optional for action: "start")'
      }
    },
    required: ['action']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const action = input.action as TerminalAction

    // Clean up old sessions
    this.cleanupOldSessions()

    const terminalInput = input as unknown as TerminalInput

    switch (action) {
      case 'start':
        return this.startSession(terminalInput)
      case 'read':
        return this.readSession(terminalInput)
      case 'write':
        return this.writeToSession(terminalInput)
      case 'stop':
        return this.stopSession(terminalInput)
      default:
        return `[ERROR] Unknown action: ${action}`
    }
  }

  private startSession(input: TerminalInput): string {
    if (!input.command) {
      return '[ERROR] "command" is required for action: start'
    }

    if (SESSIONS.size >= MAX_SESSIONS) {
      return `[ERROR] Maximum number of sessions (${MAX_SESSIONS}) reached`
    }

    const security = process.platform === 'win32'
      ? validatePowerShellCommand(input.command)
      : validateBashCommand(input.command)
    if (!security.safe) {
      return `[SECURITY BLOCKED] ${security.reason}`
    }

    const sessionId = uuidv4()

    try {
      const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash'
      const safeCwd = validatePathWithinWorkspace(input.cwd || getWorkspaceRoot())
      const terminalProcess = spawn(shell, {
        cwd: safeCwd,
        stdio: ['pipe', 'pipe', 'pipe'],
        detached: false
      })

      const session: TerminalSession = {
        id: sessionId,
        process: terminalProcess,
        output: [],
        inputQueue: [],
        isRunning: true,
        command: input.command,
        createdAt: Date.now(),
        exitCode: null
      }

      // Handle stdout
      terminalProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString('utf8')
        session.output.push(text)

        // Trim to max lines
        if (session.output.length > MAX_OUTPUT_LINES) {
          session.output = session.output.slice(-MAX_OUTPUT_LINES)
        }
      })

      // Handle stderr
      terminalProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString('utf8')
        session.output.push(`[STDERR] ${text}`)

        if (session.output.length > MAX_OUTPUT_LINES) {
          session.output = session.output.slice(-MAX_OUTPUT_LINES)
        }
      })

      // Handle exit
      terminalProcess.on('exit', (code) => {
        session.isRunning = false
        session.exitCode = code
        session.output.push(`\n[Process exited with code: ${code}]`)
      })

      SESSIONS.set(sessionId, session)

      // Send the initial command
      terminalProcess.stdin?.write(input.command + '\n')

      return `[OK] Terminal session started: ${sessionId}\nCommand: ${input.command}`
    } catch (error) {
      return `[ERROR] Failed to start terminal: ${(error as Error).message}`
    }
  }

  private readSession(input: TerminalInput): string {
    if (!input.sessionId) {
      return '[ERROR] "sessionId" is required for action: read'
    }

    const session = SESSIONS.get(input.sessionId)
    if (!session) {
      return `[ERROR] Session not found: ${input.sessionId}`
    }

    const status = session.isRunning ? 'RUNNING' : `EXITED (code: ${session.exitCode})`
    const output = session.output.join('')

    return `[SESSION: ${input.sessionId}] Status: ${status}\n\n${output}`
  }

  private writeToSession(input: TerminalInput): string {
    if (!input.sessionId) {
      return '[ERROR] "sessionId" is required for action: write'
    }

    if (!input.input) {
      return '[ERROR] "input" is required for action: write'
    }

    const session = SESSIONS.get(input.sessionId)
    if (!session) {
      return `[ERROR] Session not found: ${input.sessionId}`
    }

    if (!session.isRunning) {
      return `[ERROR] Session is not running: ${input.sessionId}`
    }

    try {
      // Ensure input ends with newline for interactive commands
      const input_data = input.input.endsWith('\n') ? input.input : input.input + '\n'
      session.process.stdin?.write(input_data)
      return `[OK] Input sent to session: ${input.sessionId}`
    } catch (error) {
      return `[ERROR] Failed to send input: ${(error as Error).message}`
    }
  }

  private stopSession(input: TerminalInput): string {
    if (!input.sessionId) {
      return '[ERROR] "sessionId" is required for action: stop'
    }

    const session = SESSIONS.get(input.sessionId)
    if (!session) {
      return `[ERROR] Session not found: ${input.sessionId}`
    }

    try {
      session.process.kill('SIGTERM')
      SESSIONS.delete(input.sessionId)
      return `[OK] Session terminated: ${input.sessionId}`
    } catch {
      SESSIONS.delete(input.sessionId)
      return `[OK] Session cleaned up: ${input.sessionId}`
    }
  }

  private cleanupOldSessions(): void {
    const now = Date.now()
    for (const [sessionId, session] of SESSIONS.entries()) {
      if (now - session.createdAt > SESSION_TIMEOUT) {
        try {
          session.process.kill('SIGTERM')
        } catch {
          // Ignore
        }
        SESSIONS.delete(sessionId)
      }
    }
  }
}
