// ═══════════════════════════════════════════════════════════════════
// Lumiq — Tool Interface
// All tools implement this interface.
// ═══════════════════════════════════════════════════════════════════

export interface Tool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  requiresApproval: boolean
  isReadOnly?: boolean
  execute(input: Record<string, unknown>, signal?: AbortSignal): Promise<string>
}

/** Structured tool execution result — use instead of raw error strings */
export interface ToolResult {
  output: string
  isError: boolean
  errorCode?: 'DENIED' | 'DISABLED' | 'UNKNOWN_TOOL' | 'EXECUTION_ERROR' | 'SECURITY_BLOCKED'
}
