// ═══════════════════════════════════════════════════════════════════
// Lumiq — Web Sandbox & CDP Inspector IPC Handlers
// ═══════════════════════════════════════════════════════════════════

import { IPC } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { getService } from '@shared/instantiation/instantiationService'
import { IWebSandboxService, ICdpInspectorService } from '@shared/services'

export function registerSandboxHandlers(): void {
  // Start preview server
  handleWithTimeout(IPC.SANDBOX_START, IPC_TIMEOUT.medium, async (_event, workspacePath: string) => {
    const sandbox = getService(IWebSandboxService)
    return await sandbox.startServer(workspacePath)
  })

  // Stop preview server
  handleWithTimeout(IPC.SANDBOX_STOP, IPC_TIMEOUT.short, async (_event, serverId: string) => {
    const sandbox = getService(IWebSandboxService)
    await sandbox.stopServer(serverId)
    return true
  })

  // Inspect styles via CDP
  handleWithTimeout(IPC.SANDBOX_INSPECT_STYLES, IPC_TIMEOUT.short, async (_event, req: { serverId: string; selector: string }) => {
    const sandbox = getService(IWebSandboxService)
    return await sandbox.inspectStyles(req.serverId, req.selector)
  })

  // Dynamic CSS style update
  handleWithTimeout(IPC.SANDBOX_UPDATE_STYLE, IPC_TIMEOUT.short, (_event, req: { selector: string; property: string; value: string }) => {
    const cdp = getService(ICdpInspectorService)
    return cdp.updateElementStyle(req.selector, req.property, req.value)
  })

  // DOM node tree structure
  handleWithTimeout(IPC.SANDBOX_GET_DOM_TREE, IPC_TIMEOUT.short, (_event, req: { workspacePath: string; htmlContent?: string }) => {
    const cdp = getService(ICdpInspectorService)
    return cdp.getDomTree(req.workspacePath, req.htmlContent)
  })

  // Console log entries
  handleWithTimeout(IPC.SANDBOX_GET_CONSOLE_LOGS, IPC_TIMEOUT.short, () => {
    const cdp = getService(ICdpInspectorService)
    return cdp.getConsoleLogs()
  })

  // Heap memory snapshot
  handleWithTimeout(IPC.SANDBOX_TAKE_HEAP_SNAPSHOT, IPC_TIMEOUT.short, () => {
    const cdp = getService(ICdpInspectorService)
    return cdp.takeHeapSnapshot()
  })
}
