// ═══════════════════════════════════════════════════════════════════
// Lumiq — DeepSeek Provider (OpenAI-compatible)
// ═══════════════════════════════════════════════════════════════════

import { OpenAIProvider } from './OpenAIProvider'
import type { ProviderConfig } from '@shared/types'

export class DeepSeekProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? 'https://api.deepseek.com/v1'
    })
  }

  async listModels(): Promise<string[]> {
    return ['deepseek-chat', 'deepseek-coder']
  }
}
