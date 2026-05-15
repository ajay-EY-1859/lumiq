// ═══════════════════════════════════════════════════════════════════
// Lumiq — Authentication IPC Handlers
// Handles OAuth login/logout and shell operations.
// ═══════════════════════════════════════════════════════════════════

import { ipcMain, shell } from 'electron'
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

export function registerAuthHandlers(): void {
  // ── Google OAuth: Login ──
  ipcMain.handle(IPC.AUTH_GOOGLE_LOGIN, async () => {
    try {
      return await googleLogin()
    } catch (error) {
      return { isLoggedIn: false, error: (error as Error).message }
    }
  })

  // ── Google OAuth: Logout ──
  ipcMain.handle(IPC.AUTH_GOOGLE_LOGOUT, async () => {
    await googleLogout()
    return { isLoggedIn: false }
  })

  // ── Google OAuth: Check Status ──
  ipcMain.handle(IPC.AUTH_GOOGLE_STATUS, () => {
    return getGoogleOAuthStatus()
  })

  // ── Google OAuth: Save Setup (Client ID + Secret) ──
  ipcMain.handle(IPC.AUTH_GOOGLE_SETUP, (_event, config: GoogleOAuthConfig) => {
    saveGoogleOAuthConfig(config)
    return { success: true }
  })

  // ── Google OAuth: Get Setup Status ──
  ipcMain.handle(IPC.AUTH_GOOGLE_GET_SETUP, () => {
    const config = getGoogleOAuthConfig()
    return {
      isConfigured: config !== null,
      clientId: config ? config.clientId.substring(0, 8) + '...' : null
    }
  })

  // ── GitHub OAuth: Login ──
  ipcMain.handle(IPC.AUTH_GITHUB_LOGIN, async () => {
    try {
      return await githubLogin()
    } catch (error) {
      return { isLoggedIn: false, error: (error as Error).message }
    }
  })

  // ── GitHub OAuth: Logout ──
  ipcMain.handle(IPC.AUTH_GITHUB_LOGOUT, async () => {
    await githubLogout()
    return { isLoggedIn: false }
  })

  // ── GitHub OAuth: Check Status ──
  ipcMain.handle(IPC.AUTH_GITHUB_STATUS, () => {
    return getGitHubOAuthStatus()
  })

  // ── GitHub OAuth: Save Setup (Client ID + Secret) ──
  ipcMain.handle(IPC.AUTH_GITHUB_SETUP, (_event, config: GitHubOAuthConfig) => {
    saveGitHubOAuthConfig(config)
    return { success: true }
  })

  // ── GitHub OAuth: Get Setup Status ──
  ipcMain.handle(IPC.AUTH_GITHUB_GET_SETUP, () => {
    const config = getGitHubOAuthConfig()
    return {
      isConfigured: config !== null,
      clientId: config ? config.clientId.substring(0, 8) + '...' : null
    }
  })

  // ── Shell: Open External URL ──
  ipcMain.handle(IPC.SHELL_OPEN_EXTERNAL, (_event, url: string) => {
    // SECURITY: Only allow https and http URLs
    if (url.startsWith('https://') || url.startsWith('http://')) {
      shell.openExternal(url)
      return true
    }
    return false
  })
}
