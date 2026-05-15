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
        .map((m) => this.toOpenAIMessage(m))
    )

    const tools = options.tools?.map((tool) => ({
      type: 'function' as const,
      function: {
        name: tool.name,
        description: tool.description,
        parameters: tool.inputSchema
      }
    }))

    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages: openaiMessages,
      stream: true,
      max_tokens: options.maxTokens,
      tools: tools && tools.length > 0 ? tools : undefined
    })

    let content = ''
    let tokensUsed = 0
    const toolCallChunks = new Map<number, { id: string; name: string; arguments: string }>()

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? ''
      if (delta) {
        content += delta
        options.onChunk?.(delta)
      }
      for (const toolCall of chunk.choices[0]?.delta?.tool_calls || []) {
        const index = toolCall.index
        const existing = toolCallChunks.get(index) || { id: '', name: '', arguments: '' }
        toolCallChunks.set(index, {
          id: toolCall.id || existing.id,
          name: toolCall.function?.name || existing.name,
          arguments: existing.arguments + (toolCall.function?.arguments || '')
        })
      }
      if (chunk.usage) tokensUsed = chunk.usage.completion_tokens
      if (options.signal?.aborted) break
    }

    const toolCalls = Array.from(toolCallChunks.values())
      .filter((toolCall) => toolCall.id && toolCall.name)
      .map((toolCall) => ({
        id: toolCall.id,
        toolName: toolCall.name,
        input: this.parseToolArguments(toolCall.arguments)
      }))

    return {
      content,
      tokensUsed,
      stopReason: toolCalls.length > 0 ? 'tool_calls' : 'stop',
      toolCalls: toolCalls.length > 0 ? toolCalls : undefined
    }
  }

  private toOpenAIMessage(message: Message): OpenAI.ChatCompletionMessageParam {
    if (message.role === 'tool') {
      return {
        role: 'tool',
        tool_call_id: message.toolCallId || message.toolName || 'tool-call',
        content: message.content
      }
    }

    if (message.role === 'assistant' && message.toolCalls && message.toolCalls.length > 0) {
      return {
        role: 'assistant',
        content: message.content || null,
        tool_calls: message.toolCalls.map((toolCall) => ({
          id: toolCall.id,
          type: 'function',
          function: {
            name: toolCall.toolName,
            arguments: JSON.stringify(toolCall.input)
          }
        }))
      }
    }

    return {
      role: message.role as 'user' | 'assistant',
      content: message.content
    }
  }

  private parseToolArguments(args: string): Record<string, unknown> {
    if (!args.trim()) return {}
    try {
      return JSON.parse(args) as Record<string, unknown>
    } catch {
      return { input: args }
    }
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
