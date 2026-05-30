// ═══════════════════════════════════════════════════════════════════
// Lumiq — User Profile Manager (Long-Term Persistent Memory)
// Extracts, saves, and injects user profile facts into the agent prompt.
// ═══════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/database'
import { getApiConfig } from '../db/apiConfigs'
import { ProviderFactory } from '../providers/ProviderFactory'
import type { Message, ProviderConfig } from '@shared/types'

export interface ProfileFact {
  id: string
  category: string
  fact: string
  confidenceScore: number
  createdAt: string
}

export class UserProfileManager {
  private static instance: UserProfileManager

  private constructor() {}

  public static getInstance(): UserProfileManager {
    if (!UserProfileManager.instance) {
      UserProfileManager.instance = new UserProfileManager()
    }
    return UserProfileManager.instance
  }

  /**
   * Retrieves all user profile facts from the database.
   */
  public getFacts(): ProfileFact[] {
    try {
      const db = getDatabase()
      const stmt = db.prepare(`
        SELECT id, category, fact, confidence_score as confidenceScore, created_at as createdAt
        FROM user_profile_knowledge
        ORDER BY created_at DESC
      `)
      return stmt.all() as ProfileFact[]
    } catch (err) {
      console.error('[UserProfileManager] Failed to fetch facts:', err)
      return []
    }
  }

  /**
   * Returns a formatted system instruction segment if any facts exist.
   */
  public getProfilePromptSegment(): string {
    const facts = this.getFacts()
    if (facts.length === 0) return ''

    let segment = '\n\n═══════════════════════════════════════════════════════════════════\n'
    segment += 'USER PROFILE KNOWLEDGE (Long-Term Memory)\n'
    segment += 'The following are verified permanent facts about the user. Always respect these preferences:\n'
    facts.forEach((f) => {
      segment += `- [${f.category.toUpperCase()}] ${f.fact}\n`
    })
    segment += '═══════════════════════════════════════════════════════════════════\n'
    return segment
  }

  /**
   * Adds a new profile fact. Ensures uniqueness of the fact.
   */
  public addFact(category: string, fact: string, confidenceScore = 1.0): boolean {
    try {
      const db = getDatabase()
      const id = uuidv4()
      const stmt = db.prepare(`
        INSERT INTO user_profile_knowledge (id, category, fact, confidence_score)
        VALUES (?, ?, ?, ?)
        ON CONFLICT(fact) DO UPDATE SET
          category = excluded.category,
          confidence_score = MAX(user_profile_knowledge.confidence_score, excluded.confidence_score),
          updated_at = CURRENT_TIMESTAMP
      `)
      stmt.run(id, category.trim().toLowerCase(), fact.trim(), confidenceScore)
      return true
    } catch (err) {
      console.error('[UserProfileManager] Failed to save fact:', err)
      return false
    }
  }

  /**
   * Deletes a profile fact by ID.
   */
  public deleteFact(id: string): boolean {
    try {
      const db = getDatabase()
      const stmt = db.prepare('DELETE FROM user_profile_knowledge WHERE id = ?')
      const result = stmt.run(id)
      return result.changes > 0
    } catch (err) {
      console.error('[UserProfileManager] Failed to delete fact:', err)
      return false
    }
  }

  /**
   * Extracts user facts asynchronously in the background.
   * Utilizes Gemini if configured, otherwise falls back to the active provider.
   */
  public async extractFactsFromExchange(
    userMessage: string,
    assistantResponse: string,
    activeConfig: ProviderConfig,
    activeModel: string
  ): Promise<void> {
    // Keep execution in background, safe from throwing into the main chat UI
    setTimeout(async () => {
      try {
        // 1. Choose a fast background model. If Gemini is available, use it (1.5 Flash is perfect).
        // Otherwise, use the current active configuration.
        let extractionConfig = activeConfig
        let extractionModel = activeModel

        const geminiConfig = getApiConfig('gemini')
        if (geminiConfig && geminiConfig.isActive) {
          extractionConfig = geminiConfig
          extractionModel = 'gemini-1.5-flash'
        }

        const provider = ProviderFactory.create(extractionConfig)

        const prompt = `You are a background fact extractor for an AI coding assistant.
Analyze the following conversation segment:
User Message: "${userMessage}"
Assistant Response: "${assistantResponse}"

Determine if the user shared any permanent, factual information about their:
1. Technical stack preferences (e.g., "I prefer TypeScript over JavaScript", "I write apps in Python").
2. Educational background, experience, or current role (e.g., "I'm a student of computer science", "I work at Lumiq").
3. Development OS or environment (e.g., "I run Windows 11", "I use VS Code as my primary editor").
4. Personal constraints or preferences (e.g., "I like short and concise code comments", "मुझे हिंदी में बात करना पसंद है").

Do NOT extract temporary, task-specific details (like "I have an error in this function", or "Here is the code of my index.ts file"). Only extract lifelong / permanent preferences or background facts.

Return a JSON array of objects, where each object has precisely these fields:
- "category": one of "tech_stack", "role", "os", "preference"
- "fact": a single, clear declarative sentence (in English or Hindi, matching the user's language) describing the permanent fact.
Example: [{"category": "tech_stack", "fact": "Prefers TypeScript over plain JavaScript"}]

If no permanent facts were shared, return an empty array [].
Respond ONLY with the raw JSON array. Do not write any markdown codeblocks, explanation, or notes. Output must start with '[' and end with ']'.`

        const messages: Message[] = [
          {
            id: 'fact_extract',
            sessionId: 'fact_extract',
            role: 'user',
            content: prompt,
            createdAt: new Date().toISOString()
          }
        ]

        const result = await provider.sendMessage(messages, {
          model: extractionModel,
          stream: false
        })

        const rawContent = result.content.trim()
        // Strip markdown if the model wrapped JSON in standard markdown blocks
        const jsonString = rawContent.replace(/```json/g, '').replace(/```/g, '').trim()

        if (jsonString.startsWith('[') && jsonString.endsWith(']')) {
          const parsed = JSON.parse(jsonString) as Array<{ category: string; fact: string }>
          if (Array.isArray(parsed)) {
            for (const item of parsed) {
              if (item.category && item.fact) {
                const succeeded = this.addFact(item.category, item.fact, 0.8)
                if (succeeded) {
                  console.log(`[UserProfileManager] Extracted new profile fact: [${item.category}] "${item.fact}"`)
                }
              }
            }
          }
        }
      } catch (err) {
        // Background task failure should never crash the main loop
        console.error('[UserProfileManager] Fact extraction failed in background:', err)
      }
    }, 1000) // Delay by 1 second to let main chat loop finalize smoothly
  }
}

export const userProfileManager = UserProfileManager.getInstance()
