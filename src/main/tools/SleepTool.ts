// ═══════════════════════════════════════════════════════════════════
// Lumiq — SleepTool
// Allows the agent to pause execution for a specified duration.
// Useful for rate limiting, waiting for external processes, etc.
// ═══════════════════════════════════════════════════════════════════

import type { Tool } from './Tool'

const MAX_SLEEP_MS = 5 * 60 * 1000 // 5 minutes maximum

export class SleepTool implements Tool {
  name = 'SleepTool'
  description = 'Pause execution for a specified number of seconds (max 300). Use when waiting for external processes, rate-limiting API calls, or adding deliberate delays.'
  requiresApproval = false
  isReadOnly = true // Non-destructive, can run in parallel batches
  inputSchema = {
    type: 'object',
    properties: {
      seconds: {
        type: 'number',
        description: 'Number of seconds to sleep (1–300)'
      },
      reason: {
        type: 'string',
        description: 'Why the agent is sleeping (logged for context)'
      }
    },
    required: ['seconds']
  }

  async execute(
    input: Record<string, unknown>,
    signal?: AbortSignal
  ): Promise<string> {
    const seconds = Math.min(Math.max(Number(input.seconds) || 1, 0.1), MAX_SLEEP_MS / 1000)
    const reason = (input.reason as string) || 'no reason given'
    const ms = Math.round(seconds * 1000)

    return new Promise((resolve) => {
      const timer = setTimeout(() => {
        resolve(`[OK] Slept for ${seconds}s. Reason: ${reason}`)
      }, ms)

      if (signal) {
        signal.addEventListener(
          'abort',
          () => {
            clearTimeout(timer)
            resolve(`[CANCELLED] Sleep interrupted after starting. Reason: ${reason}`)
          },
          { once: true }
        )
      }
    })
  }
}
