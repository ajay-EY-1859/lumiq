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
  knowledgeGraph?: string
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
               knowledge_graph as knowledgeGraph, created_at as createdAt
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

    const graphSummaries = summaries.filter((s) => s.knowledgeGraph)
    if (graphSummaries.length > 0) {
      segment += '\nKNOWLEDGE GRAPH (Semantic Entity-Relationship Index of Past Context):\n'
      graphSummaries.forEach((s, idx) => {
        segment += `[Graph Segment #${idx + 1}]\n${s.knowledgeGraph}\n`
      })
    }

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

        // Compact if total messages > 20
        const COMPACTION_THRESHOLD = 20

        if (nonSystemMessages.length <= COMPACTION_THRESHOLD) {
          return // Below threshold
        }

        console.log(`[ContextCompactor] Initiating background topic-aware history compaction for session ${sessionId} (${nonSystemMessages.length} messages)`)

        const { embeddingManager } = require('./EmbeddingManager')

        // 1. Identify user messages and their indices
        const userMessages: { index: number; content: string; vector?: number[] }[] = []
        for (let i = 0; i < nonSystemMessages.length; i++) {
          if (nonSystemMessages[i].role === 'user') {
            userMessages.push({ index: i, content: nonSystemMessages[i].content })
          }
        }

        if (userMessages.length < 2) {
          return // Not enough topics to segment
        }

        // 2. Fetch embeddings for user messages
        await Promise.all(
          userMessages.map(async (um) => {
            um.vector = await embeddingManager.getEmbedding(um.content)
          })
        )

        // 3. Find boundaries where cosine similarity < 0.45
        const boundaries: number[] = [0] // Starts of new topics (indices in nonSystemMessages)
        for (let i = 1; i < userMessages.length; i++) {
          const prev = userMessages[i - 1]
          const curr = userMessages[i]
          if (prev.vector && curr.vector) {
            const similarity = embeddingManager.cosineSimilarity(prev.vector, curr.vector)
            if (similarity < 0.45) {
              boundaries.push(curr.index)
            }
          }
        }

        // 4. Create topic blocks
        const topics: Message[][] = []
        for (let i = 0; i < boundaries.length; i++) {
          const start = boundaries[i]
          const end = i + 1 < boundaries.length ? boundaries[i + 1] : nonSystemMessages.length
          topics.push(nonSystemMessages.slice(start, end))
        }

        // The last topic group is the active topic; we keep it raw
        const completedTopics = topics.slice(0, -1)

        if (completedTopics.length === 0) {
          return // No completed topics to compact
        }

        const completedMessagesCount = completedTopics.flat().length
        if (completedMessagesCount === 0) return

        console.log(`[ContextCompactor] Found ${completedTopics.length} completed topics containing ${completedMessagesCount} messages. Compacting completed topics...`)

        // 5. Select background model (Gemini 1.5 Flash preferred)
        let summarizerConfig = activeConfig
        let summarizerModel = activeModel

        const geminiConfig = getApiConfig('gemini')
        if (geminiConfig && geminiConfig.isActive) {
          summarizerConfig = geminiConfig
          summarizerModel = 'gemini-1.5-flash'
        }

        const provider = ProviderFactory.create(summarizerConfig)

        // 6. Summarize each completed topic block
        for (const topicMessages of completedTopics) {
          let chatLogs = ''
          topicMessages.forEach((m) => {
            const roleLabel = m.role === 'user' ? 'User' : m.role === 'assistant' ? 'Assistant' : 'Tool Result'
            chatLogs += `[${roleLabel}]: ${m.content.slice(0, 1000)}${m.content.length > 1000 ? '...' : ''}\n`
            if (m.toolName) {
              chatLogs += `  Invoked Tool: ${m.toolName} with Input: ${JSON.stringify(m.toolInput)}\n`
            }
          })

          const prompt = `You are a background history compactor for a software development AI agent.
Analyze the following chronological segment of a chat session representing a single topic thread:
${chatLogs}

Create a highly detailed, concise bullet-point summary of this chat segment. Also, extract a Knowledge Graph representing the semantic entity-relationship index of this chat segment.
You MUST respond in JSON format matching this schema:
{
  "summary": "bullet-point summary capturing tasks, goals, preferences, file changes, and errors",
  "knowledgeGraph": "A text-based graph representation listing key entities (Files, Technologies, Decisions, Bugs, Features) and their relationships. Format it exactly as:
Nodes:
- [EntityA]
- [EntityB]
Relationships:
- [EntityA] --(relationship)--> [EntityB]"
}

Ensure the JSON output is valid and contains no other text.`

          let result: any = null
          try {
            result = await provider.sendMessage([
              {
                id: 'summary_task',
                sessionId: 'summary_task',
                role: 'user',
                content: prompt,
                createdAt: new Date().toISOString()
              }
            ], {
              model: summarizerModel,
              stream: false
            })
          } catch (err) {
            console.warn(`[ContextCompactor] Compaction failed with primary model ${summarizerModel}, trying active model fallback:`, err)
            if (summarizerConfig.provider !== activeConfig.provider || summarizerModel !== activeModel) {
              try {
                const fallbackProvider = ProviderFactory.create(activeConfig)
                result = await fallbackProvider.sendMessage([
                  {
                    id: 'summary_task',
                    sessionId: 'summary_task',
                    role: 'user',
                    content: prompt,
                    createdAt: new Date().toISOString()
                  }
                ], {
                  model: activeModel,
                  stream: false
                })
              } catch (fallbackErr) {
                console.error('[ContextCompactor] Fallback compaction model also failed:', fallbackErr)
                continue
              }
            } else {
              continue
            }
          }

          const rawContent = result?.content?.trim()
          if (!rawContent) continue

          let parsedResult = { summary: '', knowledgeGraph: '' }
          try {
            let cleanContent = rawContent.replace(/```json/g, '').replace(/```/g, '').trim()
            const parsed = JSON.parse(cleanContent)
            parsedResult.summary = parsed.summary || ''
            parsedResult.knowledgeGraph = parsed.knowledgeGraph || ''
          } catch {
            parsedResult.summary = rawContent
          }

          if (!parsedResult.summary) {
            parsedResult.summary = rawContent
          }

          const firstMsgId = topicMessages[0]!.id
          const lastMsgId = topicMessages[topicMessages.length - 1]!.id

          // Write summary and delete messages in a transaction
          const commitTx = db.transaction(() => {
            const insertStmt = db.prepare(`
              INSERT INTO chat_summaries (id, session_id, start_message_id, end_message_id, summary_content, knowledge_graph)
              VALUES (?, ?, ?, ?, ?, ?)
            `)
            insertStmt.run(uuidv4(), sessionId, firstMsgId, lastMsgId, parsedResult.summary, parsedResult.knowledgeGraph)

            const deleteStmt = db.prepare('DELETE FROM messages WHERE id = ?')
            for (const msg of topicMessages) {
              deleteStmt.run(msg.id)
            }
          })
          commitTx()
        }

        console.log(`[ContextCompactor] Successfully compacted completed topics for session ${sessionId}`)
      } catch (err) {
        console.error('[ContextCompactor] Failed to compact session in background:', err)
      }
    }, 1500)
  }
}

export const contextCompactor = ContextCompactor.getInstance()
