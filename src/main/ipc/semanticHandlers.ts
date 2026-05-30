// ═══════════════════════════════════════════════════════════════════
// Lumiq — Semantic Search Handlers
// Exposes codebase RAG indexing and query operations to the renderer.
// ═══════════════════════════════════════════════════════════════════

import { IPC } from '@shared/types'
import type { SemanticSearchRequest, SemanticSearchResponse, SemanticIndexStatus } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { codebaseIndexer } from '../agent/CodebaseIndexer'
import { ragQueryEngine } from '../agent/RAGQueryEngine'

export function registerSemanticHandlers(): void {
  handleWithTimeout(IPC.SEMANTIC_INDEX, IPC_TIMEOUT.short, (_event, request: { workspacePath: string; force?: boolean }): Promise<SemanticIndexStatus> => {
    return codebaseIndexer.indexWorkspace(request.workspacePath, request.force ?? false)
  })

  handleWithTimeout(IPC.SEMANTIC_STATUS, IPC_TIMEOUT.short, (_event, workspacePath: string): SemanticIndexStatus => {
    return codebaseIndexer.getStatus(workspacePath)
  })

  handleWithTimeout(IPC.SEMANTIC_SEARCH, IPC_TIMEOUT.long, async (_event, request: SemanticSearchRequest): Promise<SemanticSearchResponse> => {
    const start = Date.now()
    const query = request.query.trim()

    if (!query || !request.workspacePath) {
      return { matches: [], totalMatches: 0, elapsed: 0 }
    }

    const matches = await ragQueryEngine.search(request.workspacePath, query, request.topK ?? 8)
    return {
      matches,
      totalMatches: matches.length,
      elapsed: Date.now() - start
    }
  })
}
