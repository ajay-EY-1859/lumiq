// ═══════════════════════════════════════════════════════════════════
// Lumiq — Settings Store (Zustand)
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type { AppSettings, ThemeMode, FontSize, ToolSettings } from '@shared/types'

interface SettingsState {
  settings: AppSettings
  toolSettings: ToolSettings[]
  isLoading: boolean

  // Actions
  loadSettings: () => Promise<void>
  updateSetting: (key: keyof AppSettings, value: string) => Promise<void>
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
  contextLimit: 50
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
  settings: defaultSettings,
  toolSettings: [],
  isLoading: true,

  loadSettings: async () => {
    try {
      const settings = await window.electronAPI.settings.get() as AppSettings
      set({ settings, isLoading: false })
      applyTheme(settings.theme)
      document.documentElement.style.fontSize = `${settings.fontSize}px`
    } catch {
      set({ isLoading: false })
      applyTheme('system')
    }
  },

  updateSetting: async (key, value) => {
    await window.electronAPI.settings.set(key, value)
    const settings = { ...get().settings, [key]: value }
    set({ settings })

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
