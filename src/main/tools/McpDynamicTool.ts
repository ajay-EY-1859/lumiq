import type { Tool } from './Tool'
import { mcpServerManager } from '../services/mcp/McpServerManager'

const MCP_CALL_TIMEOUT = 30_000
const MAX_OUTPUT_LENGTH = 50_000

export class McpDynamicTool implements Tool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  requiresApproval = true
  isReadOnly = false

  constructor(
    private readonly serverId: string,
    serverName: string,
    private readonly remoteToolName: string,
    description: string,
    inputSchema: Record<string, unknown>
  ) {
    this.name = `MCP_${serverName}_${remoteToolName}`.replace(/[^A-Za-z0-9_]/g, '_')
    this.description = `MCP ${serverName}: ${description || remoteToolName}`
    this.inputSchema = inputSchema
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const result = await Promise.race([
      mcpServerManager.callTool(this.serverId, this.remoteToolName, input),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('MCP tool call timed out')), MCP_CALL_TIMEOUT)
      )
    ])

    const output = typeof result === 'string' ? result : JSON.stringify(result, null, 2)
    return output.length > MAX_OUTPUT_LENGTH
      ? `${output.slice(0, MAX_OUTPUT_LENGTH)}\n\n...output truncated to ${MAX_OUTPUT_LENGTH} characters...`
      : output
  }
}
