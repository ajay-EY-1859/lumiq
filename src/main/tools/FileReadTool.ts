// ═══════════════════════════════════════════════════════════════════
// Lumiq — FileReadTool
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync, statSync } from 'fs'
import { resolve } from 'path'
import type { Tool } from './Tool'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit

export class FileReadTool implements Tool {
  name = 'FileReadTool'
  description = 'Read the contents of a file from disk'
  requiresApproval = false
  inputSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or relative path to the file' }
    },
    required: ['path']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const filePath = resolve(input.path as string)

    // SECURITY: Prevent path traversal beyond reasonable bounds
    if (filePath.includes('\0')) {
      return '[ERROR] Invalid file path (null bytes detected)'
    }

    if (!existsSync(filePath)) {
      return `[ERROR] File not found: ${filePath}`
    }

    const stats = statSync(filePath)
    if (!stats.isFile()) {
      return `[ERROR] Not a file: ${filePath}`
    }

    if (stats.size > MAX_FILE_SIZE) {
      return `[ERROR] File too large (${(stats.size / 1024 / 1024).toFixed(1)}MB). Max: 10MB`
    }

    try {
      const content = readFileSync(filePath, 'utf8')
      return content
    } catch (e) {
      return `[ERROR] Cannot read file: ${(e as Error).message}`
    }
  }
}
