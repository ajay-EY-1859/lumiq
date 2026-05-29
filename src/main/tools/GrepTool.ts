// ═══════════════════════════════════════════════════════════════════
// Lumiq — GrepTool (Search file contents)
// ═══════════════════════════════════════════════════════════════════

import type { Tool } from './Tool'
import { validatePathWithinWorkspace, getWorkspaceRoot } from '../security/pathValidation'
import { RegexSandbox } from '../security/RegexSandbox'

const MAX_RESULTS = 200

export class GrepTool implements Tool {
  name = 'GrepTool'
  description = 'Search file contents for a pattern (like grep/ripgrep)'
  requiresApproval = false
  isReadOnly = true
  inputSchema = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'Search pattern (regex supported)' },
      path: { type: 'string', description: 'Directory or file to search (default: current dir)' },
      include: { type: 'string', description: 'File extension filter (e.g., "*.ts")' }
    },
    required: ['pattern']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const pattern = input.pattern as string
    const searchPath = validatePathWithinWorkspace((input.path as string) || getWorkspaceRoot())
    const includeFilter = input.include as string | undefined

    try {
      const matches = await RegexSandbox.runGrep(pattern, searchPath, includeFilter)

      if (matches.length === 0) {
        return `No matches found for "${pattern}"`
      }

      const truncated = matches.length > MAX_RESULTS
      const output = matches
        .slice(0, MAX_RESULTS)
        .map((m) => `${m.file}:${m.line}: ${m.content.trim()}`)
        .join('\n')

      return truncated
        ? `${output}\n\n... and ${matches.length - MAX_RESULTS} more matches`
        : output
    } catch (e) {
      return `[ERROR] ${(e as Error).message}`
    }
  }
}

