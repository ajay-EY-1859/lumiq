// ═══════════════════════════════════════════════════════════════════
// Lumiq — Preload Script (Secure IPC Bridge)
// SECURITY: This is the ONLY bridge between renderer and main.
// Only whitelisted IPC channels are exposed. The renderer process
// has NO direct access to Node.js APIs, Electron APIs, or the
// file system. All communication goes through this bridge.
// ═══════════════════════════════════════════════════════════════════

import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'

// Type for the exposed API
export interface ElectronAPI {
  chat: {
    send: (message: string, sessionId: string, provider: string, model: string, systemPrompt?: string) => Promise<void>
    cancel: () => Promise<void>
    onChunk: (callback: (chunk: string) => void) => () => void
    onEnd: (callback: (data: { content: string; tokensUsed: number }) => void) => () => void
    onError: (callback: (error: string) => void) => () => void
  }
  tool: {
    onApprovalRequest: (callback: (request: unknown) => void) => () => void
    respond: (requestId: string, approved: boolean, alwaysAllow: boolean) => Promise<void>
    onResult: (callback: (result: unknown) => void) => () => void
  }
  session: {
    list: () => Promise<unknown[]>
    load: (sessionId: string) => Promise<unknown[]>
    create: (provider: string, model: string, agentId?: string) => Promise<unknown>
    delete: (sessionId: string) => Promise<boolean>
    rename: (sessionId: string, title: string) => Promise<void>
    export: (sessionId: string, format: 'json' | 'markdown') => Promise<string>
  }
  provider: {
    list: () => Promise<unknown[]>
    save: (config: unknown) => Promise<void>
    delete: (provider: string) => Promise<boolean>
    test: (provider: string) => Promise<{ success: boolean; error?: string }>
    models: (provider: string) => Promise<string[]>
  }
  settings: {
    get: () => Promise<unknown>
    set: (key: string, value: string) => Promise<void>
    getTool: () => Promise<unknown[]>
    setTool: (settings: unknown[]) => Promise<void>
  }
  agent: {
    list: () => Promise<unknown[]>
    save: (agent: unknown) => Promise<unknown>
    delete: (agentId: string) => Promise<boolean>
  }
  auth: {
    googleLogin: () => Promise<{ isLoggedIn: boolean; email?: string; error?: string }>
    googleLogout: () => Promise<{ isLoggedIn: boolean }>
    googleStatus: () => Promise<{ isLoggedIn: boolean; email?: string; expiresAt?: number }>
    googleSetup: (config: { clientId: string; clientSecret: string }) => Promise<{ success: boolean }>
    googleGetSetup: () => Promise<{ isConfigured: boolean; clientId?: string | null }>
  }
  shell: {
    openExternal: (url: string) => Promise<boolean>
  }
  window: {
    minimize: () => void
    maximize: () => void
    close: () => void
    isMaximized: () => Promise<boolean>
  }
  // Menu event listeners
  onMenuNewSession: (callback: () => void) => () => void
  onMenuSettings: (callback: () => void) => () => void
  onMenuToggleSidebar: (callback: () => void) => () => void
}

// Helper to create safe IPC listener with cleanup
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function createListener(channel: string, callback: (...args: any[]) => void): () => void {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handler = (_event: Electron.IpcRendererEvent, ...args: any[]): void => {
    callback(...args)
  }
  ipcRenderer.on(channel, handler)
  // Return cleanup function to prevent memory leaks
  return () => {
    ipcRenderer.removeListener(channel, handler)
  }
}

// ─── Expose API to renderer ────────────────────────────────────────
contextBridge.exposeInMainWorld('electronAPI', {
  // ── Chat ──
  chat: {
    send: (message: string, sessionId: string, provider: string, model: string, systemPrompt?: string) =>
      ipcRenderer.invoke(IPC.CHAT_SEND, { message, sessionId, provider, model, systemPrompt }),
    cancel: () => ipcRenderer.invoke(IPC.CHAT_CANCEL),
    onChunk: (cb: (chunk: string) => void) => createListener(IPC.CHAT_STREAM_CHUNK, cb),
    onEnd: (cb: (data: { content: string; tokensUsed: number }) => void) => createListener(IPC.CHAT_STREAM_END, cb),
    onError: (cb: (error: string) => void) => createListener(IPC.CHAT_ERROR, cb)
  },

  // ── Tool Approval ──
  tool: {
    onApprovalRequest: (cb: (request: unknown) => void) =>
      createListener(IPC.TOOL_APPROVAL_REQUEST, cb),
    respond: (requestId: string, approved: boolean, alwaysAllow: boolean) =>
      ipcRenderer.invoke(IPC.TOOL_APPROVAL_RESPONSE, { requestId, approved, alwaysAllow }),
    onResult: (cb: (result: unknown) => void) =>
      createListener(IPC.TOOL_RESULT, cb)
  },

  // ── Sessions ──
  session: {
    list: () => ipcRenderer.invoke(IPC.SESSION_LIST),
    load: (sessionId: string) => ipcRenderer.invoke(IPC.SESSION_LOAD, sessionId),
    create: (provider: string, model: string, agentId?: string) =>
      ipcRenderer.invoke(IPC.SESSION_CREATE, { provider, model, agentId }),
    delete: (sessionId: string) => ipcRenderer.invoke(IPC.SESSION_DELETE, sessionId),
    rename: (sessionId: string, title: string) =>
      ipcRenderer.invoke(IPC.SESSION_RENAME, { sessionId, title }),
    export: (sessionId: string, format: 'json' | 'markdown') =>
      ipcRenderer.invoke(IPC.SESSION_EXPORT, { sessionId, format })
  },

  // ── Providers ──
  provider: {
    list: () => ipcRenderer.invoke(IPC.PROVIDER_LIST),
    save: (config: unknown) => ipcRenderer.invoke(IPC.PROVIDER_SAVE, config),
    delete: (provider: string) => ipcRenderer.invoke(IPC.PROVIDER_DELETE, provider),
    test: (provider: string) => ipcRenderer.invoke(IPC.PROVIDER_TEST, provider),
    models: (provider: string) => ipcRenderer.invoke(IPC.PROVIDER_MODELS, provider)
  },

  // ── Settings ──
  settings: {
    get: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
    set: (key: string, value: string) => ipcRenderer.invoke(IPC.SETTINGS_SET, { key, value }),
    getTool: () => ipcRenderer.invoke(IPC.SETTINGS_GET_TOOL),
    setTool: (settings: unknown[]) => ipcRenderer.invoke(IPC.SETTINGS_SET_TOOL, settings)
  },

  // ── Agents ──
  agent: {
    list: () => ipcRenderer.invoke(IPC.AGENT_LIST),
    save: (agent: unknown) => ipcRenderer.invoke(IPC.AGENT_SAVE, agent),
    delete: (agentId: string) => ipcRenderer.invoke(IPC.AGENT_DELETE, agentId)
  },

  // ── Auth (Google OAuth) ──
  auth: {
    googleLogin: () => ipcRenderer.invoke(IPC.AUTH_GOOGLE_LOGIN),
    googleLogout: () => ipcRenderer.invoke(IPC.AUTH_GOOGLE_LOGOUT),
    googleStatus: () => ipcRenderer.invoke(IPC.AUTH_GOOGLE_STATUS),
    googleSetup: (config: { clientId: string; clientSecret: string }) =>
      ipcRenderer.invoke(IPC.AUTH_GOOGLE_SETUP, config),
    googleGetSetup: () => ipcRenderer.invoke(IPC.AUTH_GOOGLE_GET_SETUP)
  },

  // ── Shell ──
  shell: {
    openExternal: (url: string) => ipcRenderer.invoke(IPC.SHELL_OPEN_EXTERNAL, url)
  },

  // ── Window Controls (for custom titlebar) ──
  window: {
    minimize: () => ipcRenderer.send('window:minimize'),
    maximize: () => ipcRenderer.send('window:maximize'),
    close: () => ipcRenderer.send('window:close'),
    isMaximized: () => ipcRenderer.invoke('window:is-maximized')
  },

  // ── Menu Events ──
  onMenuNewSession: (cb: () => void) => createListener('menu:new-session', cb),
  onMenuSettings: (cb: () => void) => createListener('menu:settings', cb),
  onMenuToggleSidebar: (cb: () => void) => createListener('menu:toggle-sidebar', cb)
} satisfies ElectronAPI)
