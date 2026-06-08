// ═══════════════════════════════════════════════════════════════════
// Lumiq — FileEditTool
// ═══════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, statSync, writeFileSync } from 'fs'
import type { Tool } from './Tool'
import { validatePathWithinWorkspace } from '../security/pathValidation'
import { getService } from '@shared/instantiation/instantiationService'
import { IComposerService } from '@shared/services'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit

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
    let filePath: string
    const oldString = input.old_string as string
    const newString = input.new_string as string

    try {
      filePath = validatePathWithinWorkspace(input.path as string)
    } catch (error) {
      return `[ERROR] ${(error as Error).message}`
    }

    const composer = getService(IComposerService)
    const isStaging = composer.isStagingActive()
    const isStagedDeleted = isStaging && composer.isStagedDeleted(filePath)
    const stagedContent = isStaging ? composer.getStagedContent(filePath) : undefined

    if (isStagedDeleted || (!stagedContent && !existsSync(filePath))) {
      return `[ERROR] File not found: ${filePath}`
    }

    if (!oldString) {
      return '[ERROR] old_string cannot be empty.'
    }

    try {
      let content = ''
      if (stagedContent !== undefined) {
        if (stagedContent.length > MAX_FILE_SIZE) {
          return `[ERROR] File too large (${(stagedContent.length / 1024 / 1024).toFixed(1)}MB). Max: 10MB`
        }
        content = stagedContent
      } else {
        const stats = statSync(filePath)
        if (stats.size > MAX_FILE_SIZE) {
          return `[ERROR] File too large (${(stats.size / 1024 / 1024).toFixed(1)}MB). Max: 10MB`
        }
        content = readFileSync(filePath, 'utf8')
      }

      if (!content.includes(oldString)) {
        return `[ERROR] Could not find the specified text in ${filePath}`
      }

      // Count occurrences
      const occurrences = content.split(oldString).length - 1
      if (occurrences > 1) {
        return `[WARNING] Found ${occurrences} occurrences of the target text. Please provide more specific text to ensure only the intended occurrence is replaced.`
      }

      const newContent = content.replace(oldString, newString)

      if (isStaging) {
        composer.stageWrite(filePath, newContent)
      } else {
        writeFileSync(filePath, newContent, 'utf8')
      }

      // Generate diff for display
      const diff = generateDiff(oldString, newString)
      return `[OK] File edited successfully.${isStaging ? ' (staged in memory)' : ''}\n\n${diff}`
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
