// ═══════════════════════════════════════════════════════════════════
// Lumiq — Context Manager
// Manages the context window by trimming old messages to stay
// within token limits. Preserves system prompt and recent messages.
// ═══════════════════════════════════════════════════════════════════

import type { Message } from '@shared/types'

export class ContextManager {
  private maxMessages: number

  constructor(maxMessages = 50) {
    this.maxMessages = maxMessages
  }

  /**
   * Trims messages to fit within context limits.
   * Always keeps the system prompt (if any) and the most recent messages.
   */
  trimMessages(messages: Message[]): Message[] {
    if (messages.length <= this.maxMessages) return messages

    // Separate system messages from the rest
    const systemMessages = messages.filter((m) => m.role === 'system')
    const nonSystemMessages = messages.filter((m) => m.role !== 'system')

    // Keep system messages + last N non-system messages
    const trimmedNonSystem = nonSystemMessages.slice(-this.maxMessages)

    return [...systemMessages, ...trimmedNonSystem]
  }

  /**
   * Updates the max messages limit.
   */
  setMaxMessages(max: number): void {
    this.maxMessages = Math.max(10, Math.min(200, max))
  }
}
