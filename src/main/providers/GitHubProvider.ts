// ═══════════════════════════════════════════════════════════════════
// Lumiq — GitHub Models Provider
// Uses GitHub Models REST inference with either OAuth or a GitHub token.
// ═══════════════════════════════════════════════════════════════════

import type { AIProvider } from './AIProvider'
import type { Message, ProviderConfig, SendOptions, SendResult, TestResult } from '@shared/types'
import { getValidGitHubToken } from '../auth/githubOAuth'

type GitHubChatResponse = {
  choices?: Array<{
    message?: {
      content?: string
      role?: string
    }
  }>
  usage?: {
    completion_tokens?: number
    total_tokens?: number
  }
  error?: {
    message?: string
  }
}

const GITHUB_MODELS_API = 'https://models.github.ai/inference/chat/completions?api-version=2026-03-10'
const FALLBACK_MODELS = ['openai/gpt-4.1', 'openai/gpt-4.1-mini', 'openai/gpt-4o-mini']

export class GitHubProvider implements AIProvider {
  private config: ProviderConfig

  constructor(config: ProviderConfig) {
    this.config = config
  }

  private getToken(): string {
    if (this.config.authMethod === 'oauth') {
      const token = getValidGitHubToken()
      if (!token) {
        throw new Error('GitHub OAuth token not available. Please sign in again.')
      }
      return token
    }

    if (!this.config.apiKey) {
      throw new Error('GitHub token not configured. Add a GitHub token or sign in with GitHub.')
    }

    return this.config.apiKey
  }

  async sendMessage(messages: Message[], options: SendOptions): Promise<SendResult> {
    const chatMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = []

    if (options.systemPrompt) {
      chatMessages.push({ role: 'system', content: options.systemPrompt })
    }

    chatMessages.push(
      ...messages
        .filter((message) => message.role === 'user' || message.role === 'assistant' || message.role === 'system')
        .map((message) => ({
          role: message.role as 'system' | 'user' | 'assistant',
          content: message.content
        }))
    )

    const data = await this.requestChatCompletion({
      model: options.model,
      messages: chatMessages,
      max_tokens: options.maxTokens,
      stream: false
    })

    const content = data.choices?.[0]?.message?.content || ''
    if (content) {
      options.onChunk?.(content)
    }

    return {
      content,
      tokensUsed: data.usage?.completion_tokens || data.usage?.total_tokens || 0,
      stopReason: 'stop'
    }
  }

  async listModels(): Promise<string[]> {
    return FALLBACK_MODELS
  }

  async testConnection(): Promise<TestResult> {
    try {
      await this.requestChatCompletion({
        model: this.config.defaultModel || FALLBACK_MODELS[0],
        messages: [{ role: 'user', content: 'hi' }],
        max_tokens: 8,
        stream: false
      })
      return { success: true }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  private async requestChatCompletion(body: Record<string, unknown>): Promise<GitHubChatResponse> {
    const response = await fetch(GITHUB_MODELS_API, {
      method: 'POST',
      headers: {
        Accept: 'application/vnd.github+json',
        Authorization: `Bearer ${this.getToken()}`,
        'Content-Type': 'application/json',
        'X-GitHub-Api-Version': '2026-03-10'
      },
      body: JSON.stringify(body)
    })

    const text = await response.text()
    const data = text ? JSON.parse(text) as GitHubChatResponse : {}

    if (!response.ok) {
      throw new Error(data.error?.message || `GitHub Models request failed with HTTP ${response.status}`)
    }

    return data
  }
}
