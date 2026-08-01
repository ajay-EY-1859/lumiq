import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { LspProcess } from '../LspProcess'

describe('LspProcess Engine', () => {
  it('parses UTF-8 payloads without corrupting multi-byte content', async () => {
    const proc = new LspProcess('typescript', 'node', '/tmp/workspace', () => undefined)
    const handleData = (proc as any).handleData.bind(proc)

    const payload = Buffer.from(JSON.stringify({ jsonrpc: '2.0', id: 7, result: 'café' }), 'utf8')
    const frame = Buffer.concat([
      Buffer.from(`Content-Length: ${payload.length}\r\n\r\n`, 'ascii'),
      payload
    ])

    const resolved = new Promise((resolve) => {
      (proc as any).pendingRequests.set(7, {
        resolve,
        reject: () => resolve(null)
      })
    })

    handleData(frame)

    await expect(resolved).resolves.toBe('café')
    expect((proc as any).pendingRequests.has(7)).toBe(false)
  })

  it('should initialize, request hover, completions, and listen to publishDiagnostics', async () => {
    const mockServerPath = join(__dirname, 'mockLspServer.js')
    const workspacePath = __dirname

    const notifications: { method: string; params: any }[] = []
    const onNotification = (method: string, params: any) => {
      notifications.push({ method, params })
    }

    // Binary command to run mock server is node mockLspServer.js
    const binary = `node "${mockServerPath}"`
    const proc = new LspProcess('typescript', binary, workspacePath, onNotification)

    const started = await proc.start()
    expect(started).toBe(true)

    // Verify hover
    const hoverResult = await proc.sendRequest('textDocument/hover', {
      textDocument: { uri: 'file:///mock_collab_workspace/math.ts' },
      position: { line: 0, character: 20 }
    })
    expect(hoverResult).toBeDefined()
    expect(hoverResult.contents.value).toContain('multiplyNums')

    // Verify completions
    const completionsResult = await proc.sendRequest('textDocument/completion', {
      textDocument: { uri: 'file:///mock_collab_workspace/math.ts' },
      position: { line: 0, character: 20 }
    })
    expect(completionsResult).toBeDefined()
    expect(completionsResult).toHaveLength(1)
    expect(completionsResult[0].label).toBe('multiplyNums')

    // Wait for diagnostics notification
    await new Promise((resolve) => setTimeout(resolve, 50))
    const diagNotification = notifications.find(n => n.method === 'textDocument/publishDiagnostics')
    expect(diagNotification).toBeDefined()
    expect(diagNotification?.params.diagnostics[0].message).toBe('Mock semantic error')

    // Clean up
    proc.stop()
  })
})
