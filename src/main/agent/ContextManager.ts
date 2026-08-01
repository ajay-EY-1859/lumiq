// ═══════════════════════════════════════════════════════════════════
// Lumiq — Context Manager
// Manages the context window by trimming old messages to stay
// within token limits. Preserves system prompt and recent messages.
// ═══════════════════════════════════════════════════════════════════

import type { Message } from '@shared/types'
import { userProfileManager } from './UserProfileManager'
import { contextCompactor } from './ContextCompactor'

export function getModelContextLimit(modelName: string): number {
  const name = modelName.toLowerCase()
  if (name.includes('gemini-1.5-pro') || name.includes('pro')) {
    return 1000000 // 1 Million tokens
  }
  if (name.includes('gemini-1.5-flash') || name.includes('flash')) {
    return 1000000 // 1 Million tokens
  }
  if (name.includes('claude') || name.includes('sonnet') || name.includes('opus') || name.includes('haiku')) {
    return 200000 // 200k tokens
  }
  if (name.includes('gpt-4o') || name.includes('gpt-4-turbo') || name.includes('gpt-4')) {
    return 128000 // 128k tokens
  }
  if (name.includes('gpt-3.5') || name.includes('o1') || name.includes('o3')) {
    return 128000 // 128k tokens
  }
  if (name.includes('deepseek') || name.includes('minimax') || name.includes('llama') || name.includes('nemotron') || name.includes('step-') || name.includes('stepfun')) {
    return 128000 // 128k tokens (Nvidia NIM / API context limit)
  }
  return 128000 // Default fallback limit for unknown models to prevent API context overflow errors
}

export class ContextManager {
  private maxMessages: number
  private maxTokenEstimate: number

  constructor(maxMessages = 150, maxTokenEstimate = 1000000) {
    this.maxMessages = maxMessages
    this.maxTokenEstimate = maxTokenEstimate
  }

  /**
   * Trims messages to fit within context limits.
   * Always keeps the system prompt (if any) and the most recent messages.
   * Uses an approximate token estimate so long-running IDE sessions can
   * preserve relevant history without exceeding provider limits.
   */
  trimMessages(messages: Message[], sessionId?: string, ragSegment?: string, systemPrompt?: string, modelName?: string, memorySegment?: string): Message[] {
    let systemMessages = messages.filter((m) => m.role === 'system')
    const nonSystemMessages = messages.filter((m) => m.role !== 'system')

    // Inject Long-term facts, history compaction summaries, codebase RAG context, and episodic memory
    const factsSegment = userProfileManager.getProfilePromptSegment()
    const summariesSegment = sessionId ? contextCompactor.getSummariesPromptSegment(sessionId) : ''
    const extraSystemSegments = factsSegment + summariesSegment + (ragSegment || '') + (memorySegment || '')

    const basePromptText = systemPrompt || (systemMessages.length > 0 ? systemMessages[0].content : 'You are a highly capable agentic AI coding assistant.')

    // Reconstruct system messages: 
    // 1st: Static Base Prompt
    // 2nd: Slowly-changing workspace context (if extraSystemSegments is present)
    const newSystemMessages: Message[] = [
      {
        id: 'synth_system_base',
        sessionId: sessionId || '',
        role: 'system',
        content: basePromptText,
        createdAt: new Date().toISOString()
      } as any
    ]

    if (extraSystemSegments) {
      newSystemMessages.push({
        id: 'synth_system_context',
        sessionId: sessionId || '',
        role: 'system',
        content: `[Workspace Context & Memory]\n` + extraSystemSegments,
        createdAt: new Date().toISOString()
      } as any)
    }

    systemMessages = newSystemMessages

    const limit = modelName ? getModelContextLimit(modelName) : this.maxTokenEstimate

    if (messages.length <= this.maxMessages && this.estimateTokens([...systemMessages, ...nonSystemMessages]) <= limit) {
      return [...systemMessages, ...nonSystemMessages]
    }

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
      if (totalMessages + chunk.length > this.maxMessages || totalTokens + chunkTokens > limit) {
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
