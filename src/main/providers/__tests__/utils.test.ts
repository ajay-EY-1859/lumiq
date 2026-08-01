import { describe, it, expect } from 'vitest'
import { sanitizeMessages } from '../utils'
import type { Message, SendOptions } from '@shared/types'

describe('sanitizeMessages', () => {
  it('should pass through normal messages unchanged', () => {
    const messages: Message[] = [
      { id: '1', sessionId: 's1', role: 'user', content: 'hello', createdAt: new Date().toISOString() },
      { id: '2', sessionId: 's1', role: 'assistant', content: 'hi', createdAt: new Date().toISOString() }
    ]
    const options: SendOptions = { model: 'm1', stream: false }
    const result = sanitizeMessages(messages, options)
    expect(result).toEqual(messages)
  })

  it('should remove unrecognized tool calls from assistant messages', () => {
    const messages: Message[] = [
      {
        id: '1',
        sessionId: 's1',
        role: 'assistant',
        content: 'I will write to file',
        toolCalls: [
          { id: 'c1', toolName: 'WriteFileTool', input: { path: 'a.txt', content: 'hello' } },
          { id: 'c2', toolName: 'UnknownTool', input: {} }
        ],
        createdAt: new Date().toISOString()
      }
    ]
    const options: SendOptions = {
      model: 'm1',
      stream: false,
      tools: [
        { name: 'WriteFileTool', description: 'Write a file', inputSchema: {} }
      ]
    }
    const result = sanitizeMessages(messages, options)
    expect(result[0].toolCalls).toHaveLength(1)
    expect(result[0].toolCalls![0].toolName).toBe('WriteFileTool')
  })

  it('should clean toolCalls field entirely if no valid tool calls remain', () => {
    const messages: Message[] = [
      {
        id: '1',
        sessionId: 's1',
        role: 'assistant',
        content: 'Let me do this',
        toolCalls: [
          { id: 'c2', toolName: 'UnknownTool', input: {} }
        ],
        createdAt: new Date().toISOString()
      }
    ]
    const options: SendOptions = {
      model: 'm1',
      stream: false,
      tools: []
    }
    const result = sanitizeMessages(messages, options)
    expect(result[0].toolCalls).toBeUndefined()
  })

  it('should convert unrecognized tool result messages to user messages', () => {
    const messages: Message[] = [
      {
        id: '1',
        sessionId: 's1',
        role: 'tool',
        toolName: 'UnknownTool',
        toolCallId: 'c2',
        content: 'Success',
        createdAt: new Date().toISOString()
      }
    ]
    const options: SendOptions = {
      model: 'm1',
      stream: false,
      tools: []
    }
    const result = sanitizeMessages(messages, options)
    expect(result[0].role).toBe('user')
    expect(result[0].content).toContain('[System: Tool "UnknownTool" was executed and returned the following outcome]:\nSuccess')
  })
})
