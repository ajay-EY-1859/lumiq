// ═══════════════════════════════════════════════════════════════════
// Lumiq — Provider Store (Zustand)
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type { ProviderConfig, ProviderType } from '@shared/types'
import { PROVIDER_MODELS } from '@shared/types'

type SafeProviderConfig = Omit<ProviderConfig, 'apiKey' | 'awsAccessKeyId' | 'awsSecretAccessKey'> & {
  hasApiKey: boolean
  hasAwsKeys: boolean
}

type ProviderConfigInput = Omit<ProviderConfig, 'id'> & Partial<Pick<ProviderConfig, 'id'>>

interface ProviderState {
  providers: SafeProviderConfig[]
  activeProvider: ProviderType
  activeModel: string
  isLoading: boolean

  // Actions
  loadProviders: () => Promise<void>
  saveProvider: (config: ProviderConfigInput) => Promise<void>
  deleteProvider: (provider: string) => Promise<void>
  testProvider: (provider: string, config?: Omit<ProviderConfig, 'id'> & Partial<Pick<ProviderConfig, 'id'>>) => Promise<{ success: boolean; error?: string }>
  setActiveProvider: (provider: ProviderType) => void
  setActiveModel: (model: string) => void
  getModelsForProvider: (provider: ProviderType) => { id: string; label: string }[]
}

export const useProviderStore = create<ProviderState>((set, get) => ({
  providers: [],
  activeProvider: 'anthropic',
  activeModel: 'claude-sonnet-4-20250514',
  isLoading: true,

  loadProviders: async () => {
    try {
      const providers = await window.electronAPI.provider.list() as SafeProviderConfig[]
      let { activeProvider, activeModel } = get()
      
      let activeConfig = providers.find((provider) => provider.provider === activeProvider)
      
      // Auto-detect a configured provider if the active one is not configured
      const isConfigured = activeConfig && (activeConfig.hasApiKey || activeConfig.hasAwsKeys || activeConfig.provider === 'ollama' || activeConfig.provider === 'custom')
      if (!isConfigured) {
        const configuredProvider = providers.find((p) => p.hasApiKey || p.hasAwsKeys || p.provider === 'ollama' || p.provider === 'custom')
        if (configuredProvider) {
          activeProvider = configuredProvider.provider as ProviderType
          activeConfig = configuredProvider
        }
      }

      const nextActiveModel = activeConfig?.defaultModel || (activeProvider !== get().activeProvider ? get().getModelsForProvider(activeProvider)[0]?.id : activeModel)

      set({ providers, activeProvider, activeModel: nextActiveModel, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  saveProvider: async (config) => {
    await window.electronAPI.provider.save(config)
    await get().loadProviders()
    if (config.provider === get().activeProvider && config.defaultModel) {
      set({ activeModel: config.defaultModel })
    }
  },

  deleteProvider: async (provider) => {
    await window.electronAPI.provider.delete(provider)
    await get().loadProviders()
  },

  testProvider: async (provider, config) => {
    return await window.electronAPI.provider.test(provider, config)
  },

  setActiveProvider: (provider) => {
    const providerConfig = get().providers.find((config) => config.provider === provider)
    const models = get().getModelsForProvider(provider)
    set({
      activeProvider: provider,
      activeModel: providerConfig?.defaultModel || models[0]?.id || ''
    })
  },

  setActiveModel: (model) => {
    set({ activeModel: model })
  },

  getModelsForProvider: (provider) => {
    return PROVIDER_MODELS[provider] || []
  }
}))
