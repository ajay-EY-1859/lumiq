// ═══════════════════════════════════════════════════════════════════
// Lumiq — Request/Response Trace Logger
// Securely audits and logs LLM completion payloads and tool execution traces
// for local debugging and auditing. Includes a sliding file rotation policy.
// ═══════════════════════════════════════════════════════════════════

import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync, readdirSync, statSync, unlinkSync } from 'fs'

export interface TracePayload {
  timestamp: string
  sessionId: string
  provider: string
  model: string
  systemPrompt?: string
  messages: Array<{
    role: string
    content: string
    toolName?: string
    toolCallId?: string
    toolInput?: any
    toolResult?: string
  }>
  response: {
    content: string
    tokensUsed: number
    toolCalls?: Array<{
      id: string
      toolName: string
      input: any
    }>
  }
}

export class TraceLogger {
  private static MAX_TRACE_FILES = 50

  /**
   * Gets the path to the traces folder.
   */
  private static getTracesDir(): string {
    const userDataPath = app.getPath('userData')
    const tracesDir = join(userDataPath, 'traces')
    if (!existsSync(tracesDir)) {
      mkdirSync(tracesDir, { recursive: true })
    }
    return tracesDir
  }

  /**
   * Logs a single LLM request/response exchange trace to disk.
   */
  static log(payload: TracePayload): void {
    try {
      const tracesDir = this.getTracesDir()
      const fileName = `trace_${payload.sessionId}_${Date.now()}.json`
      const filePath = join(tracesDir, fileName)

      writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
      console.log(`[TraceLogger] Successfully wrote trace log: ${fileName}`)

      // Run rotation policy to prune oldest traces
      this.rotate()
    } catch (err) {
      console.error('[TraceLogger] Failed to write trace log:', err)
    }
  }

  /**
   * Rotates trace files by deleting the oldest ones once count exceeds limit.
   */
  private static rotate(): void {
    try {
      const tracesDir = this.getTracesDir()
      const files = readdirSync(tracesDir)
        .filter(f => f.startsWith('trace_') && f.endsWith('.json'))
        .map(name => {
          const path = join(tracesDir, name)
          return {
            name,
            path,
            mtime: statSync(path).mtimeMs
          }
        })

      if (files.length > this.MAX_TRACE_FILES) {
        // Sort oldest first
        files.sort((a, b) => a.mtime - b.mtime)
        const toDeleteCount = files.length - this.MAX_TRACE_FILES

        for (let i = 0; i < toDeleteCount; i++) {
          try {
            unlinkSync(files[i].path)
            console.log(`[TraceLogger] Pruned old trace file: ${files[i].name}`)
          } catch (deleteErr) {
            console.error(`[TraceLogger] Failed to prune trace file ${files[i].name}:`, deleteErr)
          }
        }
      }
    } catch (err) {
      console.error('[TraceLogger] Trace rotation policy execution failed:', err)
    }
  }

  /**
   * Gets all trace logs files metadata.
   */
  static listTraces(): Array<{ name: string; sizeBytes: number; createdAt: string }> {
    try {
      const tracesDir = this.getTracesDir()
      return readdirSync(tracesDir)
        .filter(f => f.startsWith('trace_') && f.endsWith('.json'))
        .map(name => {
          const path = join(tracesDir, name)
          const stats = statSync(path)
          return {
            name,
            sizeBytes: stats.size,
            createdAt: stats.birthtime.toISOString()
          }
        })
    } catch {
      return []
    }
  }
}
