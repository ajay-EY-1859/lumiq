// ═══════════════════════════════════════════════════════════════════
// Lumiq — Provider Factory
// Creates the correct AI provider client from configuration.
// ═══════════════════════════════════════════════════════════════════

import type { AIProvider } from './AIProvider'
import type { ProviderConfig } from '@shared/types'
import { AnthropicProvider } from './AnthropicProvider'
import { OpenAIProvider } from './OpenAIProvider'
import { GeminiProvider } from './GeminiProvider'
import { OllamaProvider } from './OllamaProvider'
import { DeepSeekProvider } from './DeepSeekProvider'
import { BedrockProvider } from './BedrockProvider'
import { CustomProvider } from './CustomProvider'

export class ProviderFactory {
  /**
   * Creates an AI provider instance from configuration.
   *
   * SECURITY: The config passed here contains decrypted API keys.
   * This should ONLY be called from the main process.
   */
  static create(config: ProviderConfig): AIProvider {
    switch (config.provider) {
      case 'anthropic':
        return new AnthropicProvider(config)
      case 'openai':
        return new OpenAIProvider(config)
      case 'gemini':
        return new GeminiProvider(config)
      case 'ollama':
        return new OllamaProvider(config)
      case 'deepseek':
        return new DeepSeekProvider(config)
      case 'bedrock':
        return new BedrockProvider(config)
      case 'custom':
        return new CustomProvider(config)
      default:
        throw new Error(`Unknown provider: ${config.provider}`)
    }
  }
}
