// ═══════════════════════════════════════════════════════════════════
// Lumiq — OpenRouter Provider (OpenAI-compatible)
// Routes requests through OpenRouter's unified API to access
// hundreds of models (Claude, GPT, Gemini, Llama, etc.)
// ═══════════════════════════════════════════════════════════════════

import { OpenAIProvider } from './OpenAIProvider'
import type { ProviderConfig } from '@shared/types'

export class OpenRouterProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? 'https://openrouter.ai/api/v1'
    })
  }

  async listModels(): Promise<string[]> {
    try {
      // OpenRouter exposes models through a standard listing endpoint
      return await super.listModels()
    } catch {
      return [
        'anthropic/claude-sonnet-4-20250514',
        'anthropic/claude-haiku-4-20250506',
        'openai/gpt-4o',
        'openai/gpt-4o-mini',
        'google/gemini-2.5-pro-preview',
        'meta-llama/llama-3.3-70b-instruct',
        'deepseek/deepseek-chat-v3',
        'qwen/qwen-2.5-coder-32b-instruct'
      ]
    }
  }
}
