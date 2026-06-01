// ═══════════════════════════════════════════════════════════════════
// Lumiq — WebFetchTool
// SECURITY: Only HTTPS URLs allowed (HTTP blocked).
// Response size limited. No credential forwarding.
//
// Scraping strategy (no API key required):
//   1. Jina AI Reader  — r.jina.ai/<url>  (free, returns clean markdown)
//   2. Direct HTTP fetch + HTML strip     (fallback)
// ═══════════════════════════════════════════════════════════════════

import axios from 'axios'
import { lookup } from 'dns'
import { promisify } from 'util'
import type { Tool } from './Tool'

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024 // 5MB
const TIMEOUT = 20000 // 20 seconds — Jina can be slightly slower

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
      // DNS lookup failed — block the request to be safe (fail-closed).
      return '[ERROR] DNS resolution failed. Cannot verify the target is a public host.'
    }

    // ── Strategy 1: Jina AI Reader (free, no API key needed) ──────
    // Prepend r.jina.ai/ to get a clean markdown version of any page.
    try {
      const jinaUrl = `https://r.jina.ai/${url}`
      const jinaResponse = await axios.get(jinaUrl, {
        timeout: TIMEOUT,
        signal,
        maxContentLength: MAX_RESPONSE_SIZE,
        maxRedirects: 3,
        headers: {
          'User-Agent': 'Lumiq/1.0 (Desktop AI Client)',
          // Ask Jina for plain text markdown output
          Accept: 'text/plain, text/markdown, */*'
        }
      })
      const text =
        typeof jinaResponse.data === 'string'
          ? jinaResponse.data.trim()
          : JSON.stringify(jinaResponse.data)

      if (text && text.length > 100) {
        return text.slice(0, 50000)
      }
    } catch {
      // Jina unavailable or rate-limited — fall through to direct fetch.
    }

    // ── Strategy 2: Direct HTTP fetch + HTML strip (fallback) ─────
    try {
      const response = await axios.get(url, {
        timeout: TIMEOUT,
        maxContentLength: MAX_RESPONSE_SIZE,
        signal,
        headers: {
          'User-Agent': 'Lumiq/1.0 (Desktop AI Client)',
          Accept: 'text/html,text/plain,application/json'
        },
        maxRedirects: 3
      })

      const contentType = response.headers['content-type'] || ''
      const body =
        typeof response.data === 'string' ? response.data : JSON.stringify(response.data, null, 2)

      if (String(contentType).includes('text/html')) {
        return stripHtml(body).slice(0, 50000)
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

function isPrivateIP(hostname: string): boolean {
  // Block common private IP ranges (SSRF prevention)
  const h = hostname.toLowerCase()
  if (h === 'localhost' || h === '::1') return true
  if (/^127\./.test(h)) return true
  if (/^0\./.test(h)) return true
  if (/^10\./.test(h)) return true
  // 172.16.0.0/12 (172.16.x.x – 172.31.x.x)
  const m = h.match(/^172\.(\d+)\./)
  if (m && parseInt(m[1], 10) >= 16 && parseInt(m[1], 10) <= 31) return true
  if (/^192\.168\./.test(h)) return true
  if (/^169\.254\./.test(h)) return true // link-local
  if (/^fc[0-9a-f]{2}:/i.test(h)) return true
  if (/^fd[0-9a-f]{2}:/i.test(h)) return true
  if (/^fe80/i.test(h)) return true
  return false
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
