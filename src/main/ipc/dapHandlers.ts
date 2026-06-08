import { IPC } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { getService } from '@shared/instantiation/instantiationService'
import { IDapService } from '@shared/services'

export function registerDapHandlers(): void {
  // Start a debug session
  handleWithTimeout(IPC.DAP_START, IPC_TIMEOUT.short, (_event, req: { port: number; scriptPath: string }): void => {
    getService(IDapService).startDebugSession(req.port, req.scriptPath)
  })

  // Stop active debug session
  handleWithTimeout(IPC.DAP_STOP, IPC_TIMEOUT.short, (): void => {
    getService(IDapService).stopDebugSession()
  })

  // Toggle/Set breakpoint in file
  handleWithTimeout(IPC.DAP_SET_BREAKPOINT, IPC_TIMEOUT.short, (_event, req: { filePath: string; line: number }): void => {
    getService(IDapService).toggleBreakpoint(req.filePath, req.line)
  })

  // Step Over active thread line
  handleWithTimeout(IPC.DAP_STEP_OVER, IPC_TIMEOUT.short, (): void => {
    getService(IDapService).stepOver()
  })

  // Step Into active function
  handleWithTimeout(IPC.DAP_STEP_INTO, IPC_TIMEOUT.short, (): void => {
    getService(IDapService).stepInto()
  })

  // Step Out of active function
  handleWithTimeout(IPC.DAP_STEP_OUT, IPC_TIMEOUT.short, (): void => {
    getService(IDapService).stepOut()
  })

  // Continue active thread execution
  handleWithTimeout(IPC.DAP_CONTINUE, IPC_TIMEOUT.short, (): void => {
    getService(IDapService).continueExecution()
  })

  // Request AI explainer for current paused frames/variables state
  handleWithTimeout(IPC.DAP_EXPLAIN_STATE, IPC_TIMEOUT.long, async (_event, req: { goal: string }): Promise<string> => {
    return getService(IDapService).explainDebuggerState(req.goal)
  })
}
