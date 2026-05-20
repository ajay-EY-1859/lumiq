// ═══════════════════════════════════════════════════════════════════
// Lumiq — OS Keychain Integration
// SECURITY: Uses the OS-native credential store for maximum safety.
// Windows: Credential Manager
// macOS: Keychain
// Linux: libsecret (GNOME Keyring / KDE Wallet)
// ═══════════════════════════════════════════════════════════════════

const SERVICE_NAME = 'lumiq-desktop'

/**
 * Stores a value in the OS keychain.
 * Falls back to encrypted file storage if keychain is unavailable.
 *
 * @param account - Identifier for the stored value (e.g., 'anthropic-api-key')
 * @param value - The sensitive value to store
 */
export async function setKeychainValue(account: string, value: string): Promise<void> {
  try {
    const keytar = await import('keytar')
    await keytar.default.setPassword(SERVICE_NAME, account, value)
  } catch (error) {
    // Keytar may fail if native bindings aren't available
    // Fall back to encrypted storage in the app's data directory
    console.warn(
      '[Security] OS keychain unavailable, using encrypted file storage:',
      (error as Error).message
    )
    await fallbackStore(account, value)
  }
}

/**
 * Retrieves a value from the OS keychain.
 *
 * @param account - Identifier for the stored value
 * @returns The stored value, or null if not found
 */
export async function getKeychainValue(account: string): Promise<string | null> {
  try {
    const keytar = await import('keytar')
    return await keytar.default.getPassword(SERVICE_NAME, account)
  } catch (error) {
    console.warn(
      '[Security] OS keychain unavailable, using fallback:',
      (error as Error).message
    )
    return await fallbackRetrieve(account)
  }
}

/**
 * Deletes a value from the OS keychain.
 *
 * @param account - Identifier for the stored value
 * @returns true if the value was found and deleted
 */
export async function deleteKeychainValue(account: string): Promise<boolean> {
  try {
    const keytar = await import('keytar')
    return await keytar.default.deletePassword(SERVICE_NAME, account)
  } catch (error) {
    console.warn(
      '[Security] OS keychain unavailable, using fallback:',
      (error as Error).message
    )
    return await fallbackDelete(account)
  }
}

// ─── Fallback: Encrypted file storage ──────────────────────────────
// When keytar isn't available, we store encrypted values in the
// app's userData directory. This is less secure than OS keychain
// but still encrypted with AES-256-GCM.

import { app } from 'electron'
import { existsSync, mkdirSync, readFileSync, writeFileSync, unlinkSync } from 'fs'
import { join } from 'path'
import { encrypt, decrypt } from './encryption'

function getSecureStorePath(): string {
  const dir = join(app.getPath('userData'), '.secure')
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true, mode: 0o700 }) // Owner-only permissions
  }
  return dir
}

function sanitizeFilename(account: string): string {
  // Prevent directory traversal attacks
  return account.replace(/[^a-zA-Z0-9_-]/g, '_')
}

async function fallbackStore(account: string, value: string): Promise<void> {
  const dir = getSecureStorePath()
  const filePath = join(dir, `${sanitizeFilename(account)}.enc`)
  const encrypted = encrypt(value)
  writeFileSync(filePath, encrypted, { encoding: 'utf8', mode: 0o600 }) // Owner read/write only
}

async function fallbackRetrieve(account: string): Promise<string | null> {
  const dir = getSecureStorePath()
  const filePath = join(dir, `${sanitizeFilename(account)}.enc`)
  if (!existsSync(filePath)) return null
  try {
    const encrypted = readFileSync(filePath, 'utf8')
    return decrypt(encrypted)
  } catch {
    return null
  }
}

async function fallbackDelete(account: string): Promise<boolean> {
  const dir = getSecureStorePath()
  const filePath = join(dir, `${sanitizeFilename(account)}.enc`)
  if (!existsSync(filePath)) return false
  try {
    unlinkSync(filePath)
    return true
  } catch {
    return false
  }
}
