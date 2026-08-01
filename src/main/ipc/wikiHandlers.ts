// ═══════════════════════════════════════════════════════════════════
// Lumiq — Codebase Architect Wiki IPC Handlers (Milestone 30)
// ═══════════════════════════════════════════════════════════════════

import { IPC } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { getService } from '@shared/instantiation/instantiationService'
import { IArchitectWikiService } from '@shared/services'

export function registerWikiHandlers(): void {
  handleWithTimeout(IPC.WIKI_ANALYZE, IPC_TIMEOUT.long, async (_event, workspacePath: string): Promise<any> => {
    return await getService(IArchitectWikiService).analyzeCodebase(workspacePath)
  })

  handleWithTimeout(IPC.WIKI_MERMAID, IPC_TIMEOUT.short, async (_event, workspacePath: string): Promise<any> => {
    return await getService(IArchitectWikiService).generateMermaidDiagram(workspacePath)
  })

  handleWithTimeout(IPC.WIKI_WRITE, IPC_TIMEOUT.long, async (_event, workspacePath: string): Promise<any> => {
    return await getService(IArchitectWikiService).writeWikiFile(workspacePath)
  })
}
