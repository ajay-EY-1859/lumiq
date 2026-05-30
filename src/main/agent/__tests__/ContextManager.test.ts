import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync } from 'fs'

const tempUserDataPath = join(__dirname, 'temp_context_manager_test')

// Mock electron
vi.mock('electron', () => {
  const mockWebContents = {
    send: vi.fn()
  }
  const mockWindow = {
    isDestroyed: () => false,
    webContents: mockWebContents
  }
  return {
    app: {
      getPath: (name: string) => {
        if (name === 'userData') {
          return tempUserDataPath
        }
        return '/tmp'
      }
    },
    BrowserWindow: {
      getFocusedWindow: () => mockWindow,
      getAllWindows: () => [mockWindow]
    }
  }
})

import { initDatabase, closeDatabase, getDatabase } from '../../db/database'
import { ContextManager } from '../ContextManager'
import { userProfileManager } from '../UserProfileManager'
import type { Message } from '@shared/types'

describe('ContextManager & Memory Injection Tests', () => {
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

  it('should inject long-term user facts into the system prompt', () => {
    // Add some facts
    userProfileManager.addFact('tech_stack', 'Prefers TypeScript over Javascript', 0.9)
    userProfileManager.addFact('os', 'Runs Windows 11', 0.8)

    const contextManager = new ContextManager(150, 4096)
    const messages: Message[] = [
      {
        id: '1',
        sessionId: 'test-session',
        role: 'system',
        content: 'System prompt instructions.',
        createdAt: new Date().toISOString()
      },
      {
        id: '2',
        sessionId: 'test-session',
        role: 'user',
        content: 'Hello, what is my favorite language?',
        createdAt: new Date().toISOString()
      }
    ]

    const result = contextManager.trimMessages(messages, 'test-session')

    // Find the system prompt in the result
    const systemPrompt = result.find((m) => m.role === 'system')
    expect(systemPrompt).toBeDefined()
    expect(systemPrompt?.content).toContain('[TECH_STACK] Prefers TypeScript over Javascript')
    expect(systemPrompt?.content).toContain('[OS] Runs Windows 11')

    // Clean up facts
    const db = getDatabase()
    db.prepare('DELETE FROM user_profile_knowledge').run()
  })

  it('should inject compacted chat summaries when session summaries exist', () => {
    const db = getDatabase()
    const sessionId = 'compact-session'

    // Add session summary block
    db.prepare(`
      INSERT INTO chat_summaries (id, session_id, start_message_id, end_message_id, summary_content)
      VALUES (?, ?, ?, ?, ?)
    `).run('sum-1', sessionId, 'msg-1', 'msg-10', '- Discussed building an electron app.\n- Selected SQLite for db.')

    const contextManager = new ContextManager(150, 4096)
    const messages: Message[] = [
      {
        id: '11',
        sessionId: sessionId,
        role: 'user',
        content: 'What did we decide earlier?',
        createdAt: new Date().toISOString()
      }
    ]

    const result = contextManager.trimMessages(messages, sessionId)

    const systemPrompt = result.find((m) => m.role === 'system')
    expect(systemPrompt).toBeDefined()
    expect(systemPrompt?.content).toContain('COMPRESSED HISTORY SUMMARIES')
    expect(systemPrompt?.content).toContain('Selected SQLite for db.')

    // Clean up summaries
    db.prepare('DELETE FROM chat_summaries').run()
  })
})
