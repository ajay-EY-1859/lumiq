import { ipcMain } from 'electron'
import { IPC, type McpServer } from '@shared/types'
import { deleteMcpServer, listMcpServers, saveMcpServer } from '../db/mcpServers'
import { mcpServerManager } from '../services/mcp/McpServerManager'
import { agentLoop } from '../agent/AgentLoop'
import fs from 'node:fs'

export function registerMcpHandlers(): void {
  ipcMain.handle(IPC.MCP_LIST, () => listMcpServers())

  ipcMain.handle(IPC.MCP_SAVE, (_event, server: Partial<McpServer> & Pick<McpServer, 'name' | 'command'>) => {
    if (!server.name?.trim() || !server.command?.trim()) {
      throw new Error('MCP server name and command are required')
    }
    const saved = saveMcpServer(server)
    agentLoop.getToolExecutor().refreshMcpTools()
    return saved
  })

  ipcMain.handle(IPC.MCP_DELETE, (_event, id: string) => {
    mcpServerManager.stop(id)
    const deleted = deleteMcpServer(id)
    agentLoop.getToolExecutor().refreshMcpTools()
    return deleted
  })

  ipcMain.handle(IPC.MCP_START, async (_event, id: string) => {
    const status = await mcpServerManager.start(id)
    agentLoop.getToolExecutor().refreshMcpTools()
    return status
  })

  ipcMain.handle(IPC.MCP_STOP, (_event, id: string) => {
    const status = mcpServerManager.stop(id)
    agentLoop.getToolExecutor().refreshMcpTools()
    return status
  })

  ipcMain.handle(IPC.MCP_TEST, async (_event, id: string) => {
    const result = await mcpServerManager.test(id)
    agentLoop.getToolExecutor().refreshMcpTools()
    return result
  })

  ipcMain.handle(IPC.MCP_IMPORT, async (_event, filePath: string) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
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
