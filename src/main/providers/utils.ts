// ═══════════════════════════════════════════════════════════════════
// Lumiq — AI Provider Utilities
// ═══════════════════════════════════════════════════════════════════

import type { Message, SendOptions } from '@shared/types'

/**
 * Sanitizes the message history for provider API requests.
 * 1. Filters out unrecognized tool calls from assistant messages.
 * 2. Converts unrecognized tool results into standard user message blocks.
 * This prevents 400 Bad Request validation errors across all providers.
 */
export function sanitizeMessages(messages: Message[], options: SendOptions): Message[] {
  const availableToolNames = new Set(options.tools?.map((t) => t.name) || [])
  return messages.map((m) => {
    if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
      const validToolCalls = m.toolCalls.filter((tc) => availableToolNames.has(tc.toolName))
      return {
        ...m,
        toolCalls: validToolCalls.length > 0 ? validToolCalls : undefined
      }
    }
    if (m.role === 'tool') {
      const toolName = m.toolName || ''
      if (!availableToolNames.has(toolName)) {
        return {
          ...m,
          role: 'user' as const,
          content: `[System: Tool "${toolName}" was executed and returned the following outcome]:\n${m.content}`
        }
      }
    }
    return m
  })
}
