// ═══════════════════════════════════════════════════════════════════
// Lumiq — Amazon Bedrock Provider
// Uses @anthropic-ai/bedrock-sdk for Claude models on Bedrock.
// Uses @aws-sdk/client-bedrock-runtime for non-Anthropic models.
// ═══════════════════════════════════════════════════════════════════

import type { AIProvider } from './AIProvider'
import type { Message, ProviderConfig, SendOptions, SendResult, TestResult } from '@shared/types'

interface BedrockMessageBlock {
  role: 'user' | 'assistant'
  content: any[]
}

export class BedrockProvider implements AIProvider {
  private config: ProviderConfig
  private region: string

  constructor(config: ProviderConfig) {
    this.config = config
    this.region = config.awsRegion ?? 'us-east-1'
  }

  private isAnthropicModel(modelId: string): boolean {
    return modelId.startsWith('anthropic.')
  }

  /**
   * Pre-processes messages to reconstruct missing toolCalls arrays.
   * This handles old DB data where toolCalls weren't persisted on assistant messages.
   * Without this, tool_result blocks reference tool_use IDs that don't exist in the
   * conversation, causing AWS validation errors.
   */
  private reconstructToolCalls(messages: Message[]): Message[] {
    const result = messages.map(m => ({ ...m }))

    for (let i = 0; i < result.length; i++) {
      const msg = result[i]

      // If this is an assistant message without toolCalls, check if tool messages follow
      if (msg.role === 'assistant' && (!msg.toolCalls || msg.toolCalls.length === 0)) {
        const toolCalls: { id: string; toolName: string; input: any }[] = []

        for (let j = i + 1; j < result.length && result[j].role === 'tool'; j++) {
          const toolMsg = result[j]
          // Generate a stable ID if toolCallId is missing
          const callId = toolMsg.toolCallId || `synth_${i}_${j}_${Date.now()}`
          toolCalls.push({
            id: callId,
            toolName: toolMsg.toolName || 'unknown_tool',
            input: toolMsg.toolInput || {}
          })
          // Ensure the tool message also has this ID for the result mapping
          if (!result[j].toolCallId) {
            result[j] = { ...result[j], toolCallId: callId }
          }
        }

        if (toolCalls.length > 0) {
          result[i] = { ...msg, toolCalls }
        }
      }

      // Also ensure any tool message has a non-empty toolCallId
      if (msg.role === 'tool' && !msg.toolCallId) {
        result[i] = { ...result[i], toolCallId: `synth_orphan_${i}_${Date.now()}` }
      }
    }

    return result
  }

  async sendMessage(messages: Message[], options: SendOptions): Promise<SendResult> {
    // Reconstruct missing toolCalls before sending to either API path
    const preparedMessages = this.reconstructToolCalls(messages)

    if (this.isAnthropicModel(options.model)) {
      return this.sendViaMessagesApi(preparedMessages, options)
    }
    return this.sendViaConverseApi(preparedMessages, options)
  }

  private async sendViaMessagesApi(
    messages: Message[],
    options: SendOptions
  ): Promise<SendResult> {
    const AnthropicBedrock = (await import('@anthropic-ai/bedrock-sdk')).default
    const client = new AnthropicBedrock({
      awsAccessKey: this.config.awsAccessKeyId ?? undefined,
      awsSecretKey: this.config.awsSecretAccessKey ?? undefined,
      awsSessionToken: this.config.awsSessionToken ?? undefined,
      awsRegion: this.region ?? undefined
    } as any)

    const tools = options.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.inputSchema as any
    }))

    const mappedMessages: BedrockMessageBlock[] = []

    for (const m of messages) {
      if (m.role === 'system') continue

      if (m.role === 'tool') {
        const lastMsg = mappedMessages[mappedMessages.length - 1]
        const toolResultBlock = {
          type: 'tool_result',
          tool_use_id: m.toolCallId ?? '',
          content: m.content
        }
        
        if (lastMsg && lastMsg.role === 'user' && Array.isArray(lastMsg.content) && lastMsg.content.some((c: any) => c.type === 'tool_result')) {
          lastMsg.content.push(toolResultBlock)
        } else {
          mappedMessages.push({
            role: 'user',
            content: [toolResultBlock]
          })
        }
        continue
      }

      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        mappedMessages.push({
          role: 'assistant',
          content: [
            ...(m.content ? [{ type: 'text', text: m.content }] : []),
            ...m.toolCalls.map(tc => ({
              type: 'tool_use',
              id: tc.id ?? `call_${Date.now()}`,
              name: tc.toolName,
              input: tc.input
            }))
          ]
        })
        continue
      }

      const lastMsg = mappedMessages[mappedMessages.length - 1]
      if (m.content) {
        if (lastMsg && lastMsg.role === m.role) {
          if (Array.isArray(lastMsg.content)) {
            lastMsg.content.push({ type: 'text', text: m.content })
          } else {
            lastMsg.content = [
              { type: 'text', text: lastMsg.content },
              { type: 'text', text: m.content }
            ]
          }
        } else {
          mappedMessages.push({
            role: m.role as 'user' | 'assistant',
            content: [{ type: 'text', text: m.content }]
          })
        }
      } else if (!lastMsg || lastMsg.role !== m.role) {
        // Avoid emitting an empty content block for Bedrock.
        continue
      }
    }

    // Apply Prompt Caching to the last two messages
    const len = mappedMessages.length
    for (let i = Math.max(0, len - 2); i < len; i++) {
      const msg = mappedMessages[i]
      if (Array.isArray(msg.content) && msg.content.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        ;(msg.content[msg.content.length - 1] as any).cache_control = { type: 'ephemeral' }
      }
    }

    const stream = client.messages.stream({
      model: options.model,
      max_tokens: options.maxTokens ?? 8096,
      system: options.systemPrompt ? [{ type: 'text', text: options.systemPrompt, cache_control: { type: 'ephemeral' } }] : undefined,
      tools: tools && tools.length > 0 ? tools : undefined,
      messages: mappedMessages as any
    })

    let content = ''
    const toolCalls: { id: string; toolName: string; input: any }[] = []
    // Map from content block index → toolCalls array index
    // (text blocks and tool_use blocks share the same index space)
    const blockToToolIndex = new Map<number, number>()

    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        content += event.delta.text
        options.onChunk?.(event.delta.text)
        if (options.signal?.aborted) break
      }
      if (event.type === 'content_block_start' && event.content_block.type === 'tool_use') {
        const arrIndex = toolCalls.length
        blockToToolIndex.set(event.index, arrIndex)
        toolCalls.push({
          id: event.content_block.id,
          toolName: event.content_block.name,
          input: ''
        })
      }
      if (event.type === 'content_block_delta' && event.delta.type === 'input_json_delta') {
        const arrIndex = blockToToolIndex.get(event.index)
        if (arrIndex !== undefined && toolCalls[arrIndex]) {
          toolCalls[arrIndex].input = (toolCalls[arrIndex].input || '') + event.delta.partial_json
        }
      }
    }

    const finalMessage = await stream.finalMessage()

    // Parse accumulated JSON arguments
    const parsedToolCalls = toolCalls.map(tc => {
      try {
        return { ...tc, input: JSON.parse(tc.input as string) }
      } catch {
        return { ...tc, input: {} }
      }
    })

    return {
      content,
      tokensUsed: finalMessage.usage?.output_tokens ?? 0,
      stopReason: parsedToolCalls.length > 0 ? 'tool_calls' : (finalMessage.stop_reason ?? 'end_turn'),
      toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined
    }
  }

  private async sendViaConverseApi(
    messages: Message[],
    options: SendOptions
  ): Promise<SendResult> {
    const { BedrockRuntimeClient, ConverseStreamCommand } = await import(
      '@aws-sdk/client-bedrock-runtime'
    )

    const client = new BedrockRuntimeClient({
      region: this.region,
      credentials: {
        accessKeyId: this.config.awsAccessKeyId!,
        secretAccessKey: this.config.awsSecretAccessKey!,
        ...(this.config.awsSessionToken && { sessionToken: this.config.awsSessionToken })
      }
    })

    const converseMessages: any[] = []
    
    for (const m of messages) {
      if (m.role === 'system') continue

      if (m.role === 'tool') {
        const lastMsg = converseMessages[converseMessages.length - 1]
        const toolResultBlock = {
          toolResult: {
            toolUseId: m.toolCallId ?? '',
            content: [{ text: m.content }]
          }
        }
        
        // If the last message was a user message containing tool results, append to it
        if (lastMsg && lastMsg.role === 'user' && lastMsg.content.some((c: any) => c.toolResult)) {
          lastMsg.content.push(toolResultBlock)
        } else {
          converseMessages.push({
            role: 'user',
            content: [toolResultBlock]
          })
        }
        continue
      }

      if (m.role === 'assistant' && m.toolCalls && m.toolCalls.length > 0) {
        converseMessages.push({
          role: 'assistant',
          content: [
            ...(m.content ? [{ text: m.content }] : []),
            ...m.toolCalls.map(tc => ({
              toolUse: {
                toolUseId: tc.id ?? `call_${Date.now()}`,
                name: tc.toolName,
                input: tc.input
              }
            }))
          ]
        })
        continue
      }

      // Merge contiguous text messages of the same role if needed (Bedrock usually expects alternating)
      const lastMsg = converseMessages[converseMessages.length - 1]
      if (m.content) {
        if (lastMsg && lastMsg.role === m.role) {
          lastMsg.content.push({ text: m.content })
        } else {
          converseMessages.push({
            role: m.role as 'user' | 'assistant',
            content: [{ text: m.content }]
          })
        }
      } else if (!lastMsg || lastMsg.role !== m.role) {
        // Avoid emitting an empty content block for Bedrock.
        continue
      }
    }

    const toolConfig = options.tools && options.tools.length > 0 ? {
      tools: options.tools.map(t => ({
        toolSpec: {
          name: t.name,
          description: t.description,
          inputSchema: { json: t.inputSchema as Record<string, unknown> }
        }
      }))
    } as const : undefined

    const command = new ConverseStreamCommand({
      modelId: options.model,
      messages: converseMessages as any,
      system: options.systemPrompt ? [{ text: options.systemPrompt }] : undefined,
      inferenceConfig: { maxTokens: options.maxTokens ?? 4096 },
      toolConfig: toolConfig as any
    })

    const response = await client.send(command)
    let content = ''
    const toolCalls: { id: string; toolName: string; input: string }[] = []
    // Map from content block index → toolCalls array index
    const blockToToolIndex = new Map<number, number>()

    if (response.stream) {
      for await (const event of response.stream) {
        if (event.contentBlockDelta?.delta?.text) {
          const text = event.contentBlockDelta.delta.text
          content += text
          options.onChunk?.(text)
        }
        
        if (event.contentBlockStart?.start?.toolUse) {
          const arrIndex = toolCalls.length
          const blockIdx = event.contentBlockStart.contentBlockIndex ?? arrIndex
          blockToToolIndex.set(blockIdx, arrIndex)
          toolCalls.push({
            id: event.contentBlockStart.start.toolUse.toolUseId!,
            toolName: event.contentBlockStart.start.toolUse.name!,
            input: ''
          })
        }

        if (event.contentBlockDelta?.delta?.toolUse) {
          const blockIdx = event.contentBlockDelta.contentBlockIndex!
          const arrIndex = blockToToolIndex.get(blockIdx)
          if (arrIndex !== undefined && toolCalls[arrIndex]) {
            toolCalls[arrIndex].input += event.contentBlockDelta.delta.toolUse.input || ''
          }
        }

        if (options.signal?.aborted) break
      }
    }

    const parsedToolCalls = toolCalls.map(tc => {
      try {
        return { ...tc, input: JSON.parse(tc.input) }
      } catch {
        return { ...tc, input: {} }
      }
    })

    return { 
      content, 
      tokensUsed: 0, 
      stopReason: parsedToolCalls.length > 0 ? 'tool_calls' : 'stop',
      toolCalls: parsedToolCalls.length > 0 ? parsedToolCalls : undefined
    }
  }

  async listModels(): Promise<string[]> {
    try {
      const { BedrockClient, ListFoundationModelsCommand } = await import(
        '@aws-sdk/client-bedrock'
      )
      const client = new BedrockClient({
        region: this.region,
        credentials: {
          accessKeyId: this.config.awsAccessKeyId!,
          secretAccessKey: this.config.awsSecretAccessKey!,
          ...(this.config.awsSessionToken && { sessionToken: this.config.awsSessionToken })
        }
      })
      const response = await client.send(
        new ListFoundationModelsCommand({ byOutputModality: 'TEXT' })
      )
      return (response.modelSummaries ?? []).filter((m) => m.modelId).map((m) => m.modelId!)
    } catch {
      return [
        'anthropic.claude-sonnet-4-20250514-v1:0',
        'anthropic.claude-haiku-4-20250506-v1:0',
        'amazon.titan-text-express-v1'
      ]
    }
  }

  async testConnection(): Promise<TestResult> {
    try {
      await this.listModels()
      return { success: true }
    } catch (e) {
      const msg = (e as Error).message
      if (msg.includes('AccessDeniedException')) {
        return {
          success: false,
          error: 'Access denied. Enable the model in AWS Console > Bedrock > Model Access.'
        }
      }
      if (msg.includes('UnrecognizedClientException')) {
        return {
          success: false,
          error: 'Invalid AWS credentials. Check your Access Key ID and Secret.'
        }
      }
      return { success: false, error: msg }
    }
  }
}
