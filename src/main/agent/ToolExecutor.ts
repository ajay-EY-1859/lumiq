// ═══════════════════════════════════════════════════════════════════
// Lumiq — Tool Executor
// Runs tools with approval flow. Dangerous tools (BashTool,
// FileWriteTool, FileEditTool) require user approval before execution.
// ═══════════════════════════════════════════════════════════════════

import { BrowserWindow } from 'electron'
import { v4 as uuidv4 } from 'uuid'
import { IPC } from '@shared/types'
import type { ToolApprovalRequest, ToolApprovalResponse, ToolSettings } from '@shared/types'
import type { Tool } from '../tools/Tool'

// Import all tools
import { BashTool } from '../tools/BashTool'
import { FileReadTool } from '../tools/FileReadTool'
import { FileWriteTool } from '../tools/FileWriteTool'
import { FileEditTool } from '../tools/FileEditTool'
import { GlobTool } from '../tools/GlobTool'
import { GrepTool } from '../tools/GrepTool'
import { WebFetchTool } from '../tools/WebFetchTool'

// Pending approval requests
const pendingApprovals = new Map<
  string,
  { resolve: (response: ToolApprovalResponse) => void }
>()

export class ToolExecutor {
  private tools: Map<string, Tool>
  private toolSettings: Map<string, ToolSettings>
  private alwaysAllowed: Set<string> = new Set()

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
      new WebFetchTool()
    ]

    for (const tool of toolInstances) {
      this.tools.set(tool.name, tool)
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
    return Array.from(this.tools.values()).filter((tool) => {
      const settings = this.toolSettings.get(tool.name)
      // If no settings found, default to enabled
      return settings ? settings.enabled : true
    })
  }

  /**
   * Executes a tool, potentially requesting user approval first.
   */
  async executeTool(
    toolName: string,
    toolInput: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<string> {
    const tool = this.tools.get(toolName)
    if (!tool) {
      return `Error: Unknown tool "${toolName}"`
    }

    // Check if tool is enabled
    const settings = this.toolSettings.get(toolName)
    if (settings && !settings.enabled) {
      return `Error: Tool "${toolName}" is disabled`
    }

    // Check permission
    const permission = settings?.permission || (tool.requiresApproval ? 'always-ask' : 'always-allow')

    if (permission === 'always-deny') {
      return `Error: Tool "${toolName}" execution is denied by settings`
    }

    // If requires approval and not always-allowed
    if (permission === 'always-ask' && !this.alwaysAllowed.has(toolName)) {
      const approved = await this.requestApproval(tool, toolInput)
      if (!approved) {
        return `Tool execution denied by user: ${toolName}`
      }
    }

    // Execute the tool
    try {
      return await tool.execute(toolInput, signal)
    } catch (error) {
      return `Error executing tool "${toolName}": ${(error as Error).message}`
    }
  }

  /**
   * Requests user approval for a tool execution via IPC.
   */
  private async requestApproval(
    tool: Tool,
    toolInput: Record<string, unknown>
  ): Promise<boolean> {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return false

    const requestId = uuidv4()
    const request: ToolApprovalRequest = {
      requestId,
      toolName: tool.name,
      toolDescription: tool.description,
      toolInput,
      workingDirectory: (toolInput.cwd as string) || process.cwd()
    }

    // Send approval request to renderer
    window.webContents.send(IPC.TOOL_APPROVAL_REQUEST, request)

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
