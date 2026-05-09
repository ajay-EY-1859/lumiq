// ═══════════════════════════════════════════════════════════════════
// Lumiq — FileWriteTool
// ═══════════════════════════════════════════════════════════════════

import { writeFileSync, mkdirSync } from 'fs'
import { resolve, dirname } from 'path'
import type { Tool } from './Tool'

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
    const filePath = resolve(input.path as string)
    const content = input.content as string

    if (filePath.includes('\0')) {
      return '[ERROR] Invalid file path (null bytes detected)'
    }

    try {
      mkdirSync(dirname(filePath), { recursive: true })
      writeFileSync(filePath, content, 'utf8')
      return `[OK] Written ${content.length} characters to ${filePath}`
    } catch (e) {
      return `[ERROR] Cannot write file: ${(e as Error).message}`
    }
  }
}
