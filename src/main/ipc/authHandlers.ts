// ═══════════════════════════════════════════════════════════════════
// Lumiq — Authentication IPC Handlers
// Handles OAuth login/logout and shell operations.
// ═══════════════════════════════════════════════════════════════════

import { shell } from 'electron'
import { IPC } from '@shared/types'
import type { GitHubOAuthConfig, GoogleOAuthConfig } from '@shared/types'
import {
  googleLogin,
  googleLogout,
  getGoogleOAuthStatus,
  saveGoogleOAuthConfig,
  getGoogleOAuthConfig
} from '../auth/googleOAuth'
import {
  githubLogin,
  githubLogout,
  getGitHubOAuthStatus,
  saveGitHubOAuthConfig,
  getGitHubOAuthConfig
} from '../auth/githubOAuth'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

export function registerAuthHandlers(): void {
  // ── Google OAuth: Login ──
  handleWithTimeout(IPC.AUTH_GOOGLE_LOGIN, IPC_TIMEOUT.long, async () => {
    try {
      return await googleLogin()
    } catch (error) {
      return { isLoggedIn: false, error: (error as Error).message }
    }
  })

  // ── Google OAuth: Logout ──
  handleWithTimeout(IPC.AUTH_GOOGLE_LOGOUT, IPC_TIMEOUT.long, async () => {
    await googleLogout()
    return { isLoggedIn: false }
  })

  // ── Google OAuth: Check Status ──
  handleWithTimeout(IPC.AUTH_GOOGLE_STATUS, IPC_TIMEOUT.short, () => {
    return getGoogleOAuthStatus()
  })

  // ── Google OAuth: Save Setup (Client ID + Secret) ──
  handleWithTimeout(IPC.AUTH_GOOGLE_SETUP, IPC_TIMEOUT.short, (_event, config: GoogleOAuthConfig) => {
    saveGoogleOAuthConfig(config)
    return { success: true }
  })

  // ── Google OAuth: Get Setup Status ──
  handleWithTimeout(IPC.AUTH_GOOGLE_GET_SETUP, IPC_TIMEOUT.short, () => {
    const config = getGoogleOAuthConfig()
    return {
      isConfigured: config !== null,
      clientId: config ? config.clientId.substring(0, 8) + '...' : null
    }
  })

  // ── GitHub OAuth: Login ──
  handleWithTimeout(IPC.AUTH_GITHUB_LOGIN, IPC_TIMEOUT.long, async () => {
    try {
      return await githubLogin()
    } catch (error) {
      return { isLoggedIn: false, error: (error as Error).message }
    }
  })

  // ── GitHub OAuth: Logout ──
  handleWithTimeout(IPC.AUTH_GITHUB_LOGOUT, IPC_TIMEOUT.long, async () => {
    await githubLogout()
    return { isLoggedIn: false }
  })

  // ── GitHub OAuth: Check Status ──
  handleWithTimeout(IPC.AUTH_GITHUB_STATUS, IPC_TIMEOUT.short, () => {
    return getGitHubOAuthStatus()
  })

  // ── GitHub OAuth: Save Setup (Client ID + Secret) ──
  handleWithTimeout(IPC.AUTH_GITHUB_SETUP, IPC_TIMEOUT.short, (_event, config: GitHubOAuthConfig) => {
    saveGitHubOAuthConfig(config)
    return { success: true }
  })

  // ── GitHub OAuth: Get Setup Status ──
  handleWithTimeout(IPC.AUTH_GITHUB_GET_SETUP, IPC_TIMEOUT.short, () => {
    const config = getGitHubOAuthConfig()
    return {
      isConfigured: config !== null,
      clientId: config ? config.clientId.substring(0, 8) + '...' : null
    }
  })

  // ── Shell: Open External URL ──
  handleWithTimeout(IPC.SHELL_OPEN_EXTERNAL, IPC_TIMEOUT.short, (_event, url: string) => {
    try {
      const parsed = new URL(url)
      if (parsed.protocol === 'https:' || parsed.protocol === 'http:') {
        shell.openExternal(parsed.toString())
        return true
      }
    } catch {
      return false
    }
    return false
  })
}
