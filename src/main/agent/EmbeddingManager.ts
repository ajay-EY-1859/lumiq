// ═══════════════════════════════════════════════════════════════════
// Lumiq — Embedding Manager
// Generates numerical embeddings using Cloud APIs or local Transformers.js.
// ═══════════════════════════════════════════════════════════════════

import { getApiConfig } from '../db/apiConfigs'
import { GoogleGenerativeAI } from '@google/generative-ai'

export class EmbeddingManager {
  private static instance: EmbeddingManager
  private pipelineInstance: any = null
  private isLocalModelLoaded = false

  private constructor() {}

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

      // 2. Try Local Offline-First Embedding using Transformers.js
      try {
        const pipeline = await this.getLocalPipeline()
        if (pipeline) {
          const output = await pipeline(text, { pooling: 'mean', normalize: true })
          const vector = Array.from(output.data) as number[]
          return vector
        }
      } catch (localErr) {
        console.warn('[EmbeddingManager] Transformers.js local embedding failed:', localErr)
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
   * Lazily loads and caches the local Transformers.js pipeline.
   */
  private async getLocalPipeline(): Promise<any> {
    if (this.isLocalModelLoaded && this.pipelineInstance) {
      return this.pipelineInstance
    }

    try {
      // Dynamic import to prevent startup bottlenecks and compilation crashes if package is missing
      const { pipeline } = await import('@xenova/transformers')
      console.log('[EmbeddingManager] Loading offline embedding model "Xenova/all-MiniLM-L6-v2"...')
      this.pipelineInstance = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2')
      this.isLocalModelLoaded = true
      console.log('[EmbeddingManager] Local embedding model loaded successfully!')
      return this.pipelineInstance
    } catch (err) {
      console.warn('[EmbeddingManager] Could not dynamically load @xenova/transformers:', err)
      return null
    }
  }

  /**
   * Computes the dot product of two vectors (corresponds to cosine similarity
   * if both vectors are normalized).
   */
  public cosineSimilarity(vecA: number[], vecB: number[]): number {
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
