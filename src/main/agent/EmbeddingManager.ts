// ═══════════════════════════════════════════════════════════════════
// Lumiq — Embedding Manager
// Generates numerical embeddings using Cloud APIs or local Transformers.js.
// ═══════════════════════════════════════════════════════════════════

import { getApiConfig } from '../db/apiConfigs'
import { GoogleGenerativeAI } from '@google/generative-ai'
import { Worker } from 'worker_threads'
import { join } from 'path'
import { existsSync } from 'fs'

// Rust native module for SIMD-accelerated vector similarity
let native: any = null
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  native = require('@lumiq/native')
} catch {
  // Rust module not available, will use JS fallback
}

export class EmbeddingManager {
  private static instance: EmbeddingManager
  private worker: Worker | null = null
  private pendingRequests = new Map<string, { resolve: (v: number[]) => void; reject: (err: Error) => void }>()
  private requestIdCounter = 0
  private localPipelineInstance: any = null

  private constructor() {}

  private async getLocalPipeline(): Promise<any> {
    if (this.localPipelineInstance) {
      return this.localPipelineInstance
    }
    try {
      const { pipeline } = await import('@xenova/transformers')
      console.log('[EmbeddingManager] Loading offline embedding model "Xenova/all-MiniLM-L6-v2" inline...')
      this.localPipelineInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
      console.log('[EmbeddingManager] Local embedding model loaded successfully inline!')
      return this.localPipelineInstance
    } catch (err) {
      console.error('[EmbeddingManager] Failed to load @xenova/transformers inline:', err)
      throw err
    }
  }

  public static getInstance(): EmbeddingManager {
    if (!EmbeddingManager.instance) {
      EmbeddingManager.instance = new EmbeddingManager()
    }
    return EmbeddingManager.instance
  }

  /**
   * Generates a normalized embedding vector for the given text.
   * Cosine similarity between two normalized vectors is just the dot product!
   */
  public async getEmbedding(text: string): Promise<number[]> {
    try {
      // 1. Try Gemini Cloud Embeddings if active
      const geminiConfig = getApiConfig('gemini')
      if (geminiConfig && geminiConfig.isActive && geminiConfig.apiKey) {
        try {
          const genAI = new GoogleGenerativeAI(geminiConfig.apiKey)
          const model = genAI.getGenerativeModel({ model: 'text-embedding-004' })
          const result = await model.embedContent(text)
          if (result && result.embedding && result.embedding.values) {
            return this.normalizeVector(result.embedding.values)
          }
        } catch (apiErr) {
          console.warn('[EmbeddingManager] Gemini Embedding API failed, falling back to local:', apiErr)
        }
      }

      // 2. Try Local Offline-First Embedding using worker thread (with main thread inline fallback)
      try {
        const vector = await this.getEmbeddingFromWorker(text)
        if (vector) return vector
      } catch (localErr) {
        console.warn('[EmbeddingManager] Transformers.js local embedding worker failed/unavailable, trying inline fallback:', localErr)
        try {
          const pipeline = await this.getLocalPipeline()
          if (pipeline) {
            const output = await pipeline(text, { pooling: 'mean', normalize: true })
            return Array.from(output.data) as number[]
          }
        } catch (inlineErr) {
          console.warn('[EmbeddingManager] Inline Transformers.js embedding failed:', inlineErr)
        }
      }

      // 3. Resilient Fallback: Generate keyword-frequency hashed pseudo-embeddings
      // This ensures RAG functionality never crashes the app and can still match relevant keywords
      return this.generatePseudoEmbedding(text)

    } catch (err) {
      console.error('[EmbeddingManager] Fatal error during embedding generation:', err)
      return new Array(384).fill(0) // Return zero vector
    }
  }

  /**
   * Lazily spawns and caches the local embedding worker thread.
   */
  private getEmbeddingWorker(): Worker | null {
    if (this.worker) return this.worker

    try {
      const workerPath = join(__dirname, 'embeddingWorker.js')
      if (!existsSync(workerPath)) {
        console.warn(`[EmbeddingManager] Local embedding worker script not found at "${workerPath}", will fall back to inline.`)
        return null
      }
      console.log(`[EmbeddingManager] Spawning local embedding worker thread: ${workerPath}`)
      
      this.worker = new Worker(workerPath)
      
      this.worker.on('message', (data: { id: string; vector?: number[]; error?: string }) => {
        const req = this.pendingRequests.get(data.id)
        if (req) {
          this.pendingRequests.delete(data.id)
          if (data.vector) {
            req.resolve(data.vector)
          } else {
            req.reject(new Error(data.error || 'Unknown worker error'))
          }
        }
      })

      this.worker.on('error', (err: Error) => {
        console.error('[EmbeddingManager] Local embedding worker crashed:', err)
        for (const [, req] of this.pendingRequests.entries()) {
          req.reject(err)
        }
        this.pendingRequests.clear()
        this.worker = null
      })
      
      return this.worker
    } catch (err) {
      console.error('[EmbeddingManager] Failed to spawn embedding worker:', err)
      return null
    }
  }

  /**
   * Dispatches text embedding task to the background worker thread.
   */
  private getEmbeddingFromWorker(text: string): Promise<number[]> {
    return new Promise((resolve, reject) => {
      try {
        const worker = this.getEmbeddingWorker()
        if (!worker) {
          reject(new Error('Embedding worker is not available'))
          return
        }

        const id = String(++this.requestIdCounter)
        this.pendingRequests.set(id, { resolve, reject })
        worker.postMessage({ id, text })
      } catch (err) {
        reject(err)
      }
    })
  }

  /**
   * Computes the dot product of two vectors (corresponds to cosine similarity
   * if both vectors are normalized).
   */
  public cosineSimilarity(vecA: number[], vecB: number[]): number {
    if (native) {
      try {
        return native.cosineSimilarity(vecA, vecB)
      } catch {
        // Fallback to JS
      }
    }
    if (vecA.length !== vecB.length) return 0
    let dotProduct = 0
    for (let i = 0; i < vecA.length; i++) {
      dotProduct += vecA[i]! * vecB[i]!
    }
    return dotProduct
  }

  /**
   * Normalizes a vector to unit length (magnitude = 1.0).
   */
  private normalizeVector(vector: number[]): number[] {
    let sumSquares = 0
    for (let i = 0; i < vector.length; i++) {
      sumSquares += vector[i]! * vector[i]!
    }
    const magnitude = Math.sqrt(sumSquares)
    if (magnitude === 0) return vector
    return vector.map((v) => v / magnitude)
  }

  /**
   * Generates a deterministic keyword-based 384-dimensional normalized vector
   * as a resilient offline fallback when AI models aren't available.
   */
  private generatePseudoEmbedding(text: string): number[] {
    const vector = new Array(384).fill(0)
    const words = text.toLowerCase().split(/[\s,.;:!?()[\]{}""'']+/) // Split on standard whitespace and punctuation
    
    words.forEach((word) => {
      if (word.length < 3) return // Ignore short filler words
      
      // Deterministic hashing of words to vector indices
      let hash = 0
      for (let i = 0; i < word.length; i++) {
        hash = word.charCodeAt(i) + ((hash << 5) - hash)
      }
      const index = Math.abs(hash) % 384
      vector[index] = (vector[index] || 0) + 1.0
    })

    return this.normalizeVector(vector)
  }
}

export const embeddingManager = EmbeddingManager.getInstance()
