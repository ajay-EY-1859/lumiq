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
  testProvider: (provider: string) => Promise<{ success: boolean; error?: string }>
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
      set({ providers, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  saveProvider: async (config) => {
    await window.electronAPI.provider.save(config)
    await get().loadProviders()
  },

  deleteProvider: async (provider) => {
    await window.electronAPI.provider.delete(provider)
    await get().loadProviders()
  },

  testProvider: async (provider) => {
    return await window.electronAPI.provider.test(provider)
  },

  setActiveProvider: (provider) => {
    const models = get().getModelsForProvider(provider)
    set({
      activeProvider: provider,
      activeModel: models[0]?.id || ''
    })
  },

  setActiveModel: (model) => {
    set({ activeModel: model })
  },

  getModelsForProvider: (provider) => {
    return PROVIDER_MODELS[provider] || []
  }
}))
