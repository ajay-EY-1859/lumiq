import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'

const tempUserDataPath = join(__dirname, 'temp_collaboration_lsp_test')

vi.mock('electron', () => {
  const app = {
    isPackaged: false,
    getPath: (name: string) => {
      if (name === 'userData') return tempUserDataPath
      return '/tmp'
    }
  }
  const webContents = {
    send: vi.fn()
  }
  const browserWindow = {
    isDestroyed: () => false,
    webContents
  }
  return {
    app,
    BrowserWindow: {
      getFocusedWindow: () => browserWindow,
      getAllWindows: () => [browserWindow]
    },
    default: {
      app,
      BrowserWindow: {
        getFocusedWindow: () => browserWindow,
        getAllWindows: () => [browserWindow]
      }
    }
  }
})

import { initDatabase, closeDatabase, getDatabase } from '../../db/database'
import { CollaborationService } from '../CollaborationService'
import { LspService } from '../LspService'

describe('Collaboration and LSP Services (Milestones 31 & 32)', () => {
  const workspacePath = join(__dirname, 'mock_collab_workspace').replace(/\\/g, '/')
  const sampleFilePath = join(workspacePath, 'math.ts').replace(/\\/g, '/')

  beforeAll(() => {
    if (!existsSync(tempUserDataPath)) {
      mkdirSync(tempUserDataPath, { recursive: true })
    }
    if (!existsSync(workspacePath)) {
      mkdirSync(workspacePath, { recursive: true })
    }

    // Write a sample code file for testing getIdentifierAtPosition
    writeFileSync(sampleFilePath, 'export function multiplyNums(x: number, y: number) { return x * y; }', 'utf8')

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
      rmSync(workspacePath, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  describe('CollaborationService (Milestone 31)', () => {
    it('should create a room and generate credentials', async () => {
      const service = new CollaborationService()
      const res = await service.createRoom('Alpha Project', 'secret-key-123')
      
      expect(res.roomId).toBeDefined()
      expect(res.inviteCode).toContain('LUMIQ-')
      
      const state = service.getRoomState()
      expect(state.active).toBe(true)
      expect(state.roomName).toBe('Alpha Project')
      expect(state.users).toContain('Developer')
    })

    it('should join an existing room and append users', async () => {
      const service = new CollaborationService()
      await service.createRoom('Alpha Project', 'secret-key-123')
      
      const joined = await service.joinRoom('LUMIQ-TEST', 'Bob')
      expect(joined).toBe(true)
      
      const state = service.getRoomState()
      expect(state.users).toContain('Bob')
      expect(state.users).toContain('AI Assistant')
    })

    it('should properly XOR encrypt and decrypt payloads with passcode', async () => {
      const service = new CollaborationService()
      
      // Test default passcode encryption
      const secretMsg = 'Super Confidential Plan'
      const cipher = service.encryptPayload(secretMsg)
      expect(cipher).not.toBe(secretMsg)
      expect(typeof cipher).toBe('string')
      
      const decrypted = service.decryptPayload(cipher)
      expect(decrypted).toBe(secretMsg)

      // Test with custom room passcode
      await service.createRoom('Secure Room', 'my-custom-passcode')
      const cipher2 = service.encryptPayload(secretMsg)
      expect(cipher2).not.toBe(secretMsg)
      expect(service.decryptPayload(cipher2)).toBe(secretMsg)

      // Test decryption failure with incorrect key (simulate different service instance or wrong passcode)
      const wrongService = new CollaborationService()
      await wrongService.createRoom('Secure Room', 'wrong-passcode')
      const decryptedWrong = wrongService.decryptPayload(cipher2)
      expect(decryptedWrong).not.toBe(secretMsg)
    })

    it('should append logs to the collaboration timeline', async () => {
      const service = new CollaborationService()
      await service.createRoom('Beta Space')
      
      service.logTimelineAction('Developer', 'modified main.ts')
      const timeline = service.getTimeline()
      expect(timeline.length).toBeGreaterThanOrEqual(2) // 1 for creation, 1 for modification
      
      const lastAction = timeline[timeline.length - 1]
      expect(lastAction.user).toBe('Developer')
      expect(lastAction.action).toBe('modified main.ts')
    })

    it('should leave room and reset state', async () => {
      const service = new CollaborationService()
      await service.createRoom('Gamma Space')
      expect(service.getRoomState().active).toBe(true)
      
      await service.leaveRoom()
      expect(service.getRoomState().active).toBe(false)
      expect(service.getRoomState().roomId).toBe('')
    })
  })

  describe('LspService (Milestone 32)', () => {
    beforeAll(() => {
      const db = getDatabase()
      db.prepare('DELETE FROM ast_symbols').run()
      
      // Insert a mock symbol to test LspService falls back to SQLite AST search
      db.prepare(`
        INSERT INTO ast_symbols (id, workspace_path, file_path, name, kind, container_name, start_line, start_column, end_line, end_column, signature)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run('math::multiplyNums', workspacePath, sampleFilePath, 'multiplyNums', 'Function', '', 1, 17, 1, 29, 'multiplyNums(x: number, y: number): number')
    })

    it('should start and stop language servers', async () => {
      const service = new LspService()
      const started = await service.startLanguageServer('typescript', workspacePath)
      expect(started).toBe(true)
      
      await service.stopLanguageServer('typescript')
    })

    it('should resolve identifiers at position in files', () => {
      const service = new LspService()
      // multiplyNums is around line 1, col 20
      const word = (service as any).getIdentifierAtPosition(sampleFilePath, 1, 20)
      expect(word).toBe('multiplyNums')
    })

    it('should retrieve hover metadata from database/AST search', async () => {
      const service = new LspService()
      const hover = await service.getHover(sampleFilePath, 1, 20)
      
      expect(hover).not.toBeNull()
      expect(hover?.contents[0]).toContain('Function')
      expect(hover?.contents[0]).toContain('multiplyNums(x: number, y: number): number')
    })

    it('should fall back to generic hover documentation when symbol not found in database', async () => {
      const service = new LspService()
      const hover = await service.getHover(sampleFilePath, 1, 3) // points to "export" or "function"
      
      expect(hover).not.toBeNull()
      expect(hover?.contents[0]).toContain('Symbol')
    })

    it('should return completion items matching a symbol prefix', async () => {
      const service = new LspService()
      // Prefix match for "multi"
      const completions = await service.getCompletion(sampleFilePath, 1, 20)
      expect(completions.length).toBeGreaterThan(0)
      
      const multiplySuggestion = completions.find((c) => c.label === 'multiplyNums')
      expect(multiplySuggestion).toBeDefined()
      expect(multiplySuggestion?.insertText).toBe('multiplyNums')
    })

    it('should return signature help details for functions in DB', async () => {
      const service = new LspService()
      const sigHelp = await service.getSignatureHelp(sampleFilePath, 1, 20)
      
      expect(sigHelp).not.toBeNull()
      expect(sigHelp.signatures.length).toBe(1)
      expect(sigHelp.signatures[0].label).toBe('multiplyNums(x: number, y: number): number')
      expect(sigHelp.signatures[0].parameters.length).toBe(2)
      expect(sigHelp.signatures[0].parameters[0].label).toBe('x: number')
    })
  })
})
