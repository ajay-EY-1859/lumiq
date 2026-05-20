// ═══════════════════════════════════════════════════════════════════
// Lumiq — Search Handlers (Find in Files)
// ═══════════════════════════════════════════════════════════════════

import { readdirSync, readFileSync, realpathSync, statSync } from 'fs'
import { join, relative, extname } from 'path'
import { IPC } from '@shared/types'
import type { SearchMatch, SearchRequest, SearchResponse } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

const MAX_RESULTS = 500
const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5 MB
const BINARY_EXTENSIONS = new Set([
  '.png', '.jpg', '.jpeg', '.gif', '.ico', '.bmp', '.webp',
  '.mp3', '.mp4', '.avi', '.mov', '.wav',
  '.zip', '.tar', '.gz', '.rar', '.7z',
  '.exe', '.dll', '.so', '.dylib',
  '.pdf', '.doc', '.docx', '.xls', '.xlsx',
  '.woff', '.woff2', '.ttf', '.eot', '.otf',
  '.sqlite', '.db'
])
const DEFAULT_IGNORED = new Set(['node_modules', '.git', '.svn', '__pycache__', 'dist', 'out', '.next', '.cache'])

export function registerSearchHandlers(): void {
  handleWithTimeout(IPC.SEARCH_FILES, IPC_TIMEOUT.long, (_event, request: SearchRequest): SearchResponse => {
    const start = Date.now()
    const { query, workspacePath, isRegex, caseSensitive, includePattern, excludePattern } = request

    if (!query || !workspacePath) {
      return { matches: [], totalMatches: 0, truncated: false, elapsed: 0 }
    }

    // Build regex
    let regex: RegExp
    const flags = caseSensitive ? 'g' : 'gi'
    try {
      regex = isRegex
        ? new RegExp(query, flags)
        : new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), flags)
    } catch {
      return { matches: [], totalMatches: 0, truncated: false, elapsed: Date.now() - start }
    }

    // Parse include/exclude patterns
    const includeExts = parseFilterPatterns(includePattern)
    const excludeDirs = new Set([...DEFAULT_IGNORED, ...parseFilterPatterns(excludePattern)])

    const matches: SearchMatch[] = []
    const visited = new Set<string>()

    walkAndSearch(workspacePath, workspacePath, regex, matches, includeExts, excludeDirs, visited)

    const elapsed = Date.now() - start
    const truncated = matches.length > MAX_RESULTS

    return {
      matches: matches.slice(0, MAX_RESULTS),
      totalMatches: matches.length,
      truncated,
      elapsed
    }
  })
}

function parseFilterPatterns(pattern: string | undefined): string[] {
  if (!pattern) return []
  return pattern
    .split(',')
    .map(p => p.trim().replace(/^\*\./, '.').replace(/^\*/, ''))
    .filter(Boolean)
}

function matchesInclude(fileName: string, includeExts: string[]): boolean {
  if (includeExts.length === 0) return true
  const ext = extname(fileName).toLowerCase()
  return includeExts.some(inc =>
    inc.startsWith('.') ? ext === inc : fileName.includes(inc)
  )
}

function walkAndSearch(
  base: string,
  dir: string,
  pattern: RegExp,
  matches: SearchMatch[],
  includeExts: string[],
  excludeDirs: Set<string>,
  visited: Set<string>
): void {
  if (matches.length >= MAX_RESULTS * 2) return

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
    if (excludeDirs.has(entry.name)) continue
    const fullPath = join(dir, entry.name)

    if (entry.isDirectory()) {
      walkAndSearch(base, fullPath, pattern, matches, includeExts, excludeDirs, visited)
    } else if (entry.isFile()) {
      if (BINARY_EXTENSIONS.has(extname(entry.name).toLowerCase())) continue
      if (!matchesInclude(entry.name, includeExts)) continue
      searchFileForMatches(base, fullPath, pattern, matches)
    }
  }
}

function searchFileForMatches(
  base: string,
  filePath: string,
  pattern: RegExp,
  matches: SearchMatch[]
): void {
  try {
    const stat = statSync(filePath)
    if (stat.size > MAX_FILE_SIZE) return

    const content = readFileSync(filePath, 'utf8')
    const lines = content.split('\n')
    const relPath = relative(base, filePath).replace(/\\/g, '/')

    for (let i = 0; i < lines.length; i++) {
      pattern.lastIndex = 0
      let match: RegExpExecArray | null
      while ((match = pattern.exec(lines[i])) !== null) {
        matches.push({
          file: relPath,
          line: i + 1,
          column: match.index + 1,
          content: lines[i].trim()
        })
        // For non-global regex, break to avoid infinite loop
        if (!pattern.global) break
      }
    }
  } catch {
    // Skip unreadable files
  }
}
