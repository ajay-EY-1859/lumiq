// ═══════════════════════════════════════════════════════════════════
// Lumiq — Tool Interface
// All tools implement this interface.
// ═══════════════════════════════════════════════════════════════════

export interface Tool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  requiresApproval: boolean
  isReadOnly?: boolean // if true, can run concurrently with other read-only tools
  execute(input: Record<string, unknown>, signal?: AbortSignal): Promise<string>
}
