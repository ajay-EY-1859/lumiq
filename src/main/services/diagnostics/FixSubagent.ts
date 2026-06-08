// ═══════════════════════════════════════════════════════════════════
// Lumiq — FixSubagent
// Background agent service that prompts the active AI provider to analyze
// diagnostic failures and construct corrective line-replacement diffs.
// ═══════════════════════════════════════════════════════════════════

import { getDatabase } from '../../db/database'
import { getApiConfig } from '../../db/apiConfigs'
import { ProviderFactory } from '../../providers/ProviderFactory'
import { DiagnosticsWatcher } from './DiagnosticsWatcher'
import type { SelfHealingAttempt } from '../../../shared/types'

export class FixSubagent {
  private static instance: FixSubagent

  public static getInstance(): FixSubagent {
    if (!FixSubagent.instance) {
      FixSubagent.instance = new FixSubagent()
    }
    return FixSubagent.instance
  }

  /**
   * Prompts the active LLM provider asynchronously in the background to
   * analyze the stack trace and generate a precise patch proposal.
   */
  public async analyzeAndFix(attempt: SelfHealingAttempt): Promise<void> {
    console.log(`[FixSubagent] Starting analysis cycle for failure: ${attempt.id}`)

    try {
      const db = getDatabase()

      // Resolve the provider and model from the active session for context-aware repair
      const session = db.prepare("SELECT provider, model FROM sessions WHERE id = ?").get(attempt.sessionId) as { provider: string; model: string } | undefined

      const providerType = session?.provider || 'anthropic'
      const model = session?.model || 'claude-sonnet-4-20250514'

      const apiConfig = getApiConfig(providerType)
      if (!apiConfig || !apiConfig.isActive) {
        throw new Error(`Provider config for "${providerType}" is not configured or active.`)
      }

      const provider = ProviderFactory.create(apiConfig)

      // Deserialize file snapshots
      const snapshots: Record<string, string> = JSON.parse(attempt.capturedSnapshot || '{}')
      let filesContext = ''
      for (const [relPath, content] of Object.entries(snapshots)) {
        filesContext += `--- FILE: ${relPath} ---\n${content}\n\n`
      }

      // Construct a highly structured, strict-formatting system prompt
      let systemPrompt = `You are Lumiq's Autonomous Self-Healing Developer.
Your task is to analyze a shell command/compilation/test execution failure, review the provided stack trace, understand the codebase files, and generate a precise corrective fix.

You MUST respond with a single, valid JSON block matching this schema:
{
  "explanation": "Brief, clear explanation of the bug root cause and your proposed fix.",
  "filePath": "relative path of the file to modify, matching the snapshot filename exactly",
  "targetContent": "The EXACT contiguous lines of code from the existing file that need to be replaced, including all indentation and whitespace.",
  "replacementContent": "The complete replacement code block to drop in place of the targetContent."
}

CRITICAL INDENTATION & MATCHING RULES:
1. "targetContent" must match lines in the source file EXACTLY, character-for-character, including leading spaces.
2. Only replace the narrowest possible block of code that resolves the issue.
3. Keep explanation conversational but concise.
4. Output ONLY the JSON block. Do not wrap it in markdown code blocks like \`\`\`json.`

      if (attempt.executionLogs) {
        systemPrompt += `\n\n⚠️ IMPORTANT: A previous repair attempt was made but it FAILED validation in our secure sandbox with this output:
${attempt.executionLogs}

Please analyze this validation error carefully, identify the flaw in the previous repair attempt, and generate a refined, correct patch that successfully compiles and passes tests. Do NOT propose the exact same failing patch again.`
      }

      const userPrompt = `Failed Command: ${attempt.command}
Error Message: ${attempt.errorMessage}

--- STACK TRACE ---
${attempt.stackTrace}

--- AFFECTED FILE SNAPSHOTS ---
${filesContext}

Generate your corrective fix now.`

      // Send to provider
      const response = await provider.sendMessage([
        {
          id: '',
          sessionId: attempt.sessionId,
          role: 'user',
          content: userPrompt,
          createdAt: new Date().toISOString()
        }
      ], {
        model,
        stream: false,
        systemPrompt
      })

      const rawContent = response.content.trim()
      
      // Clean up markdown wrapping if the model ignored instructions and added them
      const jsonText = rawContent
        .replace(/^```json/i, '')
        .replace(/^```/, '')
        .replace(/```$/, '')
        .trim()

      let proposal
      try {
        proposal = JSON.parse(jsonText)
      } catch (parseErr) {
        console.warn(`[FixSubagent] Raw response was not valid JSON. Trying regex extractor. Error:`, parseErr)
        // Robust regex parser fallback
        const jsonMatch = rawContent.match(/\{[\s\S]*\}/)
        if (jsonMatch) {
          proposal = JSON.parse(jsonMatch[0])
        } else {
          throw new Error('Response could not be parsed as JSON.')
        }
      }

      if (!proposal.filePath || !proposal.targetContent || !proposal.replacementContent) {
        throw new Error('JSON proposal is missing required fields (filePath, targetContent, replacementContent).')
      }

      // Success — update the attempt record in the database
      attempt.proposedDiff = JSON.stringify(proposal)
      attempt.status = 'proposed'
      attempt.updatedAt = new Date().toISOString()

      db.prepare(`
        UPDATE self_healing_attempts 
        SET proposed_diff = ?, status = ?, updated_at = ?
        WHERE id = ?
      `).run(
        attempt.proposedDiff,
        attempt.status,
        attempt.updatedAt,
        attempt.id
      )

      console.log(`[FixSubagent] Successfully generated patch proposal for failure: ${attempt.id}`)

      // Broadcast update to Renderer
      DiagnosticsWatcher.broadcastToRenderer('self-healing:proposal-generated', attempt)

    } catch (err) {
      console.error(`[FixSubagent] Healing analysis cycle failed:`, err)
      const db = getDatabase()
      attempt.status = 'failed'
      attempt.executionLogs = `[FixSubagent Error] ${(err as Error).message}`
      attempt.updatedAt = new Date().toISOString()

      db.prepare(`
        UPDATE self_healing_attempts 
        SET status = ?, execution_logs = ?, updated_at = ?
        WHERE id = ?
      `).run(
        attempt.status,
        attempt.executionLogs,
        attempt.updatedAt,
        attempt.id
      )

      DiagnosticsWatcher.broadcastToRenderer('self-healing:proposal-generated', attempt)
    }
  }
}

export const fixSubagent = FixSubagent.getInstance()
