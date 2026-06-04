// ═══════════════════════════════════════════════════════════════════
// Lumiq — FileDeleteTool
// Safely delete files and directories with approval requirement
// ═══════════════════════════════════════════════════════════════════

import { existsSync, lstatSync, rmSync, readdirSync } from 'fs'
import type { Tool } from './Tool'
import { validatePathWithinWorkspace } from '../security/pathValidation'
import { ComposerService } from '../services/ComposerService'

export class FileDeleteTool implements Tool {
  name = 'FileDeleteTool'
  description = 'Delete a file or directory (requires approval)'
  requiresApproval = true
  isReadOnly = false
  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the file or directory to delete'
      },
      recursive: {
        type: 'boolean',
        description: 'Delete directories recursively (default: false). Required for non-empty directories.'
      }
    },
    required: ['path']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    let targetPath: string
    try {
      targetPath = validatePathWithinWorkspace(input.path as string)
    } catch (error) {
      return `[ERROR] ${(error as Error).message}`
    }

    const composer = ComposerService.getInstance()
    const isStaging = composer.isStagingActive()
    const isStagedDeleted = isStaging && composer.isStagedDeleted(targetPath)
    const existsInStagedFiles = isStaging && composer.getStagedContent(targetPath) !== undefined

    if (isStagedDeleted || (!existsInStagedFiles && !existsSync(targetPath))) {
      return `[ERROR] Path not found: ${targetPath}`
    }

    if (isStaging) {
      const type = (existsInStagedFiles || !lstatSync(targetPath).isDirectory()) ? 'file' : 'directory'
      composer.stageDelete(targetPath)
      return `[OK] Deleted ${type}: ${targetPath} (staged in memory)`
    }

    const stats = lstatSync(targetPath)
    const isDirectory = stats.isDirectory()
    const recursive = (input.recursive as boolean) || false

    // Check if it's a non-empty directory without recursive flag
    if (isDirectory && !recursive) {
      try {
        const entries = readdirSync(targetPath)
        if (entries.length > 0) {
          return `[ERROR] Directory is not empty: ${targetPath}. Set recursive: true to delete with contents.`
        }
      } catch (error) {
        return `[ERROR] Cannot check directory contents: ${(error as Error).message}`
      }
    }

    try {
      rmSync(targetPath, { recursive, force: false })
      const type = isDirectory ? 'directory' : 'file'
      return `[OK] Deleted ${type}: ${targetPath}`
    } catch (error) {
      const message = (error as Error).message
      if (message.includes('ENOTEMPTY')) {
        return `[ERROR] Directory not empty. Set recursive: true to delete contents.`
      }
      if (message.includes('EACCES')) {
        return `[ERROR] Permission denied: ${targetPath}`
      }
      return `[ERROR] Failed to delete: ${message}`
    }
  }
}
