// ═══════════════════════════════════════════════════════════════════
// Lumiq — Chat IPC Handlers
// Handles chat:send, chat:cancel
// ═══════════════════════════════════════════════════════════════════

import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import { agentLoop } from '../agent/AgentLoop'
import { getSessionMessages } from '../db/messages'
import { getApiConfig } from '../db/apiConfigs'
import { getSession } from '../db/sessions'

export function registerChatHandlers(): void {
  // ── Send message ──
  ipcMain.handle(
    IPC.CHAT_SEND,
    async (
      _event,
      data: {
        message: string
        sessionId: string
        provider: string
        model: string
        systemPrompt?: string
      }
    ) => {
      const { message, sessionId, provider, model, systemPrompt } = data

      // Validate input
      if (!message || !sessionId || !provider || !model) {
        throw new Error('Missing required fields: message, sessionId, provider, model')
      }

      // Get provider config (with decrypted keys)
      const config = getApiConfig(provider)
      if (!config) {
        throw new Error(`Provider "${provider}" is not configured. Add an API key in Settings.`)
      }

      // Get session messages for context
      const session = getSession(sessionId)
      if (!session) {
        throw new Error(`Session "${sessionId}" not found`)
      }

      const messages = getSessionMessages(sessionId)

      // Process through agent loop (handles streaming internally)
      await agentLoop.processMessage(message, sessionId, messages, config, {
        model,
        systemPrompt
      })
    }
  )

  // ── Cancel active request ──
  ipcMain.handle(IPC.CHAT_CANCEL, () => {
    agentLoop.cancel()
  })
}
