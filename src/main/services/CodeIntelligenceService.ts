import * as ts from 'typescript'
import chokidar, { FSWatcher } from 'chokidar'
import { join, resolve } from 'path'
import { readFileSync, existsSync } from 'fs'
import { Worker } from 'worker_threads'
import { getDatabase } from '../db/database'
import { getService } from '@shared/instantiation/instantiationService'
import { ISystemCapabilityService, ICodeIntelligenceService } from '@shared/services'
import { Disposable } from '@shared/lifecycle'
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions'

let native: any
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  native = require('@lumiq/native')
} catch (err) {
  console.error('[CodeIntelligenceService] Failed to load native @lumiq/native module:', err)
}

export interface IndexStats {
  filesProcessed: number
  symbolsCount: number
  referencesCount: number
  durationMs: number
}

export class CodeIntelligenceService extends Disposable implements ICodeIntelligenceService {
  private watcher: FSWatcher | null = null
  private workspacePath: string | null = null
  private originalNoAsar: any = undefined
  private activeWorker: Worker | null = null

  // Cached prepared statements for AST indexing performance
  private deleteSymbolsStmt: any = null
  private deleteRefsStmt: any = null
  private insertSymbolStmt: any = null
  private insertRefStmt: any = null

  constructor() {
    super()
  }

  public static getInstance(): CodeIntelligenceService {
    return getService(ICodeIntelligenceService) as CodeIntelligenceService
  }

  /**
   * Binds a new workspace, optionally skipping the heavy background scan for restore flows.
   */
  public async setWorkspace(path: string | null, options: { skipIndexing?: boolean } = {}): Promise<void> {
    if (this.activeWorker) {
      this.activeWorker.terminate()
      this.activeWorker = null
    }

    if (this.watcher) {
      await this.watcher.close()
      this.watcher = null
      this.restoreAsarPatching()
    }

    this.workspacePath = path ? resolve(path) : null

    if (!this.workspacePath || !existsSync(this.workspacePath)) {
      console.log('[CodeIntelligence] No workspace or path does not exist. Indexer stopped.')
      return
    }

    console.log(`[CodeIntelligence] Workspace bound: ${this.workspacePath}`)
    this.disableAsarPatching()

    if (!options.skipIndexing) {
      // Trigger SystemCapabilityService scan first in the background
      getService(ISystemCapabilityService).scan().catch((err) => {
        console.error('[CodeIntelligence] System capabilities scan failed:', err)
      })

      // Run workspace indexing asynchronously in the background
      this.scanWorkspaceAsync().catch((err) => {
        console.error('[CodeIntelligence] Background workspace scan failed:', err)
      })
    } else {
      console.log('[CodeIntelligence] Skipping heavy workspace scan for restore flow to keep startup responsive.')
    }

    // Setup chokidar watcher for real-time incremental updates
    this.setupWatcher()
  }

  /**
   * Asynchronously scans and indexes the entire workspace.
   * Utilizes batching and microtask yielding to ensure zero UI lag.
   */
  private async scanWorkspaceAsync(): Promise<IndexStats> {
    if (!this.workspacePath) {
      return { filesProcessed: 0, symbolsCount: 0, referencesCount: 0, durationMs: 0 }
    }

    if (this.activeWorker) {
      this.activeWorker.terminate()
      this.activeWorker = null
    }

    console.log('[CodeIntelligence] Spawning background worker thread for AST workspace scan...')

    return new Promise((resolvePromise) => {
      const workerPath = join(__dirname, 'codeIntelligenceWorker.js')
      const worker = new Worker(workerPath, {
        workerData: {
          workspacePath: this.workspacePath,
          maxFiles: 3000
        }
      })
      this.activeWorker = worker

      let filesProcessed = 0
      let symbolsCount = 0
      let referencesCount = 0

      worker.on('message', (msg) => {
        switch (msg.type) {
          case 'discovered':
            console.log(`[CodeIntelligence] Worker discovered ${msg.count} files to index. Processing in background...`)
            break

          case 'batch_indexed':
            this.writeBatchToDb(msg.batch)
            filesProcessed += msg.batch.length
            for (const item of msg.batch) {
              symbolsCount += item.symbols.length
              referencesCount += item.references.length
            }
            break

          case 'done':
            console.log(`[CodeIntelligence] Background workspace scan completed. Processed ${msg.filesProcessed} files, extracted ${msg.symbolsCount} symbols and ${msg.referencesCount} references in ${msg.durationMs}ms.`)
            this.activeWorker = null
            resolvePromise({
              filesProcessed: msg.filesProcessed,
              symbolsCount: msg.symbolsCount,
              referencesCount: msg.referencesCount,
              durationMs: msg.durationMs
            })
            break

          case 'error':
            console.error('[CodeIntelligence] Worker thread reported scanning error:', msg.error)
            this.activeWorker = null
            resolvePromise({ filesProcessed, symbolsCount, referencesCount, durationMs: 0 })
            break
        }
      })

      worker.on('error', (err) => {
        console.error('[CodeIntelligence] Worker thread crashed:', err)
        this.activeWorker = null
        resolvePromise({ filesProcessed, symbolsCount, referencesCount, durationMs: 0 })
      })

      worker.on('exit', (code) => {
        if (code !== 0) {
          console.error(`[CodeIntelligence] Worker thread exited with code ${code}`)
        }
        this.activeWorker = null
        resolvePromise({ filesProcessed, symbolsCount, referencesCount, durationMs: 0 })
      })
    })
  }

  private disableAsarPatching(): void {
    if (this.originalNoAsar === undefined) {
      this.originalNoAsar = (process as any).noAsar
    }
    ;(process as any).noAsar = true
  }

  private restoreAsarPatching(): void {
    if (this.originalNoAsar !== undefined) {
      ;(process as any).noAsar = this.originalNoAsar
      this.originalNoAsar = undefined
    }
  }

  /**
   * Indexes a single file, removing existing symbols and writing fresh ones to SQLite.
   */
  public indexFile(filePath: string): { symbols: number; references: number } {
    if (!this.workspacePath || !existsSync(filePath)) {
      return { symbols: 0, references: 0 }
    }

    try {
      const content = readFileSync(filePath, 'utf-8')
      const ext = filePath.split('.').pop()?.toLowerCase() ?? ''
      let parseResult: { symbols: any[]; references: any[] }

      if (native && native.parseFileAst && ['ts', 'tsx', 'js', 'jsx', 'py', 'rs', 'go'].includes(ext)) {
        try {
          const res = native.parseFileAst(filePath, content)
          parseResult = {
            symbols: res.symbols || [],
            references: res.references || []
          }
        } catch (err) {
          console.error(`[CodeIntelligence] Native AST parsing failed for ${filePath}, falling back:`, err)
          if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
            parseResult = this.parseTypeScript(filePath, content)
          } else if (ext === 'py') {
            parseResult = this.parsePython(filePath, content)
          } else {
            parseResult = this.parseFallback(filePath, content)
          }
        }
      } else {
        if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
          parseResult = this.parseTypeScript(filePath, content)
        } else if (ext === 'py') {
          parseResult = this.parsePython(filePath, content)
        } else {
          parseResult = this.parseFallback(filePath, content)
        }
      }

      this.writeAstToDb(filePath, parseResult.symbols, parseResult.references)
      return { symbols: parseResult.symbols.length, references: parseResult.references.length }
    } catch (err) {
      console.error(`[CodeIntelligence] Failed to index file ${filePath}:`, err)
      return { symbols: 0, references: 0 }
    }
  }

  /**
   * Writes pre-parsed AST symbols and references to the SQLite database.
   */
  private writeAstToDb(filePath: string, symbols: any[], references: any[]): void {
    if (!this.workspacePath) return

    try {
      const db = getDatabase()
      const cleanPath = filePath.replace(/\\/g, '/')
      const cleanWorkspace = this.workspacePath.replace(/\\/g, '/')

      if (!this.deleteSymbolsStmt) {
        this.deleteSymbolsStmt = db.prepare('DELETE FROM ast_symbols WHERE workspace_path = ? AND file_path = ?')
        this.deleteRefsStmt = db.prepare('DELETE FROM ast_references WHERE workspace_path = ? AND source_file_path = ?')
        this.insertSymbolStmt = db.prepare(`
          INSERT INTO ast_symbols (id, workspace_path, file_path, name, kind, container_name, start_line, start_column, end_line, end_column, signature)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        this.insertRefStmt = db.prepare(`
          INSERT INTO ast_references (id, workspace_path, source_file_path, target_name, kind, line, column, module_specifier)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
      }

      const deleteSymbols = this.deleteSymbolsStmt
      const deleteRefs = this.deleteRefsStmt
      const insertSymbol = this.insertSymbolStmt
      const insertRef = this.insertRefStmt

      const transaction = db.transaction(() => {
        deleteSymbols.run(cleanWorkspace, cleanPath)
        deleteRefs.run(cleanWorkspace, cleanPath)

        for (const sym of symbols) {
          const symId = `${cleanPath}::${sym.name}::${sym.startLine}::${sym.startColumn}`
          insertSymbol.run(
            symId,
            cleanWorkspace,
            cleanPath,
            sym.name,
            sym.kind,
            sym.containerName || null,
            sym.startLine,
            sym.startColumn,
            sym.endLine,
            sym.endColumn,
            sym.signature || null
          )
        }

        for (const ref of references) {
          const refId = `${cleanPath}::ref::${ref.targetName}::${ref.line}::${ref.column}`
          insertRef.run(
            refId,
            cleanWorkspace,
            cleanPath,
            ref.targetName,
            ref.kind,
            ref.line,
            ref.column,
            ref.moduleSpecifier || null
          )
        }
      })

      transaction()
    } catch (err) {
      console.error(`[CodeIntelligence] Failed to write AST data for ${filePath} to DB:`, err)
    }
  }

  /**
   * Writes a batch of parsed files to the database in a single SQLite transaction.
   * Extremely fast compared to writing file-by-file (reduces disk commits by 100x).
   */
  private writeBatchToDb(batch: { filePath: string; symbols: any[]; references: any[] }[]): void {
    if (!this.workspacePath) return

    try {
      const db = getDatabase()
      const cleanWorkspace = this.workspacePath.replace(/\\/g, '/')

      if (!this.deleteSymbolsStmt) {
        this.deleteSymbolsStmt = db.prepare('DELETE FROM ast_symbols WHERE workspace_path = ? AND file_path = ?')
        this.deleteRefsStmt = db.prepare('DELETE FROM ast_references WHERE workspace_path = ? AND source_file_path = ?')
        this.insertSymbolStmt = db.prepare(`
          INSERT INTO ast_symbols (id, workspace_path, file_path, name, kind, container_name, start_line, start_column, end_line, end_column, signature)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `)
        this.insertRefStmt = db.prepare(`
          INSERT INTO ast_references (id, workspace_path, source_file_path, target_name, kind, line, column, module_specifier)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `)
      }

      const deleteSymbols = this.deleteSymbolsStmt
      const deleteRefs = this.deleteRefsStmt
      const insertSymbol = this.insertSymbolStmt
      const insertRef = this.insertRefStmt

      const transaction = db.transaction(() => {
        for (const item of batch) {
          const cleanPath = item.filePath.replace(/\\/g, '/')
          deleteSymbols.run(cleanWorkspace, cleanPath)
          deleteRefs.run(cleanWorkspace, cleanPath)

          for (const sym of item.symbols) {
            const symId = `${cleanPath}::${sym.name}::${sym.startLine}::${sym.startColumn}`
            insertSymbol.run(
              symId,
              cleanWorkspace,
              cleanPath,
              sym.name,
              sym.kind,
              sym.containerName || null,
              sym.startLine,
              sym.startColumn,
              sym.endLine,
              sym.endColumn,
              sym.signature || null
            )
          }

          for (const ref of item.references) {
            const refId = `${cleanPath}::ref::${ref.targetName}::${ref.line}::${ref.column}`
            insertRef.run(
              refId,
              cleanWorkspace,
              cleanPath,
              ref.targetName,
              ref.kind,
              ref.line,
              ref.column,
              ref.moduleSpecifier || null
            )
          }
        }
      })

      transaction()
    } catch (err) {
      console.error('[CodeIntelligence] Failed to write batch AST to DB:', err)
    }
  }

  /**
   * Returns AST database stats.
   */
  public getIndexStats(): { files: number; symbols: number; references: number } {
    try {
      const db = getDatabase()
      const symbolsRow = db.prepare('SELECT COUNT(*) as count FROM ast_symbols').get() as any
      const refsRow = db.prepare('SELECT COUNT(*) as count FROM ast_references').get() as any
      const filesRow = db.prepare('SELECT COUNT(DISTINCT file_path) as count FROM ast_symbols').get() as any
      return {
        files: filesRow?.count || 0,
        symbols: symbolsRow?.count || 0,
        references: refsRow?.count || 0,
      }
    } catch (err) {
      console.error('[CodeIntelligenceService] Failed to load index stats:', err)
      return { files: 0, symbols: 0, references: 0 }
    }
  }

  /**
   * Sets up a real-time chokidar watcher for incremental updates on file actions.
   */
  private setupWatcher(): void {
    if (!this.workspacePath) return

    // SECURITY & PERFORMANCE: Disable recursive filesystem watcher on root drives (e.g. D:\, C:\, /)
    const isRootDrive = 
      (process.platform === 'win32' && /^[a-zA-Z]:\\?$/.test(this.workspacePath)) ||
      this.workspacePath === '/';

    if (isRootDrive) {
      console.warn(`[CodeIntelligence watcher] Disabling recursive file watcher on root drive ${this.workspacePath} to prevent system lag and handle exhaustion.`);
      return
    }

    console.log('[CodeIntelligence] Setting up chokidar workspace watcher...')

    const ignoredDirs = [
      'node_modules', '.git', '.vscode', 'dist', 'build', 'out', 'bin', 'obj',
      '__pycache__', '.venv', 'env', '$RECYCLE.BIN', 'System Volume Information',
      'vscode/extensions'
    ]

    this.watcher = chokidar.watch(this.workspacePath, {
      ignored: (filePath: string) => {
        const normalized = filePath.replace(/\\/g, '/')
        if (ignoredDirs.some(dir => normalized.includes(`/${dir}/`) || normalized.endsWith(`/${dir}`))) {
          return true
        }
        if (normalized.endsWith('.asar')) {
          return true
        }
        return false
      },
      persistent: true,
      ignoreInitial: true, // Only trigger on modified/created files
      ignorePermissionErrors: true,
      awaitWriteFinish: {
        stabilityThreshold: 300,
        pollInterval: 100
      }
    })

    this.watcher.on('add', (filePath) => {
      console.log(`[CodeIntelligence watcher] File added: ${filePath}`)
      this.indexFile(filePath)
    })

    this.watcher.on('change', (filePath) => {
      console.log(`[CodeIntelligence watcher] File modified: ${filePath}`)
      this.indexFile(filePath)
    })

    this.watcher.on('unlink', (filePath) => {
      console.log(`[CodeIntelligence watcher] File deleted: ${filePath}`)
      if (this.workspacePath) {
        try {
          const db = getDatabase()
          const cleanPath = filePath.replace(/\\/g, '/')
          const cleanWorkspace = this.workspacePath.replace(/\\/g, '/')
          db.prepare('DELETE FROM ast_symbols WHERE workspace_path = ? AND file_path = ?').run(cleanWorkspace, cleanPath)
          db.prepare('DELETE FROM ast_references WHERE workspace_path = ? AND source_file_path = ?').run(cleanWorkspace, cleanPath)
        } catch (err) {
          console.error('[CodeIntelligence watcher] Failed to purge deleted file from DB:', err)
        }
      }
    })
  }

  /**
   * ── AST TypeScript/JavaScript Parser (Compiler-API Backed) ──
   */
  private parseTypeScript(filePath: string, content: string): { symbols: any[]; references: any[] } {
    const sourceFile = ts.createSourceFile(filePath, content, ts.ScriptTarget.Latest, true)
    const symbols: any[] = []
    const references: any[] = []

    const visit = (node: ts.Node, containerName?: string) => {
      if (ts.isClassDeclaration(node) && node.name) {
        const name = node.name.text
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd())
        symbols.push({
          name,
          kind: 'Class',
          containerName,
          startLine: start.line + 1,
          startColumn: start.character + 1,
          endLine: end.line + 1,
          endColumn: end.character + 1,
          signature: 'class ' + name
        })
        node.members.forEach((member) => visit(member, name))
        return
      }

      if (ts.isInterfaceDeclaration(node) && node.name) {
        const name = node.name.text
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd())
        symbols.push({
          name,
          kind: 'Interface',
          containerName,
          startLine: start.line + 1,
          startColumn: start.character + 1,
          endLine: end.line + 1,
          endColumn: end.character + 1,
          signature: 'interface ' + name
        })
        return
      }

      if (ts.isFunctionDeclaration(node) && node.name) {
        const name = node.name.text
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd())
        symbols.push({
          name,
          kind: 'Function',
          containerName,
          startLine: start.line + 1,
          startColumn: start.character + 1,
          endLine: end.line + 1,
          endColumn: end.character + 1,
          signature: 'function ' + name
        })
        return
      }

      if (ts.isMethodDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        const name = node.name.text
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd())
        symbols.push({
          name,
          kind: 'Method',
          containerName,
          startLine: start.line + 1,
          startColumn: start.character + 1,
          endLine: end.line + 1,
          endColumn: end.character + 1,
          signature: 'method ' + name
        })
        return
      }

      if (ts.isVariableDeclaration(node) && node.name && ts.isIdentifier(node.name)) {
        const name = node.name.text
        const start = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile))
        const end = sourceFile.getLineAndCharacterOfPosition(node.getEnd())
        const isArrowFunc = node.initializer && (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer))
        
        symbols.push({
          name,
          kind: isArrowFunc ? 'Function' : 'Variable',
          containerName,
          startLine: start.line + 1,
          startColumn: start.character + 1,
          endLine: end.line + 1,
          endColumn: end.character + 1,
          signature: (isArrowFunc ? 'const ' : 'let ') + name
        })
      }

      if (ts.isImportDeclaration(node)) {
        if (node.importClause) {
          if (node.importClause.name) {
            const name = node.importClause.name.text
            const pos = sourceFile.getLineAndCharacterOfPosition(node.importClause.name.getStart(sourceFile))
            references.push({
              targetName: name,
              kind: 'import',
              line: pos.line + 1,
              column: pos.character + 1
            })
          }
          if (node.importClause.namedBindings && ts.isNamedImports(node.importClause.namedBindings)) {
            node.importClause.namedBindings.elements.forEach((element) => {
              const name = element.name.text
              const pos = sourceFile.getLineAndCharacterOfPosition(element.name.getStart(sourceFile))
              references.push({
                targetName: name,
                kind: 'import',
                line: pos.line + 1,
                column: pos.character + 1
              })
            })
          }
        }
      }

      if (ts.isCallExpression(node) && ts.isIdentifier(node.expression)) {
        const name = node.expression.text
        const pos = sourceFile.getLineAndCharacterOfPosition(node.expression.getStart(sourceFile))
        references.push({
          targetName: name,
          kind: 'call',
          line: pos.line + 1,
          column: pos.character + 1
        })
      }

      ts.forEachChild(node, (child) => visit(child, containerName))
    }

    visit(sourceFile)
    return { symbols, references }
  }

  /**
   * ── AST Python Parser (Indentation & State Based) ──
   */
  private parsePython(_filePath: string, content: string): { symbols: any[]; references: any[] } {
    const symbols: any[] = []
    const references: any[] = []
    const lines = content.split('\n')
    let currentClass: string | undefined = undefined

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimLine = line.trim()

      const classMatch = line.match(/^class\s+([a-zA-Z0-9_]+)/)
      if (classMatch) {
        currentClass = classMatch[1]
        symbols.push({
          name: currentClass,
          kind: 'Class',
          containerName: undefined,
          startLine: i + 1,
          startColumn: line.indexOf(currentClass) + 1,
          endLine: i + 1,
          endColumn: line.length,
          signature: 'class ' + currentClass
        })
        continue
      }

      const defMatch = line.match(/^\s*def\s+([a-zA-Z0-9_]+)/)
      if (defMatch) {
        const name = defMatch[1]
        const isMethod = line.startsWith(' ') || line.startsWith('\t')
        symbols.push({
          name,
          kind: isMethod ? 'Method' : 'Function',
          containerName: isMethod ? currentClass : undefined,
          startLine: i + 1,
          startColumn: line.indexOf(name) + 1,
          endLine: i + 1,
          endColumn: line.length,
          signature: 'def ' + name
        })
        continue
      }

      if (currentClass && line.length > 0 && !line.startsWith(' ') && !line.startsWith('\t') && !trimLine.startsWith('#')) {
        currentClass = undefined
      }

      if (trimLine.startsWith('import ') || trimLine.startsWith('from ')) {
        const importParts = trimLine.split(/\s+/)
        if (trimLine.startsWith('import ')) {
          const names = importParts.slice(1).join('').split(',')
          names.forEach((n) => {
            const cleanName = n.trim()
            if (cleanName) {
              references.push({
                targetName: cleanName,
                kind: 'import',
                line: i + 1,
                column: line.indexOf(cleanName) + 1
              })
            }
          })
        } else if (trimLine.startsWith('from ')) {
          const importIdx = importParts.indexOf('import')
          if (importIdx !== -1) {
            const names = importParts.slice(importIdx + 1).join('').split(',')
            names.forEach((n) => {
              const cleanName = n.trim()
              if (cleanName) {
                references.push({
                  targetName: cleanName,
                  kind: 'import',
                  line: i + 1,
                  column: line.indexOf(cleanName) + 1
                })
              }
            })
          }
        }
      }

      const callMatches = trimLine.matchAll(/(?:[a-zA-Z0-9_]+\.)?([a-zA-Z0-9_]+)\s*\(/g)
      for (const match of callMatches) {
        const name = match[1]
        if (name && !['if', 'elif', 'for', 'while', 'with', 'print', 'len', 'range', 'def', 'class'].includes(name)) {
          references.push({
            targetName: name,
            kind: 'call',
            line: i + 1,
            column: line.indexOf(name) + 1
          })
        }
      }
    }

    return { symbols, references }
  }

  /**
   * ── Pattern-based AST Fallback Parser for other languages (Rust, Go, Java, etc.) ──
   */
  private parseFallback(_filePath: string, content: string): { symbols: any[]; references: any[] } {
    const symbols: any[] = []
    const references: any[] = []
    const lines = content.split('\n')

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i]
      const trimLine = line.trim()

      const classMatch = trimLine.match(/^(?:pub\s+)?(?:struct|class|interface)\s+([a-zA-Z0-9_]+)/)
      if (classMatch) {
        symbols.push({
          name: classMatch[1],
          kind: 'Class',
          containerName: undefined,
          startLine: i + 1,
          startColumn: line.indexOf(classMatch[1]) + 1,
          endLine: i + 1,
          endColumn: line.length,
          signature: classMatch[0]
        })
        continue
      }

      const fnMatch = trimLine.match(/^(?:pub\s+)?(?:fn|function|def)\s+([a-zA-Z0-9_]+)/)
      if (fnMatch) {
        symbols.push({
          name: fnMatch[1],
          kind: 'Function',
          containerName: undefined,
          startLine: i + 1,
          startColumn: line.indexOf(fnMatch[1]) + 1,
          endLine: i + 1,
          endColumn: line.length,
          signature: fnMatch[0]
        })
        continue
      }
    }

    return { symbols, references }
  }
}

registerSingleton(ICodeIntelligenceService, CodeIntelligenceService, InstantiationType.Delayed);
