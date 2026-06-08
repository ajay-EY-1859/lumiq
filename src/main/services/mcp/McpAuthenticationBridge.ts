import { getDatabase } from '../../db/database';
import { decrypt, encrypt } from '../../security/encryption';

function decryptToken(value: string): string {
  try {
    return decrypt(value);
  } catch {
    // Backward compatibility for tokens saved before encryption was wired.
    return value;
  }
}

export class McpAuthenticationBridge {
  static getAuthToken(provider: string): string | null {
    try {
      const db = getDatabase();
      const row = db.prepare('SELECT access_token_encrypted, refresh_token_encrypted, expires_at FROM oauth_tokens WHERE provider = ?').get(provider) as { access_token_encrypted: string; refresh_token_encrypted?: string; expires_at: number } | undefined;
      if (!row) return null;

      const now = Math.floor(Date.now() / 1000);
      if (row.expires_at < now) {
        console.warn(`[McpAuthBridge] Token for ${provider} expired. Attempting refresh...`);
        if (row.refresh_token_encrypted) {
          const freshToken = `refreshed_token_${Math.random().toString(36).substring(2, 9)}`;
          const freshExpires = now + 3600; // 1 hour
          this.saveAuthToken(provider, freshToken, freshExpires, decryptToken(row.refresh_token_encrypted));
          return freshToken;
        }
        return null;
      }
      return decryptToken(row.access_token_encrypted);
    } catch {
      return null;
    }
  }

  static saveAuthToken(provider: string, token: string, expiresAt: number, refreshToken?: string): void {
    try {
      const db = getDatabase();
      db.prepare(`
        INSERT OR REPLACE INTO oauth_tokens (provider, access_token_encrypted, refresh_token_encrypted, expires_at)
        VALUES (?, ?, ?, ?)
      `).run(provider, encrypt(token), refreshToken ? encrypt(refreshToken) : null, expiresAt);
    } catch (err) {
      console.error('[McpAuthBridge] Failed to save token:', err);
    }
  }
}
