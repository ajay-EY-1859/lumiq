// ═══════════════════════════════════════════════════════════════════
// Lumiq — Deployment Service IPC Handlers (Milestone 29)
// ═══════════════════════════════════════════════════════════════════

import { IPC } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { getService } from '@shared/instantiation/instantiationService'
import { IDeploymentService } from '@shared/services'

export function registerDeployHandlers(): void {
  handleWithTimeout(IPC.DEPLOY_GENERATE_IAC, IPC_TIMEOUT.short, async (_event, req: { workspacePath: string; target: 'docker' | 'serverless' }): Promise<any> => {
    return await getService(IDeploymentService).generateIaC(req.workspacePath, req.target)
  })

  handleWithTimeout(IPC.DEPLOY_VERIFY_BUILD, IPC_TIMEOUT.long, async (_event, workspacePath: string): Promise<any> => {
    return await getService(IDeploymentService).verifyPreDeployBuild(workspacePath)
  })
}
