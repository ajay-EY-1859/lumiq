import { ILspService } from '@shared/services'
import { HoverResult } from '@shared/types'
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions'
import { getDatabase } from '../db/database'
import { LspProcess } from './LspProcess'
import { BrowserWindow } from 'electron'
import { IConfigurationService } from '@shared/configuration/configuration'
import { getService } from '@shared/instantiation/instantiationService'
import * as fs from 'fs'
import * as path from 'path'

export class LspService implements ILspService {
  private activeServers: Set<string> = new Set()
  private processes = new Map<string, LspProcess>()
  private syncedDocuments = new Set<string>()
  private docVersions = new Map<string, number>()

  async startLanguageServer(languageId: string, workspacePath: string): Promise<boolean> {
    if (!workspacePath) return false
    
    // Stop existing server for this language if any
    await this.stopLanguageServer(languageId)

    // Check lspMode from ConfigurationService
    let mode = 'simulated'
    try {
      const configService = getService(IConfigurationService)
      mode = configService.getValue<string>('lspMode') || 'simulated'
    } catch {
      // ignore
    }

    if (mode === 'simulated') {
      console.log(`[LspService] Starting language server (simulated mode) for ${languageId} at ${workspacePath}`)
      this.activeServers.add(languageId)
      return true
    }

    console.log(`[LspService] Starting language server (real mode) for ${languageId} at ${workspacePath}`)
    const binary = this.getBinaryPath(languageId)
    const proc = new LspProcess(
      languageId,
      binary,
      workspacePath,
      (method, params) => this.handleNotification(languageId, method, params)
    )

    const success = await proc.start()
    if (success) {
      this.processes.set(languageId, proc)
      this.activeServers.add(languageId)
      return true
    }

    console.warn(`[LspService] Could not start real language server for ${languageId}. Falling back to SQLite AST search.`)
    return false
  }

  async stopLanguageServer(languageId: string): Promise<void> {
    console.log(`[LspService] Stopping language server for ${languageId}`)
    const proc = this.processes.get(languageId)
    if (proc) {
      proc.stop()
      this.processes.delete(languageId)
    }
    this.activeServers.delete(languageId)

    // Clear document sync states for this language
    for (const docUri of this.syncedDocuments) {
      // docUri is like file:///c:/.../file.ts
      const filePath = docUri.replace('file:///', '')
      if (this.getLanguageId(filePath) === languageId) {
        this.syncedDocuments.delete(docUri)
        this.docVersions.delete(docUri)
      }
    }
  }

  async getHover(filePath: string, line: number, column: number, content?: string): Promise<HoverResult | null> {
    const languageId = this.getLanguageId(filePath)
    if (languageId) {
      const proc = this.processes.get(languageId)
      if (proc) {
        try {
          await this.ensureDocumentSynced(proc, filePath, content)
          const fileUri = 'file:///' + filePath.replace(/\\/g, '/')
          const hover = await proc.sendRequest('textDocument/hover', {
            textDocument: { uri: fileUri },
            position: { line: line - 1, character: column - 1 }
          })
          const mapped = this.mapLspHover(hover)
          if (mapped) return mapped
        } catch (err) {
          console.error(`[LspService] LSP getHover request failed for ${filePath}:`, err)
        }
      }
    }

    // Fallback: SQLite AST query
    const symbolWord = this.getIdentifierAtPosition(filePath, line, column)
    if (!symbolWord) return null

    try {
      const db = getDatabase()
      // Query symbol metadata from SQLite AST database
      const row = db.prepare(`
        SELECT signature, container_name as container, file_path as file, kind
        FROM ast_symbols
        WHERE name = ?
        LIMIT 1
      `).get(symbolWord) as any

      if (row) {
        return {
          contents: [
            `**${row.kind}**: \`${row.signature || symbolWord}\``,
            `Defined in *${row.file.split('/').pop()}* ${row.container ? `inside \`${row.container}\`` : ''}`
          ]
        }
      }
      
      return {
        contents: [
          `**Symbol**: \`${symbolWord}\``,
          `*Self-extracted from source file AST symbols table.*`
        ]
      }
    } catch {
      return null
    }
  }

  async getCompletion(filePath: string, line: number, column: number, content?: string): Promise<any[]> {
    const languageId = this.getLanguageId(filePath)
    if (languageId) {
      const proc = this.processes.get(languageId)
      if (proc) {
        try {
          await this.ensureDocumentSynced(proc, filePath, content)
          const fileUri = 'file:///' + filePath.replace(/\\/g, '/')
          const completion = await proc.sendRequest('textDocument/completion', {
            textDocument: { uri: fileUri },
            position: { line: line - 1, character: column - 1 }
          })
          const mapped = this.mapLspCompletion(completion)
          if (mapped && mapped.length > 0) return mapped
        } catch (err) {
          console.error(`[LspService] LSP getCompletion request failed for ${filePath}:`, err)
        }
      }
    }

    // Fallback: SQLite AST query
    const symbolWord = this.getIdentifierAtPosition(filePath, line, column) || ''
    try {
      const db = getDatabase()
      // Get all symbols in workspace matching typed prefix
      const rows = db.prepare(`
        SELECT DISTINCT name, kind, signature
        FROM ast_symbols
        WHERE name LIKE ?
        LIMIT 20
      `).all(`${symbolWord}%`) as any[]

      if (rows.length > 0) {
        return rows.map((r) => ({
          label: r.name,
          kind: this.mapSymbolKindToMonacoKind(r.kind),
          detail: r.signature || '',
          insertText: r.name
        }))
      }
    } catch {
      // ignore
    }

    // Default global suggestions
    return [
      { label: 'console.log', kind: 1, detail: 'Log to console', insertText: 'console.log($1)' },
      { label: 'useState', kind: 2, detail: 'React State Hook', insertText: 'useState($1)' },
      { label: 'useEffect', kind: 2, detail: 'React Effect Hook', insertText: 'useEffect(() => {\n\t$0\n}, [])' },
      { label: 'import', kind: 14, detail: 'Import module', insertText: "import { $1 } from '$2'" }
    ]
  }

  async getSignatureHelp(filePath: string, line: number, column: number, content?: string): Promise<any | null> {
    const languageId = this.getLanguageId(filePath)
    if (languageId) {
      const proc = this.processes.get(languageId)
      if (proc) {
        try {
          await this.ensureDocumentSynced(proc, filePath, content)
          const fileUri = 'file:///' + filePath.replace(/\\/g, '/')
          const sigHelp = await proc.sendRequest('textDocument/signatureHelp', {
            textDocument: { uri: fileUri },
            position: { line: line - 1, character: column - 1 }
          })
          if (sigHelp) return sigHelp
        } catch (err) {
          console.error(`[LspService] LSP getSignatureHelp request failed for ${filePath}:`, err)
        }
      }
    }

    // Fallback: SQLite AST query
    const symbolWord = this.getIdentifierAtPosition(filePath, line, column)
    if (!symbolWord) return null

    try {
      const db = getDatabase()
      const row = db.prepare(`
        SELECT name, signature, kind
        FROM ast_symbols
        WHERE name = ? AND kind IN ('Function', 'Method')
        LIMIT 1
      `).get(symbolWord) as any

      if (row && row.signature) {
        const paramsMatch = row.signature.match(/\(([^)]+)\)/)
        const paramsList = paramsMatch ? paramsMatch[1].split(',').map((p: string) => p.trim()) : []
        
        return {
          signatures: [{
            label: row.signature,
            documentation: `LSP Signature helper for ${row.name}`,
            parameters: paramsList.map((p: string) => ({ label: p, documentation: '' }))
          }],
          activeSignature: 0,
          activeParameter: 0
        }
      }
    } catch {
      // ignore
    }
    return null
  }

  private getLanguageId(filePath: string): string | null {
    const ext = path.extname(filePath).toLowerCase()
    if (['.ts', '.tsx', '.js', '.jsx'].includes(ext)) return 'typescript'
    if (['.py'].includes(ext)) return 'python'
    if (['.go'].includes(ext)) return 'go'
    if (['.rs'].includes(ext)) return 'rust'
    return null
  }

  private getBinaryPath(languageId: string): string {
    switch (languageId) {
      case 'typescript':
        return 'typescript-language-server'
      case 'python':
        return 'pyright-langserver'
      default:
        return `${languageId}-language-server`
    }
  }

  private async ensureDocumentSynced(proc: LspProcess, filePath: string, editorContent?: string): Promise<void> {
    const fileUri = 'file:///' + filePath.replace(/\\/g, '/')
    let content = editorContent

    if (content === undefined || content === null) {
      try {
        content = await fs.promises.readFile(filePath, 'utf-8')
      } catch {
        content = ''
      }
    }

    if (!this.syncedDocuments.has(fileUri)) {
      proc.sendNotification('textDocument/didOpen', {
        textDocument: {
          uri: fileUri,
          languageId: proc.languageId,
          version: 1,
          text: content
        }
      })
      this.syncedDocuments.add(fileUri)
      this.docVersions.set(fileUri, 1)
    } else {
      const nextVer = (this.docVersions.get(fileUri) || 1) + 1
      proc.sendNotification('textDocument/didChange', {
        textDocument: {
          uri: fileUri,
          version: nextVer
        },
        contentChanges: [
          {
            text: content
          }
        ]
      })
      this.docVersions.set(fileUri, nextVer)
    }
  }

  private mapLspHover(hover: any): HoverResult | null {
    if (!hover || !hover.contents) return null
    let contents: string[] = []
    
    const extractText = (content: any): string => {
      if (typeof content === 'string') return content
      if (content && typeof content === 'object') {
        if ('value' in content) return content.value
        if ('text' in content) return content.text
      }
      return ''
    }

    if (Array.isArray(hover.contents)) {
      contents = hover.contents.map(extractText).filter(Boolean)
    } else {
      const text = extractText(hover.contents)
      if (text) contents.push(text)
    }

    return contents.length > 0 ? { contents } : null
  }

  private mapLspCompletion(completion: any): any[] {
    if (!completion) return []
    const items = Array.isArray(completion) ? completion : (completion.items || [])
    
    return items.map((item: any) => {
      let kind = 1
      if (typeof item.kind === 'number') {
        kind = this.mapLspKindToMonacoKind(item.kind)
      }
      
      const insertText = item.insertText || item.textEdit?.newText || item.label
      
      return {
        label: item.label,
        kind,
        detail: item.detail || '',
        insertText
      }
    })
  }

  private mapLspKindToMonacoKind(lspKind: number): number {
    return lspKind
  }

  private handleNotification(languageId: string, method: string, params: any) {
    if (method === 'textDocument/publishDiagnostics') {
      const { uri, diagnostics } = params
      console.log(`[LspService] Published ${diagnostics?.length || 0} diagnostics for ${uri}`)
      
      const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
      if (window) {
        window.webContents.send('lsp:publish-diagnostics', {
          languageId,
          uri,
          diagnostics: (diagnostics || []).map((d: any) => ({
            message: d.message,
            severity: d.severity,
            range: d.range
          }))
        })
      }
    }
  }

  private getIdentifierAtPosition(filePath: string, line: number, column: number): string | null {
    if (!filePath || !fs.existsSync(filePath)) return null
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
      const lines = content.split('\n')
      const targetLine = lines[line - 1]
      if (!targetLine) return null

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

      const word = targetLine.substring(startWord, endWord).trim()
      return word || null
    } catch {
      return null
    }
  }

  private mapSymbolKindToMonacoKind(kind: string): number {
    switch (kind) {
      case 'Class': return 5
      case 'Interface': return 7
      case 'Function': return 11
      case 'Method': return 1
      case 'Variable': return 4
      default: return 9
    }
  }
}

registerSingleton(ILspService, LspService, InstantiationType.Delayed)
