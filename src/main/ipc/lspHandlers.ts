// ═══════════════════════════════════════════════════════════════════
// Lumiq — LSP IPC Handlers
// Directs Monaco Editor symbols and definitions to the SQLite AST database.
// Ensures sub-5ms performance for a lag-free editor experience.
// ═══════════════════════════════════════════════════════════════════

import { readFileSync, existsSync } from 'fs'
import { IPC, DocumentSymbol, SymbolKind, DefinitionResult } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { getDatabase } from '../db/database'
import { CodeIntelligenceService } from '../services/CodeIntelligenceService'

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

      // 2. Query the SQLite database for declarations of this symbol in the active workspace
      const cleanWorkspace = workspacePath ? workspacePath.replace(/\\/g, '/') : ''
      const db = getDatabase()
      
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

      const definition = db.prepare(queryStr).get(params) as any

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
