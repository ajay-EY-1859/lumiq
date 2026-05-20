// ═══════════════════════════════════════════════════════════════════
// Lumiq — TodoWriteTool
// Per-session task checklist. Agent updates this as it works,
// giving users visibility into progress.
// ═══════════════════════════════════════════════════════════════════

import { getDatabase } from '../db/database'
import type { Tool } from './Tool'

export interface TodoItem {
  id: string
  content: string
  status: 'pending' | 'in_progress' | 'completed'
  priority: 'high' | 'medium' | 'low'
}

export class TodoWriteTool implements Tool {
  name = 'TodoWriteTool'
  description = 'Update the session task checklist to track progress'
  requiresApproval = false
  isReadOnly = false
  inputSchema = {
    type: 'object',
    properties: {
      sessionId: { type: 'string', description: 'Session ID' },
      todos: {
        type: 'array',
        description: 'Updated todo list',
        items: {
          type: 'object',
          properties: {
            id: { type: 'string' },
            content: { type: 'string' },
            status: { type: 'string', enum: ['pending', 'in_progress', 'completed'] },
            priority: { type: 'string', enum: ['high', 'medium', 'low'] }
          },
          required: ['id', 'content', 'status', 'priority']
        }
      }
    },
    required: ['sessionId', 'todos']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const sessionId = input.sessionId as string
    const todos = input.todos as unknown

    if (typeof sessionId !== 'string' || !sessionId.trim()) {
      return '[ERROR] sessionId is required and must be a non-empty string.'
    }

    if (!Array.isArray(todos)) {
      return '[ERROR] todos must be an array of todo items.'
    }

    const validatedTodos: TodoItem[] = []
    for (const item of todos) {
      if (!isValidTodoItem(item)) {
        return '[ERROR] Each todo item must include id, content, status, and priority with valid values.'
      }
      validatedTodos.push(item)
    }

    try {
      const db = getDatabase()

      // Guard: verify session still exists before inserting (FK constraint)
      const sessionExists = db
        .prepare('SELECT 1 FROM sessions WHERE id = ?')
        .get(sessionId)
      if (!sessionExists) {
        return `[ERROR] Session "${sessionId}" no longer exists — todos not saved.`
      }

      db.prepare(
        `INSERT OR REPLACE INTO session_todos (session_id, todos, updated_at)
         VALUES (?, ?, CURRENT_TIMESTAMP)`
      ).run(sessionId, JSON.stringify(validatedTodos))

      const completed = todos.filter((t) => t.status === 'completed').length
      const total = todos.length
      return `Todo list updated: ${completed}/${total} tasks completed`
    } catch (error) {
      return `Error updating todos: ${(error as Error).message}`
    }
  }
}

function isValidTodoItem(item: unknown): item is TodoItem {
  return (
    typeof item === 'object' &&
    item !== null &&
    typeof (item as Record<string, unknown>).id === 'string' &&
    typeof (item as Record<string, unknown>).content === 'string' &&
    ['pending', 'in_progress', 'completed'].includes((item as Record<string, unknown>).status as string) &&
    ['high', 'medium', 'low'].includes((item as Record<string, unknown>).priority as string)
  )
}

export function getSessionTodos(sessionId: string): TodoItem[] {
  try {
    const db = getDatabase()
    const row = db
      .prepare('SELECT todos FROM session_todos WHERE session_id = ?')
      .get(sessionId) as { todos: string } | undefined
    return row ? (JSON.parse(row.todos) as TodoItem[]) : []
  } catch {
    return []
  }
}
