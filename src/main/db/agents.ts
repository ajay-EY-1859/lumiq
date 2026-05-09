// ═══════════════════════════════════════════════════════════════════
// Lumiq — Agent CRUD Operations
// ═══════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from './database'
import type { Agent } from '@shared/types'

/**
 * Creates or updates a custom agent.
 */
export function saveAgent(agent: Partial<Agent> & { name: string; systemPrompt: string }): Agent {
  const db = getDatabase()
  const id = agent.id || uuidv4()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO agents (id, name, description, system_prompt, provider, model, tools, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(id) DO UPDATE SET
      name = excluded.name,
      description = excluded.description,
      system_prompt = excluded.system_prompt,
      provider = excluded.provider,
      model = excluded.model,
      tools = excluded.tools
  `)

  const tools = JSON.stringify(agent.tools || [])

  stmt.run(
    id,
    agent.name,
    agent.description || null,
    agent.systemPrompt,
    agent.provider || null,
    agent.model || null,
    tools,
    now
  )

  return {
    id,
    name: agent.name,
    description: agent.description,
    systemPrompt: agent.systemPrompt,
    provider: agent.provider,
    model: agent.model,
    tools: agent.tools || [],
    createdAt: now
  }
}

/**
 * Lists all custom agents.
 */
export function listAgents(): Agent[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, description, system_prompt as systemPrompt,
           provider, model, tools, created_at as createdAt
    FROM agents
    ORDER BY created_at DESC
  `)

  const rows = stmt.all() as Agent[]
  return rows.map((row) => ({
    ...row,
    tools: JSON.parse(row.tools as unknown as string)
  }))
}

/**
 * Gets a single agent by ID.
 */
export function getAgent(agentId: string): Agent | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, name, description, system_prompt as systemPrompt,
           provider, model, tools, created_at as createdAt
    FROM agents
    WHERE id = ?
  `)

  const row = stmt.get(agentId) as Agent | undefined
  if (!row) return null

  return {
    ...row,
    tools: JSON.parse(row.tools as unknown as string)
  }
}

/**
 * Deletes an agent by ID.
 */
export function deleteAgent(agentId: string): boolean {
  const db = getDatabase()
  const stmt = db.prepare(`DELETE FROM agents WHERE id = ?`)
  const result = stmt.run(agentId)
  return result.changes > 0
}
