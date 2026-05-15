// ═══════════════════════════════════════════════════════════════════
// Lumiq — ClipboardTool
// Read and write system clipboard
// ═══════════════════════════════════════════════════════════════════

import { clipboard } from 'electron'
import type { Tool } from './Tool'

const MAX_CLIPBOARD_SIZE = 10 * 1024 * 1024 // 10MB

export class ClipboardTool implements Tool {
  name = 'ClipboardTool'
  description = 'Read and write system clipboard'
  requiresApproval = true
  isReadOnly = false
  inputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['read', 'write'],
        description: 'Clipboard action'
      },
      content: {
        type: 'string',
        description: 'Content to write to clipboard (required for action: "write")'
      }
    },
    required: ['action']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const action = input.action as string

    if (!['read', 'write'].includes(action)) {
      return `[ERROR] Invalid action: ${action}. Use "read" or "write"`
    }

    try {
      if (action === 'read') {
        return this.readClipboard()
      } else {
        return this.writeClipboard(input.content as string)
      }
    } catch (error) {
      return `[ERROR] Clipboard operation failed: ${(error as Error).message}`
    }
  }

  private readClipboard(): string {
    try {
      const text = clipboard.readText()
      if (!text) {
        return '[OK] Clipboard is empty'
      }

      if (text.length > MAX_CLIPBOARD_SIZE) {
        return `[ERROR] Clipboard content too large (${(text.length / 1024 / 1024).toFixed(1)}MB). Max: 10MB`
      }

      return `[CLIPBOARD]\n${text}`
    } catch (error) {
      return `[ERROR] Failed to read clipboard: ${(error as Error).message}`
    }
  }

  private writeClipboard(content: string | undefined): string {
    if (!content) {
      return '[ERROR] "content" is required for action: "write"'
    }

    if (typeof content !== 'string') {
      return '[ERROR] "content" must be a string'
    }

    if (content.length > MAX_CLIPBOARD_SIZE) {
      return `[ERROR] Content too large (${(content.length / 1024 / 1024).toFixed(1)}MB). Max: 10MB`
    }

    try {
      clipboard.writeText(content)
      return `[OK] Wrote ${content.length} characters to clipboard`
    } catch (error) {
      return `[ERROR] Failed to write clipboard: ${(error as Error).message}`
    }
  }
}
