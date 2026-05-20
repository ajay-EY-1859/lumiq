// ═══════════════════════════════════════════════════════════════════
// Lumiq — Settings Store (Zustand)
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type { AppSettings, ThemeMode, FontSize, ToolSettings } from '@shared/types'

interface SettingsState {
  globalSettings: AppSettings
  workspaceSettings: Partial<AppSettings>
  settings: AppSettings // Merged view
  toolSettings: ToolSettings[]
  isLoading: boolean

  // Actions
  loadSettings: () => Promise<void>
  loadWorkspaceSettings: (workspacePath: string | null) => Promise<void>
  updateSetting: (key: keyof AppSettings, value: string) => Promise<void>
  updateWorkspaceSetting: (workspacePath: string, key: keyof AppSettings, value: any) => Promise<void>
  setTheme: (theme: ThemeMode) => void
  setFontSize: (size: FontSize) => void
  loadToolSettings: () => Promise<void>
  updateToolSettings: (settings: ToolSettings[]) => Promise<void>
}

const defaultSettings: AppSettings = {
  theme: 'system',
  fontSize: '14',
  defaultProvider: 'anthropic',
  defaultModel: 'claude-sonnet-4-20250514',
  sidebarVisible: true,
  autoSave: true,
  contextLimit: 150,
  firecrawlApiKey: ''
}

// Apply theme to DOM
function applyTheme(theme: ThemeMode): void {
  const root = document.documentElement
  if (theme === 'system') {
    const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    root.setAttribute('data-theme', isDark ? 'dark' : 'light')
  } else {
    root.setAttribute('data-theme', theme)
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  globalSettings: defaultSettings,
  workspaceSettings: {},
  settings: defaultSettings,
  toolSettings: [],
  isLoading: true,

  loadSettings: async () => {
    try {
      const globalSettings = await window.electronAPI.settings.get() as AppSettings
      const settings = { ...globalSettings, ...get().workspaceSettings }
      set({ globalSettings, settings, isLoading: false })
      applyTheme(settings.theme)
      document.documentElement.style.fontSize = `${settings.fontSize}px`
    } catch {
      set({ isLoading: false })
      applyTheme('system')
    }
  },

  loadWorkspaceSettings: async (workspacePath) => {
    if (!workspacePath) {
      set({ workspaceSettings: {}, settings: get().globalSettings })
      return
    }
    try {
      const workspaceSettings = await window.electronAPI.settings.getWorkspace(workspacePath)
      const settings = { ...get().globalSettings, ...workspaceSettings }
      set({ workspaceSettings, settings })
      applyTheme(settings.theme)
      document.documentElement.style.fontSize = `${settings.fontSize}px`
    } catch {
      set({ workspaceSettings: {}, settings: get().globalSettings })
    }
  },

  updateSetting: async (key, value) => {
    await window.electronAPI.settings.set(key, value)
    const globalSettings = { ...get().globalSettings, [key]: value }
    const settings = { ...globalSettings, ...get().workspaceSettings }
    set({ globalSettings, settings })

    if (key === 'theme' && !get().workspaceSettings.theme) {
      applyTheme(value as ThemeMode)
    }
    if (key === 'fontSize' && !get().workspaceSettings.fontSize) {
      document.documentElement.style.fontSize = `${value}px`
    }
  },

  updateWorkspaceSetting: async (workspacePath, key, value) => {
    const newWorkspaceSettings = { ...get().workspaceSettings, [key]: value }
    await window.electronAPI.settings.setWorkspace(workspacePath, newWorkspaceSettings)
    const settings = { ...get().globalSettings, ...newWorkspaceSettings }
    set({ workspaceSettings: newWorkspaceSettings, settings })

    if (key === 'theme') {
      applyTheme(value as ThemeMode)
    }
    if (key === 'fontSize') {
      document.documentElement.style.fontSize = `${value}px`
    }
  },

  setTheme: (theme) => {
    get().updateSetting('theme', theme)
  },

  setFontSize: (size) => {
    get().updateSetting('fontSize', size)
  },

  loadToolSettings: async () => {
    try {
      const toolSettings = await window.electronAPI.settings.getTool() as ToolSettings[]
      set({ toolSettings })
    } catch {
      // Use empty defaults
    }
  },

  updateToolSettings: async (settings) => {
    await window.electronAPI.settings.setTool(settings)
    set({ toolSettings: settings })
  }
}))
