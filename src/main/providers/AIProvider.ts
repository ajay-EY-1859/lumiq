// ═══════════════════════════════════════════════════════════════════
// Lumiq — AI Provider Interface
// All providers implement this interface for unified access.
// ═══════════════════════════════════════════════════════════════════

import type { Message, SendOptions, SendResult, TestResult } from '@shared/types'

export interface AIProvider {
  /**
   * Sends messages to the AI provider and returns the response.
   * Supports streaming via options.onChunk callback.
   */
  sendMessage(messages: Message[], options: SendOptions): Promise<SendResult>

  /**
   * Lists available models from this provider.
   * Falls back to static list if API call fails.
   */
  listModels(): Promise<string[]>

  /**
   * Tests the connection to the provider.
   * Returns success/failure with error message.
   */
  testConnection(): Promise<TestResult>
}
