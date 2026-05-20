// ═══════════════════════════════════════════════════════════════════
// Lumiq — WebFetchTool
// SECURITY: Only HTTPS URLs allowed (HTTP blocked).
// Response size limited. No credential forwarding.
// ═══════════════════════════════════════════════════════════════════

import axios from 'axios'
import { lookup } from 'dns'
import { promisify } from 'util'
import type { Tool } from './Tool'
import { getDatabase } from '../db/database'

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
    if (!url.startsWith('https://')) {
      return '[ERROR] Only HTTPS URLs are allowed for security. Use https:// prefix.'
    }

    let urlObj: URL
    try {
      urlObj = new URL(url)
    } catch {
      return '[ERROR] Invalid URL format.'
    }

    const hostname = urlObj.hostname
    if (isPrivateIP(hostname)) {
      return '[ERROR] Cannot fetch private/internal URLs for security reasons.'
    }

    try {
      const addresses = await lookupAsync(hostname, { all: true })
      if (addresses.some((addr) => isPrivateIP(addr.address))) {
        return '[ERROR] Cannot fetch private/internal URLs for security reasons.'
      }
    } catch {
      // DNS lookup failed, allow the request to continue only if hostname is clearly safe
    }

    try {
      const firecrawlApiKey = getFirecrawlApiKey()
      if (firecrawlApiKey) {
        try {
          const firecrawl = await axios.post(
            'https://api.firecrawl.dev/v1/scrape',
            { url, formats: ['markdown'] },
            {
              timeout: TIMEOUT,
              signal,
              headers: {
                Authorization: `Bearer ${firecrawlApiKey}`,
                'Content-Type': 'application/json'
              }
            }
          )
          const markdown = firecrawl.data?.data?.markdown || firecrawl.data?.markdown
          if (typeof markdown === 'string' && markdown.trim()) {
            return markdown.slice(0, 50000)
          }
        } catch {
          // Fall through to the direct HTTP fetch path when Firecrawl is unavailable.
        }
      }

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

const lookupAsync = promisify(lookup)

function getFirecrawlApiKey(): string {
  const row = getDatabase().prepare("SELECT value FROM settings WHERE key = 'firecrawlApiKey'").get() as { value: string } | undefined
  return row?.value?.trim() || ''
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
    /^localhost$/i,
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
    .replace(/<!\[CDATA\[[\s\S]*?\]\]>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&#(\d+);/g, (_match, code) => String.fromCharCode(Number(code)))
    .replace(/&#x([0-9A-Fa-f]+);/g, (_match, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/\s+/g, ' ')
    .trim()
}
