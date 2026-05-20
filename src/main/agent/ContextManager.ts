// ═══════════════════════════════════════════════════════════════════
// Lumiq — Context Manager
// Manages the context window by trimming old messages to stay
// within token limits. Preserves system prompt and recent messages.
// ═══════════════════════════════════════════════════════════════════

import type { Message } from '@shared/types'

export class ContextManager {
  private maxMessages: number
  private maxTokenEstimate: number

  constructor(maxMessages = 150, maxTokenEstimate = 4096) {
    this.maxMessages = maxMessages
    this.maxTokenEstimate = maxTokenEstimate
  }

  /**
   * Trims messages to fit within context limits.
   * Always keeps the system prompt (if any) and the most recent messages.
   * Uses an approximate token estimate so long-running IDE sessions can
   * preserve relevant history without exceeding provider limits.
   */
  trimMessages(messages: Message[]): Message[] {
    if (messages.length <= this.maxMessages && this.estimateTokens(messages) <= this.maxTokenEstimate) {
      return messages
    }

    const systemMessages = messages.filter((m) => m.role === 'system')
    const nonSystemMessages = messages.filter((m) => m.role !== 'system')

    const chunks: Message[][] = []
    let currentChunk: Message[] = []

    for (const message of nonSystemMessages) {
      if (message.role === 'assistant') {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk)
        }
        currentChunk = [message]
      } else if (message.role === 'tool') {
        if (currentChunk.length === 0) {
          currentChunk = [message]
        } else {
          currentChunk.push(message)
        }
      } else {
        if (currentChunk.length > 0) {
          chunks.push(currentChunk)
          currentChunk = []
        }
        chunks.push([message])
      }
    }
    if (currentChunk.length > 0) {
      chunks.push(currentChunk)
    }

    const selectedChunks: Message[][] = []
    let totalMessages = 0
    let totalTokens = this.estimateTokens(systemMessages)

    for (let i = chunks.length - 1; i >= 0; i--) {
      const chunk = chunks[i]
      const chunkTokens = this.estimateTokens(chunk)
      if (totalMessages + chunk.length > this.maxMessages || totalTokens + chunkTokens > this.maxTokenEstimate) {
        break
      }
      selectedChunks.unshift(chunk)
      totalMessages += chunk.length
      totalTokens += chunkTokens
    }

    const trimmedNonSystem = selectedChunks.flat()
    return [...systemMessages, ...trimmedNonSystem]
  }

  private estimateTokens(messages: Message[]): number {
    let charCount = 0
    for (const message of messages) {
      charCount += message.role.length + 2
      charCount += message.content.length
      if (message.toolName) charCount += message.toolName.length + 5
      if (message.toolResult) charCount += message.toolResult.length
      if (message.toolInput) charCount += JSON.stringify(message.toolInput).length
    }
    return Math.ceil(charCount / 4)
  }

  /**
   * Updates the max messages limit.
   */
  setMaxMessages(max: number): void {
    this.maxMessages = Math.max(10, Math.min(500, max))
  }
}
