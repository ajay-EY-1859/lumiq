// ═══════════════════════════════════════════════════════════════════
// Lumiq — Agent Loop
// The main agentic loop: user sends message → AI responds →
// if AI makes tool calls → execute tools → feed results back →
// AI continues until no more tool calls.
// ═══════════════════════════════════════════════════════════════════

import { BrowserWindow } from 'electron'
import { IPC } from '@shared/types'
import type { Message, ProviderConfig, SendResult } from '@shared/types'
import { ProviderFactory } from '../providers/ProviderFactory'
import { ToolExecutor } from './ToolExecutor'
import { ContextManager } from './ContextManager'
import { createMessage } from '../db/messages'
import { touchSession } from '../db/sessions'
import type { AIProvider } from '../providers/AIProvider'

// Active request tracking for cancellation
let activeAbortController: AbortController | null = null

export class AgentLoop {
  private toolExecutor: ToolExecutor
  private contextManager: ContextManager

  constructor() {
    this.toolExecutor = new ToolExecutor()
    this.contextManager = new ContextManager()
  }

  /**
   * Processes a user message through the full agentic loop.
   */
  async processMessage(
    userMessage: string,
    sessionId: string,
    messages: Message[],
    config: ProviderConfig,
    options: {
      model: string
      systemPrompt?: string
    }
  ): Promise<void> {
    const window = BrowserWindow.getFocusedWindow()
    if (!window) return

    // Cancel any active request
    this.cancel()

    // Create abort controller for this request
    activeAbortController = new AbortController()
    const { signal } = activeAbortController

    try {
      // Save user message to DB
      createMessage(sessionId, 'user', userMessage)
      touchSession(sessionId)

      // Create provider client
      const provider: AIProvider = ProviderFactory.create(config)

      // Trim context
      const trimmedMessages = this.contextManager.trimMessages(messages)

      // Add the new user message
      const allMessages: Message[] = [
        ...trimmedMessages,
        {
          id: '',
          sessionId,
          role: 'user' as const,
          content: userMessage,
          createdAt: new Date().toISOString()
        }
      ]

      // Run the agentic loop (may loop multiple times if tool calls happen)
      await this.runLoop(provider, allMessages, sessionId, options, signal, window)
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled — not an error
        return
      }
      window.webContents.send(IPC.CHAT_ERROR, (error as Error).message)
    } finally {
      activeAbortController = null
    }
  }

  /**
   * The core agentic loop. Runs until AI gives a final response
   * with no tool calls.
   */
  private async runLoop(
    provider: AIProvider,
    messages: Message[],
    sessionId: string,
    options: { model: string; systemPrompt?: string },
    signal: AbortSignal,
    window: BrowserWindow
  ): Promise<void> {
    const MAX_ITERATIONS = 20 // Safety limit to prevent infinite loops
    let iteration = 0

    while (iteration < MAX_ITERATIONS) {
      if (signal.aborted) return
      iteration++

      let fullContent = ''

      // Stream response from AI
      const result: SendResult = await provider.sendMessage(messages, {
        model: options.model,
        stream: true,
        systemPrompt: options.systemPrompt,
        onChunk: (chunk: string) => {
          fullContent += chunk
          if (!signal.aborted) {
            window.webContents.send(IPC.CHAT_STREAM_CHUNK, chunk)
          }
        },
        signal
      })

      // Check for tool calls
      if (result.toolCalls && result.toolCalls.length > 0) {
        // Save the assistant's message (with tool call info)
        createMessage(sessionId, 'assistant', result.content, {
          tokensUsed: result.tokensUsed
        })

        // Execute each tool call
        for (const toolCall of result.toolCalls) {
          if (signal.aborted) return

          // Execute tool
          const toolResult = await this.toolExecutor.executeTool(
            toolCall.toolName,
            toolCall.input,
            signal
          )

          // Save tool result message
          createMessage(sessionId, 'tool', toolResult, {
            toolName: toolCall.toolName,
            toolInput: toolCall.input,
            toolResult
          })

          // Send tool result to renderer
          window.webContents.send(IPC.TOOL_RESULT, {
            toolName: toolCall.toolName,
            result: toolResult
          })

          // Add tool result to conversation for next AI call
          messages.push({
            id: '',
            sessionId,
            role: 'tool',
            content: toolResult,
            toolName: toolCall.toolName,
            createdAt: new Date().toISOString()
          })
        }

        // Continue the loop — AI will see tool results and continue
        continue
      }

      // No tool calls — this is the final response
      createMessage(sessionId, 'assistant', result.content, {
        tokensUsed: result.tokensUsed
      })

      touchSession(sessionId)

      // Signal stream end
      window.webContents.send(IPC.CHAT_STREAM_END, {
        content: result.content,
        tokensUsed: result.tokensUsed
      })

      return // Exit the loop
    }

    // If we hit max iterations, send error
    window.webContents.send(
      IPC.CHAT_ERROR,
      'Agent loop exceeded maximum iterations. This may indicate an infinite tool call loop.'
    )
  }

  /**
   * Cancels the active request.
   */
  cancel(): void {
    if (activeAbortController) {
      activeAbortController.abort()
      activeAbortController = null
    }
  }

  /**
   * Updates context limit.
   */
  setContextLimit(limit: number): void {
    this.contextManager.setMaxMessages(limit)
  }

  /**
   * Gets the tool executor instance.
   */
  getToolExecutor(): ToolExecutor {
    return this.toolExecutor
  }
}

// Singleton instance
export const agentLoop = new AgentLoop()
