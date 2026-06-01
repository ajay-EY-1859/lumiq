// ═══════════════════════════════════════════════════════════════════
// Lumiq — Settings IPC Handlers
// Handles app settings and tool settings
// ═══════════════════════════════════════════════════════════════════

import { IPC } from '@shared/types'
import type { AppSettings, ToolSettings } from '@shared/types'
import { getDatabase } from '../db/database'
import { agentLoop } from '../agent/AgentLoop'
import type { PermissionMode } from '../security/permissions'
import { DEFAULT_TOOL_SETTINGS, mergeToolSettings } from '../tools/defaultToolSettings'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { TraceLogger } from '../services/TraceLogger'
import { CostManager } from '../services/CostManager'
import { join, resolve, relative } from 'path'
import { existsSync, readFileSync, writeFileSync, mkdirSync, realpathSync } from 'fs'

const SETTINGS_KEYS = new Set([
  'theme',
  'fontSize',
  'defaultProvider',
  'defaultModel',
  'sidebarVisible',
  'autoSave',
  'contextLimit',
  'firecrawlApiKey',
  'dailyBudgetCap',
  'monthlyBudgetCap'
])

function normalizeSettingValue(key: string, value: unknown): string {
  const raw = String(value ?? '')
  switch (key) {
    case 'theme':
      if (!['light', 'dark', 'system'].includes(raw)) throw new Error('Invalid theme')
      return raw
    case 'fontSize':
      if (!['12', '14', '16'].includes(raw)) throw new Error('Invalid font size')
      return raw
    case 'sidebarVisible':
    case 'autoSave':
      if (!['true', 'false'].includes(raw)) throw new Error(`Invalid boolean setting: ${key}`)
      return raw
    case 'contextLimit':
      return String(Math.max(10, Math.min(500, parseInt(raw, 10) || 150)))
    case 'firecrawlApiKey':
      return raw.slice(0, 500)
    case 'defaultModel':
      return raw.replace(/[^\w:./-]/g, '').slice(0, 200)
    case 'defaultProvider':
      return raw.replace(/[^\w-]/g, '').slice(0, 50)
    case 'dailyBudgetCap':
    case 'monthlyBudgetCap': {
      const parsedVal = parseFloat(raw)
      return isNaN(parsedVal) ? '0.00' : parsedVal.toFixed(2)
    }
    default:
      throw new Error(`Unsupported setting: ${key}`)
  }
}

// ─── Workspace path safety helper ─────────────────────────────────
// Ensures the settings file we read/write is strictly inside the
// declared workspace directory (prevents path-traversal attacks).
function safeWorkspaceSettingsPath(workspacePath: string): string {
  if (typeof workspacePath !== 'string' || workspacePath.includes('\0')) {
    throw new Error('Invalid workspace path')
  }
  const resolvedWorkspace = resolve(workspacePath)
  const settingsPath = join(resolvedWorkspace, '.lumiq', 'settings.json')
  const resolvedSettings = resolve(settingsPath)

  // Resolve symlinks if the directory already exists
  let realWorkspace = resolvedWorkspace
  try { realWorkspace = realpathSync(resolvedWorkspace) } catch { /* not yet created */ }

  const rel = relative(realWorkspace, resolvedSettings)
  if (rel.startsWith('..') || rel.includes('..\\') || rel.includes('../')) {
    throw new Error('Path traversal detected in workspace settings path')
  }
  return resolvedSettings
}

export function registerSettingsHandlers(): void {
  // ── Get all settings ──
  handleWithTimeout(IPC.SETTINGS_GET, IPC_TIMEOUT.short, (): AppSettings => {
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
      firecrawlApiKey: settings.firecrawlApiKey || '',
      dailyBudgetCap: parseFloat(settings.dailyBudgetCap || '5.00'),
      monthlyBudgetCap: parseFloat(settings.monthlyBudgetCap || '50.00')
    } as any
  })

  // ── Set a setting ──
  handleWithTimeout(IPC.SETTINGS_SET, IPC_TIMEOUT.short, (_event, data: { key: string; value: unknown }) => {
    if (!SETTINGS_KEYS.has(data.key)) {
      throw new Error(`Unsupported setting: ${data.key}`)
    }
    const value = normalizeSettingValue(data.key, data.value)
    const db = getDatabase()
    const stmt = db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)')
    stmt.run(data.key, value)

    if (data.key === 'contextLimit') {
      agentLoop.setContextLimit(parseInt(value, 10))
    }
  })

  // ── Get workspace settings ──
  handleWithTimeout(IPC.SETTINGS_WORKSPACE_GET, IPC_TIMEOUT.short, (_event, workspacePath: string): Partial<AppSettings> => {
    if (!workspacePath) return {}
    try {
      const settingsPath = safeWorkspaceSettingsPath(workspacePath)
      if (existsSync(settingsPath)) {
        const content = readFileSync(settingsPath, 'utf-8')
        return JSON.parse(content)
      }
    } catch (e) {
      console.error('Failed to read workspace settings:', e)
    }
    return {}
  })

  // ── Set workspace settings ──
  handleWithTimeout(IPC.SETTINGS_WORKSPACE_SET, IPC_TIMEOUT.short, (_event, data: { workspacePath: string, settings: Partial<AppSettings> }) => {
    if (!data.workspacePath) return
    try {
      const settingsPath = safeWorkspaceSettingsPath(data.workspacePath)
      const lumiqDir = join(resolve(data.workspacePath), '.lumiq')
      if (!existsSync(lumiqDir)) {
        mkdirSync(lumiqDir, { recursive: true })
      }
      
      let currentSettings = {}
      if (existsSync(settingsPath)) {
        try {
          currentSettings = JSON.parse(readFileSync(settingsPath, 'utf-8'))
        } catch { /* ignore parse error */ }
      }
      
      const newSettings = { ...currentSettings, ...data.settings }
      writeFileSync(settingsPath, JSON.stringify(newSettings, null, 2), 'utf-8')
      
    } catch (e) {
      console.error('Failed to write workspace settings:', e)
      throw new Error(`Failed to save workspace settings: ${(e as Error).message}`)
    }
  })

  // ── Get tool settings ──
  handleWithTimeout(IPC.SETTINGS_GET_TOOL, IPC_TIMEOUT.short, (): ToolSettings[] => {
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
  handleWithTimeout(IPC.SETTINGS_SET_TOOL, IPC_TIMEOUT.short, (_event, settings: ToolSettings[]) => {
    if (!Array.isArray(settings)) throw new Error('Invalid tool settings')
    const merged = mergeToolSettings(settings)
    const db = getDatabase()
    const stmt = db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('toolSettings', ?)")
    stmt.run(JSON.stringify(merged))
    agentLoop.getToolExecutor().updateToolSettings(merged)
  })

  // ── Get permission mode ──
  handleWithTimeout(IPC.PERMISSION_MODE_GET, IPC_TIMEOUT.short, (): PermissionMode => {
    const db = getDatabase()
    const row = db.prepare("SELECT value FROM settings WHERE key = 'permissionMode'").get() as { value: string } | undefined
    return (row?.value as PermissionMode) || 'MANUAL'
  })

  // ── Set permission mode ──
  handleWithTimeout(IPC.PERMISSION_MODE_SET, IPC_TIMEOUT.short, (_event, mode: PermissionMode) => {
    if (!['MANUAL', 'LIMITED', 'EXTENDED', 'AUTO'].includes(mode)) {
      throw new Error('Invalid permission mode')
    }
    const db = getDatabase()
    db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('permissionMode', ?)").run(mode)
    agentLoop.getToolExecutor().setPermissionMode(mode)
  })

  // ── Get all request/response audit traces ──
  handleWithTimeout(IPC.TRACES_LIST, IPC_TIMEOUT.short, (): Array<{ name: string; sizeBytes: number; createdAt: string }> => {
    return TraceLogger.listTraces()
  })

  // ── Get token costs summary for settings dashboard ──
  handleWithTimeout(IPC.COSTS_SUMMARY, IPC_TIMEOUT.short, (): any => {
    return CostManager.getCostSummary()
  })
}
