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

type AgentLoopCallbacks = {
  onChunk?: (chunk: string) => void
  onToolResult?: (toolName: string, result: string) => void
  onEnd?: (content: string, tokensUsed: number) => void
  onError?: (message: string) => void
}

export class AgentLoop {
  private toolExecutor: ToolExecutor
  private contextManager: ContextManager

  constructor() {
    this.toolExecutor = new ToolExecutor()
    this.contextManager = new ContextManager()
  }

  /**
   * Reconstructs missing toolCalls on assistant messages from subsequent tool messages.
   * Old DB records may not have the tool_calls column populated, causing providers
   * to send tool_result blocks without matching tool_use blocks → validation errors.
   */
  private reconstructToolCalls(messages: Message[]): Message[] {
    const result = messages.map(m => ({ ...m }))

    for (let i = 0; i < result.length; i++) {
      const msg = result[i]

      // If assistant message has no toolCalls but is followed by tool messages → reconstruct
      if (msg.role === 'assistant' && (!msg.toolCalls || msg.toolCalls.length === 0)) {
        const toolCalls: { id: string; toolName: string; input: any }[] = []

        for (let j = i + 1; j < result.length && result[j].role === 'tool'; j++) {
          const toolMsg = result[j]
          const callId = toolMsg.toolCallId || `synth_${i}_${j}_${Date.now()}`
          toolCalls.push({
            id: callId,
            toolName: toolMsg.toolName || 'unknown_tool',
            input: toolMsg.toolInput || {}
          })
          // Sync the ID back to the tool message so result mapping stays consistent
          if (!result[j].toolCallId) {
            result[j] = { ...result[j], toolCallId: callId }
          }
        }

        if (toolCalls.length > 0) {
          result[i] = { ...msg, toolCalls }
        }
      }

      // Ensure every tool message has a non-empty toolCallId
      if (msg.role === 'tool' && !msg.toolCallId) {
        result[i] = { ...result[i], toolCallId: `synth_orphan_${i}_${Date.now()}` }
      }
    }

    return result
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
      callbacks?: AgentLoopCallbacks
    }
  ): Promise<void> {
    const window = BrowserWindow.getFocusedWindow()

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

      // Reconstruct missing toolCalls on assistant messages from DB history
      const rehydratedMessages = this.reconstructToolCalls(trimmedMessages)

      // Add the new user message
      const allMessages: Message[] = [
        ...rehydratedMessages,
        {
          id: '',
          sessionId,
          role: 'user' as const,
          content: userMessage,
          createdAt: new Date().toISOString()
        }
      ]

      // Run the agentic loop (may loop multiple times if tool calls happen)
      await this.runLoop(provider, allMessages, sessionId, options, signal, window || undefined)
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled — not an error
        return
      }
      const message = (error as Error).message
      options.callbacks?.onError?.(message)
      window?.webContents.send(IPC.CHAT_ERROR, message)
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
    options: { model: string; systemPrompt?: string; callbacks?: AgentLoopCallbacks },
    signal: AbortSignal,
    window?: BrowserWindow
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
        tools: this.toolExecutor.getAvailableTools().map((tool) => ({
          name: tool.name,
          description: tool.description,
          inputSchema: tool.inputSchema
        })),
        onChunk: (chunk: string) => {
          fullContent += chunk
          if (!signal.aborted) {
            options.callbacks?.onChunk?.(chunk)
            window?.webContents.send(IPC.CHAT_STREAM_CHUNK, chunk)
          }
        },
        signal
      })

      // Fallback parser for raw XML tool calls (e.g. minimax, some local models)
      if (!result.toolCalls || result.toolCalls.length === 0) {
        const invokeRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g
        let match
        const parsedCalls: any[] = []
        let hasToolCalls = false

        while ((match = invokeRegex.exec(result.content)) !== null) {
          hasToolCalls = true
          let rawName = match[1]
          let innerXml = match[2]
          
          // Map standard external names to internal names
          if (rawName === 'filesystem_list_directory' || rawName === 'list_dir') rawName = 'ListDirTool'
          if (rawName === 'shell_run_command' || rawName === 'run_command') rawName = 'BashTool'
          if (rawName === 'write' || rawName === 'write_file') rawName = 'FileWriteTool'
          if (rawName === 'read' || rawName === 'read_file') rawName = 'FileReadTool'
          if (rawName === 'glob') rawName = 'GlobTool'
          if (rawName === 'grep') rawName = 'GrepTool'

          const inputParams: Record<string, any> = {}
          const paramRegex = /<parameter\s+name="([^"]+)">([\s\S]*?)<\/parameter>/g
          let paramMatch
          let hasParams = false
          while ((paramMatch = paramRegex.exec(innerXml)) !== null) {
            hasParams = true
            inputParams[paramMatch[1]] = paramMatch[2].trim()
          }
          
          // If no <parameter> tags found, maybe it's just raw text inside (e.g. write tool)
          if (!hasParams && innerXml.trim()) {
            inputParams['content'] = innerXml.trim()
          }

          parsedCalls.push({
            id: `call_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            toolName: rawName,
            input: inputParams
          })
        }

        if (hasToolCalls) {
          result.toolCalls = parsedCalls
        }
      }

      // Check for tool calls
      if (result.toolCalls && result.toolCalls.length > 0) {
        // Save the assistant's message (with tool call info, including toolCalls for history replay)
        createMessage(sessionId, 'assistant', result.content, {
          tokensUsed: result.tokensUsed,
          toolCalls: result.toolCalls
        })
        messages.push({
          id: '',
          sessionId,
          role: 'assistant',
          content: result.content,
          toolCalls: result.toolCalls,
          createdAt: new Date().toISOString()
        })

        // Execute all tool calls (read-only ones run concurrently)
        const toolResults = await this.toolExecutor.executeTools(
          result.toolCalls.map((tc) => ({ id: tc.id, toolName: tc.toolName, input: tc.input })),
          signal
        )

        for (const { id, toolName, input, result: toolResult } of toolResults) {
          if (signal.aborted) return

          // Save tool result message with toolCallId for provider mapping
          createMessage(sessionId, 'tool', toolResult, {
            toolName,
            toolInput: input,
            toolResult,
            toolCallId: id
          })

          // Send tool result to renderer
          options.callbacks?.onToolResult?.(toolName, toolResult)
          window?.webContents.send(IPC.TOOL_RESULT, { toolName, result: toolResult })

          // Notify frontend if a file was edited
          if (!toolResult.startsWith('[ERROR]') && (toolName === 'FileEditTool' || toolName === 'FileWriteTool')) {
            const filePath = (input as { path?: string }).path
            if (filePath) {
              window?.webContents.send(IPC.FS_FILE_MODIFIED, filePath)
            }
          }

          // Add tool result to conversation for next AI call
          messages.push({
            id: '',
            sessionId,
            role: 'tool',
            content: toolResult,
            toolName,
            toolCallId: id,
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
      options.callbacks?.onEnd?.(result.content, result.tokensUsed)
      window?.webContents.send(IPC.CHAT_STREAM_END, {
        content: result.content,
        tokensUsed: result.tokensUsed
      })

      return // Exit the loop
    }

    // If we hit max iterations, send error
    const message = 'Agent loop exceeded maximum iterations. This may indicate an infinite tool call loop.'
    options.callbacks?.onError?.(message)
    window?.webContents.send(IPC.CHAT_ERROR, message)
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
