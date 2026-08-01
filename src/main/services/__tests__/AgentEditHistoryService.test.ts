import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import * as fs from 'fs'
import * as path from 'path'
import * as os from 'os'
import { agentEditHistoryService } from '../AgentEditHistoryService'

describe('AgentEditHistoryService', () => {
  let tmpDir: string
  let testFile: string

  beforeEach(async () => {
    tmpDir = await fs.promises.mkdtemp(path.join(os.tmpdir(), 'lumiq-edit-test-'))
    testFile = path.join(tmpDir, 'sample.ts')
    await fs.promises.writeFile(testFile, 'const initial = 1;', 'utf-8')
  })

  afterEach(async () => {
    try {
      await fs.promises.rm(tmpDir, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('should record an edit snapshot and retrieve history', () => {
    const snapshot = agentEditHistoryService.recordEdit(
      'session-123',
      testFile,
      'const initial = 1;',
      'const initial = 2;',
      'Updated initial value'
    )

    expect(snapshot).toBeDefined()
    expect(snapshot.id).toBeDefined()
    expect(snapshot.filePath).toBe(testFile)

    const history = agentEditHistoryService.getHistory('session-123')
    expect(history.length).toBeGreaterThanOrEqual(1)
    expect(history[0].id).toBe(snapshot.id)
  })

  it('should undo an edit and restore previous content', async () => {
    const snapshot = agentEditHistoryService.recordEdit(
      'session-456',
      testFile,
      'const initial = 1;',
      'const modified = 99;',
      'Changed variable name'
    )

    // Write new content
    await fs.promises.writeFile(testFile, 'const modified = 99;', 'utf-8')

    // Undo edit
    const success = await agentEditHistoryService.undoEdit(snapshot.id)
    expect(success).toBe(true)

    const restoredContent = await fs.promises.readFile(testFile, 'utf-8')
    expect(restoredContent).toBe('const initial = 1;')
  })

  it('should redo an undone edit', async () => {
    const snapshot = agentEditHistoryService.recordEdit(
      'session-789',
      testFile,
      'const initial = 1;',
      'const redoTest = true;',
      'Redo test edit'
    )

    await fs.promises.writeFile(testFile, 'const redoTest = true;', 'utf-8')
    await agentEditHistoryService.undoEdit(snapshot.id)

    const undoContent = await fs.promises.readFile(testFile, 'utf-8')
    expect(undoContent).toBe('const initial = 1;')

    const redoSuccess = await agentEditHistoryService.redoEdit(snapshot.id)
    expect(redoSuccess).toBe(true)

    const redoContent = await fs.promises.readFile(testFile, 'utf-8')
    expect(redoContent).toBe('const redoTest = true;')
  })
})
