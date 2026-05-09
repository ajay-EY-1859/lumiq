// ═══════════════════════════════════════════════════════════════════
// Lumiq — Amazon Bedrock Provider
// Uses @anthropic-ai/bedrock-sdk for Claude models on Bedrock.
// Uses @aws-sdk/client-bedrock-runtime for non-Anthropic models.
// ═══════════════════════════════════════════════════════════════════

import type { AIProvider } from './AIProvider'
import type { Message, ProviderConfig, SendOptions, SendResult, TestResult } from '@shared/types'

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

  async sendMessage(messages: Message[], options: SendOptions): Promise<SendResult> {
    if (this.isAnthropicModel(options.model)) {
      return this.sendViaMessagesApi(messages, options)
    }
    return this.sendViaConverseApi(messages, options)
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

    const stream = client.messages.stream({
      model: options.model,
      max_tokens: options.maxTokens ?? 8096,
      system: options.systemPrompt,
      messages: messages
        .filter((m) => m.role !== 'system')
        .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    })

    let content = ''
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        content += event.delta.text
        options.onChunk?.(event.delta.text)
        if (options.signal?.aborted) break
      }
    }

    const finalMessage = await stream.finalMessage()
    return {
      content,
      tokensUsed: finalMessage.usage?.output_tokens ?? 0,
      stopReason: finalMessage.stop_reason ?? 'end_turn'
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

    const converseMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: [{ text: m.content }]
      }))

    const command = new ConverseStreamCommand({
      modelId: options.model,
      messages: converseMessages,
      system: options.systemPrompt ? [{ text: options.systemPrompt }] : undefined,
      inferenceConfig: { maxTokens: options.maxTokens ?? 4096 }
    })

    const response = await client.send(command)
    let content = ''

    if (response.stream) {
      for await (const event of response.stream) {
        const text = event.contentBlockDelta?.delta?.text ?? ''
        if (text) {
          content += text
          options.onChunk?.(text)
        }
        if (options.signal?.aborted) break
      }
    }

    return { content, tokensUsed: 0, stopReason: 'stop' }
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
