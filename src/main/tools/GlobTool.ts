// ═══════════════════════════════════════════════════════════════════
// Lumiq — GlobTool (Find files by pattern)
// ═══════════════════════════════════════════════════════════════════

import { readdirSync, realpathSync } from 'fs'
import { join, relative } from 'path'
import type { Tool } from './Tool'
import { validatePathWithinWorkspace } from '../security/pathValidation'

const MAX_RESULTS = 500
const IGNORED_DIRS = new Set(['node_modules', '.git', '.svn', '__pycache__', '.next', 'dist', 'out'])

export class GlobTool implements Tool {
  name = 'GlobTool'
  description = 'Find files matching a glob-like pattern in a directory'
  requiresApproval = false
  isReadOnly = true
  inputSchema = {
    type: 'object',
    properties: {
      pattern: { type: 'string', description: 'File pattern (e.g., "*.ts", "**/*.tsx")' },
      cwd: { type: 'string', description: 'Directory to search in (default: current)' }
    },
    required: ['pattern']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const rawPattern = input.pattern as string
    const cwd = validatePathWithinWorkspace((input.cwd as string) || process.cwd())
    const results: string[] = []
    const visited = new Set<string>()
    const isNegated = rawPattern.startsWith('!')
    const pattern = isNegated ? rawPattern.slice(1) : rawPattern

    // Convert glob pattern to regex
    const regex = globToRegex(pattern)

    try {
      walkDir(cwd, cwd, regex, results, visited, isNegated)
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

function walkDir(
  base: string,
  dir: string,
  pattern: RegExp,
  results: string[],
  visited: Set<string>,
  exclude: boolean
): void {
  if (results.length >= MAX_RESULTS * 2) return

  let realDir: string
  try {
    realDir = realpathSync(dir)
  } catch {
    return
  }

  if (visited.has(realDir)) return
  visited.add(realDir)

  let entries
  try {
    entries = readdirSync(dir, { withFileTypes: true })
  } catch {
    return
  }

  for (const entry of entries) {
    if (IGNORED_DIRS.has(entry.name)) continue

    const fullPath = join(dir, entry.name)
    const relPath = relative(base, fullPath)

    if (entry.isDirectory()) {
      if (entry.isSymbolicLink()) {
        let linkTarget
        try {
          linkTarget = realpathSync(fullPath)
        } catch {
          continue
        }
        if (visited.has(linkTarget)) continue
      }
      walkDir(base, fullPath, pattern, results, visited, exclude)
    } else if (entry.isFile()) {
      const matches = pattern.test(relPath) || pattern.test(entry.name)
      if ((exclude && !matches) || (!exclude && matches)) {
        results.push(relPath)
      }
    }
  }
}

function globToRegex(glob: string): RegExp {
  let pattern = glob

  // Support brace alternatives {a,b}
  pattern = pattern.replace(/\{([^}]+)\}/g, (_match, group) => {
    return `(${group.split(',').map((segment) => segment.trim()).join('|')})`
  })

  pattern = pattern.replace(/\*\*/g, '___DOUBLE_STAR___')
  const escaped = pattern
    .replace(/[.+^${}()|[\]\\]/g, '\\$&')
    .replace(/___DOUBLE_STAR___/g, '.*')
    .replace(/\\\*/g, '[^/\\]*')
    .replace(/\\\?/g, '[^/\\]')
  return new RegExp(`(^|[\\\\/])${escaped}$`, 'i')
}
