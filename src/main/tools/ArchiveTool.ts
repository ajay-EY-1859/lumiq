// ═══════════════════════════════════════════════════════════════════
// Lumiq — ArchiveTool
// Create and extract archive files (ZIP, TAR, TAR.GZ)
// ═══════════════════════════════════════════════════════════════════

import { execSync } from 'child_process'
import { existsSync, statSync, mkdirSync } from 'fs'
import { extname } from 'path'
import type { Tool } from './Tool'
import { validatePathWithinWorkspace } from '../security/pathValidation'

type ArchiveFormat = 'zip' | 'tar' | 'tar.gz' | 'tgz'
type ArchiveAction = 'create' | 'extract'

interface ArchiveInput {
  action: ArchiveAction
  format?: ArchiveFormat
  source?: string
  destination?: string
  path?: string
}

export class ArchiveTool implements Tool {
  name = 'ArchiveTool'
  description = 'Create and extract archive files (ZIP, TAR, TAR.GZ)'
  requiresApproval = true
  isReadOnly = false
  inputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['create', 'extract'],
        description: 'Archive action'
      },
      format: {
        type: 'string',
        enum: ['zip', 'tar', 'tar.gz', 'tgz'],
        description: 'Archive format (required for action: "create")'
      },
      source: {
        type: 'string',
        description: 'Source directory (for create) or archive file (for extract)'
      },
      destination: {
        type: 'string',
        description: 'Destination path (output for create, extract location for extract)'
      },
      path: {
        type: 'string',
        description: 'Alternative name for source/destination (for compatibility)'
      }
    },
    required: ['action']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const action = input.action as ArchiveAction

    if (!['create', 'extract'].includes(action)) {
      return `[ERROR] Invalid action: ${action}. Use "create" or "extract"`
    }

    const archiveInput = input as unknown as ArchiveInput

    if (action === 'create') {
      return this.createArchive(archiveInput)
    } else {
      return this.extractArchive(archiveInput)
    }
  }

  private createArchive(input: ArchiveInput): string {
    const format = input.format as ArchiveFormat
    const source = (input.source || input.path) as string

    if (!format || !['zip', 'tar', 'tar.gz', 'tgz'].includes(format)) {
      return '[ERROR] "format" is required: zip, tar, tar.gz, or tgz'
    }

    if (!source) {
      return '[ERROR] "source" or "path" is required'
    }

    if (!input.destination) {
      return '[ERROR] "destination" is required'
    }

    let sourcePath: string
    let destPath: string

    try {
      sourcePath = validatePathWithinWorkspace(source)
      destPath = validatePathWithinWorkspace(input.destination)
    } catch (error) {
      return `[ERROR] ${(error as Error).message}`
    }

    if (!existsSync(sourcePath)) {
      return `[ERROR] Source not found: ${sourcePath}`
    }

    const stat = statSync(sourcePath)
    if (!stat.isDirectory() && !stat.isFile()) {
      return `[ERROR] Source is not a file or directory: ${sourcePath}`
    }

    try {
      let command = ''

      if (format === 'zip') {
        // Use zip command
        command = `zip -r "${destPath}" "${sourcePath}"`
      } else if (format === 'tar') {
        command = `tar -cf "${destPath}" -C "${sourcePath}" .`
      } else if (format === 'tar.gz' || format === 'tgz') {
        command = `tar -czf "${destPath}" -C "${sourcePath}" .`
      }

      execSync(command, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000
      })

      const size = statSync(destPath).size
      return `[OK] Created ${format.toUpperCase()} archive: ${destPath} (${(size / 1024).toFixed(2)} KB)`
    } catch (error) {
      return `[ERROR] Failed to create archive: ${(error as Error).message}`
    }
  }

  private extractArchive(input: ArchiveInput): string {
    const source = (input.source || input.path) as string

    if (!source) {
      return '[ERROR] "source" or "path" is required'
    }

    if (!input.destination) {
      return '[ERROR] "destination" is required'
    }

    let sourcePath: string
    let destPath: string

    try {
      sourcePath = validatePathWithinWorkspace(source)
      destPath = validatePathWithinWorkspace(input.destination)
    } catch (error) {
      return `[ERROR] ${(error as Error).message}`
    }

    if (!existsSync(sourcePath)) {
      return `[ERROR] Archive not found: ${sourcePath}`
    }

    if (!existsSync(destPath)) {
      try {
        mkdirSync(destPath, { recursive: true })
      } catch (error) {
        return `[ERROR] Failed to create destination directory: ${(error as Error).message}`
      }
    }

    try {
      const ext = extname(sourcePath).toLowerCase()
      let command = ''

      if (ext === '.zip') {
        command = `unzip -q "${sourcePath}" -d "${destPath}"`
      } else if (ext === '.gz') {
        command = `tar -xzf "${sourcePath}" -C "${destPath}"`
      } else if (ext === '.tar') {
        command = `tar -xf "${sourcePath}" -C "${destPath}"`
      } else {
        return `[ERROR] Unsupported archive format: ${ext}`
      }

      execSync(command, {
        stdio: ['pipe', 'pipe', 'pipe'],
        timeout: 60000
      })

      return `[OK] Extracted archive to: ${destPath}`
    } catch (error) {
      return `[ERROR] Failed to extract archive: ${(error as Error).message}`
    }
  }
}
