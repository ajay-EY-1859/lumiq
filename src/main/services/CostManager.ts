// ═══════════════════════════════════════════════════════════════════
// Lumiq — Cost Manager
// Computes token-level cost estimates, logs provider transactions,
// aggregates analytics, and monitors daily/monthly budget caps.
// ═══════════════════════════════════════════════════════════════════

import { BrowserWindow } from 'electron'
import { getDatabase } from '../db/database'
import { v4 as uuidv4 } from 'uuid'
import { IPC } from '@shared/types'

export interface ModelPricing {
  inputPerMillion: number
  outputPerMillion: number
}

// Pricing definitions per 1 Million tokens (in USD)
const MODEL_PRICING_REGISTRY: Record<string, ModelPricing> = {
  // Anthropic
  'claude-opus-4-20250514': { inputPerMillion: 15.0, outputPerMillion: 75.0 },
  'claude-sonnet-4-20250514': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  'claude-haiku-4-20250506': { inputPerMillion: 0.25, outputPerMillion: 1.25 },

  // OpenAI
  'gpt-4o': { inputPerMillion: 5.0, outputPerMillion: 15.0 },
  'gpt-4o-mini': { inputPerMillion: 0.15, outputPerMillion: 0.6 },
  'gpt-4-turbo': { inputPerMillion: 10.0, outputPerMillion: 30.0 },
  'gpt-3.5-turbo': { inputPerMillion: 0.5, outputPerMillion: 1.5 },

  // Gemini
  'gemini-1.5-pro': { inputPerMillion: 1.25, outputPerMillion: 5.0 },
  'gemini-1.5-flash': { inputPerMillion: 0.075, outputPerMillion: 0.3 },
  'gemini-pro': { inputPerMillion: 0.5, outputPerMillion: 1.5 },

  // Groq
  'llama-3.3-70b-versatile': { inputPerMillion: 0.59, outputPerMillion: 0.79 },
  'llama-3.1-8b-instant': { inputPerMillion: 0.05, outputPerMillion: 0.08 },
  'mixtral-8x7b-32768': { inputPerMillion: 0.27, outputPerMillion: 0.27 },
  'gemma2-9b-it': { inputPerMillion: 0.2, outputPerMillion: 0.2 },

  // Bedrock
  'us.anthropic.claude-opus-4-1-20250805-v1:0': { inputPerMillion: 15.0, outputPerMillion: 75.0 },
  'anthropic.claude-sonnet-4-20250514-v1:0': { inputPerMillion: 3.0, outputPerMillion: 15.0 },
  'anthropic.claude-haiku-4-20250506-v1:0': { inputPerMillion: 0.25, outputPerMillion: 1.25 },
  'amazon.titan-text-express-v1': { inputPerMillion: 0.8, outputPerMillion: 1.6 }
}

export class CostManager {
  /**
   * Computes estimated cost for a transaction.
   * Ollama (local) is free ($0.00).
   */
  static calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number {
    if (provider === 'ollama') {
      return 0.0
    }

    // Try finding exact model pricing
    let pricing = MODEL_PRICING_REGISTRY[model]

    // Try finding generic provider pricing by matching subkey (e.g. Bedrock models, OpenRouter)
    if (!pricing) {
      const matchKey = Object.keys(MODEL_PRICING_REGISTRY).find(k => model.includes(k))
      if (matchKey) {
        pricing = MODEL_PRICING_REGISTRY[matchKey]
      }
    }

    // Fallback standard estimate pricing if no registry entry matches
    if (!pricing) {
      pricing = { inputPerMillion: 1.5, outputPerMillion: 4.5 } // Standard middle-tier cost
    }

    const inputCost = (inputTokens / 1000000) * pricing.inputPerMillion
    const outputCost = (outputTokens / 1000000) * pricing.outputPerMillion

    return parseFloat((inputCost + outputCost).toFixed(6))
  }

  /**
   * Records a token transaction log in SQLite.
   */
  static logTransaction(
    sessionId: string,
    provider: string,
    model: string,
    inputTokens: number,
    outputTokens: number
  ): number {
    const cost = this.calculateCost(provider, model, inputTokens, outputTokens)
    try {
      const db = getDatabase()
      db.prepare(`
        INSERT INTO token_transactions (id, session_id, provider, model, input_tokens, output_tokens, estimated_cost)
        VALUES (?, ?, ?, ?, ?, ?, ?)
      `).run(uuidv4(), sessionId, provider, model, inputTokens, outputTokens, cost)

      console.log(`[CostManager] Logged cost transaction: $${cost} for ${model} (${inputTokens} in, ${outputTokens} out)`)

      // Check if limits exceeded and notify UI
      this.checkBudgetLimits()
    } catch (err) {
      console.error('[CostManager] Failed to log cost transaction:', err)
    }
    return cost
  }

  /**
   * Returns total estimated cost consumed today.
   */
  static getDailyCost(): number {
    try {
      const db = getDatabase()
      const row = db.prepare(`
        SELECT SUM(estimated_cost) as total 
        FROM token_transactions 
        WHERE DATE(created_at) = DATE('now', 'localtime')
      `).get() as { total: number | null }
      return row?.total ?? 0.0
    } catch {
      return 0.0
    }
  }

  /**
   * Returns total estimated cost consumed this calendar month.
   */
  static getMonthlyCost(): number {
    try {
      const db = getDatabase()
      const row = db.prepare(`
        SELECT SUM(estimated_cost) as total 
        FROM token_transactions 
        WHERE strftime('%Y-%m', created_at) = strftime('%Y-%m', 'now', 'localtime')
      `).get() as { total: number | null }
      return row?.total ?? 0.0
    } catch {
      return 0.0
    }
  }

  /**
   * Evaluates aggregate daily and monthly costs against user budget caps,
   * raising alerts via IPC if thresholds (80% warning / 100% cap) are exceeded.
   */
  static checkBudgetLimits(): void {
    try {
      const db = getDatabase()
      
      const dailyCapRow = db.prepare("SELECT value FROM settings WHERE key = 'dailyBudgetCap'").get() as { value: string } | undefined
      const monthlyCapRow = db.prepare("SELECT value FROM settings WHERE key = 'monthlyBudgetCap'").get() as { value: string } | undefined

      const dailyCap = parseFloat(dailyCapRow?.value || '5.00')
      const monthlyCap = parseFloat(monthlyCapRow?.value || '50.00')

      const dailyCost = this.getDailyCost()
      const monthlyCost = this.getMonthlyCost()

      const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())

      // ── Daily Limit Alerts ──
      if (dailyCost >= dailyCap) {
        window?.webContents.send(
          IPC.CHAT_ERROR,
          `⚠️ Daily Budget Exceeded! Today's cost is $${dailyCost.toFixed(2)} (Cap: $${dailyCap.toFixed(2)}).`
        )
      } else if (dailyCost >= dailyCap * 0.8) {
        window?.webContents.send(
          IPC.CHAT_ERROR,
          `⚠️ Daily Budget Warning: You have consumed $${dailyCost.toFixed(2)} (80% of your $${dailyCap.toFixed(2)} daily cap).`
        )
      }

      // ── Monthly Limit Alerts ──
      if (monthlyCost >= monthlyCap) {
        window?.webContents.send(
          IPC.CHAT_ERROR,
          `⚠️ Monthly Budget Exceeded! This month's cost is $${monthlyCost.toFixed(2)} (Cap: $${monthlyCap.toFixed(2)}).`
        )
      } else if (monthlyCost >= monthlyCap * 0.8) {
        window?.webContents.send(
          IPC.CHAT_ERROR,
          `⚠️ Monthly Budget Warning: You have consumed $${monthlyCost.toFixed(2)} (80% of your $${monthlyCap.toFixed(2)} monthly cap).`
        )
      }
    } catch (err) {
      console.error('[CostManager] Failed to evaluate budget caps:', err)
    }
  }

  /**
   * Generates a structural cost and model metrics summary for settings dashboard charts.
   */
  static getCostSummary(): Record<string, any> {
    try {
      const db = getDatabase()
      
      const providerBreakdown = db.prepare(`
        SELECT provider, SUM(input_tokens) as inputTokens, SUM(output_tokens) as outputTokens, SUM(estimated_cost) as totalCost
        FROM token_transactions
        GROUP BY provider
        ORDER BY totalCost DESC
      `).all()
      
      const recentTransactions = db.prepare(`
        SELECT model, provider, input_tokens as inputTokens, output_tokens as outputTokens, estimated_cost as cost, created_at as createdAt
        FROM token_transactions
        ORDER BY created_at DESC
        LIMIT 10
      `).all()

      return {
        dailyCost: this.getDailyCost(),
        monthlyCost: this.getMonthlyCost(),
        providerBreakdown,
        recentTransactions
      }
    } catch {
      return { dailyCost: 0, monthlyCost: 0, providerBreakdown: [], recentTransactions: [] }
    }
  }
}
