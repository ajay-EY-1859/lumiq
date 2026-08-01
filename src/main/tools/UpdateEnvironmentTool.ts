// ═══════════════════════════════════════════════════════════════════
// Lumiq — UpdateEnvironmentTool
// Allows the agent to update, create, or delete settings, custom skills,
// custom commands, MCP servers, sessions, API configs, and agent routes.
// ═══════════════════════════════════════════════════════════════════

import { getService } from '@shared/instantiation/instantiationService'
import { IConfigurationService, ConfigurationTarget } from '@shared/configuration/configuration'
import type { Tool } from './Tool'
import type { PermissionMode, CustomSkill, CustomCommand, McpServer, ProviderConfig, AgentRoute, Agent } from '@shared/types'
import { mergeToolSettings } from './defaultToolSettings'
import { saveSkill, deleteSkill } from '../db/skills'
import { saveCommand, deleteCommand } from '../db/commands'
import { saveMcpServer, deleteMcpServer } from '../db/mcpServers'
import { createSession, deleteSession, updateSessionTitle, updateSessionWorkspace } from '../db/sessions'
import { saveApiConfig, deleteApiConfig } from '../db/apiConfigs'
import { saveAgentRoute, deleteAgentRoute } from '../db/agentRoutes'
import { saveAgent, deleteAgent } from '../db/agents'

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
  'monthlyBudgetCap',
  'permissionMode',
  'toolSettings',
  'keybindings'
])

function normalizeSettingValue(key: string, value: unknown): string {
  const raw = String(value ?? '')
  switch (key) {
    case 'theme':
      if (!['light', 'dark', 'system'].includes(raw)) throw new Error('Invalid theme. Must be "light", "dark", or "system".')
      return raw
    case 'fontSize':
      if (!['12', '14', '16'].includes(raw)) throw new Error('Invalid font size. Must be "12", "14", or "16".')
      return raw
    case 'sidebarVisible':
    case 'autoSave':
      if (!['true', 'false'].includes(raw)) throw new Error(`Invalid boolean setting for ${key}. Must be "true" or "false".`)
      return raw
    case 'contextLimit': {
      const parsedLimit = parseInt(raw, 10)
      if (isNaN(parsedLimit)) throw new Error('Invalid context limit. Must be a number.')
      return String(Math.max(10, Math.min(500, parsedLimit)))
    }
    case 'firecrawlApiKey':
      return raw.slice(0, 500)
    case 'defaultModel':
      return raw.replace(/[^\w:./-]/g, '').slice(0, 200)
    case 'defaultProvider':
      return raw.replace(/[^\w-]/g, '').slice(0, 50)
    case 'dailyBudgetCap':
    case 'monthlyBudgetCap': {
      const parsedVal = parseFloat(raw)
      if (isNaN(parsedVal)) throw new Error('Invalid budget cap value. Must be a number.')
      return parsedVal.toFixed(2)
    }
    case 'permissionMode':
      if (!['MANUAL', 'LIMITED', 'EXTENDED', 'AUTO'].includes(raw)) {
        throw new Error('Invalid permission mode. Must be "MANUAL", "LIMITED", "EXTENDED", or "AUTO".')
      }
      return raw
    default:
      throw new Error(`Unsupported setting key: ${key}`)
  }
}

export class UpdateEnvironmentTool implements Tool {
  name = 'UpdateEnvironmentTool'
  description = 'Update, create, or delete various configurations, settings, or database entities of the AI platform (skills, commands, MCP servers, sessions, API configs, agent routes, agents).'
  requiresApproval = true
  isReadOnly = false
  inputSchema = {
    type: 'object',
    properties: {
      resource: {
        type: 'string',
        enum: ['settings', 'skill', 'command', 'mcpServer', 'session', 'apiConfig', 'agentRoute', 'agent'],
        description: 'The type of resource to modify.'
      },
      action: {
        type: 'string',
        enum: ['save', 'delete'],
        description: 'The action to perform: "save" (create or update) or "delete".'
      },
      data: {
        type: 'string',
        description: 'JSON-serialized string of the resource properties to save (e.g. for settings: {"key": "theme", "value": "dark"}), or the ID/provider string to delete (e.g. for skill: "skill-id-123", or for session: "session-id-123", or for apiConfig: "provider-name").'
      }
    },
    required: ['resource', 'action', 'data']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    try {
      const resource = input.resource as string
      const action = input.action as 'save' | 'delete'
      const rawData = input.data as string

      let parsedData: any
      try {
        parsedData = JSON.parse(rawData)
      } catch (err) {
        return `[ERROR] "data" must be a valid JSON-serialized string: ${(err as Error).message}`
      }

      switch (resource) {
        case 'settings': {
          if (action !== 'save') {
            return `[ERROR] Action "${action}" not supported for resource "settings". Only "save" is supported.`
          }

          let settingsToUpdate: { key: string; value: any }[] = []
          if (typeof parsedData === 'object' && parsedData !== null) {
            if ('key' in parsedData && 'value' in parsedData) {
              settingsToUpdate.push({ key: parsedData.key, value: parsedData.value })
            } else {
              for (const [k, v] of Object.entries(parsedData)) {
                settingsToUpdate.push({ key: k, value: v })
              }
            }
          }

          if (settingsToUpdate.length === 0) {
            return `[ERROR] Unsupported setting key: undefined`
          }

          const configService = getService(IConfigurationService)
          const { agentLoop } = await import('../agent/AgentLoop')
          const results: string[] = []

          for (const item of settingsToUpdate) {
            const { key, value } = item
            if (!SETTINGS_KEYS.has(key)) {
              results.push(`[ERROR] Unsupported setting key: ${key}`)
              continue
            }

            if (key === 'toolSettings') {
              if (!Array.isArray(value)) {
                results.push(`[ERROR] Tool settings must be an array of tool setting objects.`)
                continue
              }
              const merged = mergeToolSettings(value)
              void configService.updateValue('toolSettings', merged, ConfigurationTarget.User)
              agentLoop.getToolExecutor().updateToolSettings(merged)
              results.push(`[OK] Updated tool settings successfully.`)
              continue
            }

            if (key === 'keybindings') {
              if (typeof value !== 'object' || value === null) {
                results.push(`[ERROR] Keybindings must be an object.`)
                continue
              }
              void configService.updateValue('keybindings', value, ConfigurationTarget.User)
              results.push(`[OK] Updated keybindings successfully.`)
              continue
            }

            try {
              const normalized = normalizeSettingValue(key, value)

              if (key === 'permissionMode') {
                void configService.updateValue('permissionMode', normalized, ConfigurationTarget.User)
                agentLoop.getToolExecutor().setPermissionMode(normalized as PermissionMode)
                results.push(`[OK] Updated permissionMode to "${normalized}".`)
                continue
              }

              if (key === 'contextLimit') {
                void configService.updateValue('contextLimit', normalized, ConfigurationTarget.User)
                agentLoop.setContextLimit(parseInt(normalized, 10))
                results.push(`[OK] Updated contextLimit to ${normalized}.`)
                continue
              }

              void configService.updateValue(key, normalized, ConfigurationTarget.User)
              results.push(`[OK] Updated setting "${key}" to "${normalized}".`)
            } catch (err) {
              results.push(`[ERROR] Failed to update setting "${key}": ${(err as Error).message}`)
            }
          }

          return results.join('\n')
        }

        case 'skill': {
          if (action === 'save') {
            const skills = Array.isArray(parsedData) ? parsedData : [parsedData]
            const savedSkills: any[] = []
            const errors: string[] = []

            for (const item of skills) {
              const skill = item as Partial<CustomSkill> & Pick<CustomSkill, 'name' | 'promptTemplate'>
              if (!skill.name || !skill.promptTemplate) {
                errors.push(`[ERROR] Skill name and promptTemplate are required.`)
                continue
              }
              // Security checks for destructive statements or dangerous injections (same as CustomizationHarnessService)
              const lowerPrompt = skill.promptTemplate.toLowerCase()
              const dangerousPatterns = [
                /DROP\s+TABLE/i, 
                /DELETE\s+FROM/i, 
                /TRUNCATE\s+TABLE/i, 
                /rm\s+-rf/i,
                /eval\s*\(/i
              ]
              let isUnsafe = false
              for (const pattern of dangerousPatterns) {
                if (pattern.test(lowerPrompt)) {
                  errors.push(`[ERROR] Validation failed: Skill prompt template contains unsafe statements.`)
                  isUnsafe = true
                  break
                }
              }
              if (isUnsafe) continue

              if (skill.promptTemplate.length < 5) {
                errors.push(`[ERROR] Validation failed: Skill prompt template is too short (min 5 chars).`)
                continue
              }
              const saved = saveSkill(skill)
              savedSkills.push(saved)
            }

            if (errors.length > 0 && savedSkills.length === 0) {
              return errors.join('\n')
            }

            let response = ''
            if (savedSkills.length > 0) {
              const isArray = Array.isArray(parsedData)
              response += `[OK] Custom skill${isArray ? 's' : ''} saved successfully:\n${JSON.stringify(isArray ? savedSkills : savedSkills[0], null, 2)}`
            }
            if (errors.length > 0) {
              if (response) response += '\n'
              response += `Errors during processing:\n${errors.join('\n')}`
            }
            return response
          } else {
            const id = typeof parsedData === 'string' ? parsedData : parsedData.id
            if (!id) return `[ERROR] Skill ID is required for deletion.`
            const success = deleteSkill(id)
            return success
              ? `[OK] Skill "${id}" was deleted successfully.`
              : `[ERROR] Skill "${id}" not found.`
          }
        }

        case 'command': {
          if (action === 'save') {
            const cmds = Array.isArray(parsedData) ? parsedData : [parsedData]
            const savedCmds: any[] = []
            const errors: string[] = []

            for (const item of cmds) {
              const cmd = item as Partial<CustomCommand> & Pick<CustomCommand, 'name' | 'command'>
              if (!cmd.name || !cmd.command) {
                errors.push(`[ERROR] Command name and command string are required.`)
                continue
              }
              const saved = saveCommand(cmd)
              savedCmds.push(saved)
            }

            if (errors.length > 0 && savedCmds.length === 0) {
              return errors.join('\n')
            }

            let response = ''
            if (savedCmds.length > 0) {
              const isArray = Array.isArray(parsedData)
              response += `[OK] Custom command${isArray ? 's' : ''} saved successfully:\n${JSON.stringify(isArray ? savedCmds : savedCmds[0], null, 2)}`
            }
            if (errors.length > 0) {
              if (response) response += '\n'
              response += `Errors during processing:\n${errors.join('\n')}`
            }
            return response
          } else {
            const id = typeof parsedData === 'string' ? parsedData : parsedData.id
            if (!id) return `[ERROR] Command ID is required for deletion.`
            const success = deleteCommand(id)
            return success
              ? `[OK] Command "${id}" was deleted successfully.`
              : `[ERROR] Command "${id}" not found.`
          }
        }

        case 'mcpServer': {
          if (action === 'save') {
            const servers = Array.isArray(parsedData) ? parsedData : [parsedData]
            const savedServers: any[] = []
            const errors: string[] = []

            for (const item of servers) {
              const server = item as Partial<McpServer> & Pick<McpServer, 'name' | 'command'>
              if (!server.name || !server.command) {
                errors.push(`[ERROR] MCP Server name and command are required.`)
                continue
              }
              const saved = saveMcpServer(server)
              savedServers.push(saved)
            }

            if (errors.length > 0 && savedServers.length === 0) {
              return errors.join('\n')
            }

            let response = ''
            if (savedServers.length > 0) {
              const isArray = Array.isArray(parsedData)
              response += `[OK] MCP Server${isArray ? 's' : ''} saved successfully:\n${JSON.stringify(isArray ? savedServers : savedServers[0], null, 2)}`
            }
            if (errors.length > 0) {
              if (response) response += '\n'
              response += `Errors during processing:\n${errors.join('\n')}`
            }
            return response
          } else {
            const id = typeof parsedData === 'string' ? parsedData : parsedData.id
            if (!id) return `[ERROR] MCP Server ID is required for deletion.`
            const success = deleteMcpServer(id)
            return success
              ? `[OK] MCP Server "${id}" was deleted successfully.`
              : `[ERROR] MCP Server "${id}" not found.`
          }
        }

        case 'session': {
          if (action === 'save') {
            const { id, title, workspacePath, provider, model, agentId } = parsedData
            if (id) {
              if (title !== undefined) {
                updateSessionTitle(id, title)
              }
              if (workspacePath !== undefined) {
                updateSessionWorkspace(id, workspacePath)
              }
              return `[OK] Session "${id}" updated successfully.`
            } else {
              if (!provider || !model) {
                return `[ERROR] provider and model are required to create a session.`
              }
              const created = createSession(provider, model, agentId)
              return `[OK] Session created successfully:\n${JSON.stringify(created, null, 2)}`
            }
          } else {
            const id = typeof parsedData === 'string' ? parsedData : parsedData.id
            if (!id) return `[ERROR] Session ID is required for deletion.`
            const success = deleteSession(id)
            return success
              ? `[OK] Session "${id}" deleted successfully.`
              : `[ERROR] Session "${id}" not found.`
          }
        }

        case 'apiConfig': {
          if (action === 'save') {
            const config = parsedData as ProviderConfig
            if (!config.provider || !config.defaultModel) {
              return `[ERROR] provider and defaultModel are required for API config.`
            }
            saveApiConfig(config)
            return `[OK] API configuration saved successfully.`
          } else {
            const provider = typeof parsedData === 'string' ? parsedData : parsedData.provider
            if (!provider) return `[ERROR] Provider name is required for deletion.`
            const success = deleteApiConfig(provider)
            return success
              ? `[OK] API configuration for provider "${provider}" deleted successfully.`
              : `[ERROR] API configuration for provider "${provider}" not found.`
          }
        }

        case 'agentRoute': {
          if (action === 'save') {
            const routes = Array.isArray(parsedData) ? parsedData : [parsedData]
            const savedRoutes: any[] = []
            const errors: string[] = []

            for (const item of routes) {
              const route = item as Partial<AgentRoute> & Pick<AgentRoute, 'taskName' | 'provider' | 'model'>
              if (!route.taskName || !route.provider || !route.model) {
                errors.push(`[ERROR] taskName, provider, and model are required for agent route.`)
                continue
              }
              const saved = saveAgentRoute(route)
              savedRoutes.push(saved)
            }

            if (errors.length > 0 && savedRoutes.length === 0) {
              return errors.join('\n')
            }

            let response = ''
            if (savedRoutes.length > 0) {
              const isArray = Array.isArray(parsedData)
              response += `[OK] Agent route${isArray ? 's' : ''} saved successfully:\n${JSON.stringify(isArray ? savedRoutes : savedRoutes[0], null, 2)}`
            }
            if (errors.length > 0) {
              if (response) response += '\n'
              response += `Errors during processing:\n${errors.join('\n')}`
            }
            return response
          } else {
            const id = typeof parsedData === 'string' ? parsedData : parsedData.id
            if (!id) return `[ERROR] Agent route ID is required for deletion.`
            const success = deleteAgentRoute(id)
            return success
              ? `[OK] Agent route "${id}" deleted successfully.`
              : `[ERROR] Agent route "${id}" not found.`
          }
        }

        case 'agent': {
          if (action === 'save') {
            const agents = Array.isArray(parsedData) ? parsedData : [parsedData]
            const savedAgents: any[] = []
            const errors: string[] = []

            for (const item of agents) {
              const agent = item as Partial<Agent> & { name: string; systemPrompt: string }
              if (!agent.name || !agent.systemPrompt) {
                errors.push(`[ERROR] Agent name and systemPrompt are required.`)
                continue
              }
              const saved = saveAgent(agent)
              savedAgents.push(saved)
            }

            if (errors.length > 0 && savedAgents.length === 0) {
              return errors.join('\n')
            }

            let response = ''
            if (savedAgents.length > 0) {
              const isArray = Array.isArray(parsedData)
              response += `[OK] Custom agent${isArray ? 's' : ''} saved successfully:\n${JSON.stringify(isArray ? savedAgents : savedAgents[0], null, 2)}`
            }
            if (errors.length > 0) {
              if (response) response += '\n'
              response += `Errors during processing:\n${errors.join('\n')}`
            }
            return response
          } else {
            const id = typeof parsedData === 'string' ? parsedData : parsedData.id
            if (!id) return `[ERROR] Agent ID is required for deletion.`
            const success = deleteAgent(id)
            return success
              ? `[OK] Agent "${id}" deleted successfully.`
              : `[ERROR] Agent "${id}" not found.`
          }
        }

        default:
          return `[ERROR] Unknown resource: ${resource}`
      }
    } catch (err) {
      return `[ERROR] Failed to update resource: ${(err as Error).message}`
    }
  }
}
