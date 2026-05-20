import { getDatabase } from '../db/database'
import { encrypt, decrypt } from '../security/encryption'
import type { OAuthTokens } from '@shared/types'

export type OAuthProvider = 'gemini' | 'github'

export function saveOAuthTokens(provider: OAuthProvider, tokens: OAuthTokens, email?: string): void {
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

export function getOAuthTokens(provider: OAuthProvider): (OAuthTokens & { email?: string }) | null {
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
      expiresAt: Number(row.expires_at) || 0,
      tokenType: (row.token_type as string) || 'Bearer',
      scope: (row.scope as string) || undefined,
      email: (row.email as string) || undefined
    }
  } catch {
    return null
  }
}

export function deleteOAuthTokens(provider: OAuthProvider): void {
  const db = getDatabase()
  db.prepare('DELETE FROM oauth_tokens WHERE provider = ?').run(provider)
}

export function saveOAuthConfig(provider: OAuthProvider, config: { clientId: string; clientSecret: string }): void {
  const db = getDatabase()
  const stmt = db.prepare(`
    INSERT INTO oauth_config (provider, client_id_encrypted, client_secret_encrypted)
    VALUES (?, ?, ?)
    ON CONFLICT(provider) DO UPDATE SET
      client_id_encrypted = excluded.client_id_encrypted,
      client_secret_encrypted = excluded.client_secret_encrypted
  `)
  stmt.run(provider, encrypt(config.clientId), encrypt(config.clientSecret))
}

export function getOAuthConfig(provider: OAuthProvider): { clientId: string; clientSecret: string } | null {
  const db = getDatabase()
  const stmt = db.prepare(
    'SELECT client_id_encrypted, client_secret_encrypted FROM oauth_config WHERE provider = ?'
  )
  const row = stmt.get(provider) as Record<string, unknown> | undefined
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

export function deleteOAuthConfig(provider: OAuthProvider): void {
  const db = getDatabase()
  db.prepare('DELETE FROM oauth_config WHERE provider = ?').run(provider)
}
