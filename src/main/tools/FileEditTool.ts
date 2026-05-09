// ═══════════════════════════════════════════════════════════════════
// Lumiq — FileEditTool
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, writeFileSync, existsSync } from 'fs'
import { resolve } from 'path'
import type { Tool } from './Tool'

export class FileEditTool implements Tool {
  name = 'FileEditTool'
  description = 'Edit a file by replacing specific text. Shows a diff for review.'
  requiresApproval = true
  inputSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Path to the file to edit' },
      old_string: { type: 'string', description: 'The exact text to find and replace' },
      new_string: { type: 'string', description: 'The replacement text' }
    },
    required: ['path', 'old_string', 'new_string']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const filePath = resolve(input.path as string)
    const oldString = input.old_string as string
    const newString = input.new_string as string

    if (filePath.includes('\0')) {
      return '[ERROR] Invalid file path'
    }

    if (!existsSync(filePath)) {
      return `[ERROR] File not found: ${filePath}`
    }

    try {
      const content = readFileSync(filePath, 'utf8')

      if (!content.includes(oldString)) {
        return `[ERROR] Could not find the specified text in ${filePath}`
      }

      // Count occurrences
      const occurrences = content.split(oldString).length - 1
      if (occurrences > 1) {
        return `[WARNING] Found ${occurrences} occurrences of the target text. Please provide more specific text to ensure only the intended occurrence is replaced.`
      }

      const newContent = content.replace(oldString, newString)
      writeFileSync(filePath, newContent, 'utf8')

      // Generate diff for display
      const diff = generateDiff(oldString, newString)
      return `[OK] File edited successfully.\n\n${diff}`
    } catch (e) {
      return `[ERROR] Cannot edit file: ${(e as Error).message}`
    }
  }
}

function generateDiff(oldStr: string, newStr: string): string {
  const oldLines = oldStr.split('\n')
  const newLines = newStr.split('\n')

  let diff = '```diff\n'
  for (const line of oldLines) {
    diff += `- ${line}\n`
  }
  for (const line of newLines) {
    diff += `+ ${line}\n`
  }
  diff += '```'
  return diff
}
