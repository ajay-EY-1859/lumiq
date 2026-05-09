// ═══════════════════════════════════════════════════════════════════
// Lumiq — Google OAuth 2.0 Authentication
// Handles Google sign-in via the system browser (Chrome/Edge).
// Uses Authorization Code flow with PKCE for security.
// ═══════════════════════════════════════════════════════════════════

import { shell } from 'electron'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { randomBytes, createHash } from 'crypto'
import { URL } from 'url'
import { getDatabase } from '../db/database'
import { saveApiConfig, deleteApiConfig } from '../db/apiConfigs'
import { encrypt, decrypt } from '../security/encryption'
import type { OAuthTokens, OAuthStatus, GoogleOAuthConfig } from '@shared/types'

// Google OAuth endpoints
const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth'
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token'
const GOOGLE_USERINFO_URL = 'https://www.googleapis.com/oauth2/v3/userinfo'
const GOOGLE_REVOKE_URL = 'https://oauth2.googleapis.com/revoke'

// Scopes needed for Gemini API access via OAuth
// NOTE: 'generative-language' base scope does NOT exist.
// Use 'cloud-platform' which covers all Google Cloud APIs including Gemini.
const SCOPES = [
  'https://www.googleapis.com/auth/cloud-platform',
  'https://www.googleapis.com/auth/userinfo.email',
  'openid'
].join(' ')

// ─── PKCE Helpers ──────────────────────────────────────────────────
function generateCodeVerifier(): string {
  return randomBytes(32).toString('base64url')
}

function generateCodeChallenge(verifier: string): string {
  return createHash('sha256').update(verifier).digest('base64url')
}

// ─── Database Operations ───────────────────────────────────────────

/**
 * Ensures the oauth_tokens table exists (migration).
 */
export function ensureOAuthTable(): void {
  const db = getDatabase()
  db.exec(`
    CREATE TABLE IF NOT EXISTS oauth_tokens (
      provider TEXT PRIMARY KEY,
      access_token_encrypted TEXT NOT NULL,
      refresh_token_encrypted TEXT,
      expires_at INTEGER NOT NULL,
      token_type TEXT DEFAULT 'Bearer',
      scope TEXT,
      email TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS oauth_config (
      provider TEXT PRIMARY KEY,
      client_id_encrypted TEXT NOT NULL,
      client_secret_encrypted TEXT NOT NULL
    );
  `)
}

/**
 * Saves OAuth tokens securely (encrypted).
 */
function saveOAuthTokens(provider: string, tokens: OAuthTokens, email?: string): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    INSERT INTO oauth_tokens (provider, access_token_encrypted, refresh_token_encrypted, expires_at, token_type, scope, email)
    VALUES (?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      access_token_encrypted = excluded.access_token_encrypted,
      refresh_token_encrypted = excluded.refresh_token_encrypted,
      expires_at = excluded.expires_at,
      token_type = excluded.token_type,
      scope = excluded.scope,
      email = excluded.email
  `)
  stmt.run(
    provider,
    encrypt(tokens.accessToken),
    tokens.refreshToken ? encrypt(tokens.refreshToken) : null,
    tokens.expiresAt,
    tokens.tokenType,
    tokens.scope || null,
    email || null
  )
}

/**
 * Retrieves OAuth tokens for a provider.
 */
export function getOAuthTokens(provider: string): (OAuthTokens & { email?: string }) | null {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT access_token_encrypted, refresh_token_encrypted, expires_at, token_type, scope, email
    FROM oauth_tokens WHERE provider = ?
  `)
  const row = stmt.get(provider) as Record<string, unknown> | undefined
  if (!row) return null

  try {
    return {
      accessToken: decrypt(row.access_token_encrypted as string),
      refreshToken: row.refresh_token_encrypted
        ? decrypt(row.refresh_token_encrypted as string)
        : undefined,
      expiresAt: row.expires_at as number,
      tokenType: (row.token_type as string) || 'Bearer',
      scope: (row.scope as string) || undefined,
      email: (row.email as string) || undefined
    }
  } catch {
    return null
  }
}

/**
 * Deletes OAuth tokens for a provider.
 */
function deleteOAuthTokens(provider: string): void {
  const db = getDatabase()
  db.prepare('DELETE FROM oauth_tokens WHERE provider = ?').run(provider)
}

/**
 * Saves Google OAuth client credentials.
 */
export function saveGoogleOAuthConfig(config: GoogleOAuthConfig): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    INSERT INTO oauth_config (provider, client_id_encrypted, client_secret_encrypted)
    VALUES ('gemini', ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      client_id_encrypted = excluded.client_id_encrypted,
      client_secret_encrypted = excluded.client_secret_encrypted
  `)
  stmt.run(encrypt(config.clientId), encrypt(config.clientSecret))
}

/**
 * Retrieves Google OAuth client credentials.
 */
export function getGoogleOAuthConfig(): GoogleOAuthConfig | null {
  const db = getDatabase()
  const stmt = db.prepare(
    'SELECT client_id_encrypted, client_secret_encrypted FROM oauth_config WHERE provider = ?'
  )
  const row = stmt.get('gemini') as Record<string, unknown> | undefined
  if (!row) return null

  try {
    return {
      clientId: decrypt(row.client_id_encrypted as string),
      clientSecret: decrypt(row.client_secret_encrypted as string)
    }
  } catch {
    return null
  }
}

/**
 * Creates/updates a Gemini provider config entry with authMethod='oauth'.
 * This ensures the rest of the app (chat, test, etc.) recognizes Gemini as configured.
 */
function saveGeminiOAuthProvider(): void {
  saveApiConfig({
    id: 'gemini-oauth',
    provider: 'gemini',
    apiKey: 'oauth-managed', // Placeholder — actual auth uses OAuth token
    defaultModel: 'gemini-1.5-pro',
    isActive: true,
    authMethod: 'oauth'
  })
}

// ─── OAuth Flow ────────────────────────────────────────────────────

// Timeout for OAuth flow (2 minutes)
const OAUTH_TIMEOUT_MS = 2 * 60 * 1000

/**
 * Performs the Google OAuth 2.0 login flow.
 * Opens the SYSTEM BROWSER (Chrome/Edge/etc.) for authentication so that
 * existing logged-in Google accounts are automatically detected.
 * A temporary local HTTP server receives the OAuth callback.
 */
export async function googleLogin(): Promise<OAuthStatus> {
  const config = getGoogleOAuthConfig()
  if (!config) {
    throw new Error('Google OAuth not configured. Please set up Client ID and Secret first.')
  }

  const { clientId, clientSecret } = config

  // Generate PKCE parameters
  const codeVerifier = generateCodeVerifier()
  const codeChallenge = generateCodeChallenge(codeVerifier)
  const state = randomBytes(16).toString('hex')

  return new Promise((resolve, reject) => {
    let resolved = false
    let timeoutId: NodeJS.Timeout | null = null

    // Start a temporary local server to receive the OAuth callback
    let callbackPort = 0
    const server = createServer(async (req: IncomingMessage, res: ServerResponse) => {
      try {
        const url = new URL(req.url || '/', `http://127.0.0.1:${callbackPort}`)

        if (url.pathname === '/callback') {
          if (timeoutId) clearTimeout(timeoutId)

          const code = url.searchParams.get('code')
          const returnedState = url.searchParams.get('state')
          const error = url.searchParams.get('error')

          if (error) {
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(getErrorHtml(error))
            server.close()
            if (!resolved) { resolved = true; reject(new Error(`Google login failed: ${error}`)) }
            return
          }

          if (returnedState !== state || !code) {
            res.writeHead(400, { 'Content-Type': 'text/html' })
            res.end(getErrorHtml('Invalid state or missing code'))
            server.close()
            if (!resolved) { resolved = true; reject(new Error('Invalid OAuth state')) }
            return
          }

          // Exchange code for tokens
          try {
            const tokens = await exchangeCodeForTokens(
              code,
              clientId,
              clientSecret,
              `http://127.0.0.1:${callbackPort}/callback`,
              codeVerifier
            )

            // Get user email
            const email = await getUserEmail(tokens.accessToken)

            // Save tokens
            saveOAuthTokens('gemini', tokens, email)

            // Also register Gemini as a configured provider so chat/test works
            saveGeminiOAuthProvider()

            // Show success page in the browser
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(getSuccessHtml(email))
            server.close()

            if (!resolved) { resolved = true; resolve({ isLoggedIn: true, email, expiresAt: tokens.expiresAt }) }
          } catch (tokenError) {
            res.writeHead(500, { 'Content-Type': 'text/html' })
            res.end(getErrorHtml('Failed to get tokens'))
            server.close()
            if (!resolved) { resolved = true; reject(tokenError) }
          }
        }
      } catch (err) {
        res.writeHead(500)
        res.end('Internal error')
        server.close()
        if (!resolved) { resolved = true; reject(err) }
      }
    })

    server.listen(0, '127.0.0.1', () => {
      const address = server.address()
      callbackPort = typeof address === 'object' && address ? address.port : 0
      const redirectUri = `http://127.0.0.1:${callbackPort}/callback`

      // Build authorization URL
      const authUrl = new URL(GOOGLE_AUTH_URL)
      authUrl.searchParams.set('client_id', clientId)
      authUrl.searchParams.set('redirect_uri', redirectUri)
      authUrl.searchParams.set('response_type', 'code')
      authUrl.searchParams.set('scope', SCOPES)
      authUrl.searchParams.set('state', state)
      authUrl.searchParams.set('code_challenge', codeChallenge)
      authUrl.searchParams.set('code_challenge_method', 'S256')
      authUrl.searchParams.set('access_type', 'offline')
      authUrl.searchParams.set('prompt', 'consent')

      // Open the system browser (Chrome/Edge/etc.) — picks up existing Google sessions
      shell.openExternal(authUrl.toString())

      // Timeout: if user doesn't complete auth within 2 minutes
      timeoutId = setTimeout(() => {
        server.close()
        if (!resolved) { resolved = true; resolve({ isLoggedIn: false }) }
      }, OAUTH_TIMEOUT_MS)
    })

    server.on('error', (err) => {
      if (!resolved) { resolved = true; reject(new Error(`Failed to start OAuth callback server: ${err.message}`)) }
    })
  })
}

/**
 * Exchanges an authorization code for tokens.
 */
async function exchangeCodeForTokens(
  code: string,
  clientId: string,
  clientSecret: string,
  redirectUri: string,
  codeVerifier: string
): Promise<OAuthTokens> {
  const response = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier
    })
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(`Token exchange failed: ${error}`)
  }

  const data = await response.json()

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: Date.now() + (data.expires_in * 1000),
    tokenType: data.token_type || 'Bearer',
    scope: data.scope
  }
}

/**
 * Gets the user's email from Google.
 */
async function getUserEmail(accessToken: string): Promise<string> {
  const response = await fetch(GOOGLE_USERINFO_URL, {
    headers: { Authorization: `Bearer ${accessToken}` }
  })
  if (!response.ok) return 'unknown'
  const data = await response.json()
  return data.email || 'unknown'
}

/**
 * Refreshes an expired OAuth access token.
 */
export async function refreshGoogleToken(): Promise<OAuthTokens | null> {
  const config = getGoogleOAuthConfig()
  const existing = getOAuthTokens('gemini')

  if (!config || !existing?.refreshToken) return null

  try {
    const response = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: config.clientId,
        client_secret: config.clientSecret,
        refresh_token: existing.refreshToken,
        grant_type: 'refresh_token'
      })
    })

    if (!response.ok) return null

    const data = await response.json()
    const tokens: OAuthTokens = {
      accessToken: data.access_token,
      refreshToken: existing.refreshToken, // Refresh token stays the same
      expiresAt: Date.now() + (data.expires_in * 1000),
      tokenType: data.token_type || 'Bearer',
      scope: data.scope
    }

    saveOAuthTokens('gemini', tokens, existing.email)
    return tokens
  } catch {
    return null
  }
}

/**
 * Gets a valid access token (refreshes if expired).
 */
export async function getValidGoogleToken(): Promise<string | null> {
  const tokens = getOAuthTokens('gemini')
  if (!tokens) return null

  // If token expires within 5 minutes, refresh it
  if (tokens.expiresAt - Date.now() < 5 * 60 * 1000) {
    const refreshed = await refreshGoogleToken()
    return refreshed?.accessToken || null
  }

  return tokens.accessToken
}

/**
 * Gets the current Google OAuth status.
 */
export function getGoogleOAuthStatus(): OAuthStatus {
  const tokens = getOAuthTokens('gemini')
  if (!tokens) return { isLoggedIn: false }

  // Check if token is expired and there's no refresh token
  const isExpired = tokens.expiresAt < Date.now()
  if (isExpired && !tokens.refreshToken) {
    return { isLoggedIn: false }
  }

  return {
    isLoggedIn: true,
    email: tokens.email,
    expiresAt: tokens.expiresAt
  }
}

/**
 * Logs out of Google OAuth (revokes token and deletes stored data).
 */
export async function googleLogout(): Promise<void> {
  const tokens = getOAuthTokens('gemini')
  if (tokens) {
    // Revoke the token with Google
    try {
      await fetch(`${GOOGLE_REVOKE_URL}?token=${tokens.accessToken}`, {
        method: 'POST'
      })
    } catch {
      // Ignore revocation errors — we'll delete locally anyway
    }
    deleteOAuthTokens('gemini')
    // Also remove the Gemini provider config
    deleteApiConfig('gemini')
  }
}

// ─── HTML Templates ────────────────────────────────────────────────

function getSuccessHtml(email: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Login Successful</title>
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
    <div class="icon">✅</div>
    <h1>Successfully Signed In!</h1>
    <p>Logged in as <strong>${email}</strong></p>
    <p>This window will close automatically...</p>
  </div>
</body>
</html>`
}

function getErrorHtml(error: string): string {
  return `<!DOCTYPE html>
<html>
<head><title>Login Failed</title>
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
    <div class="icon">❌</div>
    <h1>Login Failed</h1>
    <p>${error}</p>
    <p>You can close this window and try again.</p>
  </div>
</body>
</html>`
}
