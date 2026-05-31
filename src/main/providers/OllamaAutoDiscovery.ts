// ═══════════════════════════════════════════════════════════════════
// Lumiq — Ollama Auto-Discovery (Offline-First Mode)
// Automatically checks if a local Ollama instance is running,
// and auto-configures it as the active provider if no primary APIs exist.
// ═══════════════════════════════════════════════════════════════════

import axios from 'axios'
import { getDatabase } from '../db/database'

export class OllamaAutoDiscovery {
  private static OLLAMA_URL = 'http://localhost:11434'

  /**
   * Pings local Ollama instance and returns available tags/models.
   */
  private static async fetchLocalModels(): Promise<string[] | null> {
    try {
      const response = await axios.get(`${this.OLLAMA_URL}/api/tags`, { timeout: 1500 })
      if (response.data && Array.isArray(response.data.models)) {
        return response.data.models.map((m: { name: string }) => m.name)
      }
      return []
    } catch {
      return null
    }
  }

  /**
   * Performs the auto-discovery check and dynamic database configuration.
   */
  static async discover(): Promise<void> {
    console.log('[OllamaAutoDiscovery] Starting startup auto-discovery check...')
    const localModels = await this.fetchLocalModels()

    if (localModels === null) {
      console.log('[OllamaAutoDiscovery] Local Ollama instance is offline or unreachable.')
      return
    }

    console.log(`[OllamaAutoDiscovery] Local Ollama is ONLINE with ${localModels.length} models:`, localModels)

    try {
      const db = getDatabase()

      // Check if any other provider already has an encrypted API key configured
      const primaryConfigs = db.prepare(`
        SELECT provider FROM api_configs 
        WHERE api_key_encrypted IS NOT NULL 
          AND api_key_encrypted != ''
          AND provider != 'ollama'
      `).all() as { provider: string }[]

      // If other primary providers are active, do not force-override settings
      if (primaryConfigs.length > 0) {
        console.log('[OllamaAutoDiscovery] Active API keys found for other providers. Skipping default override.')
        
        // However, we should still ensure Ollama is registered and active so the user can select it
        db.prepare(`
          INSERT INTO api_configs (id, provider, base_url, default_model, is_active)
          VALUES (?, ?, ?, ?, ?)
          ON CONFLICT(provider) DO UPDATE SET is_active = 1
        `).run('ollama_config', 'ollama', this.OLLAMA_URL, localModels[0] || 'qwen2.5-coder', 1)
        return
      }

      // No primary API keys exist. Configure Ollama as the active default provider!
      const defaultModel = localModels.includes('qwen2.5-coder') 
        ? 'qwen2.5-coder' 
        : (localModels[0] || 'llama3.2')

      console.log(`[OllamaAutoDiscovery] Offline-First Mode: auto-configuring Ollama as default provider with model "${defaultModel}".`)

      // 1. Upsert Ollama provider config
      db.prepare(`
        INSERT INTO api_configs (id, provider, base_url, default_model, is_active)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(provider) DO UPDATE SET 
          is_active = 1,
          default_model = excluded.default_model
      `).run('ollama_config', 'ollama', this.OLLAMA_URL, defaultModel, 1)

      // 2. Set default settings
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('defaultProvider', 'ollama')").run()
      db.prepare("INSERT OR REPLACE INTO settings (key, value) VALUES ('defaultModel', ?)").run(defaultModel)

      console.log('[OllamaAutoDiscovery] Auto-discovery configuration completed successfully.')
    } catch (err) {
      console.error('[OllamaAutoDiscovery] Error during database configuration:', err)
    }
  }
}
