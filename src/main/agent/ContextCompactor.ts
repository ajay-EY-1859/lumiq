// ═══════════════════════════════════════════════════════════════════
// Lumiq — Context Compactor (Hierarchical Context Summarizer)
// Compacts older message history into structured summaries, keeping sliding windows raw.
// ═══════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/database'
import { getApiConfig } from '../db/apiConfigs'
import { ProviderFactory } from '../providers/ProviderFactory'
import { getSessionMessages } from '../db/messages'
import type { Message, ProviderConfig } from '@shared/types'

export interface SessionSummary {
  id: string
  sessionId: string
  startMessageId: string
  endMessageId: string
  summaryContent: string
  createdAt: string
}

export class ContextCompactor {
  private static instance: ContextCompactor

  private constructor() {}

  public static getInstance(): ContextCompactor {
    if (!ContextCompactor.instance) {
      ContextCompactor.instance = new ContextCompactor()
    }
    return ContextCompactor.instance
  }

  /**
   * Retrieves all summary blocks for a specific session.
   */
  public getSummaries(sessionId: string): SessionSummary[] {
    try {
      const db = getDatabase()
      const stmt = db.prepare(`
        SELECT id, session_id as sessionId, start_message_id as startMessageId,
               end_message_id as endMessageId, summary_content as summaryContent,
               created_at as createdAt
        FROM chat_summaries
        WHERE session_id = ?
        ORDER BY created_at ASC
      `)
      return stmt.all(sessionId) as SessionSummary[]
    } catch (err) {
      console.error('[ContextCompactor] Failed to get session summaries:', err)
      return []
    }
  }

  /**
   * Formats the summaries into a cohesive block to inject into the system prompt.
   */
  public getSummariesPromptSegment(sessionId: string): string {
    const summaries = this.getSummaries(sessionId)
    if (summaries.length === 0) return ''

    let segment = '\n\n═══════════════════════════════════════════════════════════════════\n'
    segment += 'COMPRESSED HISTORY SUMMARIES (Infinite Context Layer)\n'
    segment += 'The following is a bullet-point summary of the earlier part of this chat session. Use it as background context:\n'
    summaries.forEach((s, idx) => {
      segment += `--- Summary Block #${idx + 1} ---\n${s.summaryContent}\n`
    })
    segment += '═══════════════════════════════════════════════════════════════════\n'
    return segment
  }

  /**
   * Checks a session's message count, and if it exceeds the limit (> 20),
   * summarizes the old messages and compacts the database.
   */
  public async checkAndCompactSession(
    sessionId: string,
    activeConfig: ProviderConfig,
    activeModel: string
  ): Promise<void> {
    // Execute in the background with a slight delay
    setTimeout(async () => {
      try {
        const db = getDatabase()

        // Get all non-system messages
        const allMessages = getSessionMessages(sessionId)
        const nonSystemMessages = allMessages.filter((m) => m.role !== 'system')

        // Compact if total messages > 20 and there are enough older messages to compact (we keep 5 raw)
        const COMPACTION_THRESHOLD = 20
        const RAW_KEEP_COUNT = 5

        if (nonSystemMessages.length <= COMPACTION_THRESHOLD) {
          return // Below threshold
        }

        console.log(`[ContextCompactor] Initiating background history compaction for session ${sessionId} (${nonSystemMessages.length} messages)`)

        // Split messages:
        // Older messages to compact = index 0 to (length - 6)
        const messagesToCompact = nonSystemMessages.slice(0, -RAW_KEEP_COUNT)

        if (messagesToCompact.length === 0) return

        // 1. Choose background model (Gemini 1.5 Flash preferred)
        let summarizerConfig = activeConfig
        let summarizerModel = activeModel

        const geminiConfig = getApiConfig('gemini')
        if (geminiConfig && geminiConfig.isActive) {
          summarizerConfig = geminiConfig
          summarizerModel = 'gemini-1.5-flash'
        }

        const provider = ProviderFactory.create(summarizerConfig)

        // 2. Format older chat logs for the summarizer
        let chatLogs = ''
        messagesToCompact.forEach((m) => {
          const roleLabel = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'Tool Result'
          chatLogs += `[${roleLabel}]: ${m.content.slice(0, 1000)}${m.content.length > 1000 ? '...' : ''}\n`
          if (m.toolName) {
            chatLogs += `  Invoked Tool: ${m.toolName} with Input: ${JSON.stringify(m.toolInput)}\n`
          }
        })

        const prompt = `You are a background history compactor for a software development AI agent.
Analyze the following chronological segment of a chat session:
${chatLogs}

Create a highly detailed, concise bullet-point summary of this chat segment. Make sure to capture:
1. The primary goals or tasks the user requested.
2. Any major decisions made or coding preferences stated.
3. The names of files that were created, viewed, or modified.
4. Any errors encountered and how they were resolved.

Keep the summary precise and highly professional. Avoid generalities.
Respond ONLY with the bullet points. Do not include introductory or concluding phrases.`

        const messages: Message[] = [
          {
            id: 'summary_task',
            sessionId: 'summary_task',
            role: 'user',
            content: prompt,
            createdAt: new Date().toISOString()
          }
        ]

        const result = await provider.sendMessage(messages, {
          model: summarizerModel,
          stream: false
        })

        const summaryContent = result.content.trim()

        if (!summaryContent) {
          throw new Error('Summary output was empty')
        }

        const firstMsgId = messagesToCompact[0]!.id
        const lastMsgId = messagesToCompact[messagesToCompact.length - 1]!.id

        // 3. Write summary and delete compacted messages in a single atomic transaction
        const commitTx = db.transaction(() => {
          // Insert summary
          const insertStmt = db.prepare(`
            INSERT INTO chat_summaries (id, session_id, start_message_id, end_message_id, summary_content)
            VALUES (?, ?, ?, ?, ?)
          `)
          insertStmt.run(uuidv4(), sessionId, firstMsgId, lastMsgId, summaryContent)

          // Delete original compacted messages
          const deleteStmt = db.prepare('DELETE FROM messages WHERE id = ?')
          for (const msg of messagesToCompact) {
            deleteStmt.run(msg.id)
          }
        })

        commitTx()
        console.log(`[ContextCompactor] Successfully compacted ${messagesToCompact.length} messages into a single summary block.`)

      } catch (err) {
        console.error('[ContextCompactor] Failed to compact session in background:', err)
      }
    }, 1500)
  }
}

export const contextCompactor = ContextCompactor.getInstance()
