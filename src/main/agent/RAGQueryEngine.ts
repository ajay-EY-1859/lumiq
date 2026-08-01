// ═══════════════════════════════════════════════════════════════════
// Lumiq — RAG Query Engine
// Performs vector similarity searches against indexed codebase chunks.
// ═══════════════════════════════════════════════════════════════════

import { getDatabase } from '../db/database'
import { embeddingManager } from './EmbeddingManager'

// Rust native module for SIMD-accelerated vector similarity
let native: any = null
try {
   
  native = require('@lumiq/native')
} catch {
  // Rust module not available, will use JS fallback
}

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

      // 3. Compute cosine similarity — try Rust native batch first
      if (native && rows.length > 0) {
        try {
          // Extract all vectors as f64 arrays for Rust
          const allVectors: number[][] = rows.map(row => {
            return Array.from(new Float32Array(
              row.embedding.buffer,
              row.embedding.byteOffset,
              row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
            )) as number[]
          })

          const results = native.cosineSimilarityBatch(
            queryVec,
            allVectors,
            topK,
            0.15 // threshold
          )

          return results.map((r: any) => ({
            filePath: rows[r.index].filePath,
            chunkIndex: rows[r.index].chunkIndex,
            content: rows[r.index].content,
            score: r.score
          }))
        } catch (err) {
          console.warn('[RAGQueryEngine] Rust similarity failed, falling back to JS:', err)
        }
      }

      // JS fallback: sequential cosine similarity
      const matches: RAGMatch[] = []
      for (const row of rows) {
        const chunkVec = Array.from(new Float32Array(
          row.embedding.buffer,
          row.embedding.byteOffset,
          row.embedding.byteLength / Float32Array.BYTES_PER_ELEMENT
        ))
        const score = embeddingManager.cosineSimilarity(queryVec, chunkVec)
        matches.push({
          filePath: row.filePath,
          chunkIndex: row.chunkIndex,
          content: row.content,
          score
        })
      }
      return matches
        .sort((a, b) => b.score - a.score)
        .slice(0, topK)
        .filter((m) => m.score > 0.15)

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

    // AST Call Graph Augmentation Step
    try {
      const db = getDatabase()
      const dependencySignatures: string[] = []
      const processedFiles = new Set<string>()

      for (const m of matches) {
        // Find symbols referenced by the matched file
        const refs = db.prepare(`
          SELECT DISTINCT target_name as targetName FROM ast_references 
          WHERE workspace_path = ? AND source_file_path = ?
        `).all(workspacePath, m.filePath) as { targetName: string }[]

        for (const ref of refs) {
          // Find where this symbol is defined
          const defs = db.prepare(`
            SELECT DISTINCT file_path as filePath, name, kind, signature FROM ast_symbols
            WHERE workspace_path = ? AND name = ? AND file_path != ?
            LIMIT 2
          `).all(workspacePath, ref.targetName, m.filePath) as { filePath: string, name: string, kind: string, signature: string | null }[]

          for (const def of defs) {
            const depKey = `${def.filePath}-${def.name}`
            if (processedFiles.has(depKey)) continue
            processedFiles.add(depKey)

            const sig = def.signature || `${def.kind} ${def.name}`
            dependencySignatures.push(`- Symbol: "${def.name}" (${def.kind}) defined in [${def.filePath.replace(workspacePath, '').replace(/^[\\/]/, '')}]
  Signature: ${sig}`)
          }
        }
      }

      if (dependencySignatures.length > 0) {
        segment += '🕸️ AST CODE CALL GRAPH DEPENDENCY SIGNATURES\n'
        segment += 'The following are type/function signatures of modules imported or called by the matched code above:\n'
        segment += dependencySignatures.join('\n') + '\n\n'
      }
    } catch (graphErr) {
      console.error('[RAGQueryEngine] Failed to resolve AST Graph-RAG dependencies:', graphErr)
    }

    segment += '═══════════════════════════════════════════════════════════════════\n'
    return segment
  }
}

export const ragQueryEngine = RAGQueryEngine.getInstance()
