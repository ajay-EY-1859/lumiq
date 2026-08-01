// ═══════════════════════════════════════════════════════════════════
// Lumiq — Test Orchestrator IPC Handlers (Milestone 27)
// ═══════════════════════════════════════════════════════════════════

import { IPC } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { getService } from '@shared/instantiation/instantiationService'
import { ITestOrchestratorService } from '@shared/services'

export function registerTestHandlers(): void {
  handleWithTimeout(IPC.TEST_GENERATE_SUITE, IPC_TIMEOUT.short, async (_event, req: { filePath: string; testContent: string }): Promise<any> => {
    return await getService(ITestOrchestratorService).generateTestSuite(req.filePath, req.testContent)
  })

  handleWithTimeout(IPC.TEST_RUN_SUITE, IPC_TIMEOUT.long, async (_event, testFilePath: string): Promise<any> => {
    return await getService(ITestOrchestratorService).runTestSuite(testFilePath)
  })

  handleWithTimeout(IPC.TEST_REPAIR_LOOP, IPC_TIMEOUT.long * 2, async (_event, req: { testFilePath: string; sourceFilePath: string; maxRetries?: number }): Promise<any> => {
    return await getService(ITestOrchestratorService).autonomousRepairLoop(req.testFilePath, req.sourceFilePath, req.maxRetries)
  })
}
