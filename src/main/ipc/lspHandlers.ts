// ═══════════════════════════════════════════════════════════════════
// Lumiq — LSP IPC Handlers
// Directs Monaco Editor symbols and definitions to the SQLite AST database.
// Ensures sub-5ms performance for a lag-free editor experience.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'fs'
import { IPC, DocumentSymbol, SymbolKind, DefinitionResult, ReferenceResult } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { getDatabase } from '../db/database'
import { CodeIntelligenceService } from '../services/CodeIntelligenceService'

function resolveModulePath(sourceFile: string, moduleSpecifier: string, db: any, workspacePath: string): string {
  if (!moduleSpecifier) return ''
  const { dirname, resolve, join } = require('path')
  const currentDir = dirname(sourceFile)
  
  if (moduleSpecifier.startsWith('.')) {
    const baseTarget = resolve(currentDir, moduleSpecifier)
    const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs']
    for (const ext of extensions) {
      const pathWithExt = baseTarget + ext
      if (existsSync(pathWithExt)) {
        return pathWithExt.replace(/\\/g, '/')
      }
      const indexPath = join(baseTarget, 'index' + ext)
      if (existsSync(indexPath)) {
        return indexPath.replace(/\\/g, '/')
      }
    }
  } else {
    // Non-relative import check in database
    const filesRow = db.prepare(`
      SELECT DISTINCT file_path 
      FROM ast_symbols 
      WHERE workspace_path = ? AND file_path LIKE ?
      LIMIT 1
    `).get(workspacePath, `%/${moduleSpecifier}%`) as any
    if (filesRow) {
      return filesRow.file_path
    }
  }
  return ''
}

export function registerLspHandlers(): void {
  // ── Document symbols outline ──
  handleWithTimeout(IPC.LSP_DOCUMENT_SYMBOLS, IPC_TIMEOUT.short, (_event, filePath: string): DocumentSymbol[] => {
    return getDocumentSymbols(filePath)
  })

  // ── Workspace global symbols ──
  handleWithTimeout(IPC.LSP_WORKSPACE_SYMBOLS, IPC_TIMEOUT.long, (_event, req: { workspacePath: string, query: string }): DocumentSymbol[] => {
    const { workspacePath, query } = req
    if (!workspacePath) return []
    const cleanWorkspace = workspacePath.replace(/\\/g, '/')

    try {
      const db = getDatabase()
      const rows = db.prepare(`
        SELECT name, kind, file_path as filePath, start_line as startLine, start_column as startColumn, end_line as endLine, end_column as endColumn, signature 
        FROM ast_symbols 
        WHERE workspace_path = ? AND name LIKE ? 
        LIMIT 100
      `).all(cleanWorkspace, `%${query}%`) as any[]

      const mapKind = (kind: string): SymbolKind => {
        switch (kind) {
          case 'Class': return SymbolKind.Class
          case 'Interface': return SymbolKind.Interface
          case 'Function': return SymbolKind.Function
          case 'Method': return SymbolKind.Method
          case 'Variable': return SymbolKind.Variable
          default: return SymbolKind.Field
        }
      }

      return rows.map((r) => ({
        name: r.name,
        detail: `${r.filePath.split('/').pop()} : ${r.signature || ''}`,
        kind: mapKind(r.kind),
        range: {
          startLineNumber: r.startLine,
          startColumn: r.startColumn,
          endLineNumber: r.endLine,
          endColumn: r.endColumn
        },
        selectionRange: {
          startLineNumber: r.startLine,
          startColumn: r.startColumn,
          endLineNumber: r.endLine,
          endColumn: r.endColumn
        }
      }))
    } catch (err) {
      console.error('[lspHandlers] Failed to fetch workspace symbols:', err)
      return []
    }
  })

  // ── Go to Definition ──
  handleWithTimeout(IPC.LSP_DEFINITION, IPC_TIMEOUT.short, (_event, req: { workspacePath: string, filePath: string, line: number, column: number }): DefinitionResult | null => {
    const { workspacePath, filePath, line, column } = req
    if (!filePath || !existsSync(filePath)) return null

    try {
      // 1. Read the exact identifier at the clicked position
      const content = readFileSync(filePath, 'utf-8')
      const fileLines = content.split('\n')
      const targetLine = fileLines[line - 1]
      if (!targetLine) return null

      // Columns are 1-indexed in Monaco
      const colIdx = column - 1
      let startWord = colIdx
      let endWord = colIdx

      const isWordChar = (char: string) => /[a-zA-Z0-9_]/.test(char)

      while (startWord > 0 && isWordChar(targetLine[startWord - 1])) {
        startWord--
      }
      while (endWord < targetLine.length && isWordChar(targetLine[endWord])) {
        endWord++
      }

      const symbolWord = targetLine.substring(startWord, endWord).trim()
      if (!symbolWord || !isWordChar(symbolWord[0])) return null

      // 2. Query references database to see if symbolWord is imported in the current file
      const cleanFilePath = filePath.replace(/\\/g, '/')
      const cleanWorkspace = workspacePath ? workspacePath.replace(/\\/g, '/') : ''
      const db = getDatabase()

      let definition: any = null

      const importRef = db.prepare(`
        SELECT module_specifier as moduleSpecifier 
        FROM ast_references 
        WHERE source_file_path = ? AND target_name = ? AND kind = 'import' AND module_specifier IS NOT NULL
        LIMIT 1
      `).get(cleanFilePath, symbolWord) as any

      if (importRef && importRef.moduleSpecifier) {
        const targetFile = resolveModulePath(cleanFilePath, importRef.moduleSpecifier, db, cleanWorkspace)
        if (targetFile) {
          definition = db.prepare(`
            SELECT file_path as filePath, start_line as startLine, start_column as startColumn, end_line as endLine, end_column as endColumn 
            FROM ast_symbols 
            WHERE name = ? AND file_path = ?
            LIMIT 1
          `).get(symbolWord, targetFile) as any
        }
      }

      // 3. Fallback to global symbol name search if not resolved via import
      if (!definition) {
        let queryStr = `
          SELECT file_path as filePath, start_line as startLine, start_column as startColumn, end_line as endLine, end_column as endColumn 
          FROM ast_symbols 
          WHERE name = ?
        `
        const params: any[] = [symbolWord]

        if (cleanWorkspace) {
          queryStr += ' AND workspace_path = ?'
          params.push(cleanWorkspace)
        }
        
        queryStr += ' LIMIT 1'
        definition = db.prepare(queryStr).get(params) as any
      }

      if (definition) {
        const uri = definition.filePath.startsWith('file://') 
          ? definition.filePath 
          : 'file:///' + (definition.filePath.startsWith('/') ? definition.filePath.slice(1) : definition.filePath)
        
        return {
          uri,
          range: {
            startLineNumber: definition.startLine,
            startColumn: definition.startColumn,
            endLineNumber: definition.endLine,
            endColumn: definition.endColumn
          }
        }
      }

      return null
    } catch (err) {
      console.error('[lspHandlers] Go To Definition failed:', err)
      return null
    }
  })

  // ── Find All References ──
  handleWithTimeout(IPC.LSP_REFERENCES, IPC_TIMEOUT.long, (_event, req: { workspacePath: string, filePath: string, line: number, column: number }): ReferenceResult[] => {
    const { workspacePath, filePath, line, column } = req
    if (!filePath || !existsSync(filePath)) return []

    try {
      // 1. Read the exact identifier at the clicked position
      const content = readFileSync(filePath, 'utf-8')
      const fileLines = content.split('\n')
      const targetLine = fileLines[line - 1]
      if (!targetLine) return []

      const colIdx = column - 1
      let startWord = colIdx
      let endWord = colIdx
      const isWordChar = (char: string) => /[a-zA-Z0-9_]/.test(char)

      while (startWord > 0 && isWordChar(targetLine[startWord - 1])) {
        startWord--
      }
      while (endWord < targetLine.length && isWordChar(targetLine[endWord])) {
        endWord++
      }

      const symbolWord = targetLine.substring(startWord, endWord).trim()
      if (!symbolWord || !isWordChar(symbolWord[0])) return []

      const cleanFilePath = filePath.replace(/\\/g, '/')
      const cleanWorkspace = workspacePath ? workspacePath.replace(/\\/g, '/') : ''
      const db = getDatabase()

      // 2. Find target definition file for import-aware references filtering
      let targetFile = ''

      // Check if it's imported in the current file
      const importRef = db.prepare(`
        SELECT module_specifier as moduleSpecifier 
        FROM ast_references 
        WHERE source_file_path = ? AND target_name = ? AND kind = 'import' AND module_specifier IS NOT NULL
        LIMIT 1
      `).get(cleanFilePath, symbolWord) as any

      if (importRef && importRef.moduleSpecifier) {
        targetFile = resolveModulePath(cleanFilePath, importRef.moduleSpecifier, db, cleanWorkspace)
      } else {
        // Check if it's defined in the current file
        const isDefinedLocally = db.prepare(`
          SELECT 1 FROM ast_symbols 
          WHERE file_path = ? AND name = ? 
          LIMIT 1
        `).get(cleanFilePath, symbolWord)

        if (isDefinedLocally) {
          targetFile = cleanFilePath
        } else {
          // Check if defined globally
          const globalDef = db.prepare(`
            SELECT file_path as filePath FROM ast_symbols 
            WHERE workspace_path = ? AND name = ? 
            LIMIT 1
          `).get(cleanWorkspace, symbolWord) as any
          if (globalDef) {
            targetFile = globalDef.filePath
          }
        }
      }

      const results: ReferenceResult[] = []

      if (targetFile) {
        // A. Add the definition itself as a reference
        const defs = db.prepare(`
          SELECT file_path as filePath, start_line as startLine, start_column as startColumn, end_line as endLine, end_column as endColumn 
          FROM ast_symbols 
          WHERE file_path = ? AND name = ?
        `).all(targetFile, symbolWord) as any[]

        for (const def of defs) {
          results.push({
            uri: def.filePath,
            range: {
              startLineNumber: def.startLine,
              startColumn: def.startColumn,
              endLineNumber: def.endLine,
              endColumn: def.endColumn
            }
          })
        }

        // B. Add references inside targetFile (calls or usages)
        const localRefs = db.prepare(`
          SELECT source_file_path as sourceFilePath, line, column 
          FROM ast_references 
          WHERE source_file_path = ? AND target_name = ? AND kind != 'import'
        `).all(targetFile, symbolWord) as any[]

        for (const r of localRefs) {
          results.push({
            uri: r.sourceFilePath,
            range: {
              startLineNumber: r.line,
              startColumn: r.column,
              endLineNumber: r.line,
              endColumn: r.column + symbolWord.length
            }
          })
        }

        // C. Find other files in the workspace that reference this symbol
        const candidateFiles = db.prepare(`
          SELECT DISTINCT source_file_path as sourceFilePath 
          FROM ast_references 
          WHERE workspace_path = ? AND target_name = ? AND source_file_path != ?
        `).all(cleanWorkspace, symbolWord, targetFile) as any[]

        for (const candidate of candidateFiles) {
          const cPath = candidate.sourceFilePath
          // Check if the candidate file imports symbolWord from targetFile
          const cImport = db.prepare(`
            SELECT module_specifier as moduleSpecifier 
            FROM ast_references 
            WHERE source_file_path = ? AND target_name = ? AND kind = 'import' AND module_specifier IS NOT NULL
            LIMIT 1
          `).get(cPath, symbolWord) as any

          if (cImport) {
            const resolvedImportPath = resolveModulePath(cPath, cImport.moduleSpecifier, db, cleanWorkspace)
            if (resolvedImportPath === targetFile) {
              // Valid import! Include all references from this candidate file
              const fileRefs = db.prepare(`
                SELECT source_file_path as sourceFilePath, line, column 
                FROM ast_references 
                WHERE source_file_path = ? AND target_name = ?
              `).all(cPath, symbolWord) as any[]

              for (const r of fileRefs) {
                results.push({
                  uri: r.sourceFilePath,
                  range: {
                    startLineNumber: r.line,
                    startColumn: r.column,
                    endLineNumber: r.line,
                    endColumn: r.column + symbolWord.length
                  }
                })
              }
            }
          }
        }
      } else {
        // Fallback: Global name search when no definition can be resolved
        // 1. Fetch definitions
        const defs = db.prepare(`
          SELECT file_path as filePath, start_line as startLine, start_column as startColumn, end_line as endLine, end_column as endColumn 
          FROM ast_symbols 
          WHERE workspace_path = ? AND name = ?
        `).all(cleanWorkspace, symbolWord) as any[]

        for (const def of defs) {
          results.push({
            uri: def.filePath,
            range: {
              startLineNumber: def.startLine,
              startColumn: def.startColumn,
              endLineNumber: def.endLine,
              endColumn: def.endColumn
            }
          })
        }

        // 2. Fetch all call references
        const refs = db.prepare(`
          SELECT source_file_path as sourceFilePath, line, column 
          FROM ast_references 
          WHERE workspace_path = ? AND target_name = ?
        `).all(cleanWorkspace, symbolWord) as any[]

        for (const r of refs) {
          results.push({
            uri: r.sourceFilePath,
            range: {
              startLineNumber: r.line,
              startColumn: r.column,
              endLineNumber: r.line,
              endColumn: r.column + symbolWord.length
            }
          })
        }
      }

      // Deduplicate results by file path, line and column
      const seen = new Set<string>()
      const uniqueResults = results.filter((r) => {
        const key = `${r.uri}::${r.range.startLineNumber}::${r.range.startColumn}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })

      // Format URIs cleanly
      return uniqueResults.map((r) => {
        const uri = r.uri.startsWith('file://') 
          ? r.uri 
          : 'file:///' + (r.uri.startsWith('/') ? r.uri.slice(1) : r.uri)
        return {
          uri,
          range: r.range
        }
      })
    } catch (err) {
      console.error('[lspHandlers] Find All References failed:', err)
      return []
    }
  })

  // ── Index Stats ──
  handleWithTimeout(IPC.LSP_INDEX_STATS, IPC_TIMEOUT.short, (): { files: number, symbols: number, references: number } => {
    return CodeIntelligenceService.getInstance().getIndexStats()
  })
}

function getDocumentSymbols(filePath: string): DocumentSymbol[] {
  if (!filePath || !existsSync(filePath)) return []
  const cleanPath = filePath.replace(/\\/g, '/')

  try {
    const db = getDatabase()
    let rows = db.prepare(`
      SELECT name, kind, container_name as containerName, start_line as startLine, start_column as startColumn, end_line as endLine, end_column as endColumn, signature 
      FROM ast_symbols 
      WHERE file_path = ?
    `).all(cleanPath) as any[]

    // On-the-fly parsing fallback if not indexed yet
    if (rows.length === 0) {
      CodeIntelligenceService.getInstance().indexFile(filePath)
      rows = db.prepare(`
        SELECT name, kind, container_name as containerName, start_line as startLine, start_column as startColumn, end_line as endLine, end_column as endColumn, signature 
        FROM ast_symbols 
        WHERE file_path = ?
      `).all(cleanPath) as any[]
    }

    const mapKind = (kind: string): SymbolKind => {
      switch (kind) {
        case 'Class': return SymbolKind.Class
        case 'Interface': return SymbolKind.Interface
        case 'Function': return SymbolKind.Function
        case 'Method': return SymbolKind.Method
        case 'Variable': return SymbolKind.Variable
        default: return SymbolKind.Field
      }
    }

    return rows.map((r) => ({
      name: r.name,
      detail: r.signature || '',
      kind: mapKind(r.kind),
      range: {
        startLineNumber: r.startLine,
        startColumn: r.startColumn,
        endLineNumber: r.endLine,
        endColumn: r.endColumn
      },
      selectionRange: {
        startLineNumber: r.startLine,
        startColumn: r.startColumn,
        endLineNumber: r.endLine,
        endColumn: r.endColumn
      }
    }))
  } catch (err) {
    console.error('[lspHandlers] Failed to load document symbols:', err)
    return []
  }
}
