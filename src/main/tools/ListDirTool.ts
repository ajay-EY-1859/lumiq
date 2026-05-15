// ═══════════════════════════════════════════════════════════════════
// Lumiq — ListDirTool
// List directory contents in tree format with configurable depth
// ═══════════════════════════════════════════════════════════════════

import { existsSync, lstatSync, readdirSync } from 'fs'
import { join } from 'path'
import type { Tool } from './Tool'
import { validatePathWithinWorkspace } from '../security/pathValidation'

const DEFAULT_DEPTH = 2
const MAX_DEPTH = 5
const IGNORED_PATTERNS = [
  /^\.git$/,
  /^node_modules$/,
  /^\.next$/,
  /^dist$/,
  /^build$/,
  /^\.vscode$/,
  /^\.idea$/,
  /^__pycache__$/,
  /^\.pytest_cache$/,
  /^\.DS_Store$/,
  /^\..+/
]

export class ListDirTool implements Tool {
  name = 'ListDirTool'
  description = 'List directory contents in tree format with configurable depth'
  requiresApproval = false
  isReadOnly = true
  inputSchema = {
    type: 'object',
    properties: {
      path: {
        type: 'string',
        description: 'Absolute or relative path to the directory'
      },
      depth: {
        type: 'number',
        description: 'Maximum depth to traverse (default: 2, max: 5)'
      },
      includeHidden: {
        type: 'boolean',
        description: 'Include hidden files and directories (default: false)'
      }
    },
    required: ['path']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    let dirPath: string
    try {
      dirPath = validatePathWithinWorkspace(input.path as string)
    } catch (error) {
      return `[ERROR] ${(error as Error).message}`
    }

    if (!existsSync(dirPath)) {
      return `[ERROR] Directory not found: ${dirPath}`
    }

    const stats = lstatSync(dirPath)
    if (!stats.isDirectory()) {
      return `[ERROR] Not a directory: ${dirPath}`
    }

    const depth = Math.min(input.depth as number | undefined || DEFAULT_DEPTH, MAX_DEPTH)
    const includeHidden = (input.includeHidden as boolean) || false

    try {
      const tree = this.buildTree(dirPath, depth, includeHidden, 0)
      return tree
    } catch (error) {
      return `[ERROR] Failed to list directory: ${(error as Error).message}`
    }
  }

  private buildTree(dirPath: string, maxDepth: number, includeHidden: boolean, currentDepth: number): string {
    const lines: string[] = []
    const baseName = this.getBaseName(dirPath)
    lines.push(baseName + '/')

    if (currentDepth >= maxDepth) {
      return lines.join('\n')
    }

    try {
      const entries = readdirSync(dirPath, { withFileTypes: true })
        .filter(entry => {
          if (!includeHidden && this.shouldIgnore(entry.name)) {
            return false
          }
          return true
        })
        .sort((a, b) => {
          // Directories first, then alphabetical
          if (a.isDirectory() !== b.isDirectory()) {
            return b.isDirectory() ? 1 : -1
          }
          return a.name.localeCompare(b.name)
        })

      for (let i = 0; i < entries.length; i++) {
        const entry = entries[i]
        const isLast = i === entries.length - 1
        const prefix = isLast ? '└── ' : '├── '
        const childPath = join(dirPath, entry.name)

        if (entry.isDirectory()) {
          lines.push(prefix + entry.name + '/')

          // Recursively add subdirectory contents
          if (currentDepth < maxDepth - 1) {
            const childTree = this.buildTree(childPath, maxDepth, includeHidden, currentDepth + 1)
            const childLines = childTree.split('\n').slice(1) // Skip the root directory name
            const childPrefix = isLast ? '    ' : '│   '

            for (const childLine of childLines) {
              if (childLine.trim()) {
                lines.push(childPrefix + childLine)
              }
            }
          }
        } else {
          lines.push(prefix + entry.name)
        }
      }
    } catch (error) {
      lines.push(`  [ERROR reading: ${(error as Error).message}]`)
    }

    return lines.join('\n')
  }

  private shouldIgnore(name: string): boolean {
    return IGNORED_PATTERNS.some(pattern => pattern.test(name))
  }

  private getBaseName(dirPath: string): string {
    const parts = dirPath.split(/[\\/]/).filter(p => p)
    return parts[parts.length - 1] || dirPath
  }
}
