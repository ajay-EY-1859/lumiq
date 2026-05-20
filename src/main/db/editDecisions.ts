import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from './database'
import type { EditDecision, EditDecisionType } from '@shared/types'

type EditDecisionRow = {
  id: string
  sessionId: string
  messageId: string | null
  targetFile: string
  hunkHeader: string
  decision: EditDecisionType
  patchText: string
  createdAt: string
}

export function recordEditDecision(input: {
  sessionId: string
  messageId?: string | null
  targetFile: string
  hunkHeader: string
  decision: EditDecisionType
  patchText: string
}): EditDecision {
  const id = uuidv4()
  const now = new Date().toISOString()

  const db = getDatabase()

  // Guard: verify session still exists before inserting (FK constraint)
  const sessionExists = db
    .prepare('SELECT 1 FROM sessions WHERE id = ?')
    .get(input.sessionId)
  if (!sessionExists) {
    throw new Error(`Session "${input.sessionId}" no longer exists — edit decision not saved.`)
  }

  db
    .prepare(
      `INSERT INTO session_edit_decisions
       (id, session_id, message_id, target_file, hunk_header, decision, patch_text, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.sessionId,
      input.messageId || null,
      input.targetFile,
      input.hunkHeader,
      input.decision,
      input.patchText,
      now
    )

  return {
    id,
    sessionId: input.sessionId,
    messageId: input.messageId || null,
    targetFile: input.targetFile,
    hunkHeader: input.hunkHeader,
    decision: input.decision,
    patchText: input.patchText,
    createdAt: now
  }
}

export function listEditDecisions(sessionId: string): EditDecision[] {
  return getDatabase()
    .prepare(
      `SELECT id, session_id as sessionId, message_id as messageId,
              target_file as targetFile, hunk_header as hunkHeader,
              decision, patch_text as patchText, created_at as createdAt
       FROM session_edit_decisions
       WHERE session_id = ?
       ORDER BY created_at DESC`
    )
    .all(sessionId) as EditDecisionRow[]
}
