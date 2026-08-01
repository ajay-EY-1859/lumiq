// ═══════════════════════════════════════════════════════════════════
// Lumiq — Google Gemini Provider
// Supports both API key and OAuth token authentication.
// ═══════════════════════════════════════════════════════════════════

import { GoogleGenerativeAI } from '@google/generative-ai'
import type { AIProvider } from './AIProvider'
import type { Message, ProviderConfig, SendOptions, SendResult, TestResult } from '@shared/types'
import { getValidGoogleToken } from '../auth/googleOAuth'
import { sanitizeMessages } from './utils'

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
    const sanitized = sanitizeMessages(messages, options)
    const genAI = await this.getGenAI()
    const model = genAI.getGenerativeModel({
      model: options.model,
      systemInstruction: options.systemPrompt
    })

    // Filter out system messages and map roles to user/model
    const mapped = sanitized
      .filter((m) => m.role !== 'system')
      .map((m) => {
        let contentText = m.content || ''
        if (m.role === 'tool') {
          // Format tool results nicely so the model can understand them clearly
          contentText = `[Tool Result: ${m.toolName || 'unknown'}]\n${m.content || ''}`
        }
        return {
          role: (m.role === 'assistant' ? 'model' : 'user') as 'user' | 'model',
          parts: [{ text: contentText }]
        }
      })

    // Merge consecutive messages with the same role
    const contents: typeof mapped = []
    for (const msg of mapped) {
      if (contents.length > 0 && contents[contents.length - 1].role === msg.role) {
        contents[contents.length - 1].parts[0].text += '\n\n' + msg.parts[0].text
      } else {
        contents.push(msg)
      }
    }

    // Gemini requires the conversation history to start with a user message
    while (contents.length > 0 && contents[0].role !== 'user') {
      contents.shift()
    }

    // If contents is empty, add a default user message
    if (contents.length === 0) {
      contents.push({ role: 'user', parts: [{ text: '' }] })
    }

    // Separate history (all but last) and last message
    const history = contents.slice(0, -1)
    const lastMessage = contents[contents.length - 1]

    const chat = model.startChat({ history })
    const result = await chat.sendMessageStream(lastMessage.parts[0].text)

    let content = ''
    for await (const chunk of result.stream) {
      const text = chunk.text()
      if (text) {
        content += text
        options.onChunk?.(text)
      }
      if (options.signal?.aborted) break
    }

    let tokensUsed = 0
    try {
      const response = await result.response
      if (response.usageMetadata) {
        tokensUsed = response.usageMetadata.totalTokenCount || 0
      }
    } catch (e) {
      console.warn('[GeminiProvider] Failed to fetch usage metadata:', e)
    }

    if (tokensUsed === 0) {
      // Fallback token estimation: approx 4 characters per token
      let promptChars = 0
      for (const msg of contents) {
        promptChars += msg.parts[0].text.length
      }
      const responseChars = content.length
      tokensUsed = Math.ceil((promptChars + responseChars) / 4)
    }

    return { content, tokensUsed, stopReason: 'stop' }
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
