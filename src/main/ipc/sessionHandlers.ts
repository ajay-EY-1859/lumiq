// ═══════════════════════════════════════════════════════════════════
// Lumiq — Session IPC Handlers
// Handles session CRUD operations
// ═══════════════════════════════════════════════════════════════════

import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import {
  createSession,
  listSessions,
  deleteSession,
  updateSessionTitle,
  getSession,
  updateSessionWorkspace
} from '../db/sessions'
import { getSessionMessages } from '../db/messages'
import { setWorkspaceRoot } from '../security/pathValidation'

export function registerSessionHandlers(): void {
  // ── List all sessions ──
  ipcMain.handle(IPC.SESSION_LIST, () => {
    return listSessions()
  })

  // ── Load session (returns messages) ──
  ipcMain.handle(IPC.SESSION_LOAD, (_event, sessionId: string) => {
    const session = getSession(sessionId)
    if (!session) throw new Error(`Session "${sessionId}" not found`)
    
    // Authorize this session's workspace for file operations
    setWorkspaceRoot(session.workspacePath || null)

    const messages = getSessionMessages(sessionId)
    return { session, messages }
  })

  // ── Create new session ──
  ipcMain.handle(
    IPC.SESSION_CREATE,
    (_event, data: { provider: string; model: string; agentId?: string }) => {
      return createSession(data.provider, data.model, data.agentId)
    }
  )

  // ── Delete session ──
  ipcMain.handle(IPC.SESSION_DELETE, (_event, sessionId: string) => {
    return deleteSession(sessionId)
  })

  // ── Rename session ──
  ipcMain.handle(
    IPC.SESSION_RENAME,
    (_event, data: { sessionId: string; title: string }) => {
      updateSessionTitle(data.sessionId, data.title)
    }
  )

  // ── Set Workspace ──
  ipcMain.handle(
    IPC.SESSION_SET_WORKSPACE,
    (_event, data: { sessionId: string; workspacePath: string | null }) => {
      updateSessionWorkspace(data.sessionId, data.workspacePath)
      // Immediately authorize the new workspace
      setWorkspaceRoot(data.workspacePath)
    }
  )

  // ── Export session ──
  ipcMain.handle(
    IPC.SESSION_EXPORT,
    (_event, data: { sessionId: string; format: 'json' | 'markdown' }) => {
      const session = getSession(data.sessionId)
      if (!session) throw new Error(`Session "${data.sessionId}" not found`)
      const messages = getSessionMessages(data.sessionId)

      if (data.format === 'json') {
        return JSON.stringify({ session, messages }, null, 2)
      }

      // Markdown format
      let md = `# ${session.title}\n\n`
      md += `**Provider:** ${session.provider} | **Model:** ${session.model}\n`
      md += `**Created:** ${session.createdAt}\n\n---\n\n`

      for (const msg of messages) {
        const role = msg.role === 'user' ? '👤 User' : msg.role === 'assistant' ? '🤖 Assistant' : `🔧 ${msg.toolName || 'Tool'}`
        md += `### ${role}\n\n${msg.content}\n\n---\n\n`
      }

      return md
    }
  )
}
