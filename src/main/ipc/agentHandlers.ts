// ═══════════════════════════════════════════════════════════════════
// Lumiq — Agent IPC Handlers
// Handles agent CRUD operations
// ═══════════════════════════════════════════════════════════════════

import { IPC } from '@shared/types'
import type { Agent } from '@shared/types'
import { saveAgent, listAgents, deleteAgent } from '../db/agents'
import { agentEditHistoryService } from '../services/AgentEditHistoryService'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

export function registerAgentHandlers(): void {
  // ── List all agents ──
  handleWithTimeout(IPC.AGENT_LIST, IPC_TIMEOUT.short, () => {
    return listAgents()
  })

  // ── Save agent (create or update) ──
  handleWithTimeout(
    IPC.AGENT_SAVE,
    IPC_TIMEOUT.short,
    (_event, agent: Partial<Agent> & { name: string; systemPrompt: string }) => {
      return saveAgent(agent)
    }
  )

  // ── Delete agent ──
  handleWithTimeout(IPC.AGENT_DELETE, IPC_TIMEOUT.short, (_event, agentId: string) => {
    return deleteAgent(agentId)
  })

  // ── Agent edit history ──
  handleWithTimeout(IPC.AGENT_EDIT_HISTORY, IPC_TIMEOUT.short, (_event, sessionId?: string) => {
    return agentEditHistoryService.getHistory(sessionId)
  })

  // ── Agent edit undo ──
  handleWithTimeout(IPC.AGENT_EDIT_UNDO, IPC_TIMEOUT.medium, (_event, snapshotId: string) => {
    return agentEditHistoryService.undoEdit(snapshotId)
  })

  // ── Agent edit redo ──
  handleWithTimeout(IPC.AGENT_EDIT_REDO, IPC_TIMEOUT.medium, (_event, snapshotId: string) => {
    return agentEditHistoryService.redoEdit(snapshotId)
  })
}
