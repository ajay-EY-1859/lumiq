// ═══════════════════════════════════════════════════════════════════
// Lumiq — Chat IPC Handlers
// Handles chat:send, chat:cancel
// ═══════════════════════════════════════════════════════════════════

import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import { agentLoop } from '../agent/AgentLoop'
import { buildSkillInjection } from '../agent/SkillMatcher'
import { getSessionMessages } from '../db/messages'
import { getApiConfig } from '../db/apiConfigs'
import { getSession } from '../db/sessions'
import { getAgentRoute } from '../db/agentRoutes'
import { getAgent } from '../db/agents'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

const DEFAULT_SYSTEM_PROMPT = `You are Lumiq, an advanced agentic AI coding assistant embedded in a desktop IDE.
You operate directly on the user's local file system within a designated workspace directory.
Your primary mode of operation is ACTION — use your tools to accomplish tasks rather than just describing what to do.

═══ CORE PRINCIPLES ═══

1. ACT, DON'T JUST TALK
   - When the user asks you to write code, create files, fix bugs, or build anything — DO IT using your tools.
   - Never paste large code blocks in chat when you should be writing them to files.
   - After completing an action, give a concise summary of what you did.

2. UNDERSTAND BEFORE ACTING
   - Before modifying or creating anything, scout the workspace to understand existing project structure.
   - Use GlobTool to discover project layout (e.g., "**/*.ts", "**/*.java", "*.json").
   - Use FileReadTool to read key config files (package.json, pom.xml, build.gradle, etc.) to understand tech stack, dependencies, and conventions.
   - Use GrepTool to find specific patterns, function definitions, or usages across the codebase.
   - This scouting phase prevents you from creating duplicate files, breaking conventions, or overwriting important content.

3. RESPECT THE WORKSPACE
   - All file operations must stay within the workspace directory unless the user explicitly asks otherwise.
   - Use RELATIVE paths rooted at the workspace directory for all tool calls.
   - Never create files in system directories, temp folders, or outside the workspace.

4. SAFETY
   - Do not expose API keys, secrets, or sensitive data in chat or file contents.
`

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
        taskMode?: string
      }
    ) => {
      const { message, sessionId, systemPrompt, taskMode } = data
      let { provider, model } = data

      // Validate input
      if (!message || !sessionId || !provider || !model) {
        throw new Error('Missing required fields: message, sessionId, provider, model')
      }

      if (taskMode) {
        const route = getAgentRoute(taskMode)
        if (route) {
          provider = route.provider
          model = route.model
        }
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

      let finalSystemPrompt = systemPrompt
      if (!finalSystemPrompt) {
        if (session.agentId) {
          const agent = getAgent(session.agentId)
          if (agent) {
            finalSystemPrompt = agent.systemPrompt
          }
        }
      }
      
      if (!finalSystemPrompt) {
        finalSystemPrompt = DEFAULT_SYSTEM_PROMPT
      }

      if (session.workspacePath) {
        finalSystemPrompt += `\n\n═══ ENVIRONMENT ═══\nWORKSPACE: ${session.workspacePath}\nPLATFORM: ${process.platform} (${process.arch})\nSHELL: ${process.platform === 'win32' ? 'PowerShell (prefer PowerShellTool for native ops)' : 'Bash'}
All file paths should be relative to the workspace directory above. Use it as the base/cwd for all tool calls.`
      }

      // Auto-activate skills based on context
      const skillInjection = buildSkillInjection(message, messages, session.workspacePath || undefined)
      if (skillInjection) {
        finalSystemPrompt += skillInjection
      }

      // Set workspace path on tool executor so tools default to workspace
      // instead of process.cwd() (which is Electron's install directory)
      agentLoop.getToolExecutor().setWorkspacePath(session.workspacePath || null)

      // Process through agent loop (handles streaming internally)
      await agentLoop.processMessage(message, sessionId, messages, config, {
        model,
        systemPrompt: finalSystemPrompt
      })
    }
  )

  // ── Cancel active request ──
  handleWithTimeout(IPC.CHAT_CANCEL, IPC_TIMEOUT.short, () => {
    agentLoop.cancel()
  })
}
