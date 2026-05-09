// ═══════════════════════════════════════════════════════════════════
// Lumiq — Provider IPC Handlers
// Handles provider config management and connection testing
// ═══════════════════════════════════════════════════════════════════

import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { ProviderConfig } from '@shared/types'
import {
  saveApiConfig,
  listApiConfigsSafe,
  deleteApiConfig,
  getApiConfig
} from '../db/apiConfigs'
import { ProviderFactory } from '../providers/ProviderFactory'

export function registerProviderHandlers(): void {
  // ── List providers (safe — no decrypted keys) ──
  ipcMain.handle(IPC.PROVIDER_LIST, () => {
    return listApiConfigsSafe()
  })

  // ── Save provider config ──
  ipcMain.handle(IPC.PROVIDER_SAVE, (_event, config: ProviderConfig) => {
    saveApiConfig(config)
  })

  // ── Delete provider ──
  ipcMain.handle(IPC.PROVIDER_DELETE, (_event, provider: string) => {
    return deleteApiConfig(provider)
  })

  // ── Test provider connection ──
  ipcMain.handle(IPC.PROVIDER_TEST, async (_event, provider: string) => {
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
  ipcMain.handle(IPC.PROVIDER_MODELS, async (_event, provider: string) => {
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
