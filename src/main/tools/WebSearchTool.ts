// ═══════════════════════════════════════════════════════════════════
// Lumiq — WebSearchTool
// Search the web using DuckDuckGo Instant Answer API (no key needed)
// Falls back to scraping DuckDuckGo HTML results for broader coverage.
// ═══════════════════════════════════════════════════════════════════

import { net } from 'electron'
import type { Tool } from './Tool'

const DDG_API = 'https://api.duckduckgo.com/?format=json&no_redirect=1&no_html=1&q='
const DDG_HTML = 'https://html.duckduckgo.com/html/?q='
const MAX_RESULTS = 8

interface SearchResult {
  title: string
  url: string
  snippet: string
}

async function fetchUrl(url: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const req = net.request({ url, method: 'GET' })
    const chunks: Buffer[] = []
    req.on('response', (res) => {
      res.on('data', (chunk) => chunks.push(chunk))
      res.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')))
      res.on('error', reject)
    })
    req.on('error', reject)
    req.setHeader('User-Agent', 'Mozilla/5.0 (compatible; Lumiq/1.0)')
    req.end()
  })
}

async function searchDDGApi(query: string): Promise<SearchResult[]> {
  const url = DDG_API + encodeURIComponent(query)
  const raw = await fetchUrl(url)
  let data: unknown
  try {
    data = JSON.parse(raw)
  } catch {
    throw new Error('DuckDuckGo API returned invalid JSON')
  }
  const results: SearchResult[] = []

  if (!isDuckDuckGoResponse(data)) {
    return results
  }

  // Abstract (top answer)
  if (data.AbstractText && data.AbstractURL) {
    results.push({
      title: data.Heading || query,
      url: data.AbstractURL,
      snippet: data.AbstractText
    })
  }

  // Related topics
  if (Array.isArray(data.RelatedTopics)) {
    for (const topic of data.RelatedTopics) {
      if (results.length >= MAX_RESULTS) break
      if (topic.Text && topic.FirstURL) {
        results.push({ title: topic.Text.split(' - ')[0] || topic.Text, url: topic.FirstURL, snippet: topic.Text })
      } else if (topic.Topics) {
        for (const sub of topic.Topics) {
          if (results.length >= MAX_RESULTS) break
          if (sub.Text && sub.FirstURL) {
            results.push({ title: sub.Text.split(' - ')[0] || sub.Text, url: sub.FirstURL, snippet: sub.Text })
          }
        }
      }
    }
  }

  return results
}

interface DuckDuckGoRelatedTopic {
  Text?: string
  FirstURL?: string
  Topics?: DuckDuckGoRelatedTopic[]
}

interface DuckDuckGoResponse {
  AbstractText?: string
  AbstractURL?: string
  Heading?: string
  RelatedTopics?: DuckDuckGoRelatedTopic[]
}

function isDuckDuckGoResponse(data: unknown): data is DuckDuckGoResponse {
  return typeof data === 'object' && data !== null
}

async function searchDDGHtml(query: string): Promise<SearchResult[]> {
  const url = DDG_HTML + encodeURIComponent(query)
  const html = await fetchUrl(url)
  const results: SearchResult[] = []

  // Parse result blocks: <a class="result__a" href="...">title</a> + <a class="result__snippet">snippet</a>
  const blockRe = /<a[^>]+class="result__a"[^>]+href="([^"]+)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<a[^>]+class="result__snippet"[^>]*>([\s\S]*?)<\/a>/g
  let m: RegExpExecArray | null
  while ((m = blockRe.exec(html)) !== null && results.length < MAX_RESULTS) {
    const rawUrl = m[1]!
    // DDG wraps URLs — extract uddg param or use as-is
    const uddg = rawUrl.match(/uddg=([^&]+)/)
    const finalUrl = uddg ? decodeURIComponent(uddg[1]!) : rawUrl
    const title = m[2]!.replace(/<[^>]+>/g, '').trim()
    const snippet = m[3]!.replace(/<[^>]+>/g, '').trim()
    if (title && finalUrl.startsWith('http')) {
      results.push({ title, url: finalUrl, snippet })
    }
  }

  return results
}

export class WebSearchTool implements Tool {
  name = 'WebSearchTool'
  description = 'Search the web for information using DuckDuckGo'
  requiresApproval = false
  isReadOnly = true
  inputSchema = {
    type: 'object',
    properties: {
      query: { type: 'string', description: 'Search query' },
      maxResults: { type: 'number', description: 'Max results to return (default: 5)' }
    },
    required: ['query']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const query = (input.query as string).trim()
    const maxResults = Math.min((input.maxResults as number) || 5, MAX_RESULTS)

    if (!query) return '[ERROR] Search query cannot be empty'

    try {
      // Try Instant Answer API first
      let results = await searchDDGApi(query)

      // Fall back to HTML scraping if API returns nothing useful
      if (results.length === 0) {
        results = await searchDDGHtml(query)
      }

      if (results.length === 0) {
        return `No results found for: "${query}"`
      }

      const lines = results.slice(0, maxResults).map((r, i) =>
        `${i + 1}. **${r.title}**\n   ${r.url}\n   ${r.snippet}`
      )

      return `Search results for "${query}" via DuckDuckGo:\n\n${lines.join('\n\n')}`
    } catch (error) {
      return `[ERROR] Search failed: ${(error as Error).message}`
    }
  }
}
