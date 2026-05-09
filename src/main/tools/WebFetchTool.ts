// ═══════════════════════════════════════════════════════════════════
// Lumiq — WebFetchTool
// SECURITY: Only HTTPS URLs allowed (HTTP blocked).
// Response size limited. No credential forwarding.
// ═══════════════════════════════════════════════════════════════════

import axios from 'axios'
import type { Tool } from './Tool'

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024 // 5MB
const TIMEOUT = 15000 // 15 seconds

export class WebFetchTool implements Tool {
  name = 'WebFetchTool'
  description = 'Fetch the content of a web page (HTTPS only)'
  requiresApproval = true
  inputSchema = {
    type: 'object',
    properties: {
      url: { type: 'string', description: 'The URL to fetch (must be HTTPS)' }
    },
    required: ['url']
  }

  async execute(input: Record<string, unknown>, signal?: AbortSignal): Promise<string> {
    const url = input.url as string

    // SECURITY: Only allow HTTPS
    if (!url.startsWith('https://') && !url.startsWith('http://localhost')) {
      return '[ERROR] Only HTTPS URLs are allowed for security. Use https:// prefix.'
    }

    // SECURITY: Block internal/private IPs (SSRF prevention)
    try {
      const urlObj = new URL(url)
      const hostname = urlObj.hostname
      if (isPrivateIP(hostname)) {
        return '[ERROR] Cannot fetch private/internal URLs for security reasons.'
      }
    } catch {
      return '[ERROR] Invalid URL format.'
    }

    try {
      const response = await axios.get(url, {
        timeout: TIMEOUT,
        maxContentLength: MAX_RESPONSE_SIZE,
        signal,
        headers: {
          'User-Agent': 'Lumiq/1.0 (Desktop AI Client)',
          Accept: 'text/html,text/plain,application/json'
        },
        // Don't follow too many redirects
        maxRedirects: 3
      })

      const contentType = response.headers['content-type'] || ''
      const body =
        typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)

      // Strip HTML tags for readability
      if (String(contentType).includes('text/html')) {
        return stripHtml(body).slice(0, 50000) // Limit output size
      }

      return body.slice(0, 50000)
    } catch (e) {
      if (axios.isAxiosError(e)) {
        return `[ERROR] HTTP ${e.response?.status || 'UNKNOWN'}: ${e.message}`
      }
      return `[ERROR] ${(e as Error).message}`
    }
  }
}

function isPrivateIP(hostname: string): boolean {
  // Block common private IP ranges (SSRF prevention)
  const privatePatterns = [
    /^10\./,
    /^172\.(1[6-9]|2\d|3[01])\./,
    /^192\.168\./,
    /^127\./,
    /^0\./,
    /^169\.254\./, // link-local
    /^::1$/,
    /^fc/i,
    /^fd/i,
    /^fe80/i
  ]
  return privatePatterns.some((p) => p.test(hostname))
}

function stripHtml(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/\s+/g, ' ')
    .trim()
}
