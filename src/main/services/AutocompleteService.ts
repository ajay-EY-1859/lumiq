// ═══════════════════════════════════════════════════════════════════
// Lumiq — Autocomplete Service
// Generates inline code completions using the active AI provider.
// ═══════════════════════════════════════════════════════════════════

import { ProviderFactory } from '../providers/ProviderFactory'
import { getApiConfig } from '../db/apiConfigs'

export class AutocompleteService {
  /**
   * Generates a code suggestion based on prefix and suffix context.
   */
  static async predict(
    prefix: string,
    suffix: string,
    providerName: string,
    modelName: string
  ): Promise<string> {
    // Get the provider config (with decrypted API keys)
    const config = getApiConfig(providerName)
    if (!config) {
      throw new Error(`Provider "${providerName}" is not configured.`)
    }

    const provider = ProviderFactory.create(config)

    const systemPrompt = `You are an elite, high-speed inline code completion engine.
Your single job is to return ONLY the code that should be inserted at the cursor position (represented as <CURSOR>), based on the Prefix and Suffix context provided by the user.

═══ CRITICAL CONSTRAINTS ═══
- Do NOT output markdown code blocks (e.g. \`\`\`typescript).
- Do NOT provide explanations, conversational filler, or introductory text.
- Output ONLY the raw completion string that integrates seamlessly between the Prefix and Suffix.
- Stop generating as soon as you complete the current statement, loop, or block. Do not generate unrelated code.
- If no suggestion is relevant, return an empty string.`

    const userPrompt = `Prefix:
${prefix}

Suffix:
${suffix}

Provide the exact raw completion at <CURSOR>:`

    try {
      const result = await provider.sendMessage(
        [
          {
            id: 'sys',
            sessionId: 'autocomplete',
            role: 'system',
            content: systemPrompt,
            createdAt: new Date().toISOString()
          },
          {
            id: 'usr',
            sessionId: 'autocomplete',
            role: 'user',
            content: userPrompt,
            createdAt: new Date().toISOString()
          }
        ],
        {
          model: modelName,
          maxTokens: 128,
          stream: false
        }
      )

      return result.content || ''
    } catch (err) {
      console.error('[AutocompleteService] Completion prediction failed:', err)
      return ''
    }
  }
}
