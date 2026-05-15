// ═══════════════════════════════════════════════════════════════════
// Lumiq — Context Manager
// Manages the context window by trimming old messages to stay
// within token limits. Preserves system prompt and recent messages.
// ═══════════════════════════════════════════════════════════════════

import type { Message } from '@shared/types'

export class ContextManager {
  private maxMessages: number

  constructor(maxMessages = 150) {
    this.maxMessages = maxMessages
  }

  /**
   * Trims messages to fit within context limits.
   * Always keeps the system prompt (if any) and the most recent messages.
   * Never splits an assistant+tool group — if the trim point falls inside
   * a tool result sequence, we back up to include the parent assistant message.
   */
  trimMessages(messages: Message[]): Message[] {
    if (messages.length <= this.maxMessages) return messages

    // Separate system messages from the rest
    const systemMessages = messages.filter((m) => m.role === 'system')
    const nonSystemMessages = messages.filter((m) => m.role !== 'system')

    // Start from the calculated trim point
    let startIndex = Math.max(0, nonSystemMessages.length - this.maxMessages)

    // If the trim point lands on a tool message, back up to include
    // the preceding assistant message that triggered these tool calls
    while (startIndex > 0 && nonSystemMessages[startIndex]?.role === 'tool') {
      startIndex--
    }

    const trimmedNonSystem = nonSystemMessages.slice(startIndex)

    return [...systemMessages, ...trimmedNonSystem]
  }

  /**
   * Updates the max messages limit.
   */
  setMaxMessages(max: number): void {
    this.maxMessages = Math.max(10, Math.min(500, max))
  }
}
