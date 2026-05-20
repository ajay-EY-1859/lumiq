// ═══════════════════════════════════════════════════════════════════
// Lumiq — Provider IPC Handlers
// Handles provider config management and connection testing
// ═══════════════════════════════════════════════════════════════════

import { IPC } from '@shared/types'
import type { ProviderConfig, ProviderType } from '@shared/types'
import {
  saveApiConfig,
  listApiConfigsSafe,
  deleteApiConfig,
  getApiConfig
} from '../db/apiConfigs'
import { ProviderFactory } from '../providers/ProviderFactory'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

const PROVIDERS = new Set<ProviderType>([
  'anthropic',
  'openai',
  'gemini',
  'ollama',
  'deepseek',
  'bedrock',
  'github',
  'openrouter',
  'groq',
  'custom'
])

function assertProvider(provider: string): asserts provider is ProviderType {
  if (!PROVIDERS.has(provider as ProviderType)) {
    throw new Error(`Unsupported provider: ${provider}`)
  }
}

function validateBaseUrl(baseUrl?: string): void {
  if (!baseUrl) return
  try {
    const url = new URL(baseUrl)
    if (url.protocol !== 'https:' && url.protocol !== 'http:') {
      throw new Error('Provider base URL must use http or https')
    }
  } catch {
    throw new Error('Provider base URL must use http or https')
  }
}

export function registerProviderHandlers(): void {
  // ── List providers (safe — no decrypted keys) ──
  handleWithTimeout(IPC.PROVIDER_LIST, IPC_TIMEOUT.short, () => {
    return listApiConfigsSafe()
  })

  // ── Save provider config ──
  handleWithTimeout(IPC.PROVIDER_SAVE, IPC_TIMEOUT.short, (_event, config: ProviderConfig) => {
    assertProvider(config.provider)
    validateBaseUrl(config.baseUrl)
    saveApiConfig(config)
  })

  // ── Delete provider ──
  handleWithTimeout(IPC.PROVIDER_DELETE, IPC_TIMEOUT.short, (_event, provider: string) => {
    assertProvider(provider)
    return deleteApiConfig(provider)
  })

  // ── Test provider connection ──
  handleWithTimeout(IPC.PROVIDER_TEST, IPC_TIMEOUT.long, async (_event, provider: string) => {
    assertProvider(provider)
    const config = getApiConfig(provider)
    if (!config) {
      return { success: false, error: 'Provider not configured' }
    }
    try {
      const client = ProviderFactory.create(config)
      return await client.testConnection()
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  })

  // ── List models for a provider ──
  handleWithTimeout(IPC.PROVIDER_MODELS, IPC_TIMEOUT.long, async (_event, provider: string) => {
    assertProvider(provider)
    const config = getApiConfig(provider)
    if (!config) return []
    try {
      const client = ProviderFactory.create(config)
      return await client.listModels()
    } catch {
      return []
    }
  })
}
