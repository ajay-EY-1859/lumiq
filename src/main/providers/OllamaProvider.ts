// ═══════════════════════════════════════════════════════════════════
// Lumiq — Ollama Provider (Local Models)
// No API key required. Connects to localhost:11434.
// ═══════════════════════════════════════════════════════════════════

import axios from 'axios'
import type { AIProvider } from './AIProvider'
import type { Message, ProviderConfig, SendOptions, SendResult, TestResult } from '@shared/types'
import { sanitizeMessages } from './utils'

export class OllamaProvider implements AIProvider {
  private baseUrl: string

  constructor(config: ProviderConfig) {
    this.baseUrl = config.baseUrl ?? 'http://localhost:11434'
  }

  async sendMessage(messages: Message[], options: SendOptions): Promise<SendResult> {
    const sanitized = sanitizeMessages(messages, options)
    const ollamaMessages = [
      ...(options.systemPrompt ? [{ role: 'system' as const, content: options.systemPrompt }] : []),
      ...sanitized.map((m) => ({ role: m.role, content: m.content }))
    ]

    const response = await axios.post(
      `${this.baseUrl}/api/chat`,
      {
        model: options.model,
        messages: ollamaMessages,
        stream: true
      },
      {
        responseType: 'stream',
        signal: options.signal
      }
    )

    let content = ''
    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n').filter(Boolean)
      for (const line of lines) {
        try {
          const data = JSON.parse(line)
          if (data.message?.content) {
            content += data.message.content
            options.onChunk?.(data.message.content)
          }
        } catch {
          // Skip malformed JSON lines
        }
      }
    }

    // Fallback token estimation: approx 4 characters per token
    let promptChars = 0
    for (const msg of ollamaMessages) {
      if (typeof msg.content === 'string') {
        promptChars += msg.content.length
      }
    }
    const responseChars = content.length
    const tokensUsed = Math.ceil((promptChars + responseChars) / 4)

    return { content, tokensUsed, stopReason: 'stop' }
  }

  async listModels(): Promise<string[]> {
    try {
      const response = await axios.get(`${this.baseUrl}/api/tags`, { timeout: 3000 })
      return response.data.models.map((m: { name: string }) => m.name)
    } catch {
      return ['llama3.2', 'mistral', 'qwen2.5-coder', 'phi3']
    }
  }

  async testConnection(): Promise<TestResult> {
    try {
      await axios.get(`${this.baseUrl}/api/tags`, { timeout: 3000 })
      return { success: true }
    } catch {
      return { success: false, error: 'Cannot connect to Ollama. Is it running? (ollama serve)' }
    }
  }
}
