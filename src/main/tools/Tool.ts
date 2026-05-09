// ═══════════════════════════════════════════════════════════════════
// Lumiq — Tool Interface
// All tools implement this interface.
// ═══════════════════════════════════════════════════════════════════

export interface Tool {
  name: string
  description: string
  inputSchema: Record<string, unknown>
  requiresApproval: boolean
  execute(input: Record<string, unknown>, signal?: AbortSignal): Promise<string>
}
