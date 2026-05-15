// ═══════════════════════════════════════════════════════════════════
// Lumiq — API Config CRUD (Provider configurations)
// SECURITY: API keys are encrypted before storage and decrypted
// only when needed. Keys never appear in logs.
// ═══════════════════════════════════════════════════════════════════

import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from './database'
import { encrypt, decrypt } from '../security/encryption'
import type { ProviderConfig, AuthMethod } from '@shared/types'

/**
 * Saves or updates a provider configuration.
 * API keys are encrypted before writing to the database.
 */
export function saveApiConfig(config: ProviderConfig): void {
  const db = getDatabase()

  // Encrypt sensitive fields before storage
  const encryptedApiKey = config.apiKey ? encrypt(config.apiKey) : null
  const encryptedAwsAccessKey = config.awsAccessKeyId ? encrypt(config.awsAccessKeyId) : null
  const encryptedAwsSecretKey = config.awsSecretAccessKey
    ? encrypt(config.awsSecretAccessKey)
    : null

  const stmt = db.prepare(`
    INSERT INTO api_configs (id, provider, api_key_encrypted, base_url, default_model, is_active,
                             aws_access_key_encrypted, aws_secret_key_encrypted, aws_session_token, aws_region, auth_method)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, COALESCE(?, 'us-east-1'), COALESCE(?, 'apikey'))
    ON CONFLICT(provider) DO UPDATE SET
      api_key_encrypted = COALESCE(excluded.api_key_encrypted, api_configs.api_key_encrypted),
      base_url = COALESCE(excluded.base_url, api_configs.base_url),
      default_model = excluded.default_model,
      is_active = excluded.is_active,
      aws_access_key_encrypted = COALESCE(excluded.aws_access_key_encrypted, api_configs.aws_access_key_encrypted),
      aws_secret_key_encrypted = COALESCE(excluded.aws_secret_key_encrypted, api_configs.aws_secret_key_encrypted),
      aws_session_token = COALESCE(excluded.aws_session_token, api_configs.aws_session_token),
      aws_region = COALESCE(excluded.aws_region, api_configs.aws_region),
      auth_method = COALESCE(excluded.auth_method, api_configs.auth_method)
  `)

  stmt.run(
    config.id || uuidv4(),
    config.provider,
    encryptedApiKey,
    config.baseUrl || null,
    config.defaultModel,
    config.isActive ? 1 : 0,
    encryptedAwsAccessKey,
    encryptedAwsSecretKey,
    config.awsSessionToken || null,
    config.awsRegion || null,
    config.authMethod || null
  )
}

/**
 * Lists all provider configurations.
 * API keys are decrypted when retrieved.
 *
 * SECURITY: Only call this in the main process.
 * Never send decrypted keys to the renderer.
 */
export function listApiConfigs(): ProviderConfig[] {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, provider, api_key_encrypted, base_url as baseUrl,
           default_model as defaultModel, is_active as isActive,
           aws_access_key_encrypted, aws_secret_key_encrypted,
           aws_session_token as awsSessionToken, aws_region as awsRegion,
           auth_method as authMethod
    FROM api_configs
  `)

  const rows = stmt.all() as Array<Record<string, unknown>>

  return rows.map((row) => ({
    id: row.id as string,
    provider: row.provider as ProviderConfig['provider'],
    apiKey: row.api_key_encrypted ? safeDecrypt(row.api_key_encrypted as string) : undefined,
    baseUrl: (row.baseUrl as string) || undefined,
    defaultModel: row.defaultModel as string,
    isActive: Boolean(row.isActive),
    authMethod: (row.authMethod as ProviderConfig['authMethod']) || 'apikey',
    awsAccessKeyId: row.aws_access_key_encrypted
      ? safeDecrypt(row.aws_access_key_encrypted as string)
      : undefined,
    awsSecretAccessKey: row.aws_secret_key_encrypted
      ? safeDecrypt(row.aws_secret_key_encrypted as string)
      : undefined,
    awsSessionToken: (row.awsSessionToken as string) || undefined,
    awsRegion: (row.awsRegion as string) || 'us-east-1'
  }))
}

/**
 * Gets a specific provider config by provider type.
 * Returns with decrypted keys for main-process use only.
 */
export function getApiConfig(provider: string): ProviderConfig | null {
  const configs = listApiConfigs()
  return configs.find((c) => c.provider === provider) || null
}

/**
 * Lists configs for the renderer (WITHOUT decrypted keys).
 * Only sends whether a key exists, not the key itself.
 */
export function listApiConfigsSafe(): Array<
  Omit<ProviderConfig, 'apiKey' | 'awsAccessKeyId' | 'awsSecretAccessKey'> & {
    hasApiKey: boolean
    hasAwsKeys: boolean
  }
> {
  const db = getDatabase()
  const stmt = db.prepare(`
    SELECT id, provider, api_key_encrypted, base_url as baseUrl,
           default_model as defaultModel, is_active as isActive,
           aws_access_key_encrypted, aws_region as awsRegion,
           auth_method as authMethod
    FROM api_configs
  `)

  const rows = stmt.all() as Array<Record<string, unknown>>

  return rows.map((row) => ({
    id: row.id as string,
    provider: row.provider as ProviderConfig['provider'],
    baseUrl: (row.baseUrl as string) || undefined,
    defaultModel: row.defaultModel as string,
    isActive: Boolean(row.isActive),
    awsRegion: (row.awsRegion as string) || 'us-east-1',
    hasApiKey: Boolean(row.api_key_encrypted),
    hasAwsKeys: Boolean(row.aws_access_key_encrypted),
    authMethod: ((row.authMethod as string) || 'apikey') as AuthMethod
  }))
}

/**
 * Deletes a provider configuration.
 */
export function deleteApiConfig(provider: string): boolean {
  const db = getDatabase()
  const stmt = db.prepare(`DELETE FROM api_configs WHERE provider = ?`)
  const result = stmt.run(provider)
  return result.changes > 0
}

/**
 * Safe decrypt that returns undefined on failure instead of throwing.
 */
function safeDecrypt(encrypted: string): string | undefined {
  try {
    return decrypt(encrypted)
  } catch {
    return undefined
  }
}
