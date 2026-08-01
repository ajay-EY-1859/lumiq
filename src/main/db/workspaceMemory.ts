// ═══════════════════════════════════════════════════════════════════
// Lumiq — Workspace Memory CRUD Operations
// ═══════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from './database'

export interface WorkspaceMemory {
  id: string
  workspacePath: string
  sessionId: string | null
  activityType: string
  summary: string
  contextDetails: string // JSON stringified
  createdAt: string
}

/**
 * Creates and stores a new workspace episodic memory.
 */
export function createMemory(
  workspacePath: string,
  sessionId: string | null,
  activityType: string,
  summary: string,
  contextDetails?: Record<string, any>
): WorkspaceMemory {
  const db = getDatabase()
  const id = uuidv4()
  const now = new Date().toISOString()
  const detailsStr = contextDetails ? JSON.stringify(contextDetails) : '{}'

  const stmt = db.prepare(`
    INSERT INTO workspace_episodic_memory (id, workspace_path, session_id, activity_type, summary, context_details, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(id, workspacePath, sessionId, activityType, summary, detailsStr, now)

  return {
    id,
    workspacePath,
    sessionId,
    activityType,
    summary,
    contextDetails: detailsStr,
    createdAt: now
  }
}

/**
 * Gets all episodic memories for a workspace path.
 */
export function getWorkspaceMemories(workspacePath: string, limit = 50): WorkspaceMemory[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, workspace_path as workspacePath, session_id as sessionId,
           activity_type as activityType, summary, context_details as contextDetails,
           created_at as createdAt
    FROM workspace_episodic_memory
    WHERE workspace_path = ?
    ORDER BY created_at DESC
    LIMIT ?
  `)

  const rows = stmt.all(workspacePath, limit) as any[]
  return rows.map((row) => ({
    ...row
  }))
}
