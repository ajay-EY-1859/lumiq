import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync } from 'fs'

const tempUserDataPath = join(__dirname, 'temp_agent_memory_test')

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
import { createMessage, getSessionMessages } from '../../db/messages'

describe('AgentLoop - Memory Leak Stress Test', () => {
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

  it('should run 1000 chat loop simulations without leaking memory (> 15MB heap growth)', async () => {
    // Check if GC is exposed
    if (typeof global.gc !== 'function') {
      console.warn('Garbage collection not exposed. Run test with --expose-gc. Skipping memory assertion.')
    }

    // Force GC to get a clean baseline
    if (global.gc) global.gc()
    const baselineMemory = process.memoryUsage().heapUsed

    const db = getDatabase()

    // Wrap the stress loop in a database transaction to run it blazingly fast
    const runStress = db.transaction(() => {
      for (let s = 0; s < 1000; s++) {
        const sessionId = `stress-session-${s}`
        
        // Spawn/create session
        db.prepare("INSERT INTO sessions (id, title, provider, model) VALUES (?, ?, ?, ?)").run(
          sessionId,
          `Stress Session ${s}`,
          'openai',
          'gpt-4o'
        )

        // Add 50 mock messages
        for (let m = 0; m < 50; m++) {
          const role = m % 2 === 0 ? 'user' : 'assistant'
          createMessage(sessionId, role, `Stress message content ${m} for session ${s}`, {
            tokensUsed: 10,
            executionStatus: 'completed'
          })
        }

        // Fetch messages to simulate context retrieval (AgentLoop behavior)
        const msgs = getSessionMessages(sessionId)
        expect(msgs.length).toBe(50)

        // Destroy session to prevent DB file bloat and clean up memory
        db.prepare("DELETE FROM sessions WHERE id = ?").run(sessionId)
      }
    })

    runStress()

    // Trigger GC again
    if (global.gc) {
      global.gc()
      global.gc()
      global.gc()
    }

    const finalMemory = process.memoryUsage().heapUsed
    const heapGrowthMB = (finalMemory - baselineMemory) / 1024 / 1024

    console.log(`Memory Leak Profiler:`)
    console.log(`- Baseline: ${(baselineMemory / 1024 / 1024).toFixed(2)} MB`)
    console.log(`- Final: ${(finalMemory / 1024 / 1024).toFixed(2)} MB`)
    console.log(`- Growth: ${heapGrowthMB.toFixed(2)} MB`)

    if (global.gc) {
      // Memory growth must not exceed 15MB
      expect(heapGrowthMB).toBeLessThan(15)
    }
  }, 15000)
})
