// ═══════════════════════════════════════════════════════════════════
// Lumiq — Message CRUD Operations
// ═══════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from './database'
import type { Message } from '@shared/types'

/**
 * Creates and saves a new message.
 */
export function createMessage(
  sessionId: string,
  role: Message['role'],
  content: string,
  options?: {
    toolName?: string
    toolInput?: Record<string, unknown>
    toolResult?: string
    tokensUsed?: number
  }
): Message {
  const db = getDatabase()
  const id = uuidv4()
  const now = new Date().toISOString()

  const stmt = db.prepare(`
    INSERT INTO messages (id, session_id, role, content, tool_name, tool_input, tool_result, tokens_used, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    sessionId,
    role,
    content,
    options?.toolName || null,
    options?.toolInput ? JSON.stringify(options.toolInput) : null,
    options?.toolResult || null,
    options?.tokensUsed || 0,
    now
  )

  return {
    id,
    sessionId,
    role,
    content,
    toolName: options?.toolName,
    toolInput: options?.toolInput,
    toolResult: options?.toolResult,
    tokensUsed: options?.tokensUsed || 0,
    createdAt: now
  }
}

/**
 * Gets all messages for a session, ordered by creation time.
 * Supports pagination for performance with large sessions.
 */
export function getSessionMessages(
  sessionId: string,
  options?: { limit?: number; offset?: number }
): Message[] {
  const db = getDatabase()
  const limit = options?.limit || 100
  const offset = options?.offset || 0

  const stmt = db.prepare(`
    SELECT id, session_id as sessionId, role, content,
           tool_name as toolName, tool_input as toolInput,
           tool_result as toolResult, tokens_used as tokensUsed,
           created_at as createdAt
    FROM messages
    WHERE session_id = ?
    ORDER BY created_at ASC
    LIMIT ? OFFSET ?
  `)

  const rows = stmt.all(sessionId, limit, offset) as Message[]

  // Parse JSON fields
  return rows.map((row) => ({
    ...row,
    toolInput: row.toolInput ? JSON.parse(row.toolInput as unknown as string) : undefined
  }))
}

/**
 * Gets the total message count for a session.
 */
export function getMessageCount(sessionId: string): number {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT COUNT(*) as count FROM messages WHERE session_id = ?
  `)
  const result = stmt.get(sessionId) as { count: number }
  return result.count
}

/**
 * Gets the last N messages for context window construction.
 */
export function getRecentMessages(sessionId: string, limit: number): Message[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, session_id as sessionId, role, content,
           tool_name as toolName, tool_input as toolInput,
           tool_result as toolResult, tokens_used as tokensUsed,
           created_at as createdAt
    FROM messages
    WHERE session_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `)

  const rows = stmt.all(sessionId, limit) as Message[]

  // Reverse to get chronological order and parse JSON
  return rows.reverse().map((row) => ({
    ...row,
    toolInput: row.toolInput ? JSON.parse(row.toolInput as unknown as string) : undefined
  }))
}

/**
 * Deletes a specific message.
 */
export function deleteMessage(messageId: string): boolean {
  const db = getDatabase()
  const stmt = db.prepare(`DELETE FROM messages WHERE id = ?`)
  const result = stmt.run(messageId)
  return result.changes > 0
}

/**
 * Gets total token count for a session.
 */
export function getSessionTokenCount(sessionId: string): number {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT COALESCE(SUM(tokens_used), 0) as total
    FROM messages WHERE session_id = ?
  `)
  const result = stmt.get(sessionId) as { total: number }
  return result.total
}
