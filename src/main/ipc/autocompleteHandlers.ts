// ═══════════════════════════════════════════════════════════════════
// Lumiq — Autocomplete IPC Handlers
// ═══════════════════════════════════════════════════════════════════

import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import { AutocompleteService } from '../services/AutocompleteService'

export function registerAutocompleteHandlers(): void {
  ipcMain.handle(
    IPC.AUTOCOMPLETE_PREDICT,
    async (
      _event,
      data: {
        prefix: string
        suffix: string
        provider: string
        model: string
      }
    ) => {
      const { prefix, suffix, provider, model } = data
      if (!provider || !model) {
        throw new Error('Autocomplete requires both provider and model parameters.')
      }
      return await AutocompleteService.predict(prefix, suffix, provider, model)
    }
  )
}
