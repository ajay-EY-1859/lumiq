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

      return this.cleanCompletion(result.content || '', prefix)
    } catch (err) {
      console.error('[AutocompleteService] Completion prediction failed:', err)
      return ''
    }
  }

  /**
   * Generates a single, non-streaming response for one-shot utility actions.
   */
  static async predictOneShot(
    prompt: string,
    systemPrompt: string,
    providerName: string,
    modelName: string
  ): Promise<string> {
    const config = getApiConfig(providerName)
    if (!config) {
      throw new Error(`Provider "${providerName}" is not configured.`)
    }

    const provider = ProviderFactory.create(config)

    try {
      const result = await provider.sendMessage(
        [
          {
            id: 'sys',
            sessionId: 'oneshot',
            role: 'system',
            content: systemPrompt,
            createdAt: new Date().toISOString()
          },
          {
            id: 'usr',
            sessionId: 'oneshot',
            role: 'user',
            content: prompt,
            createdAt: new Date().toISOString()
          }
        ],
        {
          model: modelName,
          maxTokens: 512,
          stream: false
        }
      )

      return result.content || ''
    } catch (err) {
      console.error('[AutocompleteService] One-shot prediction failed:', err)
      return `Error: ${(err as Error).message}`
    }
  }

  /**
   * Cleans conversational wrappers, markdown backticks, and deduplicates repeated prefixes.
   */
  static cleanCompletion(text: string, prefix: string): string {
    let clean = text.trim()

    // 1. Strip markdown code block wrapping
    if (clean.includes('```')) {
      const match = clean.match(/```(?:[a-zA-Z]+)?\n([\s\S]*?)\n```/)
      if (match) {
        clean = match[1]
      } else {
        clean = clean.replace(/```[a-zA-Z]*\n?/g, '').replace(/```/g, '')
      }
    }

    // 2. Strip conversational preambles
    const preambles = [
      /^here is the/i,
      /^sure, here/i,
      /^suggestion:/i,
      /^code:/i,
      /^raw completion:/i
    ]
    for (const regex of preambles) {
      if (regex.test(clean)) {
        const colonIdx = clean.indexOf(':')
        if (colonIdx !== -1) {
          clean = clean.slice(colonIdx + 1).trim()
        }
        break
      }
    }

    // 3. Deduplicate prefix (AI often repeats the last word/line of prefix)
    const prefixLines = prefix.split('\n')
    const lastPrefixLine = prefixLines[prefixLines.length - 1]
    
    if (lastPrefixLine.trim() && clean.startsWith(lastPrefixLine)) {
      clean = clean.slice(lastPrefixLine.length)
    } else {
      const trimmedLastLine = lastPrefixLine.trimRight() // keep leading spaces if any, though usually we match exact characters
      if (trimmedLastLine.length > 0) {
        // Only strip if the completion starts with exactly the last word/token and it was already in prefix
        const match = trimmedLastLine.match(/(\w+)$/)
        if (match) {
          const lastWord = match[1]
          if (clean.startsWith(lastWord) && clean.length > lastWord.length) {
            // Check if next char is boundary or we are duplicating the exact word
            const nextChar = clean[lastWord.length]
            if (!/[a-zA-Z0-9_]/.test(nextChar)) {
              clean = clean.slice(lastWord.length)
            }
          }
        }
      }
    }

    return clean
  }
}
