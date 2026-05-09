// ═══════════════════════════════════════════════════════════════════
// Lumiq — Settings IPC Handlers
// Handles app settings and tool settings
// ═══════════════════════════════════════════════════════════════════

import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { AppSettings, ToolSettings } from '@shared/types'
import { getDatabase } from '../db/database'

export function registerSettingsHandlers(): void {
  // ── Get all settings ──
  ipcMain.handle(IPC.SETTINGS_GET, (): AppSettings => {
    const db = getDatabase()
    const stmt = db.prepare('SELECT key, value FROM settings')
    const rows = stmt.all() as { key: string; value: string }[]

    const settings: Record<string, string> = {}
    for (const row of rows) {
      settings[row.key] = row.value
    }

    return {
      theme: (settings.theme || 'system') as AppSettings['theme'],
      fontSize: (settings.fontSize || '14') as AppSettings['fontSize'],
      defaultProvider: (settings.defaultProvider || 'anthropic') as AppSettings['defaultProvider'],
      defaultModel: settings.defaultModel || 'claude-sonnet-4-20250514',
      sidebarVisible: settings.sidebarVisible !== 'false',
      autoSave: settings.autoSave !== 'false',
      contextLimit: parseInt(settings.contextLimit || '50', 10)
    }
  })

  // ── Set a setting ──
  ipcMain.handle(IPC.SETTINGS_SET, (_event, data: { key: string; value: string }) => {
    const db = getDatabase()
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    stmt.run(data.key, data.value)
  })

  // ── Get tool settings ──
  ipcMain.handle(IPC.SETTINGS_GET_TOOL, (): ToolSettings[] => {
    const db = getDatabase()
    const stmt = db.prepare("SELECT value FROM settings WHERE key = 'toolSettings'")
    const row = stmt.get() as { value: string } | undefined
    if (!row) return []
    try {
      return JSON.parse(row.value) as ToolSettings[]
    } catch {
      return []
    }
  })

  // ── Set tool settings ──
  ipcMain.handle(IPC.SETTINGS_SET_TOOL, (_event, settings: ToolSettings[]) => {
    const db = getDatabase()
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('toolSettings', ?)")
    stmt.run(JSON.stringify(settings))
  })
}
