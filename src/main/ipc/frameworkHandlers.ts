// ═══════════════════════════════════════════════════════════════════
// Lumiq — Unified Framework IPC Channel Handler (Milestone 26)
// Bridges typesafe service proxy calls from renderer to main process channels.
// ═══════════════════════════════════════════════════════════════════

import { IPC } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { getService } from '@shared/instantiation/instantiationService'
import { IIpcFrameworkService } from '@shared/services'

export function registerFrameworkHandlers(): void {
  handleWithTimeout(
    IPC.FRAMEWORK_CALL,
    IPC_TIMEOUT.long,
    async (_event, req: { channel: string; method: string; args: any[] }): Promise<any> => {
      const ipcFramework = getService(IIpcFrameworkService)
      const chan = ipcFramework.getChannel(req.channel)
      return await chan.call(req.method, req.args)
    }
  )
}
