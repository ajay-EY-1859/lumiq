import { describe, it, expect, vi, beforeAll } from 'vitest'
import { InstantiationService, setActiveContainer } from '@shared/instantiation/instantiationService'
import { DapService } from '../DapService'

vi.mock('electron', () => {
  const BrowserWindow = {
    getFocusedWindow: () => null,
    getAllWindows: () => []
  }
  const app = {
    isPackaged: false,
    getPath: (_name: string) => '/tmp'
  }
  return {
    app,
    BrowserWindow,
    default: {
      app,
      BrowserWindow
    }
  }
})

vi.mock('../../auth/devMode', () => {
  return {
    isDeveloperMode: () => false
  }
})

describe('DapService - Debug Adapter Protocol Client', () => {
  beforeAll(() => {
    const container = new InstantiationService()
    setActiveContainer(container)
  })

  it('should initialize with inactive state', () => {
    const service = DapService.getInstance()
    const status = service.getStatus()
    expect(status.state).toBe('inactive')
    expect(status.port).toBe(0)
    expect(status.breakpoints).toEqual([])
  })

  it('should manage breakpoints correctly', () => {
    const service = DapService.getInstance()
    
    // Toggle on
    service.toggleBreakpoint('src/main.ts', 15)
    let status = service.getStatus()
    expect(status.breakpoints.length).toBe(1)
    expect(status.breakpoints[0]).toEqual({
      filePath: 'src/main.ts',
      line: 15,
      verified: true
    })

    // Toggle off
    service.toggleBreakpoint('src/main.ts', 15)
    status = service.getStatus()
    expect(status.breakpoints.length).toBe(0)
  })

  it('should start debug session and transition state', async () => {
    const service = DapService.getInstance()
    
    // Mock fetch and WebSocket globally
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([{ webSocketDebuggerUrl: 'ws://mock' }])
    })
    
    class MockWebSocket {
      static OPEN = 1
      send = vi.fn()
      close = vi.fn()
      onmessage: any = null
      onopen: any = null
      readyState = 1 // OPEN
      constructor() {
      }
    }
    global.WebSocket = MockWebSocket as any

    service.startDebugSession(9229, 'src/main.ts')
    
    // Wait for async fetch to resolve
    await new Promise(r => setTimeout(r, 50))
    
    let status = service.getStatus()
    expect(status.state).toBe('running')
    expect(status.port).toBe(9229)
    expect(status.scriptPath).toBe('src/main.ts')

    // Stop session
    service.stopDebugSession()
    status = service.getStatus()
    expect(status.state).toBe('inactive')
    expect(status.port).toBe(0)
  })

  it('should handle stepping actions when paused via CDP events', async () => {
    const service = DapService.getInstance()
    
    // Mock fetch and WebSocket
    let wsMock: any
    global.fetch = vi.fn().mockResolvedValue({
      json: () => Promise.resolve([{ webSocketDebuggerUrl: 'ws://mock' }])
    })
    
    class MockWebSocket {
      static OPEN = 1
      send = vi.fn()
      close = vi.fn()
      onmessage: any = null
      onopen: any = null
      readyState = 1 // OPEN
      constructor() {
        // eslint-disable-next-line @typescript-eslint/no-this-alias
        wsMock = this
      }
    }
    global.WebSocket = MockWebSocket as any
    
    service.startDebugSession(9229, 'src/main.ts')
    await new Promise(r => setTimeout(r, 50))
    
    // Trigger open
    if (wsMock && wsMock.onopen) wsMock.onopen()
    
    // Simulate Debugger.paused event
    if (wsMock && wsMock.onmessage) {
      wsMock.onmessage({
        data: JSON.stringify({
          method: 'Debugger.paused',
          params: {
            reason: 'other',
            callFrames: [{
              callFrameId: '0',
              functionName: 'testFunc',
              location: { lineNumber: 17, columnNumber: 5 },
              url: 'file:///src/main.ts',
              scopeChain: []
            }]
          }
        })
      })
    }
    
    await new Promise(r => setTimeout(r, 50))
    
    let status = service.getStatus()
    expect(status.state).toBe('paused')
    expect(status.stackFrames.length).toBe(1)
    expect(status.stackFrames[0].line).toBe(18) // +1 for 1-based indexing

    // Step Over
    service.stepOver()
    expect(wsMock.send).toHaveBeenCalledWith(expect.stringContaining('Debugger.stepOver'))

    // Step Into
    service.stepInto()
    expect(wsMock.send).toHaveBeenCalledWith(expect.stringContaining('Debugger.stepInto'))

    // Step Out
    service.stepOut()
    expect(wsMock.send).toHaveBeenCalledWith(expect.stringContaining('Debugger.stepOut'))

    // Continue
    service.continueExecution()
    expect(wsMock.send).toHaveBeenCalledWith(expect.stringContaining('Debugger.resume'))

    // Simulate Debugger.resumed event
    if (wsMock && wsMock.onmessage) {
      wsMock.onmessage({
        data: JSON.stringify({
          method: 'Debugger.resumed'
        })
      })
    }
    
    status = service.getStatus()
    expect(status.state).toBe('running')
    expect(status.stackFrames.length).toBe(0)

    // Clean up
    service.stopDebugSession()
  })
})
