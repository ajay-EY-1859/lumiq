import { IPC, type McpServer } from '@shared/types'
import { deleteMcpServer, listMcpServers, saveMcpServer } from '../db/mcpServers'
import { mcpServerManager } from '../services/mcp/McpServerManager'
import { agentLoop } from '../agent/AgentLoop'
import fs from 'node:fs'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { validatePathWithinWorkspace } from '../security/pathValidation'

export function registerMcpHandlers(): void {
  handleWithTimeout(IPC.MCP_LIST, IPC_TIMEOUT.short, () => listMcpServers())

  handleWithTimeout(IPC.MCP_SAVE, IPC_TIMEOUT.short, (_event, server: Partial<McpServer> & Pick<McpServer, 'name' | 'command'>) => {
    if (!server.name?.trim() || !server.command?.trim()) {
      throw new Error('MCP server name and command are required')
    }
    const saved = saveMcpServer(server)
    agentLoop.getToolExecutor().refreshMcpTools()
    return saved
  })

  handleWithTimeout(IPC.MCP_DELETE, IPC_TIMEOUT.long, (_event, id: string) => {
    mcpServerManager.stop(id)
    const deleted = deleteMcpServer(id)
    agentLoop.getToolExecutor().refreshMcpTools()
    return deleted
  })

  handleWithTimeout(IPC.MCP_START, IPC_TIMEOUT.long, async (_event, id: string) => {
    const status = await mcpServerManager.start(id)
    agentLoop.getToolExecutor().refreshMcpTools()
    return status
  })

  handleWithTimeout(IPC.MCP_STOP, IPC_TIMEOUT.long, (_event, id: string) => {
    const status = mcpServerManager.stop(id)
    agentLoop.getToolExecutor().refreshMcpTools()
    return status
  })

  handleWithTimeout(IPC.MCP_TEST, IPC_TIMEOUT.long, async (_event, id: string) => {
    const result = await mcpServerManager.test(id)
    agentLoop.getToolExecutor().refreshMcpTools()
    return result
  })

  handleWithTimeout(IPC.MCP_IMPORT, IPC_TIMEOUT.short, async (_event, filePath: string) => {
    try {
      const content = fs.readFileSync(validatePathWithinWorkspace(filePath), 'utf-8')
      const config = JSON.parse(content)
      
      // Basic validation
      if (!config.name || !config.command) {
        throw new Error('Invalid MCP config: must contain name and command fields')
      }
      
      const server: Partial<McpServer> & Pick<McpServer, 'name' | 'command'> = {
        name: config.name,
        command: config.command,
        args: config.args || [],
        env: config.env || {},
        active: true
      }
      
      const saved = saveMcpServer(server)
      agentLoop.getToolExecutor().refreshMcpTools()
      return saved
    } catch (error) {
      throw new Error(`Failed to import MCP server: ${(error as Error).message}`)
    }
  })
}
