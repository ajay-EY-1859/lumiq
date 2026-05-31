import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs'

const tempUserDataPath = join(__dirname, 'temp_self_healing_test')

// Mock electron app before importing database / DiagnosticsWatcher
vi.mock('electron', () => {
  const mockWebContents = {
    send: vi.fn()
  }
  const mockWindow = {
    isDestroyed: () => false,
    webContents: mockWebContents
  }
  const app = {
    getPath: (name: string) => {
      if (name === 'userData') {
        return tempUserDataPath
      }
      return '/tmp'
    }
  }
  const BrowserWindow = {
    getFocusedWindow: () => mockWindow,
    getAllWindows: () => [mockWindow]
  }
  const session = {
    defaultSession: {}
  }
  const ipcMain = {
    handle: vi.fn(),
    on: vi.fn(),
    removeListener: vi.fn()
  }
  const shell = {
    openExternal: vi.fn()
  }
  return {
    app,
    BrowserWindow,
    session,
    ipcMain,
    shell
  }
})

// Mock AI provider to return a pre-configured repair patch
const mockProvider = {
  sendMessage: vi.fn()
}

vi.mock('../../../providers/ProviderFactory', () => {
  return {
    ProviderFactory: {
      create: () => mockProvider
    }
  }
})

vi.mock('../../../auth/devMode', () => {
  return {
    isDeveloperMode: () => false
  }
})

import { initDatabase, closeDatabase, getDatabase } from '../../../db/database'
import { DiagnosticsWatcher } from '../DiagnosticsWatcher'
import { SandboxRunner } from '../SandboxRunner'

describe('Self-Healing Integration & Verification', () => {
  const workspaceDir = join(tempUserDataPath, 'mock_workspace')

  beforeAll(() => {
    if (!existsSync(tempUserDataPath)) {
      mkdirSync(tempUserDataPath, { recursive: true })
    }
    if (!existsSync(workspaceDir)) {
      mkdirSync(workspaceDir, { recursive: true })
    }
    initDatabase()
  })

  afterAll(() => {
    try {
      closeDatabase()
    } catch {
      // ignore
    }
    try {
      rmSync(tempUserDataPath, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('should detect a terminal failure, generate an AI diff, and apply it with gated sandbox validation', async () => {
    const db = getDatabase()

    // Setup active session
    const sessionId = 'self-heal-session-1'
    db.prepare("INSERT OR REPLACE INTO sessions (id, title, provider, model, workspace_path) VALUES (?, ?, ?, ?, ?)").run(
      sessionId,
      'Self Healing Test Session',
      'openai',
      'gpt-4o',
      workspaceDir
    )
    db.prepare("UPDATE sessions SET updated_at = datetime('now', '-10 seconds') WHERE id = ?").run(sessionId)

    // Setup active API config so FixSubagent can resolve it
    db.prepare("INSERT OR REPLACE INTO api_configs (id, provider, default_model, is_active) VALUES ('openai-id', 'openai', 'gpt-4o', 1)").run()

    // 1. Create a mock file with a syntax error
    const testFile = join(workspaceDir, 'error.js')
    writeFileSync(testFile, 'console.log("Starting");\nlet x = ;\nconsole.log("Ended");\n')

    // 2. Setup mock AI response returning a corrective replacement patch
    mockProvider.sendMessage.mockReset()
    mockProvider.sendMessage.mockResolvedValue({
      content: JSON.stringify({
        explanation: 'Assigned 42 to resolve syntax error.',
        filePath: 'error.js',
        targetContent: 'let x = ;',
        replacementContent: 'let x = 42;'
      }),
      tokensUsed: 100,
      stopReason: 'stop'
    })

    // 3. Simulate command failure
    // A syntax error in node leads to exit code 1
    const command = `node -c "${testFile}"`
    const output = `SyntaxError: Unexpected token ';'\n    at ${testFile}:2:9`

    await DiagnosticsWatcher.handleCommandOutcome(command, 1, output, workspaceDir)

    // Poll up to 30 times (3 seconds) to let FixSubagent finish asynchronously
    let attempt: any = null
    for (let i = 0; i < 30; i++) {
      attempt = db.prepare("SELECT * FROM self_healing_attempts WHERE session_id = ?").get(sessionId) as any
      if (attempt && attempt.status !== 'analyzing') {
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (attempt && attempt.status === 'failed') {
      console.log('--- TEST 1 FIX SUBAGENT LOGS ---', attempt.execution_logs)
    }

    expect(attempt).toBeDefined()
    expect(attempt.status).toBe('proposed')
    expect(attempt.error_message).toContain('error.js')
    expect(attempt.command).toBe(command)

    const proposedDiff = JSON.parse(attempt.proposed_diff)
    expect(proposedDiff.filePath).toBe('error.js')
    expect(proposedDiff.replacementContent).toBe('let x = 42;')

    // 4. Sandbox validation (gated validation command will compile testFile successfully)
    const applyResult = await SandboxRunner.applyAndValidate(attempt.id)
    expect(applyResult.success).toBe(true)

    // Assert file was successfully patched on disk
    const patchedContent = readFileSync(testFile, 'utf-8')
    expect(patchedContent).toContain('let x = 42;')
    expect(patchedContent).not.toContain('let x = ;')

    // Assert database status updated to 'applied'
    const finalAttempt = db.prepare("SELECT * FROM self_healing_attempts WHERE id = ?").get(attempt.id) as any
    expect(finalAttempt.status).toBe('applied')
  })

  it('should automatically rollback changes if validation fails after applying a patch', async () => {
    const db = getDatabase()
    const sessionId = 'self-heal-session-2'
    db.prepare("INSERT OR REPLACE INTO sessions (id, title, provider, model, workspace_path) VALUES (?, ?, ?, ?, ?)").run(
      sessionId,
      'Self Healing Test Session 2',
      'openai',
      'gpt-4o',
      workspaceDir
    )
    db.prepare("UPDATE sessions SET updated_at = datetime('now', '+10 seconds') WHERE id = ?").run(sessionId)

    // 1. Create a mock file with a syntax error
    const testFile = join(workspaceDir, 'error-fail.js')
    writeFileSync(testFile, 'console.log("Starting");\nlet y = ;\n')

    // 2. Setup mock AI response proposing a patch that is STILL a syntax error
    mockProvider.sendMessage.mockReset()
    mockProvider.sendMessage.mockResolvedValue({
      content: JSON.stringify({
        explanation: 'Proposes invalid fix.',
        filePath: 'error-fail.js',
        targetContent: 'let y = ;',
        replacementContent: 'let y = = 100;' // STILL a syntax error!
      }),
      tokensUsed: 100,
      stopReason: 'stop'
    })

    const command = `node -c "${testFile}"`
    const output = `SyntaxError: Unexpected token ';'`

    await DiagnosticsWatcher.handleCommandOutcome(command, 1, output, workspaceDir)

    // Poll up to 30 times (3 seconds) to let FixSubagent finish asynchronously
    let attempt: any = null
    for (let i = 0; i < 30; i++) {
      attempt = db.prepare("SELECT * FROM self_healing_attempts WHERE session_id = ?").get(sessionId) as any
      if (attempt && attempt.status !== 'analyzing') {
        break
      }
      await new Promise(resolve => setTimeout(resolve, 100))
    }

    if (attempt && attempt.status === 'failed') {
      console.log('--- TEST 2 FIX SUBAGENT LOGS ---', attempt.execution_logs)
    }

    expect(attempt).toBeDefined()
    expect(attempt.status).toBe('proposed')

    // 3. Sandbox validation (should FAIL because of double equals syntax error)
    const applyResult = await SandboxRunner.applyAndValidate(attempt.id)
    expect(applyResult.success).toBe(false)
    expect(applyResult.error).toContain('Validation failed')

    // Assert that the file was atomically ROLLED BACK to its original content
    const finalContent = readFileSync(testFile, 'utf-8')
    expect(finalContent).toBe('console.log("Starting");\nlet y = ;\n') // back to syntax error

    // Assert database status updated to 'failed'
    const finalAttempt = db.prepare("SELECT * FROM self_healing_attempts WHERE id = ?").get(attempt.id) as any
    expect(finalAttempt.status).toBe('failed')
  })
})
