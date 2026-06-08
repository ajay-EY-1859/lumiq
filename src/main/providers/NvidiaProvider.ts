// ═══════════════════════════════════════════════════════════════════
// Lumiq — Nvidia Provider (OpenAI-compatible)
// ═══════════════════════════════════════════════════════════════════

import { OpenAIProvider } from './OpenAIProvider'
import type { ProviderConfig } from '@shared/types'

export class NvidiaProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? 'https://integrate.api.nvidia.com/v1'
    })
  }

  async listModels(): Promise<string[]> {
    return [
      'stepfun-ai/step-3.7-flash', 
      'meta/llama-3.1-405b-instruct', 
      'meta/llama-3.1-70b-instruct', 
      'nvidia/nemotron-4-340b-instruct'
    ]
  }
}
