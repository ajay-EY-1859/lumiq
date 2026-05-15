// ═══════════════════════════════════════════════════════════════════
// Lumiq — Settings IPC Handlers
// Handles app settings and tool settings
// ═══════════════════════════════════════════════════════════════════

import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { AppSettings, ToolSettings } from '@shared/types'
import { getDatabase } from '../db/database'
import { agentLoop } from '../agent/AgentLoop'
import type { PermissionMode } from '../security/permissions'
import { DEFAULT_TOOL_SETTINGS, mergeToolSettings } from '../tools/defaultToolSettings'

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
      contextLimit: parseInt(settings.contextLimit || '150', 10),
      firecrawlApiKey: settings.firecrawlApiKey || ''
    }
  })

  // ── Set a setting ──
  ipcMain.handle(IPC.SETTINGS_SET, (_event, data: { key: string; value: string }) => {
    const db = getDatabase()
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    stmt.run(data.key, data.value)

    if (data.key === 'contextLimit') {
      agentLoop.setContextLimit(Math.max(10, Math.min(500, parseInt(data.value, 10) || 150)))
    }
  })

  // ── Get tool settings ──
  ipcMain.handle(IPC.SETTINGS_GET_TOOL, (): ToolSettings[] => {
    const db = getDatabase()
    const stmt = db.prepare("SELECT value FROM settings WHERE key = 'toolSettings'")
    const row = stmt.get() as { value: string } | undefined
    if (!row) return DEFAULT_TOOL_SETTINGS
    try {
      const saved = JSON.parse(row.value) as ToolSettings[]
      const merged = mergeToolSettings(saved)
      if (merged.length !== saved.length) {
        db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('toolSettings', ?)").run(JSON.stringify(merged))
      }
      return merged
    } catch {
      return DEFAULT_TOOL_SETTINGS
    }
  })

  // ── Set tool settings ──
  ipcMain.handle(IPC.SETTINGS_SET_TOOL, (_event, settings: ToolSettings[]) => {
    const db = getDatabase()
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('toolSettings', ?)")
    stmt.run(JSON.stringify(settings))
    agentLoop.getToolExecutor().updateToolSettings(settings)
  })

  // ── Get permission mode ──
  ipcMain.handle(IPC.PERMISSION_MODE_GET, (): PermissionMode => {
    const db = getDatabase()
    const row = db.prepare("SELECT value FROM settings WHERE key = 'permissionMode'").get() as { value: string } | undefined
    return (row?.value as PermissionMode) || 'MANUAL'
  })

  // ── Set permission mode ──
  ipcMain.handle(IPC.PERMISSION_MODE_SET, (_event, mode: PermissionMode) => {
    const db = getDatabase()
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('permissionMode', ?)").run(mode)
    agentLoop.getToolExecutor().setPermissionMode(mode)
  })
}
