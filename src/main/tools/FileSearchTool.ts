// ═══════════════════════════════════════════════════════════════════
// Lumiq — FileSearchTool
// Semantic code search across workspace files
// ═══════════════════════════════════════════════════════════════════

import { readdirSync, statSync, readFileSync } from 'fs'
import { join, extname } from 'path'
import type { Tool } from './Tool'
import { getWorkspaceRoot, validatePathWithinWorkspace } from '../security/pathValidation'

interface SearchResult {
  file: string
  lineNumber: number
  line: string
  score: number
}

const SEARCHABLE_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx',
  '.py', '.go', '.rs', '.java', '.cs', '.cpp', '.c', '.h',
  '.sql', '.html', '.css', '.scss', '.less',
  '.json', '.yaml', '.yml', '.xml', '.md'
])

const IGNORED_DIRS = new Set([
  'node_modules', '.git', 'dist', 'build', '.next', '.venv', '__pycache__', '.pytest_cache'
])

export class FileSearchTool implements Tool {
  name = 'FileSearchTool'
  description = 'Semantic code search across workspace files'
  requiresApproval = false
  isReadOnly = true
  inputSchema = {
    type: 'object',
    properties: {
      query: {
        type: 'string',
        description: 'Search query (keywords, phrases, or patterns)'
      },
      path: {
        type: 'string',
        description: 'Search within directory (default: workspace root)'
      },
      language: {
        type: 'string',
        description: 'Filter by language/extension (e.g., "ts", "py", "sql")'
      },
      maxResults: {
        type: 'number',
        description: 'Maximum results to return (default: 20, max: 100)'
      }
    },
    required: ['query']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const query = (input.query as string)?.toLowerCase().trim()
    if (!query) {
      return '[ERROR] "query" cannot be empty'
    }

    if (query.length > 200) {
      return '[ERROR] Query too long (max 200 characters)'
    }

    let searchPath: string
    try {
      searchPath = input.path
        ? validatePathWithinWorkspace(input.path as string)
        : getWorkspaceRoot()
    } catch (error) {
      return `[ERROR] ${(error as Error).message}`
    }

    const language = (input.language as string)?.toLowerCase()
    const maxResults = Math.min(Math.max((input.maxResults as number) || 20, 1), 100)

    try {
      const results = this.searchFiles(searchPath, query, language, maxResults)

      if (results.length === 0) {
        return `[OK] No results found for query: "${query}"`
      }

      return this.formatResults(results, query)
    } catch (error) {
      return `[ERROR] Search failed: ${(error as Error).message}`
    }
  }

  private searchFiles(searchPath: string, query: string, language: string | undefined, maxResults: number): SearchResult[] {
    const results: SearchResult[] = []
    const queryTerms = query.split(/\s+/)

    const traverse = (dir: string, depth = 0) => {
      if (depth > 5) return // Limit depth
      if (results.length >= maxResults) return

      try {
        const entries = readdirSync(dir)

        for (const entry of entries) {
          if (results.length >= maxResults) break

          const fullPath = join(dir, entry)
          const stat = statSync(fullPath)

          if (stat.isDirectory()) {
            if (!IGNORED_DIRS.has(entry) && !entry.startsWith('.')) {
              traverse(fullPath, depth + 1)
            }
          } else if (stat.isFile()) {
            const ext = extname(fullPath).toLowerCase()

            // Filter by language if specified
            if (language) {
              const langExt = language.startsWith('.') ? language : `.${language}`
              if (ext !== langExt) continue
            }

            // Filter by searchable extensions
            if (!SEARCHABLE_EXTENSIONS.has(ext)) continue

            // Search the file
            try {
              const content = readFileSync(fullPath, 'utf8')
              const fileResults = this.searchContent(fullPath, content, queryTerms)

              for (const result of fileResults) {
                if (results.length < maxResults) {
                  results.push(result)
                }
              }
            } catch {
              // Skip files that can't be read
            }
          }
        }
      } catch {
        // Skip directories that can't be read
      }
    }

    traverse(searchPath)
    results.sort((a, b) => b.score - a.score)
    return results.slice(0, maxResults)
  }

  private searchContent(filePath: string, content: string, queryTerms: string[]): SearchResult[] {
    const results: SearchResult[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const lowerLine = line.toLowerCase()

      // Score based on how many query terms match
      let score = 0
      for (const term of queryTerms) {
        if (lowerLine.includes(term)) {
          score += 1
        }
      }

      // Boost score for exact matches
      if (lowerLine === queryTerms.join(' ').toLowerCase()) {
        score += 10
      }

      // Boost score for word boundaries
      for (const term of queryTerms) {
        const wordBoundaryRegex = new RegExp(`\\b${term}\\b`, 'i')
        if (wordBoundaryRegex.test(line)) {
          score += 2
        }
      }

      if (score > 0) {
        results.push({
          file: filePath,
          lineNumber: i + 1,
          line: line.trim(),
          score
        })
      }
    }

    return results
  }

  private formatResults(results: SearchResult[], query: string): string {
    const grouped = this.groupByFile(results)
    let output = `[SEARCH RESULTS] Found ${results.length} match${results.length !== 1 ? 'es' : ''} for "${query}"\n\n`

    for (const [file, fileResults] of Object.entries(grouped)) {
      output += `📄 ${file}\n`

      for (const result of fileResults.slice(0, 5)) {
        output += `   ${result.lineNumber}: ${result.line}\n`
      }

      if (fileResults.length > 5) {
        output += `   ... and ${fileResults.length - 5} more matches\n`
      }

      output += '\n'
    }

    return output
  }

  private groupByFile(results: SearchResult[]): Record<string, SearchResult[]> {
    const grouped: Record<string, SearchResult[]> = {}

    for (const result of results) {
      if (!grouped[result.file]) {
        grouped[result.file] = []
      }
      grouped[result.file].push(result)
    }

    return grouped
  }
}
