import type { ToolSettings } from '@shared/types'

export const DEFAULT_TOOL_SETTINGS: ToolSettings[] = [
  { name: 'BashTool', enabled: false, permission: 'always-ask' },
  { name: 'FileReadTool', enabled: true, permission: 'always-allow' },
  { name: 'FileWriteTool', enabled: true, permission: 'always-ask' },
  { name: 'FileEditTool', enabled: true, permission: 'always-ask' },
  { name: 'GlobTool', enabled: true, permission: 'always-allow' },
  { name: 'GrepTool', enabled: true, permission: 'always-allow' },
  { name: 'WebFetchTool', enabled: true, permission: 'always-ask' },
  { name: 'WebSearchTool', enabled: true, permission: 'always-allow' },
  { name: 'TodoWriteTool', enabled: true, permission: 'always-allow' },
  { name: 'PowerShellTool', enabled: false, permission: 'always-ask' },
  { name: 'SleepTool', enabled: true, permission: 'always-allow' }
]

export function mergeToolSettings(saved: ToolSettings[]): ToolSettings[] {
  const savedByName = new Map(saved.map((setting) => [setting.name, setting]))
  const merged = DEFAULT_TOOL_SETTINGS.map((defaultSetting) => ({
    ...defaultSetting,
    ...savedByName.get(defaultSetting.name)
  }))

  for (const setting of saved) {
    if (!DEFAULT_TOOL_SETTINGS.some((defaultSetting) => defaultSetting.name === setting.name)) {
      merged.push(setting)
    }
  }

  return merged
}
