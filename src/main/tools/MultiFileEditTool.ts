// ═══════════════════════════════════════════════════════════════════
// Lumiq — MultiFileEditTool
// Edit multiple files atomically with rollback on failure
// ═══════════════════════════════════════════════════════════════════

import { existsSync, readFileSync, writeFileSync } from 'fs'
import type { Tool } from './Tool'
import { validatePathWithinWorkspace } from '../security/pathValidation'

interface EditOperation {
  path: string
  oldString: string
  newString: string
}

export class MultiFileEditTool implements Tool {
  name = 'MultiFileEditTool'
  description = 'Edit multiple files atomically with rollback on failure'
  requiresApproval = true
  isReadOnly = false
  inputSchema = {
    type: 'object',
    properties: {
      edits: {
        type: 'array',
        description: 'Array of edit operations',
        items: {
          type: 'object',
          properties: {
            path: { type: 'string', description: 'Path to the file' },
            oldString: { type: 'string', description: 'String to find and replace' },
            newString: { type: 'string', description: 'String to replace with' }
          },
          required: ['path', 'oldString', 'newString']
        }
      }
    },
    required: ['edits']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const edits = (input.edits as EditOperation[]) || []

    if (!Array.isArray(edits) || edits.length === 0) {
      return '[ERROR] edits must be a non-empty array'
    }

    // Validate all edits first
    const validationErrors = this.validateEdits(edits)
    if (validationErrors.length > 0) {
      return '[ERROR] Validation failed:\n' + validationErrors.join('\n')
    }

    // Store backup for rollback
    const backups = new Map<string, string>()

    try {
      // Phase 1: Read all files and validate changes
      const changes = new Map<string, string>()

      for (const edit of edits) {
        let filePath: string
        try {
          filePath = validatePathWithinWorkspace(edit.path)
        } catch (error) {
          throw new Error(`Invalid path ${edit.path}: ${(error as Error).message}`)
        }

        if (!existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`)
        }

        const content = readFileSync(filePath, 'utf8')
        backups.set(filePath, content)

        // Check if oldString exists
        if (!content.includes(edit.oldString)) {
          throw new Error(`String not found in ${filePath}: "${edit.oldString.substring(0, 50)}..."`)
        }

        // Apply the edit
        const newContent = content.replace(edit.oldString, edit.newString)
        changes.set(filePath, newContent)
      }

      // Phase 2: Write all changes (atomic from tool perspective)
      for (const [filePath, newContent] of changes.entries()) {
        writeFileSync(filePath, newContent, 'utf8')
      }

      const summary = `[OK] Edited ${edits.length} file(s) atomically:\n`
      const filesList = Array.from(changes.keys())
        .map((p, i) => `  ${i + 1}. ${p}`)
        .join('\n')

      return summary + filesList
    } catch (error) {
      // Rollback on error
      for (const [filePath, originalContent] of backups.entries()) {
        try {
          writeFileSync(filePath, originalContent, 'utf8')
        } catch (rollbackError) {
          console.error(`Failed to rollback ${filePath}:`, rollbackError)
        }
      }

      return `[ERROR] Transaction rolled back. ${(error as Error).message}`
    }
  }

  private validateEdits(edits: EditOperation[]): string[] {
    const errors: string[] = []

    for (let i = 0; i < edits.length; i++) {
      const edit = edits[i]

      if (typeof edit.path !== 'string' || !edit.path) {
        errors.push(`  [${i}] Missing or invalid path`)
      }

      if (typeof edit.oldString !== 'string') {
        errors.push(`  [${i}] oldString must be a string`)
      }

      if (typeof edit.newString !== 'string') {
        errors.push(`  [${i}] newString must be a string`)
      }

      if (edit.oldString === edit.newString) {
        errors.push(`  [${i}] oldString and newString are identical: "${edit.oldString}"`)
      }
    }

    return errors
  }
}
