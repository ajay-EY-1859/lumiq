// ═══════════════════════════════════════════════════════════════════
// Lumiq — Custom Commands DB
// Persistent storage for user-defined commands (shell & prompt types)
// ═══════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid'
import type { CustomCommand } from '@shared/types'
import { getDatabase } from './database'

type CommandRow = {
  id: string
  name: string
  description: string
  command: string
  type: string
  args: string
  createdAt: string
  updatedAt: string
}

function mapRow(row: CommandRow): CustomCommand {
  let args: string[] = []
  try {
    args = JSON.parse(row.args) as string[]
  } catch {
    args = []
  }
  return {
    ...row,
    type: row.type as 'shell' | 'prompt',
    args
  }
}

export function listCommands(): CustomCommand[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, name, description, command, type, args,
              created_at as createdAt, updated_at as updatedAt
       FROM custom_commands
       ORDER BY name`
    )
    .all() as CommandRow[]
  return rows.map(mapRow)
}

export function saveCommand(
  cmd: Partial<CustomCommand> & Pick<CustomCommand, 'name' | 'command'>
): CustomCommand {
  const id = cmd.id || uuidv4()
  getDatabase()
    .prepare(
      `INSERT INTO custom_commands (id, name, description, command, type, args, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(name) DO UPDATE SET
         description = excluded.description,
         command = excluded.command,
         type = excluded.type,
         args = excluded.args,
         updated_at = CURRENT_TIMESTAMP`
    )
    .run(
      id,
      cmd.name.trim(),
      cmd.description || '',
      cmd.command,
      cmd.type || 'shell',
      JSON.stringify(cmd.args || [])
    )
  const saved = listCommands().find(
    (c) => c.name.toLowerCase() === cmd.name.trim().toLowerCase()
  )
  if (!saved) throw new Error('Failed to save command')
  return saved
}

export function deleteCommand(id: string): boolean {
  return getDatabase().prepare('DELETE FROM custom_commands WHERE id = ?').run(id).changes > 0
}
