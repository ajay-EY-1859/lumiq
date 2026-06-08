// ═══════════════════════════════════════════════════════════════════
// Lumiq — Task Handlers
// ═══════════════════════════════════════════════════════════════════

import { BrowserWindow } from 'electron'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { basename, resolve } from 'path'
import { IPC } from '@shared/types'
import type { WorkspaceTaskDefinition, TaskSelfHealSuggestion } from '@shared/types'
import { getWorkspaceRoot, validatePathWithinWorkspace } from '../security/pathValidation'
import {
  deleteWorkspaceTask,
  listWorkspaceTasks,
  saveWorkspaceTask,
  syncPackageJsonTasks
} from '../db/workspaceTasks'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

const activeTasks = new Map<string, ChildProcessWithoutNullStreams>()

const ALLOWED_TASK_COMMANDS = new Set(["npm", "npx", "node", "yarn", "pnpm", "git", "python", "python3", "go", "cargo", "java", "javac", "gcc", "g++", "clang", "clang++", "make", "mingw32-make", "dotnet"])

const MAX_SELF_HEAL_LINES = 20

function isAllowedTaskCommand(command: string, cwd: string): boolean {
  const commandName = basename(command).toLowerCase()
  if (ALLOWED_TASK_COMMANDS.has(commandName)) {
    return true
  }

  try {
    const resolvedCommand = resolve(cwd, command)
    validatePathWithinWorkspace(resolvedCommand)
    return true
  } catch {
    return false
  }
}

function createSelfHealSuggestion(taskId: string, code: number | null, stderrLines: string[]): TaskSelfHealSuggestion | null {
  const errorText = stderrLines
    .join('')
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(-MAX_SELF_HEAL_LINES)

  if (code === 0 || errorText.length === 0) {
    return null
  }

  return {
    taskId,
    recommendation: 'Lumiq detected a failing developer task and captured the most recent error output for a self-healing recommendation.',
    summary: `Task exited with code ${code}. Review the latest stderr output and ask Lumiq to fix the broken code path.`,
    errorLines: errorText
  }
}

function emitSelfHealSuggestion(taskId: string, code: number | null, stderrLines: string[], sender?: Electron.WebContents): void {
  const suggestion = createSelfHealSuggestion(taskId, code, stderrLines)
  if (suggestion) {
    if (sender) {
      sender.send(IPC.TASK_SELF_HEAL, suggestion)
    } else {
      BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.TASK_SELF_HEAL, suggestion)
    }
  }
}

export function registerTaskHandlers(): void {
  handleWithTimeout(IPC.TASK_LIST_DEFINITIONS, IPC_TIMEOUT.short, (_event, workspacePath: string) => {
    const safePath = validatePathWithinWorkspace(workspacePath)
    return listWorkspaceTasks(safePath)
  })

  handleWithTimeout(IPC.TASK_SYNC_WORKSPACE, IPC_TIMEOUT.short, async (_event, workspacePath: string) => {
    const safePath = validatePathWithinWorkspace(workspacePath)
    return await syncPackageJsonTasks(safePath)
  })

  handleWithTimeout(
    IPC.TASK_SAVE_DEFINITION,
    IPC_TIMEOUT.short,
    (_event, definition: Omit<WorkspaceTaskDefinition, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => {
      const safePath = validatePathWithinWorkspace(definition.workspacePath)
      return saveWorkspaceTask({ ...definition, workspacePath: safePath })
    }
  )

  handleWithTimeout(
    IPC.TASK_DELETE_DEFINITION,
    IPC_TIMEOUT.short,
    (_event, data: { workspacePath: string; name: string }) => {
      const safePath = validatePathWithinWorkspace(data.workspacePath)
      return deleteWorkspaceTask(safePath, data.name)
    }
  )

  // Run task
  handleWithTimeout(IPC.TASK_RUN, IPC_TIMEOUT.long, (_event, { taskId, command, args, cwd }) => {
    const safeCwd = validatePathWithinWorkspace(cwd || getWorkspaceRoot())
    const safeCommand = typeof command === 'string' ? command : ''
    const safeArgs = Array.isArray(args) ? args.map((arg) => String(arg)) : []

    if (!isAllowedTaskCommand(safeCommand, safeCwd)) {
      throw new Error(`Command not allowed: ${safeCommand}`)
    }

    if (safeArgs.some((arg) => /[&|;<>`]/.test(arg))) {
      throw new Error('Invalid characters in task arguments')
    }

    const child = spawn(safeCommand, safeArgs, {
      cwd: safeCwd,
      shell: process.platform === 'win32',
      env: { ...process.env, FORCE_COLOR: '1', PYTHONUNBUFFERED: '1' }
    })

    activeTasks.set(taskId, child)

    child.stdout.on('data', (data: Buffer) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.TASK_OUTPUT, taskId, data.toString(), 'stdout')
    })

    const stderrLines: string[] = []

    child.stderr.on('data', (data: Buffer) => {
      const text = data.toString()
      stderrLines.push(text)
      if (stderrLines.length > MAX_SELF_HEAL_LINES) {
        stderrLines.splice(0, stderrLines.length - MAX_SELF_HEAL_LINES)
      }
      BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.TASK_OUTPUT, taskId, text, 'stderr')
    })

    child.on('error', (err: Error) => {
      const errorMessage = `Error starting task: ${err.message}`
      BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.TASK_OUTPUT, taskId, errorMessage, 'system')
      BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.TASK_EXIT, taskId, 1)
      emitSelfHealSuggestion(taskId, 1, [errorMessage])
      activeTasks.delete(taskId)
    })

    child.on('exit', (code: number | null) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.TASK_OUTPUT, taskId, `\n[Task exited with code ${code}]`, 'system')
      BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.TASK_EXIT, taskId, code)
      emitSelfHealSuggestion(taskId, code, stderrLines)
      activeTasks.delete(taskId)
    })

    return taskId
  })

  // Stop task
  handleWithTimeout(IPC.TASK_STOP, IPC_TIMEOUT.long, (_event, taskId: string) => {
    const child = activeTasks.get(taskId)
    if (child) {
      if (process.platform === 'win32') {
        // On Windows, child.kill() doesn't kill the child processes created by cmd.exe /c
        // We use taskkill to forcefully kill the process tree.
        spawn('taskkill', ['/pid', child.pid!.toString(), '/t', '/f'])
      } else {
        child.kill()
      }
      activeTasks.delete(taskId)
    }
  })

  handleWithTimeout(IPC.TASK_STDIN, IPC_TIMEOUT.long, (_event, data: { taskId: string; input: string }) => {
    const child = activeTasks.get(data.taskId)
    if (!child || !child.stdin.writable) {
      throw new Error('Task is not running or stdin is closed')
    }
    let safeInput = data.input
    // Translate terminal carriage returns (\r) to standard newlines (\n)
    // because piped stdin does not perform automatic newline translation like a PTY does.
    safeInput = safeInput.replace(/\r(?!\n)/g, '\n')
    child.stdin.write(safeInput)
  })
}
