// ═══════════════════════════════════════════════════════════════════
// Lumiq — SymbolQueryTool
// Exposes code intelligence and system capability scope to the AI
// ═══════════════════════════════════════════════════════════════════

import type { Tool } from './Tool'
import { getDatabase } from '../db/database'
import { SystemCapabilityService } from '../services/SystemCapabilityService'

export class SymbolQueryTool implements Tool {
  name = 'SymbolQueryTool'
  description = 'Query code intelligence (definitions, callers, class implementations) and check system capabilities (compiler/runtime scopes).'
  requiresApproval = false
  isReadOnly = true
  inputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['findDefinition', 'findCallers', 'findImplementations', 'getSystemScope'],
        description: 'The query action to perform.'
      },
      name: {
        type: 'string',
        description: 'The class, function, interface, or variable name to search for (required for all actions except getSystemScope).'
      },
      filePath: {
        type: 'string',
        description: 'Optional file path to restrict searches to.'
      }
    },
    required: ['action']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const action = input.action as string
    const name = input.name as string | undefined
    const filePath = input.filePath as string | undefined

    if (!['findDefinition', 'findCallers', 'findImplementations', 'getSystemScope'].includes(action)) {
      return `[ERROR] Invalid action: ${action}. Use findDefinition, findCallers, findImplementations, or getSystemScope`
    }

    if (action !== 'getSystemScope' && !name) {
      return `[ERROR] "name" is required for action "${action}"`
    }

    switch (action) {
      case 'getSystemScope':
        return this.getSystemScope()
      case 'findDefinition':
        return this.findDefinition(name!, filePath)
      case 'findCallers':
        return this.findCallers(name!, filePath)
      case 'findImplementations':
        return this.findImplementations(name!, filePath)
      default:
        return `[ERROR] Action "${action}" not implemented`
    }
  }

  /**
   * Action: getSystemScope
   * Returns a complete list of discovered system tools, versions, and installation recommendations.
   */
  private getSystemScope(): string {
    try {
      const capabilityService = SystemCapabilityService.getInstance()
      const caps = capabilityService.getCapabilities()

      if (caps.length === 0) {
        return '[OK] No system capabilities scanned yet. A background environment check has been initiated. Please check back in a moment!'
      }

      let output = '=== LUMIQ SYSTEM CAPABILITIES & RUNTIME SCOPE ===\n\n'
      output += 'The following development environments, runtimes, and compilers were detected on this machine:\n'

      for (const cap of caps) {
        const status = cap.isInstalled ? `✅ Installed (${cap.version})` : '❌ Not Found'
        const pathStr = cap.installPath ? ` [Path: ${cap.installPath}]` : ''
        output += `- **${cap.toolName}**: ${status}${pathStr}\n`
      }

      // Generate recommendations based on the current workspace files
      const db = getDatabase()
      const workspaceRow = db.prepare('SELECT workspace_path FROM sessions WHERE workspace_path IS NOT NULL LIMIT 1').get() as any
      const workspacePath = workspaceRow?.workspace_path

      if (workspacePath) {
        // Collect files in database to check formats
        const filesRow = db.prepare('SELECT DISTINCT file_path FROM ast_symbols WHERE workspace_path = ?').all(workspacePath) as any[]
        const filePaths = filesRow.map((r) => r.file_path)

        const recs = capabilityService.getRecommendations(filePaths)
        if (recs.length > 0) {
          output += '\n=== SYSTEM TOOLCHAIN RECOMMENDATIONS ===\n'
          output += 'Based on the file formats found in your active workspace, we recommend configuring these missing dependencies:\n'
          for (const rec of recs) {
            output += `- ${rec}\n`
          }
        } else {
          output += '\n🎉 Excellent! Your local machine has all necessary compilers and toolchains installed to build and run this workspace!\n'
        }
      }

      return output
    } catch (err) {
      return `[ERROR] Failed to fetch system scope: ${(err as Error).message}`
    }
  }

  /**
   * Action: findDefinition
   * Queries the database to locate where a symbol is defined.
   */
  private findDefinition(name: string, filePath?: string): string {
    try {
      const db = getDatabase()
      let query = `
        SELECT file_path as filePath, kind, container_name as containerName, start_line as startLine, start_column as startColumn, signature 
        FROM ast_symbols 
        WHERE name = ?
      `
      const params: any[] = [name]

      if (filePath) {
        query += ' AND file_path LIKE ?'
        params.push(`%${filePath.replace(/\\/g, '/')}`)
      }

      const rows = db.prepare(query).all(params) as any[]

      if (rows.length === 0) {
        return `[OK] Could not find any declaration definition for symbol: "${name}"`
      }

      let output = `=== SYMBOL DEFINITION FOR "${name}" ===\n`
      output += `Found ${rows.length} definition(s):\n\n`

      for (const row of rows) {
        const container = row.containerName ? ` in container class/module "${row.containerName}"` : ''
        output += `- **Kind**: ${row.kind}${container}\n`
        output += `  **Location**: ${row.filePath}:${row.startLine}:${row.startColumn}\n`
        if (row.signature) {
          output += `  **Signature**: \`${row.signature}\`\n`
        }
        output += '\n'
      }

      return output
    } catch (err) {
      return `[ERROR] Failed to find symbol definition: ${(err as Error).message}`
    }
  }

  /**
   * Action: findCallers
   * Queries the database to locate who calls a specific function.
   */
  private findCallers(name: string, filePath?: string): string {
    try {
      const db = getDatabase()
      let query = `
        SELECT source_file_path as sourceFilePath, line, column 
        FROM ast_references 
        WHERE target_name = ? AND kind = 'call'
      `
      const params: any[] = [name]

      if (filePath) {
        query += ' AND source_file_path LIKE ?'
        params.push(`%${filePath.replace(/\\/g, '/')}`)
      }

      const rows = db.prepare(query).all(params) as any[]

      if (rows.length === 0) {
        return `[OK] Could not find any call references to function/symbol: "${name}"`
      }

      let output = `=== CALLERS OF FUNCTION "${name}" ===\n`
      output += `Found ${rows.length} caller(s):\n\n`

      for (const row of rows) {
        output += `- Called in: ${row.sourceFilePath}:${row.line}:${row.column}\n`
      }

      return output
    } catch (err) {
      return `[ERROR] Failed to query symbol callers: ${(err as Error).message}`
    }
  }

  /**
   * Action: findImplementations
   * Queries the database to locate files declaring a specific class or interface.
   */
  private findImplementations(name: string, filePath?: string): string {
    try {
      const db = getDatabase()
      let query = `
        SELECT file_path as filePath, kind, start_line as startLine, start_column as startColumn, signature 
        FROM ast_symbols 
        WHERE name = ? AND kind IN ('Class', 'Interface')
      `
      const params: any[] = [name]

      if (filePath) {
        query += ' AND file_path LIKE ?'
        params.push(`%${filePath.replace(/\\/g, '/')}`)
      }

      const rows = db.prepare(query).all(params) as any[]

      if (rows.length === 0) {
        return `[OK] Could not find any class or interface declarations matching: "${name}"`
      }

      let output = `=== IMPLEMENTATIONS/DECLARATIONS FOR "${name}" ===\n`
      output += `Found ${rows.length} class/interface declaration(s):\n\n`

      for (const row of rows) {
        output += `- **Kind**: ${row.kind}\n`
        output += `  **Location**: ${row.filePath}:${row.startLine}:${row.startColumn}\n`
        if (row.signature) {
          output += `  **Signature**: \`${row.signature}\`\n`
        }
        output += '\n'
      }

      return output
    } catch (err) {
      return `[ERROR] Failed to find implementations: ${(err as Error).message}`
    }
  }
}
