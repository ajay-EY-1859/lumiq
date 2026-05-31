import fs from 'node:fs'
import path from 'node:path'
import type {
  InstalledPlugin,
  PluginCommandResource,
  PluginManifest,
  PluginMarketplaceItem,
  PluginMcpResource,
  PluginResourceType,
  PluginSkillResource
} from '@shared/types'
import { deleteCommand, listCommands, saveCommand } from '../../db/commands'
import { deleteInstalledPlugin, getInstalledPlugin, listInstalledPlugins, saveInstalledPlugin } from '../../db/plugins'
import { deleteSkill, listSkills, saveSkill } from '../../db/skills'
import { deleteMcpServer, listMcpServers, saveMcpServer } from '../../db/mcpServers'
import { mcpServerManager } from '../mcp/McpServerManager'
import { agentLoop } from '../../agent/AgentLoop'
import { LOCAL_PLUGIN_REGISTRY } from './localRegistry'

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null
}

function assertString(value: unknown, label: string): string {
  if (typeof value !== 'string' || !value.trim()) {
    throw new Error(`Plugin manifest is missing ${label}`)
  }
  return value.trim()
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function validateSkill(value: unknown): PluginSkillResource {
  if (!isRecord(value)) throw new Error('Invalid skill resource')
  return {
    name: assertString(value.name, 'skill.name'),
    description: typeof value.description === 'string' ? value.description : '',
    promptTemplate: assertString(value.promptTemplate, 'skill.promptTemplate'),
    allowedTools: asStringArray(value.allowedTools)
  }
}

function validateCommand(value: unknown): PluginCommandResource {
  if (!isRecord(value)) throw new Error('Invalid command resource')
  const type = value.type === 'prompt' ? 'prompt' : 'shell'
  return {
    name: assertString(value.name, 'command.name'),
    description: typeof value.description === 'string' ? value.description : '',
    command: assertString(value.command, 'command.command'),
    type,
    args: asStringArray(value.args)
  }
}

function validateMcp(value: unknown): PluginMcpResource {
  if (!isRecord(value)) throw new Error('Invalid MCP resource')
  const env = isRecord(value.env)
    ? Object.fromEntries(Object.entries(value.env).filter((entry): entry is [string, string] => typeof entry[1] === 'string'))
    : {}
  return {
    name: assertString(value.name, 'mcp.name'),
    command: assertString(value.command, 'mcp.command'),
    args: asStringArray(value.args),
    env
  }
}

function validateManifest(value: unknown): PluginManifest {
  if (!isRecord(value)) throw new Error('Invalid plugin manifest')
  const category = value.category
  if (category !== 'skill' && category !== 'command' && category !== 'mcp' && category !== 'bundle') {
    throw new Error('Plugin manifest has an invalid category')
  }
  const resources = isRecord(value.resources) ? value.resources : {}
  const manifest: PluginManifest = {
    id: assertString(value.id, 'id'),
    name: assertString(value.name, 'name'),
    version: assertString(value.version, 'version'),
    category,
    author: assertString(value.author, 'author'),
    description: assertString(value.description, 'description'),
    resources: {
      skills: Array.isArray(resources.skills) ? resources.skills.map(validateSkill) : [],
      commands: Array.isArray(resources.commands) ? resources.commands.map(validateCommand) : [],
      mcpServers: Array.isArray(resources.mcpServers) ? resources.mcpServers.map(validateMcp) : []
    }
  }
  const resourceCount =
    (manifest.resources.skills?.length || 0) +
    (manifest.resources.commands?.length || 0) +
    (manifest.resources.mcpServers?.length || 0)
  if (resourceCount === 0) throw new Error('Plugin manifest must include at least one resource')
  return manifest
}

export class PluginMarketplaceService {
  listMarketplace(): PluginMarketplaceItem[] {
    const installedIds = new Set(listInstalledPlugins().map((plugin) => plugin.id))
    return LOCAL_PLUGIN_REGISTRY.map((plugin) => ({ ...plugin, installed: installedIds.has(plugin.id) }))
  }

  listInstalled(): InstalledPlugin[] {
    return listInstalledPlugins()
  }

  installMarketplacePlugin(pluginId: string): InstalledPlugin {
    const manifest = LOCAL_PLUGIN_REGISTRY.find((plugin) => plugin.id === pluginId)
    if (!manifest) throw new Error('Plugin not found in local marketplace')
    return this.installManifest(manifest, 'marketplace')
  }

  importLocalPlugin(folderPath: string): InstalledPlugin {
    const manifestPath = this.resolveManifestPath(folderPath)
    const raw = fs.readFileSync(manifestPath, 'utf8')
    return this.installManifest(validateManifest(JSON.parse(raw) as unknown), 'local')
  }

  uninstall(pluginId: string): boolean {
    const plugin = getInstalledPlugin(pluginId)
    if (!plugin) return false

    for (const resource of plugin.resources) {
      if (resource.type === 'mcp') {
        mcpServerManager.stop(resource.resourceId)
        deleteMcpServer(resource.resourceId)
      } else if (resource.type === 'skill') {
        deleteSkill(resource.resourceId)
      } else if (resource.type === 'command') {
        deleteCommand(resource.resourceId)
      }
    }

    const deleted = deleteInstalledPlugin(pluginId)
    agentLoop.getToolExecutor().refreshMcpTools()
    return deleted
  }

  private installManifest(manifest: PluginManifest, source: InstalledPlugin['source']): InstalledPlugin {
    const validManifest = validateManifest(manifest)
    if (getInstalledPlugin(validManifest.id)) {
      const installed = getInstalledPlugin(validManifest.id)
      if (!installed) throw new Error('Plugin is already installed')
      return installed
    }

    this.assertNoConflicts(validManifest)
    const created: Array<{ type: PluginResourceType; resourceId: string; name: string }> = []

    try {
      for (const skill of validManifest.resources.skills || []) {
        const saved = saveSkill(skill)
        created.push({ type: 'skill', resourceId: saved.id, name: saved.name })
      }
      for (const command of validManifest.resources.commands || []) {
        const saved = saveCommand(command)
        created.push({ type: 'command', resourceId: saved.id, name: saved.name })
      }
      for (const server of validManifest.resources.mcpServers || []) {
        const saved = saveMcpServer({ ...server, active: true, approved: false, status: 'stopped' })
        created.push({ type: 'mcp', resourceId: saved.id, name: saved.name })
      }
      const installed = saveInstalledPlugin(validManifest, source, created)
      agentLoop.getToolExecutor().refreshMcpTools()
      return installed
    } catch (error) {
      for (const resource of created.reverse()) {
        if (resource.type === 'skill') deleteSkill(resource.resourceId)
        if (resource.type === 'command') deleteCommand(resource.resourceId)
        if (resource.type === 'mcp') deleteMcpServer(resource.resourceId)
      }
      throw error
    }
  }

  private assertNoConflicts(manifest: PluginManifest): void {
    const skills = new Set(listSkills().map((skill) => skill.name.toLowerCase()))
    const commands = new Set(listCommands().map((command) => command.name.toLowerCase()))
    const mcpServers = new Set(listMcpServers().map((server) => server.name.toLowerCase()))

    for (const skill of manifest.resources.skills || []) {
      if (skills.has(skill.name.toLowerCase())) throw new Error(`Skill "${skill.name}" already exists`)
    }
    for (const command of manifest.resources.commands || []) {
      if (commands.has(command.name.toLowerCase())) throw new Error(`Command "${command.name}" already exists`)
    }
    for (const server of manifest.resources.mcpServers || []) {
      if (mcpServers.has(server.name.toLowerCase())) throw new Error(`MCP server "${server.name}" already exists`)
    }
  }

  private resolveManifestPath(folderPath: string): string {
    const root = path.resolve(folderPath)
    const candidates = [
      path.join(root, 'plugin.json'),
      path.join(root, '.lumiq', 'plugin.json'),
      path.join(root, '.codex-plugin', 'plugin.json')
    ]
    const manifestPath = candidates.find((candidate) => fs.existsSync(candidate))
    if (!manifestPath) {
      throw new Error('No plugin manifest found. Expected plugin.json or .lumiq/plugin.json.')
    }
    return manifestPath
  }
}

export const pluginMarketplaceService = new PluginMarketplaceService()
