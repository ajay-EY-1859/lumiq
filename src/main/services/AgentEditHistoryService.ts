// ═══════════════════════════════════════════════════════════════════
// Lumiq — Agent Edit History & Reversion Service
// Allows tracking, auditing, and instant undo/redo of agent edits.
// ═══════════════════════════════════════════════════════════════════

import * as fs from 'fs'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/database'

export interface AgentEditSnapshot {
  id: string
  sessionId: string
  filePath: string
  timestamp: number
  previousContent: string
  newContent: string
  summary?: string
  isUndone: boolean
}

export class AgentEditHistoryService {
  private history: AgentEditSnapshot[] = []

  constructor() {
    this.initDatabaseTable()
  }

  private initDatabaseTable(): void {
    try {
      const db = getDatabase()
      db.prepare(`
        CREATE TABLE IF NOT EXISTS agent_edit_history (
          id TEXT PRIMARY KEY,
          session_id TEXT NOT NULL,
          file_path TEXT NOT NULL,
          timestamp INTEGER NOT NULL,
          previous_content TEXT NOT NULL,
          new_content TEXT NOT NULL,
          summary TEXT,
          is_undone INTEGER DEFAULT 0
        )
      `).run()

      // Load recent history into memory
      const rows = db.prepare(`
        SELECT id, session_id as sessionId, file_path as filePath, timestamp, 
               previous_content as previousContent, new_content as newContent, 
               summary, is_undone as isUndone
        FROM agent_edit_history
        ORDER BY timestamp DESC
        LIMIT 100
      `).all() as any[]

      this.history = rows.map((r) => ({
        ...r,
        isUndone: Boolean(r.isUndone)
      }))
    } catch (err) {
      console.warn('[AgentEditHistoryService] Database initialization skipped in test/mock mode:', err)
    }
  }

  public recordEdit(
    sessionId: string,
    filePath: string,
    previousContent: string,
    newContent: string,
    summary?: string
  ): AgentEditSnapshot {
    const snapshot: AgentEditSnapshot = {
      id: uuidv4(),
      sessionId,
      filePath,
      timestamp: Date.now(),
      previousContent,
      newContent,
      summary: summary || `Edit to ${filePath}`,
      isUndone: false
    }

    this.history.unshift(snapshot)

    try {
      const db = getDatabase()
      db.prepare(`
        INSERT INTO agent_edit_history (id, session_id, file_path, timestamp, previous_content, new_content, summary, is_undone)
        VALUES (?, ?, ?, ?, ?, ?, ?, 0)
      `).run(
        snapshot.id,
        snapshot.sessionId,
        snapshot.filePath,
        snapshot.timestamp,
        snapshot.previousContent,
        snapshot.newContent,
        snapshot.summary
      )
    } catch (err) {
      console.warn('[AgentEditHistoryService] Failed to persist snapshot to DB:', err)
    }

    return snapshot
  }

  public getHistory(sessionId?: string): AgentEditSnapshot[] {
    if (!sessionId) {
      return [...this.history]
    }
    return this.history.filter((s) => s.sessionId === sessionId)
  }

  public async undoEdit(snapshotId: string): Promise<boolean> {
    const snapshot = this.history.find((s) => s.id === snapshotId)
    if (!snapshot || snapshot.isUndone) return false

    try {
      await fs.promises.writeFile(snapshot.filePath, snapshot.previousContent, 'utf-8')
      snapshot.isUndone = true

      try {
        const db = getDatabase()
        db.prepare('UPDATE agent_edit_history SET is_undone = 1 WHERE id = ?').run(snapshotId)
      } catch {
        // ignore DB update failure
      }

      return true
    } catch (err) {
      console.error(`[AgentEditHistoryService] Undo failed for ${snapshot.filePath}:`, err)
      return false
    }
  }

  public async redoEdit(snapshotId: string): Promise<boolean> {
    const snapshot = this.history.find((s) => s.id === snapshotId)
    if (!snapshot || !snapshot.isUndone) return false

    try {
      await fs.promises.writeFile(snapshot.filePath, snapshot.newContent, 'utf-8')
      snapshot.isUndone = false

      try {
        const db = getDatabase()
        db.prepare('UPDATE agent_edit_history SET is_undone = 0 WHERE id = ?').run(snapshotId)
      } catch {
        // ignore DB update failure
      }

      return true
    } catch (err) {
      console.error(`[AgentEditHistoryService] Redo failed for ${snapshot.filePath}:`, err)
      return false
    }
  }
}

export const agentEditHistoryService = new AgentEditHistoryService()
