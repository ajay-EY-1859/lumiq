// ═══════════════════════════════════════════════════════════════════
// Lumiq — Chat IPC Handlers
// Handles chat:send, chat:cancel
// ═══════════════════════════════════════════════════════════════════

import { ipcMain } from 'electron'
import { IPC, PROVIDER_MODELS, ProviderType } from '@shared/types'
import { agentLoop } from '../agent/AgentLoop'
import { buildSkillInjection } from '../agent/SkillMatcher'
import { getSessionMessages } from '../db/messages'
import { getApiConfig, listApiConfigsSafe } from '../db/apiConfigs'
import { getSession } from '../db/sessions'
import { getDatabase } from '../db/database'
import { getAgentRoute } from '../db/agentRoutes'
import { getAgent } from '../db/agents'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { setAllowedExtraPaths, parseAttachedPaths } from '../security/pathValidation'
import { AutocompleteService } from '../services/AutocompleteService'

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
      let config = getApiConfig(provider)
      const isProviderConfigured = config && (
        config.apiKey ||
        config.awsAccessKeyId ||
        provider === 'ollama' ||
        provider === 'custom' ||
        config.authMethod === 'oauth'
      )

      if (!isProviderConfigured) {
        // Find if there is any other provider that is configured
        const allConfigs = listApiConfigsSafe()
        const configured = allConfigs.find(
          (c) =>
            c.hasApiKey ||
            c.hasAwsKeys ||
            c.provider === 'ollama' ||
            c.provider === 'custom' ||
            c.authMethod === 'oauth'
        )

        if (configured) {
          // Switch to the configured provider!
          provider = configured.provider
          model = configured.defaultModel || (PROVIDER_MODELS[provider as ProviderType]?.[0]?.id || 'default')
          config = getApiConfig(provider)
          
          // Also update the session in the database so it remembers this provider/model!
          try {
            const db = getDatabase()
            const stmt = db.prepare('UPDATE sessions SET provider = ?, model = ? WHERE id = ?')
            stmt.run(provider, model, sessionId)
          } catch (dbErr) {
            console.error('[chatHandlers] Failed to update session provider:', dbErr)
          }
        } else {
          // No api configured at all
          throw new Error('error! no api configured please configure atleast 1 api key in setting')
        }
      }

      if (!config) {
        throw new Error('error! no api configured please configure atleast 1 api key in setting')
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

      // Extract all attached paths from the current message and session history
      const attachedPathsSet = new Set<string>()
      


      parseAttachedPaths(message).forEach((p) => attachedPathsSet.add(p))
      for (const msg of messages) {
        if (msg.content) {
          parseAttachedPaths(msg.content).forEach((p) => attachedPathsSet.add(p))
        }
      }

      setAllowedExtraPaths(Array.from(attachedPathsSet))

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

  // ── One-shot prediction ──
  ipcMain.handle(
    IPC.CHAT_PREDICT_ONE_SHOT,
    async (
      _event,
      data: {
        prompt: string
        systemPrompt: string
        provider: string
        model: string
      }
    ) => {
      const { prompt, systemPrompt, provider, model } = data
      return await AutocompleteService.predictOneShot(prompt, systemPrompt, provider, model)
    }
  )
}
