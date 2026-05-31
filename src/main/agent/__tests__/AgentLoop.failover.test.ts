import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync } from 'fs'

const tempUserDataPath = join(__dirname, 'temp_agent_failover_test')

// Mock electron app and BrowserWindow before importing database / AgentLoop
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

// Mock AI providers
const mockOpenAIProvider = {
  sendMessage: vi.fn(),
  listModels: vi.fn(),
  testConnection: vi.fn()
}

const mockAnthropicProvider = {
  sendMessage: vi.fn(),
  listModels: vi.fn(),
  testConnection: vi.fn()
}

const mockGeminiProvider = {
  sendMessage: vi.fn(),
  listModels: vi.fn(),
  testConnection: vi.fn()
}

vi.mock('../../providers/ProviderFactory', () => {
  return {
    ProviderFactory: {
      create: (config: any) => {
        if (config.provider === 'openai') return mockOpenAIProvider
        if (config.provider === 'anthropic') return mockAnthropicProvider
        if (config.provider === 'gemini') return mockGeminiProvider
        throw new Error('Unknown provider in mock')
      }
    }
  }
})

import { initDatabase, closeDatabase, getDatabase } from '../../db/database'
import { saveApiConfig } from '../../db/apiConfigs'
import { getSessionMessages } from '../../db/messages'
import { AgentLoop } from '../AgentLoop'

describe('AgentLoop Cascade Failover & Stream Stitching', () => {
  let agentLoop: AgentLoop

  beforeAll(() => {
    if (!existsSync(tempUserDataPath)) {
      mkdirSync(tempUserDataPath, { recursive: true })
    }
    initDatabase()
    agentLoop = new AgentLoop()

    // Mock setTimeout globally to run callbacks instantly to prevent slow tests
    vi.spyOn(global, 'setTimeout').mockImplementation((fn: any) => {
      fn()
      return {} as any
    })
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
    vi.restoreAllMocks()
  })

  it('should cascade failover: OpenAI (fails 4 times) -> Anthropic (fails 4 times) -> Gemini (succeeds)', async () => {
    // Save API configurations
    saveApiConfig({
      id: 'openai-id',
      provider: 'openai',
      defaultModel: 'gpt-4o',
      isActive: true
    })
    saveApiConfig({
      id: 'anthropic-id',
      provider: 'anthropic',
      defaultModel: 'claude-sonnet-4-20250514',
      isActive: true
    })
    saveApiConfig({
      id: 'gemini-id',
      provider: 'gemini',
      defaultModel: 'gemini-1.5-pro',
      isActive: true
    })

    // Setup active session in database
    const db = getDatabase()
    const sessionId = 'test-session-1'
    db.prepare("INSERT OR REPLACE INTO sessions (id, title, provider, model) VALUES (?, ?, ?, ?)").run(
      sessionId,
      'Test Failover Session',
      'openai',
      'gpt-4o'
    )

    // Mock primary (OpenAI) to fail with transient error (503 Service Unavailable)
    mockOpenAIProvider.sendMessage.mockReset()
    mockOpenAIProvider.sendMessage.mockRejectedValue(new Error('503 Service Unavailable'))

    // Mock secondary (Anthropic) to fail with rate limit (429 Rate Limit Exceeded)
    mockAnthropicProvider.sendMessage.mockReset()
    mockAnthropicProvider.sendMessage.mockRejectedValue(new Error('429 Rate Limit Exceeded'))

    // Mock tertiary (Gemini) to succeed
    mockGeminiProvider.sendMessage.mockReset()
    mockGeminiProvider.sendMessage.mockResolvedValue({
      content: 'Hello, this is Gemini!',
      tokensUsed: 15,
      stopReason: 'stop'
    })

    // Send user message
    const callbacks = {
      onChunk: vi.fn(),
      onError: vi.fn(),
      onEnd: vi.fn()
    }

    await agentLoop.processMessage(
      'Test message',
      sessionId,
      [],
      {
        id: 'openai-id',
        provider: 'openai',
        defaultModel: 'gpt-4o',
        isActive: true
      },
      {
        model: 'gpt-4o',
        callbacks
      }
    )

    // OpenAI and Anthropic should have both been tried, retried, and failed
    expect(mockOpenAIProvider.sendMessage).toHaveBeenCalled()
    expect(mockAnthropicProvider.sendMessage).toHaveBeenCalled()
    // Gemini should have been called and succeeded
    expect(mockGeminiProvider.sendMessage).toHaveBeenCalled()

    // Assert that the final result was saved successfully to DB
    const dbMessages = getSessionMessages(sessionId)
    const assistantMsg = dbMessages.find(m => m.role === 'assistant')
    expect(assistantMsg).toBeDefined()
    expect(assistantMsg?.content).toBe('Hello, this is Gemini!')
    expect(assistantMsg?.executionStatus).toBe('completed')
  })

  it('should stream-stitch: OpenAI streams 50 tokens, fails mid-stream -> Anthropic completes the rest', async () => {
    const sessionId = 'test-session-2'
    const db = getDatabase()
    db.prepare("INSERT OR REPLACE INTO sessions (id, title, provider, model) VALUES (?, ?, ?, ?)").run(
      sessionId,
      'Test Stitch Session',
      'openai',
      'gpt-4o'
    )

    // OpenAI streams chunk and then throws a transient error
    mockOpenAIProvider.sendMessage.mockReset()
    mockOpenAIProvider.sendMessage.mockImplementation(async (_messages: any, options: any) => {
      // Simulate partial stream chunk
      options.onChunk('Part 1 from OpenAI...')
      throw new Error('503 Service Unavailable')
    })

    // Anthropic succeeds
    mockAnthropicProvider.sendMessage.mockReset()
    mockAnthropicProvider.sendMessage.mockImplementation(async (_messages: any, options: any) => {
      // Simulate Anthropic chunk
      options.onChunk('Part 2 from Anthropic!')
      return {
        content: 'Part 1 from OpenAI...Part 2 from Anthropic!',
        tokensUsed: 30,
        stopReason: 'stop'
      }
    })

    const callbacks = {
      onChunk: vi.fn(),
      onError: vi.fn(),
      onEnd: vi.fn()
    }

    await agentLoop.processMessage(
      'Stitch me!',
      sessionId,
      [],
      {
        id: 'openai-id',
        provider: 'openai',
        defaultModel: 'gpt-4o',
        isActive: true
      },
      {
        model: 'gpt-4o',
        callbacks
      }
    )

    // Assert onChunk callback received both chunks
    expect(callbacks.onChunk).toHaveBeenCalledWith('Part 1 from OpenAI...')
    expect(callbacks.onChunk).toHaveBeenCalledWith('Part 2 from Anthropic!')

    // Assert the stitched result was saved and finalized in DB
    const dbMessages = getSessionMessages(sessionId)
    const assistantMsgs = dbMessages.filter(m => m.role === 'assistant')
    expect(assistantMsgs.length).toBe(1)
    expect(assistantMsgs[0].content).toBe('Part 1 from OpenAI...Part 2 from Anthropic!')
    expect(assistantMsgs[0].executionStatus).toBe('completed')
  })
})
