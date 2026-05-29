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
  handleWithTimeout(IPC.PROVIDER_TEST, IPC_TIMEOUT.long, async (_event, provider: string, customConfig?: Omit<ProviderConfig, 'id'> & Partial<Pick<ProviderConfig, 'id'>>) => {
    assertProvider(provider)
    const existing = getApiConfig(provider)
    let config: ProviderConfig | null = null

    if (customConfig) {
      config = {
        id: customConfig.id || (existing ? existing.id : provider),
        provider: provider as ProviderType,
        apiKey: customConfig.apiKey || (existing ? existing.apiKey : undefined),
        baseUrl: customConfig.baseUrl || (existing ? existing.baseUrl : undefined),
        defaultModel: customConfig.defaultModel || (existing ? existing.defaultModel : ''),
        isActive: customConfig.isActive ?? (existing ? existing.isActive : true),
        authMethod: customConfig.authMethod || (existing ? existing.authMethod : 'apikey'),
        awsAccessKeyId: customConfig.awsAccessKeyId || (existing ? existing.awsAccessKeyId : undefined),
        awsSecretAccessKey: customConfig.awsSecretAccessKey || (existing ? existing.awsSecretAccessKey : undefined),
        awsSessionToken: customConfig.awsSessionToken || (existing ? existing.awsSessionToken : undefined),
        awsRegion: customConfig.awsRegion || (existing ? existing.awsRegion : 'us-east-1')
      }
    } else {
      config = existing
    }

    if (!config) {
      return { success: false, error: 'Provider not configured' }
    }

    // Ephemeral check for required credentials before invoking API
    if (config.authMethod !== 'oauth' && provider !== 'ollama' && provider !== 'custom') {
      if (provider === 'bedrock') {
        if (!config.awsAccessKeyId || !config.awsSecretAccessKey) {
          return { success: false, error: 'AWS Access Key ID and Secret Access Key are required to test connection.' }
        }
      } else {
        if (!config.apiKey) {
          return { success: false, error: 'API Key is required to test connection.' }
        }
      }
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
