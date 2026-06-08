// ═══════════════════════════════════════════════════════════════════
// Lumiq — Settings IPC Handlers
// Handles app settings and tool settings
// ═══════════════════════════════════════════════════════════════════

import { IPC } from '@shared/types'
import type { AppSettings, ToolSettings } from '@shared/types'
import { agentLoop } from '../agent/AgentLoop'
import type { PermissionMode } from '../security/permissions'
import { DEFAULT_TOOL_SETTINGS, mergeToolSettings } from '../tools/defaultToolSettings'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { CostManager } from '../services/CostManager'
import { join, resolve, relative } from 'path'
import { existsSync, readFileSync, realpathSync } from 'fs'
import { getService } from '@shared/instantiation/instantiationService'
import { ITraceLogger } from '@shared/services'
import { IConfigurationService, ConfigurationTarget } from '@shared/configuration/configuration'

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
    const configService = getService(IConfigurationService)
    return {
      theme: configService.getValue('theme'),
      fontSize: configService.getValue('fontSize'),
      defaultProvider: configService.getValue('defaultProvider'),
      defaultModel: configService.getValue('defaultModel'),
      sidebarVisible: configService.getValue('sidebarVisible'),
      autoSave: configService.getValue('autoSave'),
      contextLimit: configService.getValue('contextLimit'),
      firecrawlApiKey: configService.getValue('firecrawlApiKey'),
      dailyBudgetCap: configService.getValue('dailyBudgetCap'),
      monthlyBudgetCap: configService.getValue('monthlyBudgetCap')
    } as any
  })

  // ── Set a setting ──
  handleWithTimeout(IPC.SETTINGS_SET, IPC_TIMEOUT.short, (_event, data: { key: string; value: unknown }) => {
    if (!SETTINGS_KEYS.has(data.key)) {
      throw new Error(`Unsupported setting: ${data.key}`)
    }
    const value = normalizeSettingValue(data.key, data.value)
    const configService = getService(IConfigurationService)
    void configService.updateValue(data.key, value, ConfigurationTarget.User)

    if (data.key === 'contextLimit') {
      agentLoop.setContextLimit(configService.getValue<number>('contextLimit'))
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
    const configService = getService(IConfigurationService)
    for (const [key, value] of Object.entries(data.settings)) {
      void configService.updateValue(key, value, ConfigurationTarget.Workspace)
    }
  })

  // ── Get tool settings ──
  handleWithTimeout(IPC.SETTINGS_GET_TOOL, IPC_TIMEOUT.short, (): ToolSettings[] => {
    return getService(IConfigurationService).getValue<ToolSettings[]>('toolSettings') || DEFAULT_TOOL_SETTINGS
  })

  // ── Set tool settings ──
  handleWithTimeout(IPC.SETTINGS_SET_TOOL, IPC_TIMEOUT.short, (_event, settings: ToolSettings[]) => {
    if (!Array.isArray(settings)) throw new Error('Invalid tool settings')
    const merged = mergeToolSettings(settings)
    const configService = getService(IConfigurationService)
    void configService.updateValue('toolSettings', merged, ConfigurationTarget.User)
    agentLoop.getToolExecutor().updateToolSettings(merged)
  })

  // ── Get permission mode ──
  handleWithTimeout(IPC.PERMISSION_MODE_GET, IPC_TIMEOUT.short, (): PermissionMode => {
    return getService(IConfigurationService).getValue<PermissionMode>('permissionMode') || 'MANUAL'
  })

  // ── Set permission mode ──
  handleWithTimeout(IPC.PERMISSION_MODE_SET, IPC_TIMEOUT.short, (_event, mode: PermissionMode) => {
    if (!['MANUAL', 'LIMITED', 'EXTENDED', 'AUTO'].includes(mode)) {
      throw new Error('Invalid permission mode')
    }
    const configService = getService(IConfigurationService)
    void configService.updateValue('permissionMode', mode, ConfigurationTarget.User)
    agentLoop.getToolExecutor().setPermissionMode(mode)
  })

  // ── Get all request/response audit traces ──
  handleWithTimeout(IPC.TRACES_LIST, IPC_TIMEOUT.short, (): Array<{ name: string; sizeBytes: number; createdAt: string }> => {
    return getService(ITraceLogger).listTraces()
  })

  // ── Get token costs summary for settings dashboard ──
  handleWithTimeout(IPC.COSTS_SUMMARY, IPC_TIMEOUT.short, (): any => {
    return CostManager.getCostSummary()
  })
}
