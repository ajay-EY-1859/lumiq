// ═══════════════════════════════════════════════════════════════════
// Lumiq — NotebookTool
// Execute JavaScript/Python code snippets in a sandboxed context
// ═══════════════════════════════════════════════════════════════════

import { execSync } from 'child_process'
import { writeFileSync, unlinkSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import { v4 as uuidv4 } from 'uuid'
import type { Tool } from './Tool'

type CodeLanguage = 'javascript' | 'python'

const MAX_EXECUTION_TIME = 30000 // 30 seconds
const MAX_OUTPUT_SIZE = 1024 * 1024 // 1MB

export class NotebookTool implements Tool {
  name = 'NotebookTool'
  description = 'Execute JavaScript or Python code snippets'
  requiresApproval = true
  isReadOnly = false
  inputSchema = {
    type: 'object',
    properties: {
      code: {
        type: 'string',
        description: 'Code to execute'
      },
      language: {
        type: 'string',
        enum: ['javascript', 'python'],
        description: 'Programming language (javascript or python)'
      }
    },
    required: ['code', 'language']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const code = input.code as string | undefined
    const language = input.language as CodeLanguage | undefined

    if (!code || typeof code !== 'string') {
      return '[ERROR] "code" must be a non-empty string'
    }

    if (!language || !['javascript', 'python'].includes(language)) {
      return '[ERROR] "language" must be "javascript" or "python"'
    }

    if (code.length > 50000) {
      return '[ERROR] Code too large (max 50KB)'
    }

    // Check for dangerous patterns
    if (this.hasDangerousPatterns(code, language)) {
      return '[ERROR] Code contains potentially dangerous operations (file access, network, etc.)'
    }

    try {
      if (language === 'javascript') {
        return await this.executeJavaScript(code)
      } else {
        return await this.executePython(code)
      }
    } catch (error) {
      return `[ERROR] Execution failed: ${(error as Error).message}`
    }
  }

  private async executeJavaScript(code: string): Promise<string> {
    const tempFile = join(tmpdir(), `lumiq_${uuidv4()}.js`)
    const wrappedCode = `
(async () => {
  try {
    ${code}
  } catch (error) {
    console.error(String(error.stack || error));
  }
})();
`

    try {
      writeFileSync(tempFile, wrappedCode, 'utf8')

      const output = execSync(`node "${tempFile}"`, {
        encoding: 'utf8',
        timeout: MAX_EXECUTION_TIME,
        maxBuffer: MAX_OUTPUT_SIZE,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      return output.trim() || '[OK] Executed successfully with no output'
    } catch (error) {
      const stderr = (error as any).stderr?.toString()
      const stdout = (error as any).stdout?.toString()
      return `[ERROR]\n${stderr || stdout || (error as Error).message}`
    } finally {
      try {
        unlinkSync(tempFile)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  private async executePython(code: string): Promise<string> {
    const tempFile = join(tmpdir(), `lumiq_${uuidv4()}.py`)

    try {
      writeFileSync(tempFile, code, 'utf8')

      const output = execSync(`python "${tempFile}"`, {
        encoding: 'utf8',
        timeout: MAX_EXECUTION_TIME,
        maxBuffer: MAX_OUTPUT_SIZE,
        stdio: ['pipe', 'pipe', 'pipe']
      })

      return output.trim() || '[OK] Executed successfully with no output'
    } catch (error) {
      const stderr = (error as any).stderr?.toString()
      const stdout = (error as any).stdout?.toString()
      return `[ERROR]\n${stderr || stdout || (error as Error).message}`
    } finally {
      try {
        unlinkSync(tempFile)
      } catch (e) {
        // Ignore cleanup errors
      }
    }
  }

  private hasDangerousPatterns(code: string, language: CodeLanguage): boolean {
    const dangerousJS = [
      /require\s*\(\s*['"]child_process['"]\s*\)/,
      /require\s*\(\s*['"]fs['"]\s*\)/,
      /require\s*\(\s*['"]net['"]\s*\)/,
      /require\s*\(\s*['"]http['"]\s*\)/,
      /process\.exit/,
      /process\.kill/,
      /new Function/,
      /eval\s*\(/
    ]

    const dangerousPython = [
      /import\s+os/,
      /import\s+subprocess/,
      /import\s+socket/,
      /import\s+urllib/,
      /import\s+requests/,
      /open\s*\(/,
      /exec\s*\(/,
      /eval\s*\(/,
      /__import__/
    ]

    const patterns = language === 'javascript' ? dangerousJS : dangerousPython
    return patterns.some(pattern => pattern.test(code))
  }
}
