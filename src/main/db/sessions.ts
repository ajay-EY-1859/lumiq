// ═══════════════════════════════════════════════════════════════════
// Lumiq — Session CRUD Operations
// All queries use prepared statements to prevent SQL injection.
// ═══════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from './database'
import type { Session } from '@shared/types'
import { codebaseIndexer } from '../agent/CodebaseIndexer'

/**
 * Creates a new session.
 */
export function createSession(provider: string, model: string, agentId?: string): Session {
  const db = getDatabase()
  const id = uuidv4()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO sessions (id, title, provider, model, agent_id, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(id, 'New Session', provider, model, agentId || null, now, now)

  return { id, title: 'New Session', provider, model, agentId, createdAt: now, updatedAt: now }
}

/**
 * Lists all sessions, ordered by most recently updated.
 */
export function listSessions(): Session[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, title, provider, model, agent_id as agentId, workspace_path as workspacePath,
           created_at as createdAt, updated_at as updatedAt
    FROM sessions
    ORDER BY updated_at DESC
  `)
  return stmt.all() as Session[]
}

/**
 * Loads a single session by ID.
 */
export function getSession(sessionId: string): Session | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, title, provider, model, agent_id as agentId, workspace_path as workspacePath,
           created_at as createdAt, updated_at as updatedAt
    FROM sessions
    WHERE id = ?
  `)
  return (stmt.get(sessionId) as Session) || null
}

/**
 * Updates the session title (auto-generated or user-renamed).
 */
export function updateSessionTitle(sessionId: string, title: string): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    UPDATE sessions SET title = ?, updated_at = ? WHERE id = ?
  `)
  // Sanitize title to prevent XSS when displayed in renderer
  const sanitizedTitle = title.replace(/[<>]/g, '').slice(0, 200)
  stmt.run(sanitizedTitle, new Date().toISOString(), sessionId)
}

/**
 * Updates the session's updated_at timestamp.
 */
export function touchSession(sessionId: string): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    UPDATE sessions SET updated_at = ? WHERE id = ?
  `)
  stmt.run(new Date().toISOString(), sessionId)
}

/**
 * Updates the session's workspace path.
 */
export function updateSessionWorkspace(sessionId: string, workspacePath: string | null): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    UPDATE sessions SET workspace_path = ?, updated_at = ? WHERE id = ?
  `)
  stmt.run(workspacePath, new Date().toISOString(), sessionId)

  // Trigger background semantic indexing when a workspace path is bound
  if (workspacePath) {
    codebaseIndexer.indexWorkspace(workspacePath)
  }
}

/**
 * Deletes a session and all its messages (CASCADE).
 */
export function deleteSession(sessionId: string): boolean {
  const db = getDatabase()
  const stmt = db.prepare(`DELETE FROM sessions WHERE id = ?`)
  const result = stmt.run(sessionId)
  return result.changes > 0
}

/**
 * Searches sessions by title.
 * Uses LIKE with proper escaping to prevent injection.
 */
export function searchSessions(query: string): Session[] {
  const db = getDatabase()
  // Escape LIKE wildcards in user input
  const escapedQuery = query.replace(/[%_\\]/g, '\\$&')
  const stmt = db.prepare(`
    SELECT id, title, provider, model, agent_id as agentId, workspace_path as workspacePath,
           created_at as createdAt, updated_at as updatedAt
    FROM sessions
    WHERE title LIKE ? ESCAPE '\\'
    ORDER BY updated_at DESC
  `)
  return stmt.all(`%${escapedQuery}%`) as Session[]
}
