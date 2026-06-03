import * as ts from 'typescript'
import { join } from 'path'
import { readFileSync, existsSync, promises as fsPromises } from 'fs'
import { parentPort, workerData } from 'worker_threads'

interface SymbolRefData {
  symbols: any[]
  references: any[]
}

const { workspacePath, maxFiles } = workerData as { workspacePath: string; maxFiles: number }

if (!parentPort || !workspacePath) {
  process.exit(0)
}

function parseTypeScript(filePath: string, content: string): SymbolRefData {
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

function parsePython(content: string): SymbolRefData {
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

function parseFallback(content: string): SymbolRefData {
  const symbols: any[] = []
  const references: any[] = []
  const lines = content.split('\n')

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const trimLine = line.trim()

    const classMatch = trimLine.match(/^(?:pub\s+)?(struct|class|interface)\s+([a-zA-Z0-9_]+)/)
    if (classMatch) {
      symbols.push({
        name: classMatch[2],
        kind: 'Class',
        containerName: undefined,
        startLine: i + 1,
        startColumn: line.indexOf(classMatch[2]) + 1,
        endLine: i + 1,
        endColumn: line.length,
        signature: classMatch[0]
      })
      continue
    }

    const fnMatch = trimLine.match(/^(?:pub\s+)?(fn|function|def)\s+([a-zA-Z0-9_]+)/)
    if (fnMatch) {
      symbols.push({
        name: fnMatch[2],
        kind: 'Function',
        containerName: undefined,
        startLine: i + 1,
        startColumn: line.indexOf(fnMatch[2]) + 1,
        endLine: i + 1,
        endColumn: line.length,
        signature: fnMatch[0]
      })
      continue
    }
  }

  return { symbols, references }
}

const EXCLUDED_DIRS = new Set([
  'node_modules',
  '.git',
  'dist',
  'build',
  'out',
  'bin',
  'obj',
  '__pycache__',
  '.venv',
  'env',
  'system volume information',
  'vscode/extensions'
])

const isExcluded = (name: string, path: string) => {
  const lowerName = name.toLowerCase()
  if (lowerName.startsWith('.') || lowerName.startsWith('$') || EXCLUDED_DIRS.has(lowerName)) {
    return true
  }

  const norm = path.toLowerCase().replace(/\\/g, '/')
  return (
    norm.includes('/node_modules/') ||
    norm.includes('/.git/') ||
    norm.includes('/dist/') ||
    norm.includes('/build/') ||
    norm.includes('/out/') ||
    norm.includes('/bin/') ||
    norm.includes('/obj/') ||
    norm.includes('/__pycache__/') ||
    norm.includes('/.venv/') ||
    norm.includes('/env/') ||
    norm.includes('/system volume information/') ||
    norm.includes('/vscode/extensions/') ||
    norm.endsWith('.asar')
  )
}

const isIndexable = (name: string) => {
  const ext = name.split('.').pop()?.toLowerCase()
  return ext ? ['js', 'jsx', 'ts', 'tsx', 'py', 'rs', 'go', 'java', 'cs', 'rb', 'php'].includes(ext) : false
}

async function runScan() {
  const startTime = Date.now()
  const indexableFiles: string[] = []
  const queue = [workspacePath]

  // Traverse directory structure asynchronously to gather paths in background
  while (queue.length > 0 && indexableFiles.length < maxFiles) {
    const currentDir = queue.shift()!
    try {
      const children = await fsPromises.readdir(currentDir)
      for (const child of children) {
        const childPath = join(currentDir, child)
        if (isExcluded(child, childPath)) continue

        try {
          const stats = await fsPromises.stat(childPath)
          if (stats.isDirectory()) {
            queue.push(childPath)
          } else if (stats.isFile() && isIndexable(child)) {
            indexableFiles.push(childPath)
          }
        } catch {
          // Ignore stat errors
        }
      }
    } catch {
      // Ignore read dir errors
    }

    // Yield to keep thread responsive to exits
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  parentPort!.postMessage({
    type: 'discovered',
    count: indexableFiles.length
  })

  let filesProcessed = 0
  let symbolsCount = 0
  let referencesCount = 0
  let batch: any[] = []
  const BATCH_SIZE = 100

  for (const file of indexableFiles) {
    try {
      if (!existsSync(file)) continue
      const content = readFileSync(file, 'utf-8')
      const ext = file.split('.').pop()?.toLowerCase() ?? ''
      let parseResult: SymbolRefData

      if (['ts', 'tsx', 'js', 'jsx'].includes(ext)) {
        parseResult = parseTypeScript(file, content)
      } else if (ext === 'py') {
        parseResult = parsePython(content)
      } else {
        parseResult = parseFallback(content)
      }

      symbolsCount += parseResult.symbols.length
      referencesCount += parseResult.references.length
      filesProcessed++

      batch.push({
        filePath: file,
        symbols: parseResult.symbols,
        references: parseResult.references
      })

      if (batch.length >= BATCH_SIZE) {
        parentPort!.postMessage({
          type: 'batch_indexed',
          batch
        })
        batch = []
      }
    } catch (err) {
      // Ignore parsing errors for individual files
    }

    // Yield after every file to allow the worker thread loop to be interrupted or handle other messages
    await new Promise((resolve) => setTimeout(resolve, 0))
  }

  // Send any remaining items in the last batch
  if (batch.length > 0) {
    parentPort!.postMessage({
      type: 'batch_indexed',
      batch
    })
  }

  const durationMs = Date.now() - startTime
  parentPort!.postMessage({
    type: 'done',
    filesProcessed,
    symbolsCount,
    referencesCount,
    durationMs
  })
}

runScan().catch((err) => {
  parentPort!.postMessage({
    type: 'error',
    error: err instanceof Error ? err.message : String(err)
  })
})
