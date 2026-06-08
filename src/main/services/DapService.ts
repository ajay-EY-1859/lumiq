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

  private timeoutIds: NodeJS.Timeout[] = []

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
    } else {
      this.state.breakpoints.push({
        filePath: cleanPath,
        line,
        verified: true
      })
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

    // Simulate hitting a breakpoint/exception after 1.5 seconds
    const id = setTimeout(() => {
      this.triggerSimulatedBreak()
    }, 1500)
    this.timeoutIds.push(id)
  }

  public stopDebugSession(): void {
    for (const timeoutId of this.timeoutIds) {
      clearTimeout(timeoutId)
    }
    this.timeoutIds = []

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

  private triggerSimulatedBreak(): void {
    this.state.state = 'paused'
    this.state.activeFrameId = 0
    this.state.errorOutput = "TypeError: Cannot read properties of null (reading 'toString') at calculateTotal (src/utils/math.ts:18:12)"

    // Load mock stack frames
    this.state.stackFrames = [
      {
        id: 0,
        name: 'calculateTotal',
        source: { name: 'math.ts', path: 'src/utils/math.ts' },
        line: 18,
        column: 12
      },
      {
        id: 1,
        name: 'processInvoice',
        source: { name: 'billing.ts', path: 'src/services/billing.ts' },
        line: 45,
        column: 8
      },
      {
        id: 2,
        name: 'handleCheckout',
        source: { name: 'main.ts', path: 'src/main.ts' },
        line: 102,
        column: 4
      }
    ]

    // Load mock scopes
    this.state.scopes = [
      {
        name: 'Local',
        variablesReference: 1000,
        variables: [
          { name: 'items', value: '[ { id: 101, price: null, qty: 2 } ]', type: 'object' },
          { name: 'taxRate', value: '0.18', type: 'number' },
          { name: 'discount', value: 'undefined', type: 'undefined' }
        ]
      },
      {
        name: 'Global',
        variablesReference: 2000,
        variables: [
          { name: 'process', value: '[Object]', type: 'object' },
          { name: 'LUMIQ_DEBUG_MODE', value: '"true"', type: 'string' }
        ]
      }
    ]

    this.broadcastState()
  }

  public stepOver(): void {
    if (this.state.state !== 'paused' || this.state.stackFrames.length === 0) return

    // Simulate moving to next line and resolving the variable state
    const currentFrame = this.state.stackFrames[0]!
    currentFrame.line = currentFrame.line + 1
    
    // Update local variables during stepping to show debugger is "alive"
    const localScope = this.state.scopes.find(s => s.name === 'Local')
    if (localScope) {
      const discountVar = localScope.variables.find(v => v.name === 'discount')
      if (discountVar) {
        discountVar.value = '0'
        discountVar.type = 'number'
      }
    }
    
    this.broadcastState()
  }

  public stepInto(): void {
    if (this.state.state !== 'paused' || this.state.stackFrames.length === 0) return

    // Simulate stepping into functions
    this.state.stackFrames.unshift({
      id: 99,
      name: 'formatCurrency',
      source: { name: 'stringFormatter.ts', path: 'src/utils/stringFormatter.ts' },
      line: 5,
      column: 2
    })
    this.state.activeFrameId = 99

    this.broadcastState()
  }

  public stepOut(): void {
    if (this.state.state !== 'paused' || this.state.stackFrames.length < 2) return

    // Pop active frame
    this.state.stackFrames.shift()
    this.state.activeFrameId = this.state.stackFrames[0]!.id

    this.broadcastState()
  }

  public continueExecution(): void {
    if (this.state.state !== 'paused') return
    
    this.state.state = 'running'
    this.state.stackFrames = []
    this.state.scopes = []
    this.state.activeFrameId = null
    this.state.errorOutput = undefined
    
    this.broadcastState()

    // Trigger another pause after 2 seconds (e.g. hits another line or normal finish)
    const id = setTimeout(() => {
      this.state.state = 'inactive'
      this.broadcastState()
    }, 2000)
    this.timeoutIds.push(id)
  }

  public async explainDebuggerState(goal: string): Promise<string> {
    const activeConfigs = listApiConfigs().filter((c) => c.isActive)
    const config = activeConfigs.find(c => c.apiKey || c.provider === 'ollama' || c.provider === 'custom') || activeConfigs[0]
    
    if (!config) {
      return '[ERROR] No active AI provider configured. Please add an API key in settings.'
    }

    const model = config.defaultModel || 'gpt-4o'
    const provider = ProviderFactory.create(config)

    // Construct detailed context of stack frames and variable scopes
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
