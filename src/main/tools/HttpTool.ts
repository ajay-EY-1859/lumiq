// ═══════════════════════════════════════════════════════════════════
// Lumiq — HttpTool
// Full HTTP client for REST API testing (GET, POST, PUT, PATCH, DELETE)
// ═══════════════════════════════════════════════════════════════════

import https from 'https'
import http from 'http'
import { URL } from 'url'
import type { Tool } from './Tool'

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE' | 'HEAD' | 'OPTIONS'

const MAX_RESPONSE_SIZE = 5 * 1024 * 1024 // 5MB
const REQUEST_TIMEOUT = 30000 // 30 seconds

export class HttpTool implements Tool {
  name = 'HttpTool'
  description = 'Full HTTP client for REST API testing'
  requiresApproval = true
  isReadOnly = false
  inputSchema = {
    type: 'object',
    properties: {
      method: {
        type: 'string',
        enum: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'],
        description: 'HTTP method'
      },
      url: {
        type: 'string',
        description: 'Request URL (must be absolute)'
      },
      headers: {
        type: 'object',
        description: 'Request headers as object'
      },
      body: {
        type: 'string',
        description: 'Request body (for POST, PUT, PATCH)'
      }
    },
    required: ['method', 'url']
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const method = (input.method as HttpMethod)?.toUpperCase() as HttpMethod
    const url = input.url as string

    if (!method || !['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS'].includes(method)) {
      return `[ERROR] Invalid HTTP method: ${method}`
    }

    if (!url) {
      return '[ERROR] "url" is required'
    }

    // Validate URL
    try {
      new URL(url)
    } catch {
      return `[ERROR] Invalid URL: ${url}`
    }

    // Block localhost and private IPs by default (security)
    if (this.isPrivateUrl(url)) {
      return '[ERROR] Access to localhost/private IPs is blocked for security'
    }

    const headers = (input.headers as Record<string, string>) || {}
    const body = input.body as string | undefined

    try {
      const response = await this.makeRequest(method, url, headers, body)
      return response
    } catch (error) {
      return `[ERROR] Request failed: ${(error as Error).message}`
    }
  }

  private async makeRequest(
    method: HttpMethod,
    urlString: string,
    headers: Record<string, string>,
    body?: string
  ): Promise<string> {
    return new Promise((resolve, reject) => {
      const url = new URL(urlString)
      const isHttps = url.protocol === 'https:'
      const client = isHttps ? https : http

      // Set default headers
      const requestHeaders: Record<string, string> = {
        'User-Agent': 'Lumiq-HttpTool/1.0',
        ...headers
      }

      // Add Content-Length if body is provided
      if (body) {
        requestHeaders['Content-Length'] = Buffer.byteLength(body, 'utf8').toString()
      }

      const options = {
        method,
        headers: requestHeaders,
        timeout: REQUEST_TIMEOUT
      }

      const request = client.request(url, options, (response) => {
        let data = ''
        let size = 0

        response.on('data', (chunk: Buffer) => {
          size += chunk.length
          if (size > MAX_RESPONSE_SIZE) {
            request.destroy()
            reject(new Error(`Response too large (>${(MAX_RESPONSE_SIZE / 1024 / 1024).toFixed(1)}MB)`))
            return
          }
          data += chunk
        })

        response.on('end', () => {
          const result = this.formatResponse(response, data, method)
          resolve(result)
        })
      })

      request.on('timeout', () => {
        request.destroy()
        reject(new Error(`Request timeout (${REQUEST_TIMEOUT}ms)`))
      })

      request.on('error', (error) => {
        reject(error)
      })

      // Send body if present
      if (body) {
        request.write(body)
      }

      request.end()
    })
  }

  private formatResponse(response: http.IncomingMessage, data: string, method: HttpMethod): string {
    const statusCode = response.statusCode || 0
    const statusText = response.statusMessage || 'Unknown'
    const headers = response.headers

    let output = `[HTTP RESPONSE]
Status: ${statusCode} ${statusText}
Method: ${method}

Headers:
`

    for (const [key, value] of Object.entries(headers)) {
      output += `  ${key}: ${value}\n`
    }

    output += '\nBody:\n'

    // Try to pretty-print JSON
    if (headers['content-type']?.includes('application/json')) {
      try {
        const parsed = JSON.parse(data)
        output += JSON.stringify(parsed, null, 2)
      } catch {
        output += data
      }
    } else {
      output += data.substring(0, 50000) // Limit output
    }

    if (data.length > 50000) {
      output += `\n\n[... ${data.length - 50000} more characters truncated ...]`
    }

    return output
  }

  private isPrivateUrl(url: string): boolean {
    try {
      const parsed = new URL(url)
      const hostname = parsed.hostname.toLowerCase()

      // Block localhost variants
      if (hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1') {
        return true
      }

      // Block private IP ranges (RFC 1918 + link-local + loopback)
      // 10.0.0.0/8
      if (/^10\./.test(hostname)) return true
      // 172.16.0.0/12  (172.16.x.x – 172.31.x.x)
      const m = hostname.match(/^172\.(\d+)\./)
      if (m && parseInt(m[1], 10) >= 16 && parseInt(m[1], 10) <= 31) return true
      // 192.168.0.0/16
      if (/^192\.168\./.test(hostname)) return true
      // 169.254.0.0/16 link-local
      if (/^169\.254\./.test(hostname)) return true
      // IPv6 private
      if (/^fc[0-9a-f]{2}:/i.test(hostname)) return true
      if (/^fd[0-9a-f]{2}:/i.test(hostname)) return true
      if (/^fe80:/i.test(hostname)) return true

      return false
    } catch {
      return false
    }
  }
}
