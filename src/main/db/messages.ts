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
    toolCallId?: string
    toolCalls?: { id: string; toolName: string; input: any }[]
    tokensUsed?: number
  }
): Message {
  const db = getDatabase()
  const id = uuidv4()
  const now = new Date().toISOString()

  // Guard: verify session still exists before inserting (prevents FK constraint
  // failures when user deletes a session while the agent loop is still running)
  const sessionExists = db
    .prepare('SELECT 1 FROM sessions WHERE id = ?')
    .get(sessionId)
  if (!sessionExists) {
    throw new Error(`Session "${sessionId}" no longer exists — message not saved.`)
  }

  const stmt = db.prepare(`
    INSERT INTO messages (id, session_id, role, content, tool_name, tool_input, tool_result, tool_call_id, tool_calls, tokens_used, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)

  stmt.run(
    id,
    sessionId,
    role,
    content,
    options?.toolName || null,
    options?.toolInput ? JSON.stringify(options.toolInput) : null,
    options?.toolResult || null,
    options?.toolCallId || null,
    options?.toolCalls ? JSON.stringify(options.toolCalls) : null,
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
    toolCallId: options?.toolCallId,
    toolCalls: options?.toolCalls,
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
  const hasLimit = options?.limit !== undefined
  const hasOffset = options?.offset !== undefined

  let query = `
    SELECT id, session_id as sessionId, role, content,
           tool_name as toolName, tool_input as toolInput,
           tool_result as toolResult, tool_call_id as toolCallId,
           tool_calls as toolCalls,
           tokens_used as tokensUsed,
           created_at as createdAt
    FROM messages
    WHERE session_id = ?
    ORDER BY created_at ASC
  `

  const params: any[] = [sessionId]

  if (hasLimit) {
    query += ` LIMIT ?`
    params.push(options.limit)
    if (hasOffset) {
      query += ` OFFSET ?`
      params.push(options.offset)
    }
  } else if (hasOffset) {
    // SQLite requires LIMIT when OFFSET is specified. -1 means no limit.
    query += ` LIMIT -1 OFFSET ?`
    params.push(options.offset)
  }

  const stmt = db.prepare(query)
  const rows = stmt.all(...params) as any[]

  // Parse JSON fields
  return rows.map((row) => ({
    ...row,
    toolInput: row.toolInput ? JSON.parse(row.toolInput as string) : undefined,
    toolCalls: row.toolCalls ? JSON.parse(row.toolCalls as string) : undefined
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
           tool_result as toolResult, tool_call_id as toolCallId,
           tool_calls as toolCalls,
           tokens_used as tokensUsed,
           created_at as createdAt
    FROM messages
    WHERE session_id = ?
    ORDER BY created_at DESC
    LIMIT ?
  `)

  const rows = stmt.all(sessionId, limit) as any[]

  // Reverse to get chronological order and parse JSON
  return rows.reverse().map((row) => ({
    ...row,
    toolInput: row.toolInput ? JSON.parse(row.toolInput as string) : undefined,
    toolCalls: row.toolCalls ? JSON.parse(row.toolCalls as string) : undefined
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

/**
 * Deletes all messages for a specific session.
 */
export function clearSessionMessages(sessionId: string): boolean {
  const db = getDatabase()
  const stmt = db.prepare(`DELETE FROM messages WHERE session_id = ?`)
  const result = stmt.run(sessionId)
  return result.changes > 0
}

/**
 * Deletes older messages, keeping only the most recent N messages.
 */
export function compactSessionMessages(sessionId: string, keepCount: number = 10): boolean {
  const db = getDatabase()
  const stmt = db.prepare(`
    DELETE FROM messages 
    WHERE session_id = ? AND id NOT IN (
      SELECT id FROM messages WHERE session_id = ? ORDER BY created_at DESC LIMIT ?
    )
  `)
  const result = stmt.run(sessionId, sessionId, keepCount)
  return result.changes > 0
}
