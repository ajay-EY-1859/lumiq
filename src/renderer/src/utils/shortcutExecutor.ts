// ═══════════════════════════════════════════════════════════════════
// Lumiq — Shortcut Executor Utility
// Centralizes logic for F5, F6, Shift+F5, and step debugging triggers
// ═══════════════════════════════════════════════════════════════════

import { useTaskStore } from '../store/taskStore'
import { useEditorStore } from '../store/editorStore'
import { useSessionStore } from '../store/sessionStore'
import { normalizePath } from './paths'

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
  const normalizedTabId = normalizePath(activeTab.id)

  if (ext === 'py') {
    command = 'python'
    args = ['-u', normalizedTabId]
  } else if (['js', 'jsx', 'ts', 'tsx'].includes(ext)) {
    command = 'node'
    args = [normalizedTabId]
  } else if (ext === 'go') {
    command = 'go'
    args = ['run', normalizedTabId]
  } else if (ext === 'java') {
    command = 'javac'
    args = [normalizedTabId]
  } else if (ext === 'c') {
    command = 'node'
    args = ['.lumiq/c-cpp-runner.js', 'gcc', normalizedTabId]
  } else if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') {
    command = 'node'
    args = ['.lumiq/c-cpp-runner.js', 'g++', normalizedTabId]
  } else if (ext === 'cs') {
    command = 'dotnet'
    args = ['run', '--project', normalizedTabId]
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
  const normalizedTabId = normalizePath(activeTab.id)

  if (ext === 'py') {
    command = 'python'
    args = ['-m', 'py_compile', normalizedTabId]
  } else if (ext === 'java') {
    command = 'javac'
    args = [normalizedTabId]
  } else if (ext === 'c') {
    command = 'gcc'
    args = ['-c', normalizedTabId]
  } else if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') {
    command = 'g++'
    args = ['-c', normalizedTabId]
  } else if (ext === 'go') {
    command = 'go'
    args = ['build', '-o', 'temp_build_out', normalizedTabId]
  } else if (ext === 'cs') {
    command = 'dotnet'
    args = ['build', normalizedTabId]
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
  if (window.electronAPI && window.electronAPI.dap) {
    window.electronAPI.dap.stepOver().catch(err => console.error('[Debugger] Step over failed:', err))
  }
}

export function debugStepIntoAction(): void {
  console.log('[ShortcutExecutor] F11: Debug Step Into triggered (DAP integration binding).')
  if (window.electronAPI && window.electronAPI.dap) {
    window.electronAPI.dap.stepInto().catch(err => console.error('[Debugger] Step into failed:', err))
  }
}

export function debugStepOutAction(): void {
  console.log('[ShortcutExecutor] Shift+F11: Debug Step Out triggered (DAP integration binding).')
  if (window.electronAPI && window.electronAPI.dap) {
    window.electronAPI.dap.stepOut().catch(err => console.error('[Debugger] Step out failed:', err))
  }
}
