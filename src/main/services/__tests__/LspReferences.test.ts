import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'

const tempUserDataPath = join(__dirname, 'temp_lsp_references_test')
const mockHandlers: Record<string, Function> = {}

// Mock electron before importing database/handlers
vi.mock('electron', () => {
  return {
    app: {
      getPath: (name: string) => {
        if (name === 'userData') {
          return tempUserDataPath
        }
        return '/tmp'
      }
    },
    ipcMain: {
      handle: (channel: string, handler: Function) => {
        mockHandlers[channel] = handler
      }
    }
  }
})

import { initDatabase, closeDatabase, getDatabase } from '../../db/database'
import { registerLspHandlers } from '../../ipc/lspHandlers'
import { IPC } from '../../../shared/types'

describe('LSP Find All References Handler', () => {
  const workspacePath = join(__dirname, 'mock_workspace').replace(/\\/g, '/')
  const utilsPath = join(workspacePath, 'utils.ts').replace(/\\/g, '/')
  const mainPath = join(workspacePath, 'main.ts').replace(/\\/g, '/')

  beforeAll(() => {
    if (!existsSync(tempUserDataPath)) {
      mkdirSync(tempUserDataPath, { recursive: true })
    }
    if (!existsSync(workspacePath)) {
      mkdirSync(workspacePath, { recursive: true })
    }

    // Write dummy code files to simulate real workspace structure
    writeFileSync(utilsPath, 'export function addNums(a: number, b: number) { return a + b; }', 'utf8')
    writeFileSync(mainPath, 'import { addNums } from "./utils";\nconst res = addNums(2, 3);\nconsole.log(res);', 'utf8')

    initDatabase()
    registerLspHandlers()
  })

  afterAll(() => {
    try {
      closeDatabase()
    } catch {}
    try {
      rmSync(tempUserDataPath, { recursive: true, force: true })
      rmSync(workspacePath, { recursive: true, force: true })
    } catch {}
  })

  it('should find references for imported symbols pointing back to target file', async () => {
    const db = getDatabase()

    // Clean tables first
    db.prepare('DELETE FROM ast_symbols').run()
    db.prepare('DELETE FROM ast_references').run()

    // 1. Insert symbol: addNums function definition inside utils.ts
    db.prepare(`
      INSERT INTO ast_symbols (id, workspace_path, file_path, name, kind, start_line, start_column, end_line, end_column)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run('utils::addNums', workspacePath, utilsPath, 'addNums', 'Function', 1, 17, 1, 24)

    // 2. Insert reference: import addNums inside main.ts
    db.prepare(`
      INSERT INTO ast_references (id, workspace_path, source_file_path, target_name, kind, line, column, module_specifier)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run('main::import::addNums', workspacePath, mainPath, 'addNums', 'import', 1, 10, './utils')

    // 3. Insert reference: call addNums inside main.ts
    db.prepare(`
      INSERT INTO ast_references (id, workspace_path, source_file_path, target_name, kind, line, column)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run('main::call::addNums', workspacePath, mainPath, 'addNums', 'call', 2, 13)

    const handler = mockHandlers[IPC.LSP_REFERENCES]
    expect(handler).toBeDefined()

    // Invoke references search for 'addNums' on the import site (line 1, col 10 in main.ts)
    // The handler should query the db, resolve './utils' to utilsPath, and find references
    const results = await handler(null, {
      workspacePath,
      filePath: mainPath,
      line: 1,
      column: 11
    })

    expect(results).toBeDefined()
    expect(results.length).toBeGreaterThanOrEqual(2)

    // Verify definition in utils.ts is present
    const defRef = results.find((r: any) => r.uri.endsWith('utils.ts') && r.range.startLineNumber === 1 && r.range.startColumn === 17)
    expect(defRef).toBeDefined()

    // Verify call site in main.ts is present
    const callRef = results.find((r: any) => r.uri.endsWith('main.ts') && r.range.startLineNumber === 2 && r.range.startColumn === 13)
    expect(callRef).toBeDefined()
  })

  it('should find references for locally defined symbols, including importing files', async () => {
    const handler = mockHandlers[IPC.LSP_REFERENCES]

    // Query references starting from the definition site inside utils.ts (line 1, col 17)
    const results = await handler(null, {
      workspacePath,
      filePath: utilsPath,
      line: 1,
      column: 18
    })

    expect(results).toBeDefined()
    // Should include: Definition, Import in main.ts, Call in main.ts
    expect(results.length).toBe(3)

    const importRef = results.find((r: any) => r.uri.endsWith('main.ts') && r.range.startLineNumber === 1 && r.range.startColumn === 10)
    expect(importRef).toBeDefined()
  })
})
