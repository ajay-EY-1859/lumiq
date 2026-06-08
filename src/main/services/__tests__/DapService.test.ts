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

  it('should start debug session and transition state', () => {
    const service = DapService.getInstance()
    
    service.startDebugSession(9229, 'src/main.ts')
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

  it('should handle stepping actions when paused', () => {
    const service = DapService.getInstance()
    
    // Force set state to paused with mock frames for testing
    service.startDebugSession(9229, 'src/main.ts')
    
    // Manually trigger simulated break to avoid waiting for timeout
    ;(service as any).triggerSimulatedBreak()
    
    let status = service.getStatus()
    expect(status.state).toBe('paused')
    expect(status.stackFrames.length).toBe(3)
    expect(status.stackFrames[0].line).toBe(18)

    // Step Over
    service.stepOver()
    status = service.getStatus()
    expect(status.stackFrames[0].line).toBe(19)
    
    // Verify variable mutation during step over
    const localScope = status.scopes.find(s => s.name === 'Local')
    const discountVar = localScope?.variables.find(v => v.name === 'discount')
    expect(discountVar?.value).toBe('0')

    // Step Into
    service.stepInto()
    status = service.getStatus()
    expect(status.stackFrames.length).toBe(4)
    expect(status.activeFrameId).toBe(99)
    expect(status.stackFrames[0].name).toBe('formatCurrency')

    // Step Out
    service.stepOut()
    status = service.getStatus()
    expect(status.stackFrames.length).toBe(3)
    expect(status.activeFrameId).toBe(0)

    // Continue
    service.continueExecution()
    status = service.getStatus()
    expect(status.state).toBe('running')
    expect(status.stackFrames.length).toBe(0)

    // Clean up
    service.stopDebugSession()
  })
})
