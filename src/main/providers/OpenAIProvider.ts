// ═══════════════════════════════════════════════════════════════════
// Lumiq — OpenAI Provider
// ═══════════════════════════════════════════════════════════════════

import OpenAI from 'openai'
import type { AIProvider } from './AIProvider'
import type { Message, ProviderConfig, SendOptions, SendResult, TestResult } from '@shared/types'

export class OpenAIProvider implements AIProvider {
  protected client: OpenAI

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined
    })
  }

  async sendMessage(messages: Message[], options: SendOptions): Promise<SendResult> {
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = []

    if (options.systemPrompt) {
      openaiMessages.push({ role: 'system', content: options.systemPrompt })
    }

    openaiMessages.push(
      ...messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({
          role: m.role as 'user' | 'assistant',
          content: m.content
        }))
    )

    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages: openaiMessages,
      stream: true,
      max_tokens: options.maxTokens
    })

    let content = ''
    let tokensUsed = 0

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (delta) {
        content += delta
        options.onChunk?.(delta)
      }
      if (chunk.usage) tokensUsed = chunk.usage.completion_tokens
      if (options.signal?.aborted) break
    }

    return { content, tokensUsed, stopReason: 'stop' }
  }

  async listModels(): Promise<string[]> {
    try {
      const models = await this.client.models.list()
      return models.data
        .filter((m) => m.id.startsWith('gpt'))
        .map((m) => m.id)
        .sort()
    } catch {
      return ['gpt-4o', 'gpt-4o-mini', 'gpt-4-turbo', 'gpt-3.5-turbo']
    }
  }

  async testConnection(): Promise<TestResult> {
    try {
      await this.client.models.list()
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }
}
