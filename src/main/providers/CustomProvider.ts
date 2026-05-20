// ═══════════════════════════════════════════════════════════════════
// Lumiq — Custom Provider (OpenAI-compatible)
// ═══════════════════════════════════════════════════════════════════

import { OpenAIProvider } from './OpenAIProvider'
import type { ProviderConfig } from '@shared/types'

export class CustomProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super(config) // Uses user-configured baseUrl and apiKey
  }

  async listModels(): Promise<string[]> {
    try {
      return await super.listModels()
    } catch {
      return [] // Custom provider may not support model listing
    }
  }
}
