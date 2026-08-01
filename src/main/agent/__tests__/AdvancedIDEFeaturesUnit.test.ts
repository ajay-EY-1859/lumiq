import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync } from 'fs'

const tempUserDataPath = join(__dirname, 'temp_advanced_features_unit_test')

// Mock electron app path
vi.mock('electron', () => {
  const app = {
    isPackaged: false,
    getPath: (name: string) => {
      if (name === 'userData') return tempUserDataPath
      return '/tmp'
    }
  }
  const BrowserWindow = {
    getFocusedWindow: () => null,
    getAllWindows: () => []
  }
  const dialog = {
    showMessageBox: () => Promise.resolve({ response: 0 })
  }
  return {
    app,
    BrowserWindow,
    dialog,
    default: {
      app,
      BrowserWindow,
      dialog
    }
  }
})

vi.mock('@electron-toolkit/utils', () => {
  return {
    is: {
      dev: true
    }
  }
})

import { initDatabase, closeDatabase, getDatabase } from '../../db/database'
import { userProfileManager } from '../UserProfileManager'
import { contextCompactor } from '../ContextCompactor'
import { ragQueryEngine } from '../RAGQueryEngine'
import { embeddingManager } from '../EmbeddingManager'

describe('Advanced IDE Features - Unit Tests', () => {
  beforeAll(() => {
    if (!existsSync(tempUserDataPath)) {
      mkdirSync(tempUserDataPath, { recursive: true })
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

  it('should run fact consolidation sweep successfully', async () => {
    // Add two facts that are semantically related
    userProfileManager.addFact('tech_stack', 'Prefers TypeScript for development', 0.9)
    userProfileManager.addFact('tech_stack', 'Likes to use TypeScript over JS', 0.8)

    // Verify they are added
    const facts = userProfileManager.getFacts()
    expect(facts.length).toBeGreaterThanOrEqual(2)

    const spy = vi.spyOn(embeddingManager, 'cosineSimilarity').mockReturnValue(0.8)
    
    // Stub the configs database call to prevent real API connection
    const db = getDatabase()
    db.prepare("INSERT OR REPLACE INTO api_configs (id, provider, default_model, is_active) VALUES ('mock-gemini', 'gemini', 'gemini-1.5-flash', 0)").run()

    await userProfileManager.consolidateFacts()
    spy.mockRestore()

    // Clean up
    db.prepare('DELETE FROM user_profile_knowledge').run()
  })

  it('should run topic compaction segment boundaries detection', async () => {
    const sessionId = 'topic-compaction-session'
    const db = getDatabase()
    
    db.prepare(`
      INSERT OR REPLACE INTO sessions (id, title, provider, model)
      VALUES (?, ?, ?, ?)
    `).run(sessionId, 'Topic Session', 'openai', 'gpt-4o')

    // Add multiple user and assistant messages representing different topics
    db.prepare(`
      INSERT INTO messages (id, session_id, role, content)
      VALUES 
        ('m1', ?, 'user', 'How do I query sqlite in node?'),
        ('m2', ?, 'assistant', 'Use better-sqlite3 package.'),
        ('m3', ?, 'user', 'What styling changes should I make to my layout?'),
        ('m4', ?, 'assistant', 'Use flexbox padding.')
    `).run(sessionId, sessionId, sessionId, sessionId)

    const spyEmbed = vi.spyOn(embeddingManager, 'getEmbedding').mockResolvedValue(new Float32Array(1536) as any)
    const spySim = vi.spyOn(embeddingManager, 'cosineSimilarity').mockReturnValue(0.2) // Low similarity indicates boundary!

    await contextCompactor.checkAndCompactSession(sessionId, { provider: 'openai', defaultModel: 'gpt-4o', isActive: true } as any, 'gpt-4o')
    
    spyEmbed.mockRestore()
    spySim.mockRestore()

    // Clean up
    db.prepare('DELETE FROM sessions WHERE id = ?').run(sessionId)
  })

  it('should perform AST Graph-RAG dependency matching', async () => {
    const db = getDatabase()
    const workspace = '/mock/project/ast'
    
    // Add mock symbols and references
    db.prepare(`
      INSERT OR REPLACE INTO ast_symbols (id, workspace_path, file_path, name, kind, signature, start_line, start_column, end_line, end_column)
      VALUES 
        ('sym1', ?, 'src/IUserRepo.ts', 'IUserRepository', 'interface', 'export interface IUserRepository {}', 1, 1, 1, 1)
    `).run(workspace)

    db.prepare(`
      INSERT OR REPLACE INTO ast_references (id, workspace_path, source_file_path, target_name, kind, line, column)
      VALUES 
        ('ref1', ?, 'src/UserService.ts', 'IUserRepository', 'implements', 1, 1)
    `).run(workspace)

    // Call getSemanticPromptSegment
    const mockMatches = [
      { filePath: 'src/UserService.ts', chunkIndex: 0, content: 'class UserService implements IUserRepository {}', score: 0.9 }
    ]
    
    const spySearch = vi.spyOn(ragQueryEngine, 'search').mockResolvedValue(mockMatches)
    const segment = await ragQueryEngine.getSemanticPromptSegment(workspace, 'UserService')
    
    expect(segment).toContain('AST CODE CALL GRAPH DEPENDENCY SIGNATURES')
    expect(segment).toContain('IUserRepository')
    expect(segment).toContain('src/IUserRepo.ts')

    spySearch.mockRestore()

    // Clean up
    db.prepare("DELETE FROM ast_symbols WHERE workspace_path = ?").run(workspace)
    db.prepare("DELETE FROM ast_references WHERE workspace_path = ?").run(workspace)
  })

  it('should perform AST Graph-RAG dependency matching with multiple symbols', async () => {
    const db = getDatabase()
    const workspace = '/mock/project/ast-multi'
    
    // Add multiple mock symbols and references
    db.prepare(`
      INSERT OR REPLACE INTO ast_symbols (id, workspace_path, file_path, name, kind, signature, start_line, start_column, end_line, end_column)
      VALUES 
        ('sym-multi-1', ?, 'src/Logger.ts', 'Logger', 'class', 'export class Logger {}', 1, 1, 1, 1),
        ('sym-multi-2', ?, 'src/Config.ts', 'Config', 'class', 'export class Config {}', 1, 1, 1, 1)
    `).run(workspace, workspace)

    db.prepare(`
      INSERT OR REPLACE INTO ast_references (id, workspace_path, source_file_path, target_name, kind, line, column)
      VALUES 
        ('ref-multi-1', ?, 'src/MainService.ts', 'Logger', 'call', 2, 5),
        ('ref-multi-2', ?, 'src/MainService.ts', 'Config', 'call', 3, 5)
    `).run(workspace, workspace)

    // Call getSemanticPromptSegment
    const mockMatches = [
      { filePath: 'src/MainService.ts', chunkIndex: 0, content: 'class MainService { constructor() { new Logger(); new Config(); } }', score: 0.95 }
    ]
    
    const spySearch = vi.spyOn(ragQueryEngine, 'search').mockResolvedValue(mockMatches)
    const segment = await ragQueryEngine.getSemanticPromptSegment(workspace, 'MainService')
    
    expect(segment).toContain('AST CODE CALL GRAPH DEPENDENCY SIGNATURES')
    expect(segment).toContain('Logger')
    expect(segment).toContain('Config')
    expect(segment).toContain('src/Logger.ts')
    expect(segment).toContain('src/Config.ts')

    spySearch.mockRestore()

    // Clean up
    db.prepare("DELETE FROM ast_symbols WHERE workspace_path = ?").run(workspace)
    db.prepare("DELETE FROM ast_references WHERE workspace_path = ?").run(workspace)
  })
})
