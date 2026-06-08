// ═══════════════════════════════════════════════════════════════════
// Lumiq — FileReadTool
// ═══════════════════════════════════════════════════════════════════

import { closeSync, existsSync, openSync, readFileSync, readSync, statSync } from 'fs'
import type { Tool } from './Tool'
import { validatePathWithinWorkspace } from '../security/pathValidation'
import { getService } from '@shared/instantiation/instantiationService'
import { IComposerService } from '@shared/services'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB limit

export class FileReadTool implements Tool {
  name = 'FileReadTool'
  description = 'Read the contents of a file from disk'
  requiresApproval = false
  isReadOnly = true
  inputSchema = {
    type: 'object',
    properties: {
      path: { type: 'string', description: 'Absolute or relative path to the file' }
    },
    required: ['path']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    let filePath: string
    try {
      filePath = validatePathWithinWorkspace(input.path as string)
    } catch (error) {
      return `[ERROR] ${(error as Error).message}`
    }

    const composer = getService(IComposerService)
    const isStaging = composer.isStagingActive()

    if (isStaging) {
      if (composer.isStagedDeleted(filePath)) {
        return `[ERROR] File not found: ${filePath}`
      }
      const stagedContent = composer.getStagedContent(filePath)
      if (stagedContent !== undefined) {
        if (stagedContent.length > MAX_FILE_SIZE) {
          return `[ERROR] File too large (${(stagedContent.length / 1024 / 1024).toFixed(1)}MB). Max: 10MB`
        }
        return stagedContent
      }
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

    if (looksLikeBinary(filePath)) {
      return '[ERROR] File appears to be binary or non-text. Use a different tool.'
    }

    try {
      const content = readFileSync(filePath, 'utf8')
      return content
    } catch (e) {
      return `[ERROR] Cannot read file: ${(e as Error).message}`
    }
  }
}

function looksLikeBinary(filePath: string): boolean {
  const fd = openSync(filePath, 'r')
  const buffer = Buffer.alloc(512)
  try {
    const bytesRead = readSync(fd, buffer, 0, 512, 0)
    for (let i = 0; i < bytesRead; i++) {
      const byte = buffer[i]
      if (byte === 0) return true
      if (byte < 7 || (byte > 13 && byte < 32)) return true
    }
  } finally {
    closeSync(fd)
  }
  return false
}
