import { IPC } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { DapService } from '../services/DapService'

export function registerDapHandlers(): void {
  // Start a debug session
  handleWithTimeout(IPC.DAP_START, IPC_TIMEOUT.short, (_event, req: { port: number; scriptPath: string }): void => {
    DapService.getInstance().startDebugSession(req.port, req.scriptPath)
  })

  // Stop active debug session
  handleWithTimeout(IPC.DAP_STOP, IPC_TIMEOUT.short, (): void => {
    DapService.getInstance().stopDebugSession()
  })

  // Toggle/Set breakpoint in file
  handleWithTimeout(IPC.DAP_SET_BREAKPOINT, IPC_TIMEOUT.short, (_event, req: { filePath: string; line: number }): void => {
    DapService.getInstance().toggleBreakpoint(req.filePath, req.line)
  })

  // Step Over active thread line
  handleWithTimeout(IPC.DAP_STEP_OVER, IPC_TIMEOUT.short, (): void => {
    DapService.getInstance().stepOver()
  })

  // Step Into active function
  handleWithTimeout(IPC.DAP_STEP_INTO, IPC_TIMEOUT.short, (): void => {
    DapService.getInstance().stepInto()
  })

  // Step Out of active function
  handleWithTimeout(IPC.DAP_STEP_OUT, IPC_TIMEOUT.short, (): void => {
    DapService.getInstance().stepOut()
  })

  // Continue active thread execution
  handleWithTimeout(IPC.DAP_CONTINUE, IPC_TIMEOUT.short, (): void => {
    DapService.getInstance().continueExecution()
  })

  // Request AI explainer for current paused frames/variables state
  handleWithTimeout(IPC.DAP_EXPLAIN_STATE, IPC_TIMEOUT.long, async (_event, req: { goal: string }): Promise<string> => {
    return DapService.getInstance().explainDebuggerState(req.goal)
  })
}
