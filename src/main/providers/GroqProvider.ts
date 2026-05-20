// ═══════════════════════════════════════════════════════════════════
// Lumiq — Groq Provider (OpenAI-compatible)
// Ultra-fast inference using Groq's LPU hardware.
// ═══════════════════════════════════════════════════════════════════

import { OpenAIProvider } from './OpenAIProvider'
import type { ProviderConfig } from '@shared/types'

export class GroqProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? 'https://api.groq.com/openai/v1'
    })
  }

  async listModels(): Promise<string[]> {
    try {
      return await super.listModels()
    } catch {
      return [
        'llama-3.3-70b-versatile',
        'llama-3.1-8b-instant',
        'mixtral-8x7b-32768',
        'gemma2-9b-it'
      ]
    }
  }
}
