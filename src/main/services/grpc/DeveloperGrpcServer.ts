import { BrowserWindow } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import * as grpc from '@grpc/grpc-js'
import * as protoLoader from '@grpc/proto-loader'
import { v4 as uuidv4 } from 'uuid'
import { IPC, type GrpcStatus } from '@shared/types'
import { getApiConfig } from '../../db/apiConfigs'
import { getDatabase } from '../../db/database'
import { agentLoop } from '../../agent/AgentLoop'
import { createSession, getSession, listSessions, updateSessionTitle, updateSessionWorkspace } from '../../db/sessions'
import { getSessionMessages } from '../../db/messages'

type StreamCall = grpc.ServerWritableStream<
  {
    prompt?: string
    provider?: string
    model?: string
    sessionId?: string
    workspacePath?: string
    contextFiles?: Array<{
      path?: string
      language?: string
      content?: string
      selectionStartLine?: number
      selectionEndLine?: number
    }>
  },
  { content?: string; done?: boolean; error?: string; sessionId?: string; eventType?: string; metadataJson?: string }
>

type PingCall = grpc.ServerUnaryCall<
  Record<string, never>,
  { ok: boolean; version: string }
>

type UnaryCall<Request, Response> = grpc.ServerUnaryCall<Request, Response>

class DeveloperGrpcServer {
  private server: grpc.Server | null = null
  private port = 43187
  private authToken = ''

  status(): GrpcStatus {
    return { running: Boolean(this.server), host: '127.0.0.1', port: this.port }
  }

  async start(port = 43187): Promise<GrpcStatus> {
    if (this.server) return this.status()
    this.port = port

    const protoPath = this.getProtoPath()
    const packageDefinition = protoLoader.loadSync(protoPath, {
      keepCase: false,
      longs: String,
      enums: String,
      defaults: true,
      oneofs: true
    })
    const loaded = grpc.loadPackageDefinition(packageDefinition) as {
      lumiq: {
        LumiqDeveloper: grpc.ServiceClientConstructor & { service: grpc.ServiceDefinition }
      }
    }

    let authToken = process.env.LUMIQ_GRPC_AUTH_TOKEN?.trim()
    if (!authToken) {
      authToken = uuidv4()
      console.warn('LUMIQ_GRPC_AUTH_TOKEN is not set. A temporary gRPC auth token has been generated for this session.')
    }

    this.authToken = authToken
    this.server = new grpc.Server()
    this.server.addService(loaded.lumiq.LumiqDeveloper.service, {
      streamChat: (_call: StreamCall) => {
        void this.handleStreamChat(_call)
      },
      ping: (_call: PingCall, callback: grpc.sendUnaryData<{ ok: boolean; version: string }>) => {
        if (!this.isAuthorized(_call.metadata)) {
          callback(this.unauthorizedError(), null)
          return
        }
        callback(null, { ok: true, version: '0.1.0' })
      },
      getStatus: (
        call: UnaryCall<Record<string, never>, { running: boolean; host: string; port: number; version: string }>,
        callback: grpc.sendUnaryData<{ running: boolean; host: string; port: number; version: string }>
      ) => {
        if (!this.isAuthorized(call.metadata)) {
          callback(this.unauthorizedError(), null)
          return
        }
        callback(null, { ...this.status(), version: '0.1.0' })
      },
      listSessions: (
        call: UnaryCall<{ limit?: number }, { sessions: Array<Record<string, string>> }>,
        callback: grpc.sendUnaryData<{ sessions: Array<Record<string, string>> }>
      ) => {
        if (!this.isAuthorized(call.metadata)) {
          callback(this.unauthorizedError(), null)
          return
        }
        const limit = Math.max(1, Math.min(call.request.limit || 25, 100))
        callback(null, {
          sessions: listSessions().slice(0, limit).map((session) => ({
            id: session.id,
            title: session.title,
            provider: session.provider,
            model: session.model,
            workspacePath: session.workspacePath || '',
            updatedAt: session.updatedAt
          }))
        })
      },
      getSessionMessages: (
        call: UnaryCall<{ sessionId?: string }, { messages: Array<Record<string, string>> }>,
        callback: grpc.sendUnaryData<{ messages: Array<Record<string, string>> }>
      ) => {
        if (!this.isAuthorized(call.metadata)) {
          callback(this.unauthorizedError(), null)
          return
        }
        const sessionId = call.request.sessionId?.trim()
        if (!sessionId || !getSession(sessionId)) {
          callback(this.invalidArgumentError('Valid session_id is required'), null)
          return
        }
        callback(null, {
          messages: getSessionMessages(sessionId).map((message) => ({
            id: message.id,
            role: message.role,
            content: message.content,
            createdAt: message.createdAt
          }))
        })
      }
    })

    await new Promise<void>((resolve, reject) => {
      this.server?.bindAsync(
        `127.0.0.1:${this.port}`,
        grpc.ServerCredentials.createInsecure(),
        (error) => {
          if (error) {
            this.server = null
            reject(error)
            return
          }
          this.server?.start()
          resolve()
        }
      )
    })

    this.broadcast(IPC.GRPC_CLIENT_CONNECTED, this.status())
    return this.status()
  }

  stop(): GrpcStatus {
    const server = this.server
    this.server = null
    server?.forceShutdown()
    return this.status()
  }

  private async handleStreamChat(call: StreamCall): Promise<void> {
    if (!this.isAuthorized(call.metadata)) {
      call.write({ error: 'Unauthorized: missing or invalid authorization token', done: true, eventType: 'error' })
      call.end()
      return
    }

    this.broadcast(IPC.GRPC_CLIENT_CONNECTED, this.status())
    const prompt = call.request.prompt?.trim()
    if (!prompt) {
      call.write({ error: 'Prompt is required', done: true, eventType: 'error' })
      call.end()
      return
    }

    const defaults = this.getDefaults()
    const providerName = call.request.provider || defaults.provider
    const model = call.request.model || defaults.model
    const config = getApiConfig(providerName)
    if (!config) {
      call.write({ error: `Provider "${providerName}" is not configured`, done: true, eventType: 'error' })
      call.end()
      return
    }

    try {
      const requestedSession = call.request.sessionId?.trim()
      const session = requestedSession ? getSession(requestedSession) : createSession(providerName, model)
      if (!session) {
        throw new Error(`Session "${requestedSession}" not found`)
      }
      if (!requestedSession) {
        updateSessionTitle(session.id, `gRPC ${new Date().toLocaleString()}`)
      }
      if (call.request.workspacePath?.trim()) {
        updateSessionWorkspace(session.id, call.request.workspacePath.trim())
      }
      const persistedSession = getSession(session.id)
      if (!persistedSession) {
        throw new Error('Failed to create gRPC session')
      }
      agentLoop.getToolExecutor().setWorkspacePath(persistedSession.workspacePath || null)

      call.on('cancelled', () => agentLoop.cancel())

      call.write({
        content: '',
        done: false,
        sessionId: session.id,
        eventType: 'session',
        metadataJson: JSON.stringify({ sessionId: session.id, workspacePath: persistedSession.workspacePath || null })
      })

      await agentLoop.processMessage(this.buildPrompt(prompt, call.request.contextFiles || []), session.id, getSessionMessages(session.id), config, {
        model,
        callbacks: {
          onChunk: (content) => call.write({ content, done: false, sessionId: session.id, eventType: 'content' }),
          onToolResult: (toolName, result) => {
            call.write({
              content: `\n[tool:${toolName}]\n${result}\n`,
              done: false,
              sessionId: session.id,
              eventType: 'tool',
              metadataJson: JSON.stringify({ toolName })
            })
          },
          onEnd: () => {
            call.write({ done: true, sessionId: session.id, eventType: 'done' })
            call.end()
          },
          onError: (message) => {
            call.write({ error: message, done: true, sessionId: session.id, eventType: 'error' })
            call.end()
          }
        }
      })
    } catch (error) {
      call.write({ error: (error as Error).message, done: true, eventType: 'error' })
      call.end()
    }
  }

  private buildPrompt(
    prompt: string,
    contextFiles: Array<{ path?: string; language?: string; content?: string; selectionStartLine?: number; selectionEndLine?: number }>
  ): string {
    const usefulFiles = contextFiles.filter((file) => file.path?.trim() && file.content?.trim()).slice(0, 5)
    if (usefulFiles.length === 0) return prompt
    const context = usefulFiles.map((file) => {
      const lineInfo = file.selectionStartLine && file.selectionEndLine
        ? ` lines ${file.selectionStartLine}-${file.selectionEndLine}`
        : ''
      return `File: ${file.path}${lineInfo}\nLanguage: ${file.language || 'text'}\n\n${file.content}`
    }).join('\n\n---\n\n')
    return `IDE context:\n\n${context}\n\nUser request:\n${prompt}`
  }

  private isAuthorized(metadata: grpc.Metadata): boolean {
    const authHeader = metadata.get('authorization')[0] as string | undefined
    return Boolean(authHeader && authHeader === `Bearer ${this.authToken}`)
  }

  private unauthorizedError(): grpc.ServiceError {
    return {
      name: 'Unauthorized',
      message: 'Unauthorized: missing or invalid authorization token',
      code: grpc.status.UNAUTHENTICATED
    } as grpc.ServiceError
  }

  private invalidArgumentError(message: string): grpc.ServiceError {
    return {
      name: 'InvalidArgument',
      message,
      code: grpc.status.INVALID_ARGUMENT
    } as grpc.ServiceError
  }

  private getDefaults(): { provider: string; model: string } {
    const rows = getDatabase().prepare('SELECT key, value FROM settings WHERE key IN (?, ?)').all(
      'defaultProvider',
      'defaultModel'
    ) as { key: string; value: string }[]
    const settings = Object.fromEntries(rows.map((row) => [row.key, row.value]))
    return {
      provider: settings.defaultProvider || 'anthropic',
      model: settings.defaultModel || 'claude-sonnet-4-20250514'
    }
  }

  private getProtoPath(): string {
    const candidates = [
      join(__dirname, 'lumiq.proto'),
      join(process.cwd(), 'src', 'main', 'services', 'grpc', 'lumiq.proto'),
      join(process.resourcesPath || '', 'lumiq.proto')
    ]
    const protoPath = candidates.find((candidate) => candidate && existsSync(candidate))
    if (!protoPath) {
      throw new Error('Unable to locate lumiq.proto for the local developer server')
    }
    return protoPath
  }

  private broadcast(channel: string, payload: unknown): void {
    for (const window of BrowserWindow.getAllWindows()) {
      window.webContents.send(channel, payload)
    }
  }
}

export const developerGrpcServer = new DeveloperGrpcServer()
