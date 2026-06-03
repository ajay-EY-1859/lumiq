// ═══════════════════════════════════════════════════════════════════
// Lumiq — Tool Executor
// Runs tools with approval flow. Dangerous tools (BashTool,
// FileWriteTool, FileEditTool) require user approval before execution.
// ═══════════════════════════════════════════════════════════════════

import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { IPC } from '@shared/types'
import type { ToolApprovalRequest, ToolApprovalResponse, ToolSettings } from '@shared/types'
import type { Tool, ToolResult } from '../tools/Tool'

// Import all tools
import { BashTool } from '../tools/BashTool'
import { FileReadTool } from '../tools/FileReadTool'
import { FileWriteTool } from '../tools/FileWriteTool'
import { FileEditTool } from '../tools/FileEditTool'
import { GlobTool } from '../tools/GlobTool'
import { GrepTool } from '../tools/GrepTool'
import { WebFetchTool } from '../tools/WebFetchTool'
import { WebSearchTool } from '../tools/WebSearchTool'
import { TodoWriteTool } from '../tools/TodoWriteTool'
import { evaluatePermission, type PermissionMode } from '../security/permissions'
import { mcpServerManager } from '../services/mcp/McpServerManager'
import { McpDynamicTool } from '../tools/McpDynamicTool'
import { PowerShellTool } from '../tools/PowerShellTool'
import { SleepTool } from '../tools/SleepTool'
import { ListDirTool } from '../tools/ListDirTool'
import { FileDeleteTool } from '../tools/FileDeleteTool'
import { FileMoveTool } from '../tools/FileMoveTool'
import { MultiFileEditTool } from '../tools/MultiFileEditTool'
import { GitTool } from '../tools/GitTool'
import { TerminalTool } from '../tools/TerminalTool'
import { NotebookTool } from '../tools/NotebookTool'
import { DiffTool } from '../tools/DiffTool'
import { ImageReadTool } from '../tools/ImageReadTool'
import { FileSearchTool } from '../tools/FileSearchTool'
import { ClipboardTool } from '../tools/ClipboardTool'
import { ArchiveTool } from '../tools/ArchiveTool'
import { HttpTool } from '../tools/HttpTool'
import { EnvTool } from '../tools/EnvTool'
import { SymbolQueryTool } from '../tools/SymbolQueryTool'
import { setWorkspaceRoot } from '../security/pathValidation'

// Read-only tools that can run concurrently
const READ_ONLY_TOOLS = new Set(['FileReadTool', 'GrepTool', 'GlobTool', 'SleepTool', 'ListDirTool', 'GitTool', 'DiffTool', 'ImageReadTool', 'FileSearchTool', 'EnvTool', 'SymbolQueryTool'])
const MAX_CONCURRENCY = 10

// Pending approval requests
const pendingApprovals = new Map<
  string,
  { resolve: (response: ToolApprovalResponse) => void }
>()

// Tools that accept a working directory parameter
const CWD_TOOLS = new Set(['BashTool', 'PowerShellTool', 'GlobTool'])
const PATH_TOOLS = new Set(['GrepTool'])

export class ToolExecutor {
  private tools: Map<string, Tool>
  private toolSettings: Map<string, ToolSettings>
  private alwaysAllowed: Set<string> = new Set()
  private permissionMode: PermissionMode = 'MANUAL'
  private workspacePath: string | null = null

  setPermissionMode(mode: PermissionMode): void {
    this.permissionMode = mode
  }

  getPermissionMode(): PermissionMode {
    return this.permissionMode
  }

  /**
   * Sets the active workspace path. Tools that accept cwd/path will
   * default to this instead of process.cwd() (which is the Electron
   * install directory — not useful and potentially dangerous).
   */
  setWorkspacePath(path: string | null): void {
    this.workspacePath = path
    // Synchronize with the security validation module
    setWorkspaceRoot(path)
  }

  getWorkspacePath(): string | null {
    return this.workspacePath
  }

  constructor() {
    this.tools = new Map()
    this.toolSettings = new Map()
    this.registerDefaultTools()
  }

  private registerDefaultTools(): void {
    const toolInstances: Tool[] = [
      new BashTool(),
      new FileReadTool(),
      new FileWriteTool(),
      new FileEditTool(),
      new GlobTool(),
      new GrepTool(),
      new WebFetchTool(),
      new WebSearchTool(),
      new TodoWriteTool(),
      new PowerShellTool(),
      new SleepTool(),
      new ListDirTool(),
      new FileDeleteTool(),
      new FileMoveTool(),
      new MultiFileEditTool(),
      new GitTool(),
      new TerminalTool(),
      new NotebookTool(),
      new DiffTool(),
      new ImageReadTool(),
      new FileSearchTool(),
      new ClipboardTool(),
      new ArchiveTool(),
      new HttpTool(),
      new EnvTool(),
      new SymbolQueryTool()
    ]

    for (const tool of toolInstances) {
      this.tools.set(tool.name, tool)
    }
  }

  refreshMcpTools(): void {
    for (const name of Array.from(this.tools.keys())) {
      if (name.startsWith('MCP_')) this.tools.delete(name)
    }
    for (const tool of mcpServerManager.getTools()) {
      const dynamicTool = new McpDynamicTool(
        tool.serverId,
        tool.serverName,
        tool.name,
        tool.description,
        tool.inputSchema
      )
      this.tools.set(dynamicTool.name, dynamicTool)
    }
  }

  /**
   * Updates tool settings from the database.
   */
  updateToolSettings(settings: ToolSettings[]): void {
    this.toolSettings.clear()
    for (const s of settings) {
      this.toolSettings.set(s.name, s)
    }
  }

  /**
   * Gets the list of available tools for the AI provider.
   */
  getAvailableTools(): Tool[] {
    this.refreshMcpTools()
    return Array.from(this.tools.values()).filter((tool) => {
      const settings = this.toolSettings.get(tool.name)
      // If no settings found, default to enabled
      return settings ? settings.enabled : true
    })
  }

  /**
   * Executes multiple tool calls, running read-only tools concurrently
   * and write tools serially. Up to MAX_CONCURRENCY parallel executions.
   */
  async executeTools(
    toolCalls: Array<{ id: string; toolName: string; input: Record<string, unknown> }>,
    signal?: AbortSignal
  ): Promise<Array<{ id: string; toolName: string; input: Record<string, unknown>; result: string }>> {
    // Partition into batches: consecutive read-only tools run in parallel
    const batches: Array<{ concurrent: boolean; calls: typeof toolCalls }> = []
    for (const call of toolCalls) {
      const isReadOnly = READ_ONLY_TOOLS.has(call.toolName) ||
        (this.tools.get(call.toolName)?.isReadOnly === true)
      const last = batches[batches.length - 1]
      if (isReadOnly && last?.concurrent) {
        last.calls.push(call)
      } else {
        batches.push({ concurrent: isReadOnly, calls: [call] })
      }
    }

    const results: Array<{ id: string; toolName: string; input: Record<string, unknown>; result: string }> = []
    let circuitBroken = false

    for (const batch of batches) {
      if (circuitBroken) {
        for (const call of batch.calls) {
          results.push({
            id: call.id,
            toolName: call.toolName,
            input: call.input,
            result: 'Skipped because a previous tool execution was denied or failed.'
          })
        }
        continue
      }
      if (batch.concurrent && batch.calls.length > 1) {
        // Run read-only tools in parallel (capped at MAX_CONCURRENCY)
        const chunks: typeof toolCalls[] = []
        for (let i = 0; i < batch.calls.length; i += MAX_CONCURRENCY) {
          chunks.push(batch.calls.slice(i, i + MAX_CONCURRENCY))
        }
        for (const chunk of chunks) {
          const chunkResults = await Promise.all(
            chunk.map(async (call) => {
              if (circuitBroken) {
                return {
                  id: call.id,
                  toolName: call.toolName,
                  input: call.input,
                  result: 'Skipped because a previous tool execution was denied or failed.'
                }
              }
              const res = await this.executeTool(call.toolName, call.input, signal)
              if (res.isError) {
                circuitBroken = true
              }
              return {
                id: call.id,
                toolName: call.toolName,
                input: call.input,
                result: res.output
              }
            })
          )
          results.push(...chunkResults)
        }
      } else {
        // Run serially
        for (const call of batch.calls) {
          if (circuitBroken) {
            results.push({
              id: call.id,
              toolName: call.toolName,
              input: call.input,
              result: 'Skipped because a previous tool execution was denied or failed.'
            })
            continue
          }
          const res = await this.executeTool(call.toolName, call.input, signal)
          if (res.isError) {
            circuitBroken = true
          }
          results.push({
            id: call.id,
            toolName: call.toolName,
            input: call.input,
            result: res.output
          })
        }
      }
    }
    return results;
  }

  /**
   * Executes a tool, returning a structured ToolResult.
   */
  async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<ToolResult> {
    const tool = this.tools.get(toolName)
    if (!tool && toolName.startsWith('MCP_')) {
      this.refreshMcpTools()
    }
    const refreshedTool = this.tools.get(toolName)
    if (!refreshedTool) {
      return { output: `Error: Unknown tool "${toolName}"`, isError: true, errorCode: 'UNKNOWN_TOOL' }
    }

    // Check if tool is enabled
    const settings = this.toolSettings.get(toolName)
    if (settings && !settings.enabled) {
      if (settings.permission === 'always-deny') {
        return { output: `Error: Tool "${toolName}" execution is denied by settings`, isError: true, errorCode: 'DISABLED' }
      }
      const approved = await this.requestApproval(refreshedTool, toolInput)
      if (!approved) {
        return { output: `Tool execution denied by user: ${toolName}`, isError: true, errorCode: 'DENIED' }
      }
    }

    const toolPermission = settings?.permission || (refreshedTool.requiresApproval ? 'always-ask' : 'always-allow')

    if (toolPermission === 'always-deny') {
      return { output: `Error: Tool "${toolName}" execution is denied by settings`, isError: true, errorCode: 'DISABLED' }
    }

    // Evaluate using permission mode + per-tool override
    const decision = evaluatePermission(toolName, this.permissionMode, toolPermission)
    if (!decision.autoApprove && !this.alwaysAllowed.has(toolName)) {
      const approved = await this.requestApproval(refreshedTool, toolInput)
      if (!approved) {
        return { output: `Tool execution denied by user: ${toolName}`, isError: true, errorCode: 'DENIED' }
      }
    }

    // Inject workspace path as default cwd/path if the tool accepts it
    const enrichedInput = { ...toolInput }
    if (this.workspacePath) {
      if (CWD_TOOLS.has(toolName) && !enrichedInput.cwd) {
        enrichedInput.cwd = this.workspacePath
      }
      if (PATH_TOOLS.has(toolName) && !enrichedInput.path) {
        enrichedInput.path = this.workspacePath
      }
    }

    // Execute the tool
    try {
      const output = await refreshedTool.execute(enrichedInput, signal)
      const isError = output.startsWith('[ERROR]') || output.startsWith('[SECURITY BLOCKED]') || output.startsWith('[BLOCKED]')
      return { output, isError, errorCode: isError ? 'EXECUTION_ERROR' : undefined }
    } catch (error) {
      return {
        output: `Error executing tool "${toolName}": ${(error as Error).message}`,
        isError: true,
        errorCode: 'EXECUTION_ERROR'
      }
    }
  }

  /**
   * Requests user approval for a tool execution via IPC.
   */
  private async requestApproval(
    tool: Tool,
    toolInput: Record<string, unknown>
  ): Promise<boolean> {
    const window =
      BrowserWindow.getFocusedWindow() ||
      BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed())
    if (!window) return false

    const requestId = uuidv4()
    const request: ToolApprovalRequest = {
      requestId,
      toolName: tool.name,
      toolDescription: tool.description,
      toolInput,
      workingDirectory: (toolInput.cwd as string) || this.workspacePath || 'No workspace bound'
    }

    // Send approval request to renderer
    window.webContents.send(IPC.TOOL_APPROVAL_REQUEST, request)
    window.webContents.send(IPC.GRPC_ACTION_REQUIRED, request)

    // Wait for response
    return new Promise<boolean>((resolve) => {
      pendingApprovals.set(requestId, {
        resolve: (response: ToolApprovalResponse) => {
          if (response.alwaysAllow) {
            this.alwaysAllowed.add(tool.name)
          }
          resolve(response.approved)
        }
      })

      // Timeout after 5 minutes
      setTimeout(() => {
        if (pendingApprovals.has(requestId)) {
          pendingApprovals.delete(requestId)
          resolve(false)
        }
      }, 5 * 60 * 1000)
    })
  }

  /**
   * Handles an approval response from the renderer.
   */
  static handleApprovalResponse(response: ToolApprovalResponse): void {
    const pending = pendingApprovals.get(response.requestId)
    if (pending) {
      pendingApprovals.delete(response.requestId)
      pending.resolve(response)
    }
  }
}
