// ═══════════════════════════════════════════════════════════════════
// Lumiq — AES-256-GCM Encryption for API Keys
// SECURITY: All API keys are encrypted before storage.
// Keys are NEVER stored in plaintext, logged, or transmitted
// except to the provider's own API endpoint.
// ═══════════════════════════════════════════════════════════════════

import { createCipheriv, createDecipheriv, randomBytes, scryptSync, timingSafeEqual, createHash } from 'crypto'
import os from 'os'

const ALGORITHM = 'aes-256-gcm'
const SALT_LENGTH = 32 // 256-bit salt
const IV_LENGTH = 16 // 128-bit IV
const KEY_LENGTH = 32 // 256-bit key
const AUTH_TAG_LENGTH = 16 // 128-bit auth tag
const SCRYPT_N = 16384 // CPU/memory cost parameter
const SCRYPT_R = 8
const SCRYPT_P = 1

/**
 * Derives a 256-bit key from a password using scrypt.
 * scrypt is chosen over PBKDF2 because it is memory-hard,
 * making brute-force attacks significantly more expensive.
 */
function deriveKey(password: string, salt: Buffer): Buffer {
  return scryptSync(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P
  })
}

/**
 * Gets the machine-specific master password.
 * Uses a combination of platform-specific identifiers to create
 * a deterministic but machine-unique master password.
 * This ensures encrypted data cannot be moved between machines.
 */
function getMasterPassword(): string {
  // Combine multiple machine-specific values
  const machineId = [
    os.hostname(),
    os.platform(),
    os.arch(),
    os.homedir(),
    os.userInfo().username
  ].join('|')
  // Hash it so we don't leak system info directly
  return createHash('sha256').update(machineId).digest('hex')
}

export interface EncryptedPayload {
  salt: string // hex
  iv: string // hex
  encrypted: string // hex
  authTag: string // hex
  version: number // schema version for future migration
}

/**
 * Encrypts a plaintext API key using AES-256-GCM.
 *
 * @param plaintext - The API key to encrypt
 * @returns JSON string containing all components needed for decryption
 *
 * SECURITY NOTES:
 * - Each encryption generates a unique random salt and IV
 * - The auth tag provides integrity verification (tamper detection)
 * - scrypt key derivation is memory-hard (resistant to GPU attacks)
 */
export function encrypt(plaintext: string): string {
  if (!plaintext || plaintext.length === 0) {
    throw new Error('Cannot encrypt empty string')
  }

  const masterPassword = getMasterPassword()
  const salt = randomBytes(SALT_LENGTH)
  const key = deriveKey(masterPassword, salt)
  const iv = randomBytes(IV_LENGTH)

  const cipher = createCipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  const encrypted = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()])
  const authTag = cipher.getAuthTag()

  const payload: EncryptedPayload = {
    salt: salt.toString('hex'),
    iv: iv.toString('hex'),
    encrypted: encrypted.toString('hex'),
    authTag: authTag.toString('hex'),
    version: 1
  }

  // Zero out sensitive buffers
  key.fill(0)

  return JSON.stringify(payload)
}

/**
 * Decrypts an AES-256-GCM encrypted API key.
 *
 * @param encryptedJson - JSON string from encrypt()
 * @returns The original plaintext API key
 * @throws Error if decryption fails (wrong key, tampered data, etc.)
 *
 * SECURITY: The auth tag is verified during decryption.
 * If the encrypted data has been tampered with, decryption
 * will throw an error (authenticated encryption).
 */
export function decrypt(encryptedJson: string): string {
  if (!encryptedJson || encryptedJson.length === 0) {
    throw new Error('Cannot decrypt empty string')
  }

  let payload: EncryptedPayload
  try {
    payload = JSON.parse(encryptedJson)
  } catch {
    throw new Error('Invalid encrypted payload format')
  }

  // Validate payload structure
  if (!payload.salt || !payload.iv || !payload.encrypted || !payload.authTag) {
    throw new Error('Corrupted encrypted payload — missing fields')
  }

  const masterPassword = getMasterPassword()
  const salt = Buffer.from(payload.salt, 'hex')
  const key = deriveKey(masterPassword, salt)
  const iv = Buffer.from(payload.iv, 'hex')
  const authTag = Buffer.from(payload.authTag, 'hex')

  const decipher = createDecipheriv(ALGORITHM, key, iv, { authTagLength: AUTH_TAG_LENGTH })
  decipher.setAuthTag(authTag)

  try {
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(payload.encrypted, 'hex')),
      decipher.final()
    ])

    // Zero out sensitive buffers
    key.fill(0)

    return decrypted.toString('utf8')
  } catch {
    // Zero out key even on failure
    key.fill(0)
    throw new Error('Decryption failed — data may be corrupted or from a different machine')
  }
}

/**
 * Sanitizes a string to remove any API key patterns.
 * Use this before logging ANY string that might contain keys.
 *
 * Patterns matched:
 * - sk-ant-... (Anthropic)
 * - sk-... (OpenAI)
 * - AIza... (Google)
 * - AKIA... (AWS Access Key)
 */
export function sanitizeForLogging(text: string): string {
  return text
    .replace(/sk-ant-[a-zA-Z0-9_-]{20,}/g, '[ANTHROPIC_KEY_REDACTED]')
    .replace(/sk-[a-zA-Z0-9]{20,}/g, '[OPENAI_KEY_REDACTED]')
    .replace(/AIza[a-zA-Z0-9_-]{30,}/g, '[GOOGLE_KEY_REDACTED]')
    .replace(/AKIA[A-Z0-9]{12,}/g, '[AWS_KEY_REDACTED]')
}

/**
 * Timing-safe string comparison to prevent timing attacks.
 * Use when comparing sensitive values like API keys or tokens.
 */
export function secureCompare(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  return timingSafeEqual(Buffer.from(a), Buffer.from(b))
}
