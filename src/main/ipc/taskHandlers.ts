// ═══════════════════════════════════════════════════════════════════
// Lumiq — Task Handlers
// ═══════════════════════════════════════════════════════════════════

import { ipcMain, BrowserWindow } from 'electron'
import { spawn, ChildProcessWithoutNullStreams } from 'child_process'
import { basename, resolve } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { IPC } from '@shared/types'
import { getWorkspaceRoot, validatePathWithinWorkspace } from '../security/pathValidation'

const activeTasks = new Map<string, ChildProcessWithoutNullStreams>()

const ALLOWED_TASK_COMMANDS = new Set(["npm", "npx", "node", "yarn", "pnpm", "git", "python", "python3", "go", "cargo"])

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

export function registerTaskHandlers(): void {
  // Run task
  ipcMain.handle(IPC.TASK_RUN, (_event, { command, args, cwd }) => {
    const taskId = uuidv4()
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
      shell: false,
      env: { ...process.env, FORCE_COLOR: '1' }
    })

    activeTasks.set(taskId, child)

    child.stdout.on('data', (data: Buffer) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.TASK_OUTPUT, taskId, data.toString(), 'stdout')
    })

    child.stderr.on('data', (data: Buffer) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.TASK_OUTPUT, taskId, data.toString(), 'stderr')
    })

    child.on('error', (err: Error) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.TASK_OUTPUT, taskId, `Error starting task: ${err.message}`, 'system')
      BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.TASK_EXIT, taskId, 1)
      activeTasks.delete(taskId)
    })

    child.on('exit', (code: number | null) => {
      BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.TASK_OUTPUT, taskId, `\n[Task exited with code ${code}]`, 'system')
      BrowserWindow.getAllWindows()[0]?.webContents.send(IPC.TASK_EXIT, taskId, code)
      activeTasks.delete(taskId)
    })

    return taskId
  })

  // Stop task
  ipcMain.handle(IPC.TASK_STOP, (_event, taskId: string) => {
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
}
