// ═══════════════════════════════════════════════════════════════════
// Lumiq — RAG Query Engine
// Performs vector similarity searches against indexed codebase chunks.
// ═══════════════════════════════════════════════════════════════════

import { getDatabase } from '../db/database'
import { embeddingManager } from './EmbeddingManager'

export interface RAGMatch {
  filePath: string
  chunkIndex: number
  content: string
  score: number
}

export class RAGQueryEngine {
  private static instance: RAGQueryEngine

  private constructor() {}

  public static getInstance(): RAGQueryEngine {
    if (!RAGQueryEngine.instance) {
      RAGQueryEngine.instance = new RAGQueryEngine()
    }
    return RAGQueryEngine.instance
  }

  /**
   * Performs semantic similarity search on the user's query within the workspace path.
   * Returns top matched code chunks.
   */
  public async search(workspacePath: string, query: string, topK = 4): Promise<RAGMatch[]> {
    try {
      const db = getDatabase()

      // 1. Get query embedding
      const queryVec = await embeddingManager.getEmbedding(query)

      // 2. Fetch all embeddings for this workspace
      const stmt = db.prepare(`
        SELECT file_path as filePath, chunk_index as chunkIndex, content, embedding
        FROM codebase_embeddings
        WHERE workspace_path = ?
      `)
      const rows = stmt.all(workspacePath) as Array<{
        filePath: string
        chunkIndex: number
        content: string
        embedding: Buffer
      }>

      if (rows.length === 0) return []

      // 3. Compute cosine similarity for each chunk
      const matches: RAGMatch[] = []

      for (const row of rows) {
        // Deserialize float array from buffer
        const chunkVec = Array.from(new Float32Array(row.embedding.buffer))
        const score = embeddingManager.cosineSimilarity(queryVec, chunkVec)

        matches.push({
          filePath: row.filePath,
          chunkIndex: row.chunkIndex,
          content: row.content,
          score
        })
      }

      // 4. Sort descending by score and keep topK
      return matches
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .filter((m) => m.score > 0.15) // Relevancy threshold filter

    } catch (err) {
      console.error('[RAGQueryEngine] Semantic search query failed:', err)
      return []
    }
  }

  /**
   * Formats retrieved matched chunks as a system prompt context block.
   */
  public async getSemanticPromptSegment(workspacePath: string, query: string): Promise<string> {
    const matches = await this.search(workspacePath, query)
    if (matches.length === 0) return ''

    let segment = '\n\n═══════════════════════════════════════════════════════════════════\n'
    segment += 'SEMANTIC WORKSPACE CONTEXT (Codebase RAG Layer)\n'
    segment += 'The following are relevant code snippets matching the user\'s current task. Use them for additional code structure context:\n\n'
    matches.forEach((m, idx) => {
      segment += `--- Snippet #${idx + 1} | File: ${m.filePath} (Chunk #${m.chunkIndex + 1}) | Match Relevance: ${(m.score * 100).toFixed(1)}% ---\n`
      segment += `${m.content}\n\n`
    })
    segment += '═══════════════════════════════════════════════════════════════════\n'
    return segment
  }
}

export const ragQueryEngine = RAGQueryEngine.getInstance()
