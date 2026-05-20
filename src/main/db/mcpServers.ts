import { v4 as uuidv4 } from 'uuid'
import type { McpServer, McpServerStatus } from '@shared/types'
import { getDatabase } from './database'

type McpServerRow = {
  id: string
  name: string
  command: string
  args: string
  env: string
  active: number
  approved: number
  status: McpServerStatus
  last_error: string | null
  tools_count: number
  createdAt: string
  updatedAt: string
}

function parseJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

function mapRow(row: McpServerRow): McpServer {
  return {
    id: row.id,
    name: row.name,
    command: row.command,
    args: parseJson<string[]>(row.args, []),
    env: parseJson<Record<string, string>>(row.env, {}),
    active: Boolean(row.active),
    approved: Boolean(row.approved),
    status: row.status,
    lastError: row.last_error || undefined,
    toolsCount: row.tools_count,
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  }
}

export function listMcpServers(): McpServer[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, name, command, args, env, active, approved, status, last_error,
              tools_count, created_at as createdAt, updated_at as updatedAt
       FROM mcp_servers
       ORDER BY name`
    )
    .all() as McpServerRow[]
  return rows.map(mapRow)
}

export function getMcpServer(id: string): McpServer | null {
  const row = getDatabase()
    .prepare(
      `SELECT id, name, command, args, env, active, approved, status, last_error,
              tools_count, created_at as createdAt, updated_at as updatedAt
       FROM mcp_servers
       WHERE id = ?`
    )
    .get(id) as McpServerRow | undefined
  return row ? mapRow(row) : null
}

export function saveMcpServer(server: Partial<McpServer> & Pick<McpServer, 'name' | 'command'>): McpServer {
  const id = server.id || uuidv4()
  getDatabase()
    .prepare(
      `INSERT INTO mcp_servers (id, name, command, args, env, active, approved, status, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'stopped'), CURRENT_TIMESTAMP)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         command = excluded.command,
         args = excluded.args,
         env = excluded.env,
         active = excluded.active,
         approved = excluded.approved,
         updated_at = CURRENT_TIMESTAMP`
    )
    .run(
      id,
      server.name.trim(),
      server.command.trim(),
      JSON.stringify(server.args || []),
      JSON.stringify(server.env || {}),
      server.active === false ? 0 : 1,
      server.approved ? 1 : 0,
      server.status || 'stopped'
    )
  const saved = getMcpServer(id)
  if (!saved) throw new Error('Failed to save MCP server')
  return saved
}

export function updateMcpServerStatus(
  id: string,
  status: McpServerStatus,
  lastError?: string,
  toolsCount?: number
): void {
  getDatabase()
    .prepare(
      `UPDATE mcp_servers
       SET status = ?, last_error = ?, tools_count = COALESCE(?, tools_count), updated_at = CURRENT_TIMESTAMP
       WHERE id = ?`
    )
    .run(status, lastError || null, toolsCount ?? null, id)
}

export function markMcpServerApproved(id: string): void {
  getDatabase().prepare('UPDATE mcp_servers SET approved = 1 WHERE id = ?').run(id)
}

export function deleteMcpServer(id: string): boolean {
  return getDatabase().prepare('DELETE FROM mcp_servers WHERE id = ?').run(id).changes > 0
}
