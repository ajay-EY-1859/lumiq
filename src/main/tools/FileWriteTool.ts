// ═══════════════════════════════════════════════════════════════════
// Lumiq — FileWriteTool
// ═══════════════════════════════════════════════════════════════════

import { existsSync, writeFileSync, mkdirSync } from 'fs'
import { dirname } from 'path'
import type { Tool } from './Tool'
import { validatePathWithinWorkspace } from '../security/pathValidation'

const MAX_CONTENT_SIZE = 1 * 1024 * 1024 // 1MB max write size

export class FileWriteTool implements Tool {
  name = 'FileWriteTool'
  description = 'Write content to a file (creates the file and directories if needed)'
  requiresApproval = true
  inputSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to write to' },
      content: { type: 'string', description: 'Content to write' }
    },
    required: ['path', 'content']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    let filePath: string
    const content = input.content as string

    if (typeof content !== 'string') {
      return '[ERROR] Content must be a string.'
    }

    if (content.length > MAX_CONTENT_SIZE) {
      return `[ERROR] Content too large (${content.length} bytes). Max allowed is ${MAX_CONTENT_SIZE} bytes.`
    }

    try {
      filePath = validatePathWithinWorkspace(input.path as string)
    } catch (error) {
      return `[ERROR] ${(error as Error).message}`
    }

    const existed = existsSync(filePath)

    try {
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, content, 'utf8')
      return `[OK] Written ${content.length} characters to ${filePath}${existed ? ' (overwrote existing file)' : ''}`
    } catch (e) {
      return `[ERROR] Cannot write file: ${(e as Error).message}`
    }
  }
}
