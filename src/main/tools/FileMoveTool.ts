// ═══════════════════════════════════════════════════════════════════
// Lumiq — FileMoveTool
// Move or rename files and directories with approval requirement
// ═══════════════════════════════════════════════════════════════════

import { existsSync, lstatSync, renameSync, copyFileSync, mkdirSync, readdirSync, rmSync } from 'fs'
import { dirname, join } from 'path'
import type { Tool } from './Tool'
import { validatePathWithinWorkspace } from '../security/pathValidation'

export class FileMoveTool implements Tool {
  name = 'FileMoveTool'
  description = 'Move or rename a file or directory (requires approval)'
  requiresApproval = true
  isReadOnly = false
  inputSchema = {
    type: 'object',
    properties: {
      source: {
        type: 'string',
        description: 'Absolute or relative path to the source file or directory'
      },
      destination: {
        type: 'string',
        description: 'Absolute or relative path to the destination'
      }
    },
    required: ['source', 'destination']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    let sourcePath: string
    let destPath: string

    try {
      sourcePath = validatePathWithinWorkspace(input.source as string)
      destPath = validatePathWithinWorkspace(input.destination as string)
    } catch (error) {
      return `[ERROR] ${(error as Error).message}`
    }

    if (!existsSync(sourcePath)) {
      return `[ERROR] Source not found: ${sourcePath}`
    }

    if (sourcePath === destPath) {
      return `[ERROR] Source and destination are the same: ${sourcePath}`
    }

    // Check if destination already exists
    if (existsSync(destPath)) {
      return `[ERROR] Destination already exists: ${destPath}. Please choose a different destination or delete it first.`
    }

    // Check if destination parent directory exists
    const destParent = dirname(destPath)
    if (!existsSync(destParent)) {
      return `[ERROR] Destination parent directory does not exist: ${destParent}`
    }

    try {
      const sourceStats = lstatSync(sourcePath)
      const isDirectory = sourceStats.isDirectory()

      // Use rename for most cases (cross-filesystem safe in Node 14+)
      renameSync(sourcePath, destPath)

      const action = sourcePath.endsWith(destPath.split('/').pop() || '') ? 'Renamed' : 'Moved'
      const type = isDirectory ? 'directory' : 'file'
      return `[OK] ${action} ${type} from ${sourcePath} to ${destPath}`
    } catch (error) {
      const message = (error as Error).message

      if (message.includes('EEXIST')) {
        return `[ERROR] Destination already exists: ${destPath}`
      }
      if (message.includes('EACCES')) {
        return `[ERROR] Permission denied`
      }
      if (message.includes('ENOENT')) {
        return `[ERROR] Source or destination path is invalid`
      }
      if (message.includes('EXDEV')) {
        // Cross-device link - try copy + delete approach
        try {
          await this.copyRecursive(sourcePath, destPath)
          rmSync(sourcePath, { recursive: true })
          return `[OK] Moved across filesystems: ${sourcePath} to ${destPath}`
        } catch (copyError) {
          return `[ERROR] Failed to move across filesystems: ${(copyError as Error).message}`
        }
      }

      return `[ERROR] Failed to move: ${message}`
    }
  }

  private async copyRecursive(source: string, destination: string): Promise<void> {
    const stat = lstatSync(source)

    if (stat.isDirectory()) {
      mkdirSync(destination, { recursive: true })
      const entries = readdirSync(source)

      for (const entry of entries) {
        const sourceEntry = join(source, entry)
        const destEntry = join(destination, entry)
        await this.copyRecursive(sourceEntry, destEntry)
      }
    } else if (stat.isSymbolicLink()) {
      // Skip symlinks
      return
    } else {
      copyFileSync(source, destination)
    }
  }
}
