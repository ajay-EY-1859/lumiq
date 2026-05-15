// ═══════════════════════════════════════════════════════════════════
// Lumiq — DiffTool
// Show unified diff between two files or text
// ═══════════════════════════════════════════════════════════════════

import { existsSync, readFileSync } from 'fs'
import type { Tool } from './Tool'
import { validatePathWithinWorkspace } from '../security/pathValidation'

export class DiffTool implements Tool {
  name = 'DiffTool'
  description = 'Show unified diff between two files or text blocks'
  requiresApproval = false
  isReadOnly = true
  inputSchema = {
    type: 'object',
    properties: {
      pathA: {
        type: 'string',
        description: 'Path to first file (or use textA instead)'
      },
      pathB: {
        type: 'string',
        description: 'Path to second file (or use textB instead)'
      },
      textA: {
        type: 'string',
        description: 'First text content (alternative to pathA)'
      },
      textB: {
        type: 'string',
        description: 'Second text content (alternative to pathB)'
      },
      context: {
        type: 'number',
        description: 'Number of context lines (default: 3, max: 10)'
      }
    }
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    let textA = ''
    let textB = ''
    let nameA = 'a'
    let nameB = 'b'

    try {
      // Get first text
      if (input.pathA) {
        const pathA = validatePathWithinWorkspace(input.pathA as string)
        if (!existsSync(pathA)) {
          return `[ERROR] File not found: ${pathA}`
        }
        textA = readFileSync(pathA, 'utf8')
        nameA = pathA
      } else if (input.textA) {
        textA = input.textA as string
        nameA = 'text-a'
      } else {
        return '[ERROR] Either pathA or textA is required'
      }

      // Get second text
      if (input.pathB) {
        const pathB = validatePathWithinWorkspace(input.pathB as string)
        if (!existsSync(pathB)) {
          return `[ERROR] File not found: ${pathB}`
        }
        textB = readFileSync(pathB, 'utf8')
        nameB = pathB
      } else if (input.textB) {
        textB = input.textB as string
        nameB = 'text-b'
      } else {
        return '[ERROR] Either pathB or textB is required'
      }

      if (textA === textB) {
        return '[OK] Files are identical (no differences)'
      }

      const contextLines = Math.min(Math.max((input.context as number) || 3, 0), 10)
      const diff = this.generateUnifiedDiff(textA, textB, nameA, nameB, contextLines)

      return diff
    } catch (error) {
      return `[ERROR] ${(error as Error).message}`
    }
  }

  private generateUnifiedDiff(
    textA: string,
    textB: string,
    nameA: string,
    nameB: string,
    contextLines: number
  ): string {
    const linesA = textA.split('\n')
    const linesB = textB.split('\n')

    const diff = this.computeDiff(linesA, linesB)
    const hunks = this.generateHunks(diff, contextLines)

    if (hunks.length === 0) {
      return '[OK] No differences found'
    }

    const header = `--- ${nameA}\n+++ ${nameB}\n`
    const body = hunks.map(hunk => this.formatHunk(hunk)).join('\n')

    return header + body
  }

  private computeDiff(linesA: string[], linesB: string[]): Array<{ type: string; line: string; indexA: number; indexB: number }> {
    // Simple Myers diff algorithm (simplified version)
    const diff: Array<{ type: string; line: string; indexA: number; indexB: number }> = []
    const m = linesA.length
    const n = linesB.length

    // dp[i][j] = longest common subsequence length
    const dp: number[][] = Array(m + 1)
      .fill(null)
      .map(() => Array(n + 1).fill(0))

    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= n; j++) {
        if (linesA[i - 1] === linesB[j - 1]) {
          dp[i][j] = dp[i - 1][j - 1] + 1
        } else {
          dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1])
        }
      }
    }

    // Backtrack to build diff
    let i = m,
      j = n
    while (i > 0 || j > 0) {
      if (i > 0 && j > 0 && linesA[i - 1] === linesB[j - 1]) {
        diff.unshift({ type: ' ', line: linesA[i - 1], indexA: i - 1, indexB: j - 1 })
        i--
        j--
      } else if (j > 0 && (i === 0 || dp[i][j - 1] >= dp[i - 1][j])) {
        diff.unshift({ type: '+', line: linesB[j - 1], indexA: i, indexB: j - 1 })
        j--
      } else if (i > 0) {
        diff.unshift({ type: '-', line: linesA[i - 1], indexA: i - 1, indexB: j })
        i--
      }
    }

    return diff
  }

  private generateHunks(
    diff: Array<{ type: string; line: string; indexA: number; indexB: number }>,
    contextLines: number
  ): Array<{ startA: number; startB: number; linesA: number; linesB: number; lines: Array<{ type: string; line: string }> }> {
    const hunks: Array<{ startA: number; startB: number; linesA: number; linesB: number; lines: Array<{ type: string; line: string }> }> = []
    let currentHunk: { startA: number; startB: number; lines: Array<{ type: string; line: string }> } | null = null

    for (let i = 0; i < diff.length; i++) {
      const item = diff[i]

      if (item.type !== ' ') {
        if (!currentHunk) {
          // Start a new hunk
          const startContext = Math.max(0, i - contextLines)
          currentHunk = {
            startA: diff[startContext].indexA,
            startB: diff[startContext].indexB,
            lines: []
          }

          // Add leading context
          for (let j = startContext; j < i; j++) {
            currentHunk.lines.push({ type: ' ', line: diff[j].line })
          }
        }

        currentHunk.lines.push({ type: item.type, line: item.line })
      } else if (currentHunk) {
        // Check if we should end the hunk
        const nextChangeIdx = diff.findIndex((d, idx) => idx > i && d.type !== ' ')
        if (nextChangeIdx === -1 || nextChangeIdx - i > contextLines + 1) {
          // End the hunk
          const endContext = Math.min(diff.length - 1, i + contextLines)
          for (let j = i; j <= endContext; j++) {
            currentHunk.lines.push({ type: ' ', line: diff[j].line })
          }

          const linesA = currentHunk.lines.filter(l => l.type !== '+').length
          const linesB = currentHunk.lines.filter(l => l.type !== '-').length

          hunks.push({
            startA: currentHunk.startA,
            startB: currentHunk.startB,
            linesA,
            linesB,
            lines: currentHunk.lines
          })

          currentHunk = null
          i = endContext
        }
      }
    }

    // Close any remaining hunk
    if (currentHunk) {
      const linesA = currentHunk.lines.filter(l => l.type !== '+').length
      const linesB = currentHunk.lines.filter(l => l.type !== '-').length

      hunks.push({
        startA: currentHunk.startA,
        startB: currentHunk.startB,
        linesA,
        linesB,
        lines: currentHunk.lines
      })
    }

    return hunks
  }

  private formatHunk(hunk: { startA: number; startB: number; linesA: number; linesB: number; lines: Array<{ type: string; line: string }> }): string {
    const header = `@@ -${hunk.startA + 1},${hunk.linesA} +${hunk.startB + 1},${hunk.linesB} @@\n`
    const body = hunk.lines
      .map(item => {
        const prefix = item.type === '+' ? '+' : item.type === '-' ? '-' : ' '
        return prefix + item.line
      })
      .join('\n')

    return header + body
  }
}
