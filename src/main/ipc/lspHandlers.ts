import { readFileSync, existsSync } from 'fs'
import { join } from 'path'
import { IPC, DocumentSymbol, SymbolKind, DefinitionResult } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

export function registerLspHandlers(): void {
  handleWithTimeout(IPC.LSP_DOCUMENT_SYMBOLS, IPC_TIMEOUT.short, (_event, filePath: string): DocumentSymbol[] => {
    return getDocumentSymbols(filePath)
  })

  handleWithTimeout(IPC.LSP_WORKSPACE_SYMBOLS, IPC_TIMEOUT.long, (_event, req: { workspacePath: string, query: string }): DocumentSymbol[] => {
    // For now, workspace symbols just search across files or return empty.
    // Real implementation would index the workspace.
    return []
  })

  handleWithTimeout(IPC.LSP_DEFINITION, IPC_TIMEOUT.short, (_event, req: { workspacePath: string, filePath: string, line: number, column: number }): DefinitionResult | null => {
    // Basic definition logic: parse the word at line/col, then search workspace or current file.
    return null
  })
}

function getDocumentSymbols(filePath: string): DocumentSymbol[] {
  if (!existsSync(filePath)) return []
  
  try {
    const content = readFileSync(filePath, 'utf-8')
    const lines = content.split('\n')
    const symbols: DocumentSymbol[] = []
    
    // Very naive regex-based symbol parser. 
    // Suitable for TS, JS, Python.
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      
      // TS/JS Function/Class
      const classMatch = line.match(/^(?:export\s+)?(?:default\s+)?class\s+([a-zA-Z0-9_]+)/)
      if (classMatch) {
        symbols.push(createSymbol(classMatch[1], SymbolKind.Class, i))
        continue
      }
      
      const funcMatch = line.match(/^(?:export\s+)?(?:default\s+)?(?:async\s+)?function\s+([a-zA-Z0-9_]+)/)
      if (funcMatch) {
        symbols.push(createSymbol(funcMatch[1], SymbolKind.Function, i))
        continue
      }

      const constFuncMatch = line.match(/^(?:export\s+)?(?:const|let|var)\s+([a-zA-Z0-9_]+)\s*=\s*(?:async\s*)?(?:function|\([^)]*\)\s*=>|[a-zA-Z0-9_]+\s*=>)/)
      if (constFuncMatch) {
        symbols.push(createSymbol(constFuncMatch[1], SymbolKind.Function, i))
        continue
      }

      const interfaceMatch = line.match(/^(?:export\s+)?interface\s+([a-zA-Z0-9_]+)/)
      if (interfaceMatch) {
        symbols.push(createSymbol(interfaceMatch[1], SymbolKind.Interface, i))
        continue
      }

      const typeMatch = line.match(/^(?:export\s+)?type\s+([a-zA-Z0-9_]+)/)
      if (typeMatch) {
        symbols.push(createSymbol(typeMatch[1], SymbolKind.Struct, i))
        continue
      }

      // Python Function/Class
      const pyClassMatch = line.match(/^class\s+([a-zA-Z0-9_]+)/)
      if (pyClassMatch) {
        symbols.push(createSymbol(pyClassMatch[1], SymbolKind.Class, i))
        continue
      }

      const pyFuncMatch = line.match(/^def\s+([a-zA-Z0-9_]+)/)
      if (pyFuncMatch) {
        symbols.push(createSymbol(pyFuncMatch[1], SymbolKind.Function, i))
        continue
      }
    }
    
    return symbols
  } catch (err) {
    console.error('Failed to parse symbols:', err)
    return []
  }
}

function createSymbol(name: string, kind: SymbolKind, lineIndex: number): DocumentSymbol {
  const line = lineIndex + 1
  return {
    name,
    kind,
    range: {
      startLineNumber: line,
      startColumn: 1,
      endLineNumber: line,
      endColumn: 100
    },
    selectionRange: {
      startLineNumber: line,
      startColumn: 1,
      endLineNumber: line,
      endColumn: 100
    }
  }
}
