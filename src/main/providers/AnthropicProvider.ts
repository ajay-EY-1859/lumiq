// ═══════════════════════════════════════════════════════════════════
// Lumiq — Anthropic Claude Provider
// ═══════════════════════════════════════════════════════════════════

import Anthropic from '@anthropic-ai/sdk'
import type { AIProvider } from './AIProvider'
import type { Message, ProviderConfig, SendOptions, SendResult, TestResult } from '@shared/types'

export class AnthropicProvider implements AIProvider {
  private client: Anthropic

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl || undefined
    })
  }

  async sendMessage(messages: Message[], options: SendOptions): Promise<SendResult> {
    const anthropicMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => this.toAnthropicMessage(m))

    const tools = options.tools?.map((tool) => ({
      name: tool.name,
      description: tool.description,
      input_schema: tool.inputSchema
    }))

    const stream = this.client.messages.stream({
      model: options.model,
      max_tokens: options.maxTokens ?? 8096,
      system: options.systemPrompt,
      messages: anthropicMessages,
      tools: tools && tools.length > 0 ? tools : undefined
    } as Anthropic.MessageCreateParamsNonStreaming)

    let content = ''
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        content += event.delta.text
        options.onChunk?.(event.delta.text)
        if (options.signal?.aborted) break
      }
    }

    const finalMessage = await stream.finalMessage()
    const toolCalls = finalMessage.content
      .filter((block) => block.type === 'tool_use')
      .map((block) => ({
        id: block.id,
        toolName: block.name,
        input: block.input as Record<string, unknown>
      }))

    return {
      content,
      tokensUsed: finalMessage.usage?.output_tokens ?? 0,
      stopReason: finalMessage.stop_reason ?? 'end_turn',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    }
  }

  private toAnthropicMessage(message: Message): Anthropic.MessageParam {
    if (message.role === 'tool') {
      return {
        role: 'user',
        content: [
          {
            type: 'tool_result',
            tool_use_id: message.toolCallId || message.toolName || 'tool-call',
            content: message.content
          }
        ]
      }
    }

    if (message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: [
          ...(message.content ? [{ type: 'text' as const, text: message.content }] : []),
          ...message.toolCalls.map((toolCall) => ({
            type: 'tool_use' as const,
            id: toolCall.id,
            name: toolCall.toolName,
            input: toolCall.input
          }))
        ]
      }
    }

    return {
      role: message.role as 'user' | 'assistant',
      content: message.content
    }
  }

  async listModels(): Promise<string[]> {
    return ['claude-opus-4-20250514', 'claude-sonnet-4-20250514', 'claude-haiku-4-20250506']
  }

  async testConnection(): Promise<TestResult> {
    try {
      await this.client.messages.create({
        model: 'claude-haiku-4-20250506',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }]
      })
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }
}
