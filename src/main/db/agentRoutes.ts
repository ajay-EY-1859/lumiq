import { v4 as uuidv4 } from 'uuid'
import type { AgentRoute, ProviderType } from '@shared/types'
import { getDatabase } from './database'

type AgentRouteRow = {
  id: string
  taskName: string
  provider: ProviderType
  model: string
  createdAt: string
  updatedAt: string
}

export function listAgentRoutes(): AgentRoute[] {
  return getDatabase()
    .prepare(
      `SELECT id, task_name as taskName, provider, model, created_at as createdAt, updated_at as updatedAt
       FROM agent_routes
       ORDER BY task_name`
    )
    .all() as AgentRoute[]
}

export function getAgentRoute(taskName: string): AgentRoute | null {
  const normalized = taskName.trim().toLowerCase()
  const row = getDatabase()
    .prepare(
      `SELECT id, task_name as taskName, provider, model, created_at as createdAt, updated_at as updatedAt
       FROM agent_routes
       WHERE lower(task_name) = ?`
    )
    .get(normalized) as AgentRouteRow | undefined
  return row || null
}

export function saveAgentRoute(route: Partial<AgentRoute> & Pick<AgentRoute, 'taskName' | 'provider' | 'model'>): AgentRoute {
  const id = route.id || uuidv4()
  getDatabase()
    .prepare(
      `INSERT INTO agent_routes (id, task_name, provider, model, updated_at)
       VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(task_name) DO UPDATE SET
         provider = excluded.provider,
         model = excluded.model,
         updated_at = CURRENT_TIMESTAMP`
    )
    .run(id, route.taskName.trim(), route.provider, route.model.trim())
  const saved = getAgentRoute(route.taskName)
  if (!saved) throw new Error('Failed to save route')
  return saved
}

export function deleteAgentRoute(id: string): boolean {
  return getDatabase().prepare('DELETE FROM agent_routes WHERE id = ?').run(id).changes > 0
}
