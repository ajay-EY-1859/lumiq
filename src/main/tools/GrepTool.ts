// ═══════════════════════════════════════════════════════════════════
// Lumiq — GrepTool (Search file contents)
// ═══════════════════════════════════════════════════════════════════

import { readdirSync, readFileSync, realpathSync, statSync } from 'fs'
import { join, relative } from 'path'
import type { Tool } from './Tool'
import { validatePathWithinWorkspace, getWorkspaceRoot } from '../security/pathValidation'

const MAX_RESULTS = 200
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp',
  '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.sqlite', '.db'
])
const IGNORED_DIRS = new Set(['node_modules', '.git', '.svn', '__pycache__', 'dist', 'out'])

interface GrepMatch {
  file: string
  line: number
  content: string
}

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
    const matches: GrepMatch[] = []
    const visited = new Set<string>()

    let regex: RegExp
    try {
      regex = new RegExp(pattern, 'i')
    } catch {
      regex = new RegExp(pattern.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i')
    }

    try {
      searchFiles(searchPath, searchPath, regex, matches, includeFilter, visited)

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

function searchFiles(
  base: string,
  dir: string,
  pattern: RegExp,
  matches: GrepMatch[],
  includeFilter: string | undefined,
  visited: Set<string>
): void {
  if (matches.length >= MAX_RESULTS * 2) return

  let stat
  try {
    stat = statSync(dir)
  } catch {
    return
  }

  if (stat.isFile()) {
    searchFile(base, dir, pattern, matches)
    return
  }

  let realDir
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

    if (entry.isDirectory()) {
      if (entry.isSymbolicLink()) {
        let target
        try {
          target = realpathSync(fullPath)
        } catch {
          continue
        }
        if (visited.has(target)) continue
      }
      searchFiles(base, fullPath, pattern, matches, includeFilter, visited)
    } else if (entry.isFile()) {
      const ext = entry.name.substring(entry.name.lastIndexOf('.'))
      if (BINARY_EXTENSIONS.has(ext.toLowerCase())) continue
      if (includeFilter && !matchesFilter(entry.name, includeFilter)) continue

      searchFile(base, fullPath, pattern, matches)
    }
  }
}

function searchFile(base: string, filePath: string, pattern: RegExp, matches: GrepMatch[]): void {
  try {
    const stat = statSync(filePath)
    if (stat.size > MAX_FILE_SIZE) return

    const content = readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    const relPath = relative(base, filePath)

    for (let i = 0; i < lines.length; i++) {
      pattern.lastIndex = 0 // Reset regex state
      if (pattern.test(lines[i])) {
        matches.push({ file: relPath, line: i + 1, content: lines[i] })
      }
    }
  } catch {
    // Skip unreadable files silently
  }
}

function matchesFilter(filename: string, filter: string): boolean {
  const regex = new RegExp(
    '^' + filter.replace(/[.+^${}()|[\]\\]/g, '\\$&').replace(/\\\*/g, '.*').replace(/\\\?/g, '[^\\/]').replace(/\\\|/g, '|') + '$',
    'i'
  )
  return regex.test(filename)
}
