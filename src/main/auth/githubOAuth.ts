// ═══════════════════════════════════════════════════════════════════
// Lumiq — GitHub OAuth 2.0 Authentication
// Handles GitHub sign-in via the system browser and stores tokens securely.
// ═══════════════════════════════════════════════════════════════════

import { shell } from 'electron'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { randomBytes } from 'crypto'
import { URL } from 'url'
import { deleteApiConfig, getApiConfig, saveApiConfig } from '../db/apiConfigs'
import { deleteOAuthTokens, getOAuthConfig, getOAuthTokens, saveOAuthConfig, saveOAuthTokens } from './oauthStore'
import type { GitHubOAuthConfig, OAuthStatus, OAuthTokens } from '@shared/types'

const GITHUB_AUTH_URL = 'https://github.com/login/oauth/authorize'
const GITHUB_TOKEN_URL = 'https://github.com/login/oauth/access_token'
const GITHUB_USER_URL = 'https://api.github.com/user'
const GITHUB_EMAILS_URL = 'https://api.github.com/user/emails'
const GITHUB_REVOKE_URL = 'https://api.github.com/applications'
const GITHUB_PROVIDER = 'github'
const SCOPES = ['read:user', 'user:email'].join(' ')
const OAUTH_TIMEOUT_MS = 2 * 60 * 1000

export function saveGitHubOAuthConfig(config: GitHubOAuthConfig): void {
  saveOAuthConfig(GITHUB_PROVIDER, config)
}

export function getGitHubOAuthConfig(): GitHubOAuthConfig | null {
  return getOAuthConfig(GITHUB_PROVIDER)
}

function saveGitHubOAuthProvider(): void {
  saveApiConfig({
    id: 'github-oauth',
    provider: 'github',
    apiKey: 'oauth-managed',
    defaultModel: 'openai/gpt-4.1',
    isActive: true,
    authMethod: 'oauth'
  })
}

export async function githubLogin(): Promise<OAuthStatus> {
  const config = getGitHubOAuthConfig()
  if (!config) {
    throw new Error('GitHub OAuth not configured. Please set up Client ID and Secret first.')
  }

  const state = randomBytes(16).toString('hex')

  return new Promise((resolve, reject) => {
    let resolved = false
    let timeoutId: NodeJS.Timeout | null = null
    let callbackPort = 0

    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url || '/', `http://127.0.0.1:${callbackPort}`)
        if (url.pathname !== '/callback') {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Not Found')
          return
        }

        if (timeoutId) clearTimeout(timeoutId)

        const code = url.searchParams.get('code')
        const returnedState = url.searchParams.get('state')
        const error = url.searchParams.get('error')

        if (error || returnedState !== state || !code) {
          res.writeHead(400, { 'Content-Type': 'text/html' })
          res.end(getErrorHtml(error || 'Invalid state or missing code'))
          server.close()
          if (!resolved) {
            resolved = true
            reject(new Error(error || 'Invalid OAuth state'))
          }
          return
        }

        try {
          const tokens = await exchangeCodeForTokens(
            code,
            config.clientId,
            config.clientSecret,
            `http://127.0.0.1:${callbackPort}/callback`
          )
          const email = await getGitHubEmail(tokens.accessToken)
          saveOAuthTokens(GITHUB_PROVIDER, tokens, email)
          saveGitHubOAuthProvider()

          res.writeHead(200, { 'Content-Type': 'text/html' })
          res.end(getSuccessHtml(email))
          server.close()
          if (!resolved) {
            resolved = true
            resolve({ isLoggedIn: true, email, expiresAt: tokens.expiresAt })
          }
        } catch (tokenError) {
          res.writeHead(500, { 'Content-Type': 'text/html' })
          res.end(getErrorHtml('Failed to get GitHub token'))
          server.close()
          if (!resolved) {
            resolved = true
            reject(tokenError)
          }
        }
      } catch (err) {
        res.writeHead(500)
        res.end('Internal error')
        server.close()
        if (!resolved) {
          resolved = true
          reject(err)
        }
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      callbackPort = typeof address === 'object' && address ? address.port : 0
      const redirectUri = `http://127.0.0.1:${callbackPort}/callback`

      const authUrl = new URL(GITHUB_AUTH_URL)
      authUrl.searchParams.set('client_id', config.clientId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('scope', SCOPES)
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('allow_signup', 'true')

      shell.openExternal(authUrl.toString())

      timeoutId = setTimeout(() => {
        server.close()
        if (!resolved) {
          resolved = true
          resolve({ isLoggedIn: false })
        }
      }, OAUTH_TIMEOUT_MS)
    })

    server.on('error', (err) => {
      if (!resolved) {
        resolved = true
        reject(new Error(`Failed to start GitHub OAuth callback server: ${err.message}`))
      }
    })
  })
}

async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string
): Promise<OAuthTokens> {
  const response = await fetch(GITHUB_TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`GitHub token exchange failed: ${error}`)
  }

  const data = await response.json()
  if (data.error) {
    throw new Error(`GitHub token exchange failed: ${data.error_description || data.error}`)
  }

  return {
    accessToken: data.access_token,
    expiresAt: Date.now() + 365 * 24 * 60 * 60 * 1000,
    tokenType: data.token_type || 'Bearer',
    scope: data.scope
  }
}

async function getGitHubEmail(accessToken: string): Promise<string> {
  const headers = {
    Authorization: `Bearer ${accessToken}`,
    Accept: 'application/vnd.github+json',
    'X-GitHub-Api-Version': '2022-11-28'
  }

  const userResponse = await fetch(GITHUB_USER_URL, { headers })
  if (userResponse.ok) {
    const user = await userResponse.json()
    if (user.email) return user.email
    if (user.login) return user.login
  }

  const emailsResponse = await fetch(GITHUB_EMAILS_URL, { headers })
  if (!emailsResponse.ok) return 'unknown'

  const emails = await emailsResponse.json()
  const primary = Array.isArray(emails)
    ? emails.find((item) => item.primary && item.verified) || emails.find((item) => item.verified)
    : null
  return primary?.email || 'unknown'
}

export function getGitHubOAuthStatus(): OAuthStatus {
  const tokens = getOAuthTokens(GITHUB_PROVIDER)
  if (!tokens || tokens.expiresAt < Date.now()) return { isLoggedIn: false }

  return {
    isLoggedIn: true,
    email: tokens.email,
    expiresAt: tokens.expiresAt
  }
}

export function getValidGitHubToken(): string | null {
  const tokens = getOAuthTokens(GITHUB_PROVIDER)
  if (!tokens || tokens.expiresAt < Date.now()) return null
  return tokens.accessToken
}

export async function githubLogout(): Promise<void> {
  const config = getGitHubOAuthConfig()
  const tokens = getOAuthTokens(GITHUB_PROVIDER)

  if (config && tokens) {
    try {
      const credentials = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString('base64')
      await fetch(`${GITHUB_REVOKE_URL}/${config.clientId}/token`, {
        method: 'DELETE',
        headers: {
          Authorization: `Basic ${credentials}`,
          Accept: 'application/vnd.github+json',
          'X-GitHub-Api-Version': '2022-11-28'
        },
        body: JSON.stringify({ access_token: tokens.accessToken })
      })
    } catch {
      // Ignore revocation errors and clear the local session.
    }
  }

  deleteOAuthTokens(GITHUB_PROVIDER)
  const providerConfig = getApiConfig(GITHUB_PROVIDER)
  if (providerConfig?.authMethod === 'oauth') {
    deleteApiConfig(GITHUB_PROVIDER)
  }
}

function getSuccessHtml(email: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>GitHub Login Successful</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex; align-items: center; justify-content: center; height: 100vh;
    margin: 0; background: #0F172A; color: #E2E8F0; }
  .container { text-align: center; padding: 40px; }
  .icon { font-size: 48px; margin-bottom: 16px; }
  h1 { font-size: 20px; color: #22C55E; margin-bottom: 8px; }
  p { font-size: 14px; color: #94A3B8; }
</style>
</head>
<body>
  <div class="container">
    <div class="icon">OK</div>
    <h1>Successfully Signed In!</h1>
    <p>Connected GitHub as <strong>${escapeHtml(email)}</strong></p>
    <p>You can close this window and return to Lumiq.</p>
  </div>
</body>
</html>`
}

function getErrorHtml(error: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>GitHub Login Failed</title>
<style>
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
    display: flex; align-items: center; justify-content: center; height: 100vh;
    margin: 0; background: #0F172A; color: #E2E8F0; }
  .container { text-align: center; padding: 40px; }
  .icon { font-size: 48px; margin-bottom: 16px; }
  h1 { font-size: 20px; color: #EF4444; margin-bottom: 8px; }
  p { font-size: 14px; color: #94A3B8; }
</style>
</head>
<body>
  <div class="container">
    <div class="icon">!</div>
    <h1>Login Failed</h1>
    <p>${escapeHtml(error)}</p>
    <p>You can close this window and try again.</p>
  </div>
</body>
</html>`
}

function escapeHtml(value: string): string {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}
