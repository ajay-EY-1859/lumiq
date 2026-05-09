// ═══════════════════════════════════════════════════════════════════
// Lumiq — Agent IPC Handlers
// Handles agent CRUD operations
// ═══════════════════════════════════════════════════════════════════

import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import type { Agent } from '@shared/types'
import { saveAgent, listAgents, deleteAgent } from '../db/agents'

export function registerAgentHandlers(): void {
  // ── List all agents ──
  ipcMain.handle(IPC.AGENT_LIST, () => {
    return listAgents()
  })

  // ── Save agent (create or update) ──
  ipcMain.handle(
    IPC.AGENT_SAVE,
    (_event, agent: Partial<Agent> & { name: string; systemPrompt: string }) => {
      return saveAgent(agent)
    }
  )

  // ── Delete agent ──
  ipcMain.handle(IPC.AGENT_DELETE, (_event, agentId: string) => {
    return deleteAgent(agentId)
  })
}
