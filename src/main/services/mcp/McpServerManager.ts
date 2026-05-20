import { BrowserWindow, dialog } from 'electron'
import { spawn, type ChildProcessWithoutNullStreams } from 'child_process'
import { EventEmitter } from 'events'
import type { McpServer, McpStatusChange, McpToolDefinition } from '@shared/types'
import { IPC } from '@shared/types'
import {
  getMcpServer,
  listMcpServers,
  markMcpServerApproved,
  updateMcpServerStatus
} from '../../db/mcpServers'

type PendingRequest = {
  resolve: (value: unknown) => void
  reject: (error: Error) => void
  timeout: NodeJS.Timeout
}

type RunningServer = {
  server: McpServer
  process: ChildProcessWithoutNullStreams
  buffer: string
  pending: Map<number, PendingRequest>
  nextId: number
  tools: McpToolDefinition[]
}

export class McpServerManager extends EventEmitter {
  private running = new Map<string, RunningServer>()

  list(): McpServer[] {
    return listMcpServers().map((server) => {
      const active = this.running.get(server.id)
      return active
        ? { ...server, status: 'running', toolsCount: active.tools.length }
        : server
    })
  }

  getTools(): Array<McpToolDefinition & { serverId: string; serverName: string }> {
    const tools: Array<McpToolDefinition & { serverId: string; serverName: string }> = []
    for (const running of this.running.values()) {
      for (const tool of running.tools) {
        tools.push({ ...tool, serverId: running.server.id, serverName: running.server.name })
      }
    }
    return tools
  }

  async start(serverId: string): Promise<McpStatusChange> {
    const server = getMcpServer(serverId)
    if (!server) throw new Error('MCP server not found')
    if (this.running.has(serverId)) {
      return { serverId, status: 'running', toolsCount: this.running.get(serverId)?.tools.length || 0 }
    }
    if (!server.active) throw new Error('MCP server is disabled')

    if (!server.approved) {
      const approved = await this.requestFirstStartApproval(server)
      if (!approved) throw new Error('MCP server start was not approved')
      markMcpServerApproved(server.id)
    }

    this.setStatus(serverId, 'starting')
    const child = spawn(server.command, server.args, {
      env: { ...process.env, ...server.env },
      stdio: 'pipe',
      windowsHide: true
    })

    const running: RunningServer = {
      server,
      process: child,
      buffer: '',
      pending: new Map(),
      nextId: 1,
      tools: []
    }
    this.running.set(serverId, running)

    child.stdout.on('data', (chunk: Buffer) => this.handleStdout(serverId, chunk.toString('utf8')))
    child.stderr.on('data', (chunk: Buffer) => {
      const message = chunk.toString('utf8').trim()
      if (message) this.emitStatus({ serverId, status: 'running', lastError: message })
    })
    child.on('exit', () => {
      this.rejectPending(serverId, new Error('MCP server exited'))
      this.running.delete(serverId)
      this.setStatus(serverId, 'stopped')
    })
    child.on('error', (error) => {
      this.rejectPending(serverId, error)
      this.running.delete(serverId)
      this.setStatus(serverId, 'error', error.message)
    })

    try {
      await this.rpc(serverId, 'initialize', {
        protocolVersion: '2024-11-05',
        capabilities: {},
        clientInfo: { name: 'Lumiq', version: '1.0.0' }
      })
      this.notify(serverId, 'notifications/initialized', {})
      const toolsResult = (await this.rpc(serverId, 'tools/list', {})) as { tools?: McpToolDefinition[] }
      running.tools = Array.isArray(toolsResult.tools) ? toolsResult.tools : []
      this.setStatus(serverId, 'running', undefined, running.tools.length)
      return { serverId, status: 'running', toolsCount: running.tools.length }
    } catch (error) {
      this.stop(serverId)
      this.setStatus(serverId, 'error', (error as Error).message)
      throw error
    }
  }

  stop(serverId: string): McpStatusChange {
    const running = this.running.get(serverId)
    if (running) {
      this.rejectPending(serverId, new Error('MCP server stopped'))
      running.process.kill()
      this.running.delete(serverId)
    }
    this.setStatus(serverId, 'stopped')
    return { serverId, status: 'stopped' }
  }

  async test(serverId: string): Promise<{ success: boolean; error?: string; toolsCount?: number }> {
    try {
      const status = await this.start(serverId)
      return { success: true, toolsCount: status.toolsCount }
    } catch (error) {
      return { success: false, error: (error as Error).message }
    }
  }

  async callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown> {
    const result = await this.rpc(serverId, 'tools/call', {
      name: toolName,
      arguments: args
    })
    return result
  }

  stopAll(): void {
    for (const serverId of Array.from(this.running.keys())) {
      this.stop(serverId)
    }
  }

  private async requestFirstStartApproval(server: McpServer): Promise<boolean> {
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows()[0]
    if (!window) return false
    const result = await dialog.showMessageBox(window, {
      type: 'warning',
      buttons: ['Start Server', 'Cancel'],
      defaultId: 1,
      cancelId: 1,
      title: 'Start MCP Server',
      message: `Start MCP server "${server.name}"?`,
      detail: `${server.command} ${server.args.join(' ')}\n\nThis starts a local process and exposes its tools to Lumiq.`
    })
    return result.response === 0
  }

  private rpc(serverId: string, method: string, params: unknown): Promise<unknown> {
    const running = this.running.get(serverId)
    if (!running) return Promise.reject(new Error('MCP server is not running'))
    const id = running.nextId++
    const request = { jsonrpc: '2.0', id, method, params }
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        running.pending.delete(id)
        reject(new Error(`MCP request timed out: ${method}`))
      }, 30000)
      running.pending.set(id, { resolve, reject, timeout })
      running.process.stdin.write(`${JSON.stringify(request)}\n`)
    })
  }

  private notify(serverId: string, method: string, params: unknown): void {
    const running = this.running.get(serverId)
    if (!running) return
    running.process.stdin.write(`${JSON.stringify({ jsonrpc: '2.0', method, params })}\n`)
  }

  private handleStdout(serverId: string, chunk: string): void {
    const running = this.running.get(serverId)
    if (!running) return
    running.buffer += chunk
    let newline = running.buffer.indexOf('\n')
    while (newline >= 0) {
      const line = running.buffer.slice(0, newline).trim()
      running.buffer = running.buffer.slice(newline + 1)
      if (line) this.handleMessage(running, line)
      newline = running.buffer.indexOf('\n')
    }
  }

  private handleMessage(running: RunningServer, line: string): void {
    let message: { id?: number; result?: unknown; error?: { message?: string } }
    try {
      message = JSON.parse(line) as typeof message
    } catch {
      return
    }
    if (typeof message.id !== 'number') return
    const pending = running.pending.get(message.id)
    if (!pending) return
    running.pending.delete(message.id)
    clearTimeout(pending.timeout)
    if (message.error) {
      pending.reject(new Error(message.error.message || 'MCP request failed'))
    } else {
      pending.resolve(message.result)
    }
  }

  private rejectPending(serverId: string, error: Error): void {
    const running = this.running.get(serverId)
    if (!running) return
    for (const pending of running.pending.values()) {
      clearTimeout(pending.timeout)
      pending.reject(error)
    }
    running.pending.clear()
  }

  private setStatus(
    serverId: string,
    status: McpStatusChange['status'],
    lastError?: string,
    toolsCount?: number
  ): void {
    updateMcpServerStatus(serverId, status, lastError, toolsCount)
    this.emitStatus({ serverId, status, lastError, toolsCount })
  }

  private emitStatus(change: McpStatusChange): void {
    this.emit('status-change', change)
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(IPC.MCP_STATUS_CHANGE, change)
    }
  }
}

export const mcpServerManager = new McpServerManager()
