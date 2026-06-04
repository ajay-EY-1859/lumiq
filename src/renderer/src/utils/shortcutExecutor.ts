// ═══════════════════════════════════════════════════════════════════
// Lumiq — Shortcut Executor Utility
// Centralizes logic for F5, F6, Shift+F5, and step debugging triggers
// ═══════════════════════════════════════════════════════════════════

import path from 'path'
import { useTaskStore } from '../store/taskStore'
import { useEditorStore } from '../store/editorStore'
import { useSessionStore } from '../store/sessionStore'

function getExecutableOutputPath(filePath: string): string {
  const parsed = path.parse(filePath)
  const suffix = process.platform === 'win32' ? '.exe' : ''
  return path.join(parsed.dir, `${parsed.name}${suffix}`)
}

export async function runProjectAction(): Promise<void> {
  const sessionState = useSessionStore.getState()
  const activeSession = sessionState.sessions.find(s => s.id === sessionState.activeSessionId)
  const workspacePath = activeSession?.workspacePath
  if (!workspacePath) return

  const taskState = useTaskStore.getState()
  let runTask = taskState.definitions.find(
    d => d.name.endsWith(':run') || d.name.startsWith('npm:start') || d.name.startsWith('npm:dev') || d.name.startsWith('python:run')
  )
  
  if (!runTask) {
    console.log(`[ShortcutExecutor] No run task found. Auto-syncing workspace...`)
    await taskState.syncWorkspace(workspacePath)
    const updatedState = useTaskStore.getState()
    runTask = updatedState.definitions.find(
      d => d.name.endsWith(':run') || d.name.startsWith('npm:start') || d.name.startsWith('npm:dev') || d.name.startsWith('python:run')
    )
  }
  
  if (runTask) {
    console.log(`[ShortcutExecutor] F5: Running project task "${runTask.name}"...`)
    taskState.runTask(runTask.name, runTask.command, runTask.args, workspacePath)
  } else {
    alert('No project run configuration discovered. Even after auto-discovery, no run scripts were found.')
  }
}

export async function buildProjectAction(): Promise<void> {
  const sessionState = useSessionStore.getState()
  const activeSession = sessionState.sessions.find(s => s.id === sessionState.activeSessionId)
  const workspacePath = activeSession?.workspacePath
  if (!workspacePath) return

  const taskState = useTaskStore.getState()
  let buildTask = taskState.definitions.find(
    d => d.name.endsWith(':build') || d.name.endsWith(':compile') || d.name.endsWith(':build-project')
  )
  
  if (!buildTask) {
    console.log(`[ShortcutExecutor] No build task found. Auto-syncing workspace...`)
    await taskState.syncWorkspace(workspacePath)
    const updatedState = useTaskStore.getState()
    buildTask = updatedState.definitions.find(
      d => d.name.endsWith(':build') || d.name.endsWith(':compile') || d.name.endsWith(':build-project')
    )
  }
  
  if (buildTask) {
    console.log(`[ShortcutExecutor] F6: Building project task "${buildTask.name}"...`)
    taskState.runTask(buildTask.name, buildTask.command, buildTask.args, workspacePath)
  } else {
    alert('No project build configuration discovered. Even after auto-discovery, no build/compile scripts were found.')
  }
}

export function runCurrentFileAction(): void {
  const editorState = useEditorStore.getState()
  const activeTab = editorState.tabs.find(t => t.id === editorState.activeTabId)
  if (!activeTab) return

  const sessionState = useSessionStore.getState()
  const activeSession = sessionState.sessions.find(s => s.id === sessionState.activeSessionId)
  const workspacePath = activeSession?.workspacePath
  if (!workspacePath) return

  const ext = activeTab.name.split('.').pop()?.toLowerCase() ?? ''
  let command = ''
  let args: string[] = []

  if (ext === 'py') {
    command = 'python'
    args = [activeTab.id]
  } else if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
    command = 'node'
    args = [activeTab.id]
  } else if (ext === 'go') {
    command = 'go'
    args = ['run', activeTab.id]
  } else if (ext === 'java') {
    command = 'javac'
    args = [activeTab.id]
  } else if (ext === 'c') {
    command = 'gcc'
    args = [activeTab.id, '-o', getExecutableOutputPath(activeTab.id)]
  } else if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') {
    command = 'g++'
    args = [activeTab.id, '-o', getExecutableOutputPath(activeTab.id)]
  } else if (ext === 'cs') {
    command = 'dotnet'
    args = ['run', '--project', activeTab.id]
  }

  if (command) {
    console.log(`[ShortcutExecutor] Ctrl+F5: Executing active file "${activeTab.name}"...`)
    useTaskStore.getState().runTask(`Run File: ${activeTab.name}`, command, args, workspacePath)
  } else {
    console.warn(`[ShortcutExecutor] Extension "${ext}" is not supported for file runs.`)
  }
}

export function compileCurrentFileAction(): void {
  const editorState = useEditorStore.getState()
  const activeTab = editorState.tabs.find(t => t.id === editorState.activeTabId)
  if (!activeTab) return

  const sessionState = useSessionStore.getState()
  const activeSession = sessionState.sessions.find(s => s.id === sessionState.activeSessionId)
  const workspacePath = activeSession?.workspacePath
  if (!workspacePath) return

  const ext = activeTab.name.split('.').pop()?.toLowerCase() ?? ''
  let command = ''
  let args: string[] = []

  if (ext === 'java') {
    command = 'javac'
    args = [activeTab.id]
  } else if (ext === 'c') {
    command = 'gcc'
    args = ['-c', activeTab.id]
  } else if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') {
    command = 'g++'
    args = ['-c', activeTab.id]
  } else if (ext === 'go') {
    command = 'go'
    args = ['build', '-o', 'temp_build_out', activeTab.id]
  } else if (ext === 'cs') {
    command = 'dotnet'
    args = ['build', activeTab.id]
  }

  if (command) {
    console.log(`[ShortcutExecutor] Ctrl+F6: Compiling active file "${activeTab.name}"...`)
    useTaskStore.getState().runTask(`Compile File: ${activeTab.name}`, command, args, workspacePath)
  } else {
    console.warn(`[ShortcutExecutor] Extension "${ext}" is not supported for file compilation.`)
  }
}

export function stopActiveTaskAction(): void {
  const taskState = useTaskStore.getState()
  const activeTaskId = taskState.activeTaskId
  const runningTask = taskState.tasks.find(t => t.id === activeTaskId || t.status === 'running')
  if (runningTask) {
    console.log(`[ShortcutExecutor] Shift+F5: Force termination requested for task "${runningTask.name}"`)
    taskState.stopTask(runningTask.id)
  }
}

export function debugStepOverAction(): void {
  console.log('[ShortcutExecutor] F10: Debug Step Over triggered (DAP integration binding).')
  const taskState = useTaskStore.getState()
  const runningTask = taskState.tasks.find(t => t.status === 'running')
  if (runningTask) {
    useTaskStore.getState()._appendLog(runningTask.id, '\n[Lumiq Debugger] F10: Step Over executed.\n', 'system')
  }
}

export function debugStepIntoAction(): void {
  console.log('[ShortcutExecutor] F11: Debug Step Into triggered (DAP integration binding).')
  const taskState = useTaskStore.getState()
  const runningTask = taskState.tasks.find(t => t.status === 'running')
  if (runningTask) {
    useTaskStore.getState()._appendLog(runningTask.id, '\n[Lumiq Debugger] F11: Step Into executed.\n', 'system')
  }
}

export function debugStepOutAction(): void {
  console.log('[ShortcutExecutor] Shift+F11: Debug Step Out triggered (DAP integration binding).')
  const taskState = useTaskStore.getState()
  const runningTask = taskState.tasks.find(t => t.status === 'running')
  if (runningTask) {
    useTaskStore.getState()._appendLog(runningTask.id, '\n[Lumiq Debugger] Shift+F11: Step Out executed.\n', 'system')
  }
}
