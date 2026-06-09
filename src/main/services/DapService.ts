import { BrowserWindow } from 'electron'
import { IPC, DapState } from '@shared/types'
import { listApiConfigs } from '../db/apiConfigs'
import { ProviderFactory } from '../providers/ProviderFactory'
import { Disposable } from '@shared/lifecycle'
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions'
import { getService } from '@shared/instantiation/instantiationService'
import { IDapService } from '@shared/services'

export class DapService extends Disposable implements IDapService {
  
  private state: DapState = {
    state: 'inactive',
    port: 0,
    scriptPath: '',
    breakpoints: [],
    stackFrames: [],
    scopes: [],
    activeFrameId: null
  }

  private ws: WebSocket | null = null
  private msgId = 1
  private pendingRequests: Map<number, { resolve: (value?: any) => void, reject: (reason?: any) => void }> = new Map()

  constructor() {
    super()
  }

  public static getInstance(): DapService {
    return getService(IDapService) as DapService
  }

  public getStatus(): DapState {
    return { ...this.state }
  }

  private broadcastState(): void {
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    if (window) {
      window.webContents.send(IPC.DAP_STATUS, this.state)
    }
  }

  public toggleBreakpoint(filePath: string, line: number): void {
    const cleanPath = filePath.replace(/\\/g, '/')
    const idx = this.state.breakpoints.findIndex(b => b.filePath === cleanPath && b.line === line)
    
    if (idx !== -1) {
      this.state.breakpoints.splice(idx, 1)
      this.sendCommand('Debugger.removeBreakpoint', { breakpointId: `bp_${cleanPath}_${line}` }).catch(() => {})
    } else {
      this.state.breakpoints.push({
        filePath: cleanPath,
        line,
        verified: true
      })
      this.sendCommand('Debugger.setBreakpointByUrl', {
        urlRegex: '.*' + cleanPath.split('/').pop() + '.*',
        lineNumber: line - 1
      }).catch(() => {})
    }
    this.broadcastState()
  }

  public startDebugSession(port: number, scriptPath: string): void {
    this.stopDebugSession()
    const cleanPath = scriptPath.replace(/\\/g, '/')
    
    this.state = {
      ...this.state,
      state: 'running',
      port,
      scriptPath: cleanPath,
      threadId: 1,
      stackFrames: [],
      scopes: [],
      activeFrameId: null,
      errorOutput: undefined
    }
    this.broadcastState()

    this.connectInspector(port).catch(err => {
      console.error('[DapService] Failed to connect to inspector:', err)
      this.state.errorOutput = `Failed to connect to debugger on port ${port}: ${err.message}`
      this.state.state = 'inactive'
      this.broadcastState()
    })
  }

  private async connectInspector(port: number): Promise<void> {
    const res = await fetch(`http://127.0.0.1:${port}/json/list`)
    const targets = await res.json()
    if (!targets || targets.length === 0) {
      throw new Error('No debug targets found.')
    }
    const wsUrl = targets[0].webSocketDebuggerUrl
    if (!wsUrl) throw new Error('No webSocketDebuggerUrl found in target.')

    this.ws = new WebSocket(wsUrl)
    
    this.ws.onopen = async () => {
      console.log(`[DapService] Connected to debugger at ${wsUrl}`)
      await this.sendCommand('Debugger.enable')
      await this.sendCommand('Runtime.enable')

      // Sync breakpoints
      for (const bp of this.state.breakpoints) {
        if (bp.verified) {
          try {
            await this.sendCommand('Debugger.setBreakpointByUrl', {
              urlRegex: '.*' + bp.filePath.split('/').pop() + '.*',
              lineNumber: bp.line - 1
            })
          } catch(e) {
            console.error('Failed to set bp', e)
          }
        }
      }
    }

    this.ws.onmessage = (event: any) => {
      const msg = JSON.parse(event.data)
      if (msg.id && this.pendingRequests.has(msg.id)) {
        if (msg.error) {
          this.pendingRequests.get(msg.id)!.reject(new Error(msg.error.message))
        } else {
          this.pendingRequests.get(msg.id)!.resolve(msg.result)
        }
        this.pendingRequests.delete(msg.id)
      } else if (msg.method) {
        this.handleEvent(msg.method, msg.params)
      }
    }

    this.ws.onclose = () => {
      console.log('[DapService] Debugger connection closed.')
      this.stopDebugSession()
    }
  }

  private sendCommand(method: string, params?: any): Promise<any> {
    if (!this.ws || this.ws.readyState !== WebSocket.OPEN) return Promise.reject(new Error('WebSocket not connected'))
    return new Promise((resolve, reject) => {
      const id = this.msgId++
      this.pendingRequests.set(id, { resolve, reject })
      this.ws!.send(JSON.stringify({ id, method, params }))
    })
  }

  private async handleEvent(method: string, params: any) {
    if (method === 'Debugger.paused') {
      this.state.state = 'paused'
      this.state.errorOutput = params.reason === 'exception' ? 'Exception hit' : undefined
      
      const frames = params.callFrames || []
      this.state.stackFrames = frames.map((f: any, i: number) => ({
        id: i,
        name: f.functionName || '(anonymous)',
        source: { name: f.url.split('/').pop() || 'unknown', path: f.url.replace('file://', '') },
        line: f.location.lineNumber + 1,
        column: f.location.columnNumber + 1
      }))
      
      this.state.activeFrameId = 0
      
      if (frames.length > 0) {
        await this.loadScopes(frames[0])
      }
      
      this.broadcastState()
    } else if (method === 'Debugger.resumed') {
      this.state.state = 'running'
      this.state.stackFrames = []
      this.state.scopes = []
      this.state.activeFrameId = null
      this.broadcastState()
    }
  }

  private async loadScopes(callFrame: any) {
    this.state.scopes = []
    const scopes = callFrame.scopeChain || []
    for (let i = 0; i < scopes.length; i++) {
      const scope = scopes[i]
      if (scope.type === 'global') continue
      
      const res = await this.sendCommand('Runtime.getProperties', {
        objectId: scope.object.objectId,
        ownProperties: true
      }).catch(() => null)

      if (res && res.result) {
        const variables = res.result.map((prop: any) => ({
          name: prop.name,
          value: prop.value ? (prop.value.value !== undefined ? String(prop.value.value) : prop.value.description || prop.value.type) : 'undefined',
          type: prop.value ? prop.value.type : 'undefined',
          variablesReference: prop.value?.objectId ? Math.floor(Math.random() * 1000) : 0
        }))

        this.state.scopes.push({
          name: scope.type.charAt(0).toUpperCase() + scope.type.slice(1),
          variablesReference: i + 1,
          variables
        })
      }
    }
  }

  public stopDebugSession(): void {
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.pendingRequests.clear()

    this.state = {
      ...this.state,
      state: 'inactive',
      port: 0,
      scriptPath: '',
      threadId: undefined,
      stackFrames: [],
      scopes: [],
      activeFrameId: null,
      errorOutput: undefined
    }
    this.broadcastState()
  }

  public stepOver(): void {
    if (this.state.state !== 'paused') return
    this.sendCommand('Debugger.stepOver').catch(console.error)
  }

  public stepInto(): void {
    if (this.state.state !== 'paused') return
    this.sendCommand('Debugger.stepInto').catch(console.error)
  }

  public stepOut(): void {
    if (this.state.state !== 'paused') return
    this.sendCommand('Debugger.stepOut').catch(console.error)
  }

  public continueExecution(): void {
    if (this.state.state !== 'paused') return
    this.sendCommand('Debugger.resume').catch(console.error)
  }

  public async explainDebuggerState(goal: string): Promise<string> {
    const activeConfigs = listApiConfigs().filter((c) => c.isActive)
    const config = activeConfigs.find(c => c.apiKey || c.provider === 'ollama' || c.provider === 'custom') || activeConfigs[0]
    
    if (!config) {
      return '[ERROR] No active AI provider configured. Please add an API key in settings.'
    }

    const model = config.defaultModel || 'gpt-4o'
    const provider = ProviderFactory.create(config)

    let frameContext = 'Stack Trace:\n'
    for (const frame of this.state.stackFrames) {
      frameContext += `  at ${frame.name} (${frame.source.path}:${frame.line}:${frame.column})\n`
    }

    frameContext += '\nVariable Scopes:\n'
    for (const scope of this.state.scopes) {
      frameContext += `[Scope: ${scope.name}]\n`
      for (const v of scope.variables) {
        frameContext += `  ${v.name} = ${v.value} (${v.type || 'unknown'})\n`
      }
    }

    if (this.state.errorOutput) {
      frameContext += `\nError output:\n${this.state.errorOutput}\n`
    }

    const systemPrompt = `You are a Debugger Explainer AI agent. You are given a stack trace, local scopes, variables, and error output representing a paused/crashed execution state.
Analyze the provided execution context to pinpoint the exact root cause of the error.
Explain:
1. What went wrong in the variables or state.
2. The specific file and line that caused the error.
3. Propose a drop-in replacement patch (Unified diff layout) to resolve the issue.`

    const messages = [
      {
        id: 'debug_explain_init',
        sessionId: 'dap_temp',
        role: 'user' as const,
        content: `User's overall goal: "${goal}"\n\nCurrent Debugger State:\n${frameContext}`,
        createdAt: new Date().toISOString()
      }
    ]

    try {
      const response = await provider.sendMessage(messages, {
        model,
        stream: false,
        systemPrompt
      })
      return response.content
    } catch (err) {
      return `[ERROR] AI Explainer failed: ${(err as Error).message}`
    }
  }
}

registerSingleton(IDapService, DapService, InstantiationType.Delayed);
