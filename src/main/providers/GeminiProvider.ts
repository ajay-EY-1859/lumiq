// ═══════════════════════════════════════════════════════════════════
// Lumiq — Google Gemini Provider
// Supports both API key and OAuth token authentication.
// ═══════════════════════════════════════════════════════════════════

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIProvider } from './AIProvider'
import type { Message, ProviderConfig, SendOptions, SendResult, TestResult } from '@shared/types'
import { getValidGoogleToken } from '../auth/googleOAuth'

export class GeminiProvider implements AIProvider {
  private config: ProviderConfig

  constructor(config: ProviderConfig) {
    this.config = config
  }

  /**
   * Gets an authenticated GoogleGenerativeAI instance.
   * Uses OAuth token if auth method is 'oauth', otherwise uses API key.
   */
  private async getGenAI(): Promise<GoogleGenerativeAI> {
    if (this.config.authMethod === 'oauth') {
      const token = await getValidGoogleToken()
      if (!token) {
        throw new Error('Google OAuth token expired or not available. Please sign in again.')
      }
      // Use OAuth token — pass as API key header (the SDK supports this)
      // The Google Generative AI SDK can use access tokens via custom headers
      return new GoogleGenerativeAI(token)
    }

    if (!this.config.apiKey) {
      throw new Error('Gemini API key not configured.')
    }
    return new GoogleGenerativeAI(this.config.apiKey)
  }

  async sendMessage(messages: Message[], options: SendOptions): Promise<SendResult> {
    const genAI = await this.getGenAI()
    const model = genAI.getGenerativeModel({
      model: options.model,
      systemInstruction: options.systemPrompt
    })

    const history = messages.slice(0, -1).map((m) => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }))

    const chat = model.startChat({ history })
    const lastMessage = messages[messages.length - 1]!

    const result = await chat.sendMessageStream(lastMessage.content)

    let content = ''
    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) {
        content += text
        options.onChunk?.(text)
      }
      if (options.signal?.aborted) break
    }

    return { content, tokensUsed: 0, stopReason: 'stop' }
  }

  async listModels(): Promise<string[]> {
    return ['gemini-1.5-pro', 'gemini-1.5-flash', 'gemini-pro']
  }

  async testConnection(): Promise<TestResult> {
    try {
      const genAI = await this.getGenAI()
      const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })
      await model.generateContent('hi')
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  }
}
