// ═══════════════════════════════════════════════════════════════════
// Lumiq — GlobTool (Find files by pattern)
// ═══════════════════════════════════════════════════════════════════

import { readdirSync } from 'fs'
import { join, relative, resolve } from 'path'
import type { Tool } from './Tool'

const MAX_RESULTS = 500
const IGNORED_DIRS = new Set(['node_modules', '.git', '.svn', '__pycache__', '.next', 'dist', 'out'])

export class GlobTool implements Tool {
  name = 'GlobTool'
  description = 'Find files matching a glob-like pattern in a directory'
  requiresApproval = false
  inputSchema = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'File pattern (e.g., "*.ts", "**/*.tsx")' },
      cwd: { type: 'string', description: 'Directory to search in (default: current)' }
    },
    required: ['pattern']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const pattern = input.pattern as string
    const cwd = resolve((input.cwd as string) || process.cwd())
    const results: string[] = []

    // Convert glob pattern to regex
    const regex = globToRegex(pattern)

    try {
      walkDir(cwd, cwd, regex, results)
      if (results.length === 0) {
        return `No files matching "${pattern}" found in ${cwd}`
      }
      const truncated = results.length > MAX_RESULTS
      const output = results.slice(0, MAX_RESULTS).join('\n')
      return truncated
        ? `${output}\n\n... and ${results.length - MAX_RESULTS} more files (showing first ${MAX_RESULTS})`
        : output
    } catch (e) {
      return `[ERROR] ${(e as Error).message}`
    }
  }
}

function walkDir(base: string, dir: string, pattern: RegExp, results: string[]): void {
  if (results.length >= MAX_RESULTS * 2) return

  const entries = readdirSync(dir, { withFileTypes: true })
  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue

    const fullPath = join(dir, entry.name)
    const relPath = relative(base, fullPath)

    if (entry.isDirectory()) {
      walkDir(base, fullPath, pattern, results)
    } else if (entry.isFile()) {
      if (pattern.test(relPath) || pattern.test(entry.name)) {
        results.push(relPath)
      }
    }
  }
}

function globToRegex(glob: string): RegExp {
  const escaped = glob
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/\*\*/g, '___DOUBLE_STAR___')
    .replace(/\*/g, '[^/\\\\]*')
    .replace(/___DOUBLE_STAR___/g, '.*')
    .replace(/\?/g, '[^/\\\\]')
  return new RegExp(`(^|[\\\\/])${escaped}$`, 'i')
}
