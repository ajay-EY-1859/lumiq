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
import { getDatabase } from '../db/database'
import { createMessage, updateMessageContent } from '../db/messages'
import { touchSession } from '../db/sessions'
import { listApiConfigs } from '../db/apiConfigs'
import type { AIProvider } from '../providers/AIProvider'
import { userProfileManager } from './UserProfileManager'
import { contextCompactor } from './ContextCompactor'
import { TraceLogger } from '../services/TraceLogger'
import { CostManager } from '../services/CostManager'

// Active request tracking for cancellation
let activeAbortController: AbortController | null = null

/** Sentinel error thrown when a session is deleted mid-flight. */
class SessionDeletedError extends Error {
  constructor() {
    super('Session deleted')
    this.name = 'SessionDeletedError'
  }
}

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
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows().find((candidate) => !candidate.isDestroyed())

    // Cancel any active request
    this.cancel()

    // Create abort controller for this request
    activeAbortController = new AbortController()
    const { signal } = activeAbortController

    try {
      // Save user message to DB (guard: session may have been deleted between
      // the renderer dispatching the IPC and the DB insert executing)
      try {
        createMessage(sessionId, 'user', userMessage)
        touchSession(sessionId)
      } catch (err) {
        const msg = (err as Error).message
        if (msg.includes('no longer exists') || msg.includes('FOREIGN KEY')) {
          window?.webContents.send(IPC.CHAT_ERROR, 'Session was deleted — message not sent.')
          return
        }
        throw err
      }

      // Create provider client
      const provider: AIProvider = ProviderFactory.create(config)

      // 1. Fetch workspace path of active session
      let workspacePath: string | null = null
      try {
        const db = getDatabase()
        const session = db.prepare('SELECT workspace_path as workspacePath FROM sessions WHERE id = ?').get(sessionId) as { workspacePath: string | null }
        if (session) {
          workspacePath = session.workspacePath
        }
      } catch (err) {
        console.error('[AgentLoop] Failed to fetch session workspace path:', err)
      }

      // 2. Fetch codebase RAG context if a workspace path is configured
      let ragSegment = ''
      if (workspacePath && userMessage) {
        try {
          const { ragQueryEngine } = await import('./RAGQueryEngine')
          ragSegment = await ragQueryEngine.getSemanticPromptSegment(workspacePath, userMessage)
        } catch (err) {
          console.error('[AgentLoop] RAG search failed:', err)
        }
      }

      // Trim context
      const trimmedMessages = this.contextManager.trimMessages(messages, sessionId, ragSegment)

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
      await this.runLoop(provider, config, allMessages, sessionId, userMessage, options, signal, window || undefined)
    } catch (error) {
      if ((error as Error).name === 'AbortError') {
        // User cancelled — not an error
        return
      }
      if ((error as Error).name === 'SessionDeletedError') {
        // Session was deleted mid-loop — already reported to renderer via IPC
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
   * Retries an async function with exponential backoff on transient errors.
   * Non-retryable errors (auth failures, validation) throw immediately.
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    baseDelayMs = 1000,
    signal?: AbortSignal
  ): Promise<T> {
    let lastError: Error | null = null
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      if (signal?.aborted) throw new DOMException('Aborted', 'AbortError')
      try {
        return await fn()
      } catch (error) {
        lastError = error as Error
        const msg = lastError.message || ''

        // Non-retryable errors — fail immediately
        if (
          msg.includes('401') || msg.includes('403') ||
          msg.includes('InvalidApiKey') || msg.includes('AuthenticationError') ||
          msg.includes('AccessDeniedException') || msg.includes('UnrecognizedClientException') ||
          msg.includes('ValidationException') || msg.includes('Invalid') ||
          lastError.name === 'AbortError'
        ) {
          throw lastError
        }

        // Retryable: network errors, 429 rate limit, 5xx server errors, timeouts
        if (attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt) + Math.random() * 500
          console.warn(`[AgentLoop] Provider call failed (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${Math.round(delay)}ms: ${msg}`)
          await new Promise(resolve => setTimeout(resolve, delay))
        }
      }
    }
    throw lastError!
  }

  private stableStringify(value: unknown): string {
    if (value === null) return 'null'
    if (Array.isArray(value)) {
      return `[${value.map((item) => this.stableStringify(item)).join(',')}]`
    }
    if (typeof value === 'object') {
      const objectValue = value as Record<string, unknown>
      const sortedKeys = Object.keys(objectValue).sort()
      return `{${sortedKeys.map((key) => `${JSON.stringify(key)}:${this.stableStringify(objectValue[key])}`).join(',')}}`
    }
    return JSON.stringify(value)
  }

  private buildToolSignature(toolCalls: { toolName: string; input: unknown }[]): string {
    return toolCalls
      .map((tc) => `${tc.toolName}:${this.stableStringify(tc.input)}`)
      .join('|')
  }

  private getFallbackConfigs(triedProviders: string[]): ProviderConfig[] {
    const allConfigs = listApiConfigs().filter(c => c.isActive && !triedProviders.includes(c.provider));
    const priorityOrder = ['openai', 'anthropic', 'gemini', 'bedrock', 'ollama'];
    return allConfigs.sort((a, b) => {
      const idxA = priorityOrder.indexOf(a.provider);
      const idxB = priorityOrder.indexOf(b.provider);
      const valA = idxA === -1 ? 99 : idxA;
      const valB = idxB === -1 ? 99 : idxB;
      return valA - valB;
    });
  }

  /**
   * The core agentic loop. Runs until AI gives a final response
   * with no tool calls.
   */
  private async runLoop(
    provider: AIProvider,
    config: ProviderConfig,
    messages: Message[],
    sessionId: string,
    userMessage: string,
    options: { model: string; systemPrompt?: string; callbacks?: AgentLoopCallbacks },
    signal: AbortSignal,
    window?: BrowserWindow
  ): Promise<void> {
    // Helper: safely insert a message, aborting the loop if session was deleted
    const safeCreateMessage: typeof createMessage = (...args) => {
      try {
        return createMessage(...args)
      } catch (err) {
        const msg = (err as Error).message
        if (msg.includes('no longer exists') || msg.includes('FOREIGN KEY')) {
          window?.webContents.send(IPC.CHAT_ERROR, 'Session was deleted — agent stopped.')
          throw new SessionDeletedError()
        }
        throw err
      }
    }

    const MAX_ITERATIONS = 100 // High-progress safety limit (Lumiq's consecutive loop check handles actual loops)
    let iteration = 0
    const executionSignatures: string[] = []

    let currentConfig = config
    let currentModel = options.model
    let currentProvider = provider

    while (iteration < MAX_ITERATIONS) {
      if (signal.aborted) return
      iteration++

      let result: SendResult | null = null
      let streamSucceeded = false
      let currentStreamedContent = ''
      let assistantMessageId: string | null = null
      const triedProviders: string[] = [currentConfig.provider]

      while (!streamSucceeded) {
        try {
          result = await this.withRetry(
            () => currentProvider.sendMessage(messages, {
              model: currentModel,
              stream: true,
              systemPrompt: options.systemPrompt,
              tools: this.toolExecutor.getAvailableTools().map((tool) => ({
                name: tool.name,
                description: tool.description,
                inputSchema: tool.inputSchema
              })),
              onChunk: (chunk: string) => {
                if (signal.aborted) return

                if (!assistantMessageId) {
                  const msg = safeCreateMessage(sessionId, 'assistant', '', {
                    executionStatus: 'streaming'
                  })
                  assistantMessageId = msg.id
                }

                currentStreamedContent += chunk
                updateMessageContent(assistantMessageId, currentStreamedContent, {
                  executionStatus: 'streaming'
                })

                options.callbacks?.onChunk?.(chunk)
                window?.webContents.send(IPC.CHAT_STREAM_CHUNK, chunk)
              },
              signal
            }),
            3,   // max retries
            1000, // base delay 1s
            signal
          )

          streamSucceeded = true

          // Since the stream succeeded, we update the assistant message ID in the DB
          if (assistantMessageId) {
            updateMessageContent(assistantMessageId, result.content, {
              executionStatus: 'completed',
              tokensUsed: result.tokensUsed,
              toolCalls: result.toolCalls
            })
            // Update messages array for subsequent tool execution logic, avoiding duplicates
            const existingMsgIndex = messages.findIndex(m => m.id === assistantMessageId)
            if (existingMsgIndex !== -1) {
              messages[existingMsgIndex].content = result.content
              messages[existingMsgIndex].toolCalls = result.toolCalls
              messages[existingMsgIndex].executionStatus = 'completed' as any
            } else {
              messages.push({
                id: assistantMessageId,
                sessionId,
                role: 'assistant',
                content: result.content,
                toolCalls: result.toolCalls,
                createdAt: new Date().toISOString()
              })
            }
          } else {
            const msg = safeCreateMessage(sessionId, 'assistant', result.content, {
              tokensUsed: result.tokensUsed,
              toolCalls: result.toolCalls,
              executionStatus: 'completed'
            })
            messages.push({
              id: msg.id,
              sessionId,
              role: 'assistant',
              content: result.content,
              toolCalls: result.toolCalls,
              createdAt: new Date().toISOString()
            })
          }

          // Log cost transaction (Offline-First and Budget Cap support)
          try {
            if (result && result.tokensUsed > 0) {
              const estOutputTokens = Math.round(result.content.length / 4)
              const estInputTokens = Math.max(0, result.tokensUsed - estOutputTokens)
              CostManager.logTransaction(sessionId, currentConfig.provider, currentModel, estInputTokens, estOutputTokens)
            }
          } catch (err) {
            console.error('[AgentLoop] Failed to log cost transaction:', err)
          }
        } catch (err) {
          if (signal.aborted) throw err

          console.error(`[AgentLoop] Provider ${currentConfig.provider} failed:`, err)

          if (assistantMessageId) {
            updateMessageContent(assistantMessageId, currentStreamedContent, {
              executionStatus: 'interrupted'
            })
            const existingMsgIndex = messages.findIndex(m => m.id === assistantMessageId)
            if (existingMsgIndex !== -1) {
              messages[existingMsgIndex].content = currentStreamedContent
              messages[existingMsgIndex].executionStatus = 'interrupted' as any
            } else {
              messages.push({
                id: assistantMessageId,
                sessionId,
                role: 'assistant',
                content: currentStreamedContent,
                executionStatus: 'interrupted' as any,
                createdAt: new Date().toISOString()
              })
            }
          }

          triedProviders.push(currentConfig.provider)
          const fallbacks = this.getFallbackConfigs(triedProviders)
          if (fallbacks.length === 0) {
            throw err
          }

          currentConfig = fallbacks[0]
          currentModel = currentConfig.defaultModel
          currentProvider = ProviderFactory.create(currentConfig)
          console.warn(`[AgentLoop] Cascading failover to backup provider: ${currentConfig.provider} with model ${currentModel}`)
        }
      }

      // Fallback parser for raw XML tool calls (e.g. minimax, some local models)
      if (!result!.toolCalls || result!.toolCalls.length === 0) {
        const invokeRegex = /<invoke\s+name="([^"]+)">([\s\S]*?)<\/invoke>/g
        let match
        const parsedCalls: any[] = []
        let hasToolCalls = false

        while ((match = invokeRegex.exec(result!.content)) !== null) {
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
          result!.toolCalls = parsedCalls
        }
      }

      // Circular execution / loop detection using sliding window signature validator
      if (result!.toolCalls && result!.toolCalls.length > 0) {
        const currentToolSignature = this.buildToolSignature(result!.toolCalls)
        executionSignatures.push(currentToolSignature)

        const n = executionSignatures.length

        // Size 1 (consecutive duplicate): A-A
        if (n >= 2 && executionSignatures[n - 1] === executionSignatures[n - 2]) {
          const err = new Error('Circular execution detected: consecutive duplicate tool calls.')
          err.name = 'CircularExecutionException'
          throw err
        }

        // Size 2: A-B-A-B
        if (n >= 4 &&
            executionSignatures[n - 1] === executionSignatures[n - 3] &&
            executionSignatures[n - 2] === executionSignatures[n - 4]) {
          const err = new Error('Circular execution detected: loop pattern A-B-A-B detected.')
          err.name = 'CircularExecutionException'
          throw err
        }

        // Size 3: A-B-C-A-B-C
        if (n >= 6 &&
            executionSignatures[n - 1] === executionSignatures[n - 4] &&
            executionSignatures[n - 2] === executionSignatures[n - 5] &&
            executionSignatures[n - 3] === executionSignatures[n - 6]) {
          const err = new Error('Circular execution detected: loop pattern A-B-C-A-B-C detected.')
          err.name = 'CircularExecutionException'
          throw err
        }
      }

      // Check for tool calls
      if (result!.toolCalls && result!.toolCalls.length > 0) {
        // Execute all tool calls (read-only ones run concurrently)
        const toolResults = await this.toolExecutor.executeTools(
          result!.toolCalls.map((tc) => ({ id: tc.id, toolName: tc.toolName, input: tc.input })),
          signal
        )

        for (const { id, toolName, input, result: toolResult } of toolResults) {
          if (signal.aborted) return

          // Save tool result message with toolCallId for provider mapping
          safeCreateMessage(sessionId, 'tool', toolResult, {
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

      try { touchSession(sessionId) } catch { /* session may be gone */ }

      // Trigger background user profile facts extraction
      userProfileManager.extractFactsFromExchange(userMessage, result!.content, config, options.model)

      // Trigger background context compaction check (>20 messages, keeping last 5 raw)
      contextCompactor.checkAndCompactSession(sessionId, config, options.model)

      // Log request/response audit trace
      try {
        TraceLogger.log({
          timestamp: new Date().toISOString(),
          sessionId,
          provider: currentConfig.provider,
          model: currentModel,
          systemPrompt: options.systemPrompt,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            toolName: m.toolName,
            toolCallId: m.toolCallId,
            toolInput: m.toolInput,
            toolResult: m.toolResult
          })),
          response: {
            content: result!.content,
            tokensUsed: result!.tokensUsed,
            toolCalls: result!.toolCalls?.map(tc => ({
              id: tc.id,
              toolName: tc.toolName,
              input: tc.input
            }))
          }
        })
      } catch (logErr) {
        console.error('[AgentLoop] Trace logging failed:', logErr)
      }

      // Signal stream end
      options.callbacks?.onEnd?.(result!.content, result!.tokensUsed)
      window?.webContents.send(IPC.CHAT_STREAM_END, {
        content: result!.content,
        tokensUsed: result!.tokensUsed
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
