// ═══════════════════════════════════════════════════════════════════
// Lumiq — GetEnvironmentTool
// Allows the agent to read general settings, custom skills, commands,
// MCP servers, sessions, API configs, and agent routes.
// ═══════════════════════════════════════════════════════════════════

import { getService } from '@shared/instantiation/instantiationService'
import { IConfigurationService } from '@shared/configuration/configuration'
import type { Tool } from './Tool'
import type { AppSettings, ToolSettings, PermissionMode } from '@shared/types'
import { DEFAULT_TOOL_SETTINGS } from './defaultToolSettings'
import { listSkills } from '../db/skills'
import { listCommands } from '../db/commands'
import { listMcpServers } from '../db/mcpServers'
import { listSessions } from '../db/sessions'
import { listApiConfigsSafe } from '../db/apiConfigs'
import { listAgentRoutes } from '../db/agentRoutes'
import { listAgents } from '../db/agents'

export class GetEnvironmentTool implements Tool {
  name = 'GetEnvironmentTool'
  description = 'Read application configurations, settings, custom skills, commands, active sessions, API providers, agent routes, and custom agents.'
  requiresApproval = false
  isReadOnly = true
  inputSchema = {
    type: 'object',
    properties: {
      resource: {
        type: 'string',
        enum: ['settings', 'skills', 'commands', 'mcpServers', 'sessions', 'apiConfigs', 'agentRoutes', 'agents', 'all'],
        description: 'The configuration or database resource to retrieve.'
      }
    },
    required: ['resource']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    try {
      const resource = input.resource as string

      switch (resource) {
        case 'settings': {
          const configService = getService(IConfigurationService)
          const appSettings: AppSettings = {
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
          const permissionMode = configService.getValue<PermissionMode>('permissionMode') || 'MANUAL'
          const toolSettings = configService.getValue<ToolSettings[]>('toolSettings') || DEFAULT_TOOL_SETTINGS
          return JSON.stringify({ appSettings, permissionMode, toolSettings }, null, 2)
        }

        case 'skills':
          return JSON.stringify(listSkills(), null, 2)

        case 'commands':
          return JSON.stringify(listCommands(), null, 2)

        case 'mcpServers':
          return JSON.stringify(listMcpServers(), null, 2)

        case 'sessions':
          return JSON.stringify(listSessions(), null, 2)

        case 'apiConfigs':
          return JSON.stringify(listApiConfigsSafe(), null, 2)

        case 'agentRoutes':
          return JSON.stringify(listAgentRoutes(), null, 2)

        case 'agents':
          return JSON.stringify(listAgents(), null, 2)

        case 'all': {
          const configService = getService(IConfigurationService)
          const appSettings: AppSettings = {
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
          const permissionMode = configService.getValue<PermissionMode>('permissionMode') || 'MANUAL'
          const toolSettings = configService.getValue<ToolSettings[]>('toolSettings') || DEFAULT_TOOL_SETTINGS

          return JSON.stringify({
            settings: { appSettings, permissionMode, toolSettings },
            skills: listSkills(),
            commands: listCommands(),
            mcpServers: listMcpServers(),
            sessions: listSessions(),
            apiConfigs: listApiConfigsSafe(),
            agentRoutes: listAgentRoutes(),
            agents: listAgents()
          }, null, 2)
        }

        default:
          return `[ERROR] Unknown resource: ${resource}`
      }
    } catch (err) {
      return `[ERROR] Failed to retrieve resource: ${(err as Error).message}`
    }
  }
}
