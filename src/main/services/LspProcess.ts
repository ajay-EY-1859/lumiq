// ═══════════════════════════════════════════════════════════════════
// Lumiq — LSP Process Manager
// Manages language server child processes and implements JSON-RPC.
// ═══════════════════════════════════════════════════════════════════

import { ChildProcess, spawn } from 'child_process'

export class LspProcess {
  private process: ChildProcess | null = null
  private buffer = Buffer.alloc(0)
  private nextId = 1
  private pendingRequests = new Map<number, { resolve: (val: any) => void; reject: (err: any) => void }>()
  private isShuttingDown = false

  constructor(
    public readonly languageId: string,
    private readonly binaryPath: string,
    private readonly workspacePath: string,
    private readonly onNotification: (method: string, params: any) => void
  ) {}

  async start(): Promise<boolean> {
    try {
      this.isShuttingDown = false
      const parts = this.binaryPath.split(/\s+/)
      const command = parts[0]
      const args = [...parts.slice(1), '--stdio']

      console.log(`[LspProcess-${this.languageId}] Spawning ${command} ${args.join(' ')} at ${this.workspacePath}`)
      this.process = spawn(command, args, {
        cwd: this.workspacePath,
        shell: true
      })

      this.process.stdout?.on('data', (data: Buffer) => this.handleData(data))
      
      this.process.stderr?.on('data', (data: Buffer) => {
        console.warn(`[LspProcess-${this.languageId} stderr] ${data.toString('utf8').trim()}`)
      })

      this.process.on('error', (err) => {
        console.error(`[LspProcess-${this.languageId}] Process error:`, err)
        if (!this.isShuttingDown) this.stop()
      })

      this.process.on('close', (code) => {
        console.log(`[LspProcess-${this.languageId}] Process closed with code ${code}`)
        if (!this.isShuttingDown) this.stop()
      })

      // Send standard initialize request
      const initParams = {
        processId: process.pid,
        rootUri: `file:///${this.workspacePath.replace(/\\/g, '/')}`,
        capabilities: {
          textDocument: {
            hover: { dynamicRegistration: true, contentFormat: ['markdown', 'plaintext'] },
            completion: { dynamicRegistration: true, completionItem: { snippetSupport: true } },
            publishDiagnostics: { relatedInformation: true }
          }
        },
        workspaceFolders: [
          {
            uri: `file:///${this.workspacePath.replace(/\\/g, '/')}`,
            name: 'workspace'
          }
        ]
      }

      await this.sendRequest('initialize', initParams)
      this.sendNotification('initialized', {})
      console.log(`[LspProcess-${this.languageId}] Successfully initialized server`)
      return true
    } catch (err) {
      console.error(`[LspProcess-${this.languageId}] Start failed:`, err)
      this.stop()
      return false
    }
  }

  stop() {
    if (this.isShuttingDown) return
    this.isShuttingDown = true
    
    if (this.process) {
      try {
        this.process.kill()
      } catch {
        // ignore
      }
      this.process = null
    }

    for (const [_, req] of this.pendingRequests) {
      req.reject(new Error('LSP server stopped'))
    }
    this.pendingRequests.clear()
    this.buffer = Buffer.alloc(0)
  }

  sendRequest(method: string, params: any): Promise<any> {
    return new Promise((resolve, reject) => {
      const id = this.nextId++
      
      const timeoutId = setTimeout(() => {
        if (this.pendingRequests.has(id)) {
          this.pendingRequests.delete(id)
          reject(new Error(`LSP Request timeout: ${method}`))
        }
      }, 30000)

      this.pendingRequests.set(id, { 
        resolve: (val) => { clearTimeout(timeoutId); resolve(val) }, 
        reject: (err) => { clearTimeout(timeoutId); reject(err) } 
      })

      const payload = {
        jsonrpc: '2.0',
        id,
        method,
        params
      }
      this.writePayload(payload)
    })
  }

  sendNotification(method: string, params: any) {
    const payload = {
      jsonrpc: '2.0',
      method,
      params
    }
    this.writePayload(payload)
  }

  private writePayload(payload: any) {
    if (!this.process || !this.process.stdin || this.process.stdin.destroyed) {
      return
    }
    const json = JSON.stringify(payload)
    const content = Buffer.from(json, 'utf8')
    const header = `Content-Length: ${content.length}\r\n\r\n`
    this.process.stdin.write(header)
    this.process.stdin.write(content)
  }

  private handleData(data: Buffer) {
    this.buffer = Buffer.concat([this.buffer, data])

    while (true) {
      const headerName = Buffer.from('Content-Length:', 'ascii')
      const headerIndex = this.buffer.indexOf(headerName)
      if (headerIndex === -1) {
        break
      }

      const headerEndIndex = this.buffer.indexOf(Buffer.from('\r\n\r\n', 'ascii'), headerIndex)
      if (headerEndIndex === -1) {
        break
      }

      const headerLine = this.buffer.subarray(headerIndex, headerEndIndex).toString('ascii')
      const match = headerLine.match(/Content-Length:\s*(\d+)/i)
      if (!match) {
        this.buffer = this.buffer.subarray(headerEndIndex + 4)
        continue
      }

      const contentLength = parseInt(match[1], 10)
      const messageStartIndex = headerEndIndex + 4
      const messageLength = messageStartIndex + contentLength

      if (this.buffer.length < messageLength) {
        break
      }

      const payloadBuffer = this.buffer.subarray(messageStartIndex, messageLength)
      this.buffer = this.buffer.subarray(messageLength)

      try {
        const payloadJson = payloadBuffer.toString('utf8')
        const payload = JSON.parse(payloadJson)
        this.dispatchMessage(payload)
      } catch (err) {
        console.error('[LspProcessParser] JSON parse error:', err)
      }
    }
  }

  private dispatchMessage(payload: any) {
    if (payload.id !== undefined) {
      const id = Number(payload.id)
      const req = this.pendingRequests.get(id)
      if (req) {
        this.pendingRequests.delete(id)
        if (payload.error) {
          req.reject(new Error(payload.error.message || 'LSP Request error'))
        } else {
          req.resolve(payload.result)
        }
      }
    } else if (payload.method) {
      this.onNotification(payload.method, payload.params)
    }
  }
}
