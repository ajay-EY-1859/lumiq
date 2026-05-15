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
import { createSession, getSession, updateSessionTitle } from '../../db/sessions'
import { getSessionMessages } from '../../db/messages'

type StreamCall = grpc.ServerWritableStream<
  { prompt?: string; provider?: string; model?: string },
  { content?: string; done?: boolean; error?: string }
>

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
      streamChat: (call: StreamCall) => {
        void this.handleStreamChat(call)
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
    const authHeader = call.metadata.get('authorization')[0] as string | undefined
    if (!authHeader || authHeader !== `Bearer ${this.authToken}`) {
      call.write({ error: 'Unauthorized: missing or invalid authorization token', done: true })
      call.end()
      return
    }

    this.broadcast(IPC.GRPC_CLIENT_CONNECTED, this.status())
    const prompt = call.request.prompt?.trim()
    if (!prompt) {
      call.write({ error: 'Prompt is required', done: true })
      call.end()
      return
    }

    const defaults = this.getDefaults()
    const providerName = call.request.provider || defaults.provider
    const model = call.request.model || defaults.model
    const config = getApiConfig(providerName)
    if (!config) {
      call.write({ error: `Provider "${providerName}" is not configured`, done: true })
      call.end()
      return
    }

    try {
      const session = createSession(providerName, model)
      updateSessionTitle(session.id, `gRPC ${new Date().toLocaleString()}`)
      const persistedSession = getSession(session.id)
      if (!persistedSession) {
        throw new Error('Failed to create gRPC session')
      }

      call.on('cancelled', () => agentLoop.cancel())

      await agentLoop.processMessage(prompt, session.id, getSessionMessages(session.id), config, {
        model,
        callbacks: {
          onChunk: (content) => call.write({ content, done: false }),
          onToolResult: (toolName, result) => {
            call.write({ content: `\n[tool:${toolName}]\n${result}\n`, done: false })
          },
          onEnd: () => {
            call.write({ done: true })
            call.end()
          },
          onError: (message) => {
            call.write({ error: message, done: true })
            call.end()
          }
        }
      })
    } catch (error) {
      call.write({ error: (error as Error).message, done: true })
      call.end()
    }
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
