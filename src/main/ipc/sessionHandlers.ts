// ═══════════════════════════════════════════════════════════════════
// Lumiq — Session IPC Handlers
// Handles session CRUD operations
// ═══════════════════════════════════════════════════════════════════

import { IPC } from '@shared/types'
import {
  createSession,
  listSessions,
  deleteSession,
  updateSessionTitle,
  getSession,
  updateSessionWorkspace
} from '../db/sessions'
import { getSessionMessages, clearSessionMessages, compactSessionMessages, deleteMessagesFrom } from '../db/messages'
import { setWorkspaceRoot, setAllowedExtraPaths, validateWorkspaceRootCandidate, parseAttachedPaths } from '../security/pathValidation'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

export function registerSessionHandlers(): void {
  // ── List all sessions ──
  handleWithTimeout(IPC.SESSION_LIST, IPC_TIMEOUT.short, () => {
    return listSessions()
  })

  // ── Load session (returns messages) ──
  handleWithTimeout(IPC.SESSION_LOAD, IPC_TIMEOUT.short, (_event, sessionId: string) => {
    const session = getSession(sessionId)
    if (!session) throw new Error(`Session "${sessionId}" not found`)
    
    // Authorize this session's workspace for file operations
    setWorkspaceRoot(session.workspacePath || null)

    const messages = getSessionMessages(sessionId)

    // Extract all attached paths from the session history
    const attachedPathsSet = new Set<string>()


    for (const msg of messages) {
      if (msg.content) {
        parseAttachedPaths(msg.content).forEach((p) => attachedPathsSet.add(p))
      }
    }
    setAllowedExtraPaths(Array.from(attachedPathsSet))

    return { session, messages }
  })

  // ── Create new session ──
  handleWithTimeout(
    IPC.SESSION_CREATE,
    IPC_TIMEOUT.short,
    (_event, data: { provider: string; model: string; agentId?: string }) => {
      return createSession(data.provider, data.model, data.agentId)
    }
  )

  // ── Delete session ──
  handleWithTimeout(IPC.SESSION_DELETE, IPC_TIMEOUT.short, (_event, sessionId: string) => {
    return deleteSession(sessionId)
  })

  // ── Rename session ──
  handleWithTimeout(
    IPC.SESSION_RENAME,
    IPC_TIMEOUT.short,
    (_event, data: { sessionId: string; title: string }) => {
      updateSessionTitle(data.sessionId, data.title)
    }
  )

  // ── Set Workspace ──
  handleWithTimeout(
    IPC.SESSION_SET_WORKSPACE,
    IPC_TIMEOUT.short,
    (_event, data: { sessionId: string; workspacePath: string | null }) => {
      const workspacePath = validateWorkspaceRootCandidate(data.workspacePath)
      updateSessionWorkspace(data.sessionId, workspacePath)
      // Immediately authorize the new workspace
      setWorkspaceRoot(workspacePath)
    }
  )

  // ── Export session ──
  handleWithTimeout(
    IPC.SESSION_EXPORT,
    IPC_TIMEOUT.short,
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

  // ── Clear session messages ──
  handleWithTimeout(IPC.SESSION_CLEAR_MESSAGES, IPC_TIMEOUT.short, (_event, sessionId: string) => {
    return clearSessionMessages(sessionId)
  })

  // ── Compact session messages ──
  handleWithTimeout(
    IPC.SESSION_COMPACT_MESSAGES,
    IPC_TIMEOUT.short,
    (_event, data: { sessionId: string; keepCount?: number }) => {
      return compactSessionMessages(data.sessionId, data.keepCount || 10)
    }
  )

  // ── Delete messages from a specific message ID ──
  handleWithTimeout(
    IPC.SESSION_DELETE_MESSAGES_FROM,
    IPC_TIMEOUT.short,
    (_event, data: { sessionId: string; messageId: string }) => {
      return deleteMessagesFrom(data.sessionId, data.messageId)
    }
  )
}
