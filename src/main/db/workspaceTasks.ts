import { existsSync, readFileSync } from 'fs'
import { join, resolve } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from './database'
import type { WorkspaceTaskDefinition } from '@shared/types'

type WorkspaceTaskRow = {
  id: string
  workspacePath: string
  name: string
  command: string
  args: string
  source: 'package' | 'custom'
  createdAt: string
  updatedAt: string
}

function mapRow(row: WorkspaceTaskRow): WorkspaceTaskDefinition {
  let args: string[] = []
  try {
    args = JSON.parse(row.args) as string[]
  } catch {
    args = []
  }
  return { ...row, args }
}

export function listWorkspaceTasks(workspacePath: string): WorkspaceTaskDefinition[] {
  const safePath = resolve(workspacePath)
  const rows = getDatabase()
    .prepare(
      `SELECT id, workspace_path as workspacePath, name, command, args, source,
              created_at as createdAt, updated_at as updatedAt
       FROM workspace_tasks
       WHERE workspace_path = ?
       ORDER BY source DESC, name`
    )
    .all(safePath) as WorkspaceTaskRow[]
  return rows.map(mapRow)
}

export function saveWorkspaceTask(
  task: Omit<WorkspaceTaskDefinition, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string
    createdAt?: string
    updatedAt?: string
  }
): WorkspaceTaskDefinition {
  const workspacePath = resolve(task.workspacePath)
  const id = task.id || uuidv4()

  getDatabase()
    .prepare(
      `INSERT INTO workspace_tasks (id, workspace_path, name, command, args, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(workspace_path, name) DO UPDATE SET
         command = excluded.command,
         args = excluded.args,
         source = CASE
           WHEN workspace_tasks.source = 'custom' AND excluded.source = 'package'
           THEN workspace_tasks.source
           ELSE excluded.source
         END,
         updated_at = CURRENT_TIMESTAMP`
    )
    .run(id, workspacePath, task.name.trim(), task.command.trim(), JSON.stringify(task.args), task.source)

  const saved = listWorkspaceTasks(workspacePath).find((item) => item.name === task.name.trim())
  if (!saved) throw new Error('Failed to save workspace task')
  return saved
}

export function deleteWorkspaceTask(workspacePath: string, name: string): boolean {
  return (
    getDatabase()
      .prepare(`DELETE FROM workspace_tasks WHERE workspace_path = ? AND name = ?`)
      .run(resolve(workspacePath), name).changes > 0
  )
}

export function syncPackageJsonTasks(workspacePath: string): WorkspaceTaskDefinition[] {
  const safePath = resolve(workspacePath)
  const packageJsonPath = join(safePath, 'package.json')
  if (!existsSync(packageJsonPath)) {
    return listWorkspaceTasks(safePath)
  }

  const raw = readFileSync(packageJsonPath, 'utf-8')
  const pkg = JSON.parse(raw) as { scripts?: Record<string, string> }
  const scripts = pkg.scripts || {}

  for (const name of Object.keys(scripts)) {
    saveWorkspaceTask({
      workspacePath: safePath,
      name,
      command: 'npm',
      args: ['run', name],
      source: 'package'
    })
  }

  return listWorkspaceTasks(safePath)
}
