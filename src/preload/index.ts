// ═══════════════════════════════════════════════════════════════════
// Lumiq — Preload Script (Secure IPC Bridge)
// SECURITY: This is the ONLY bridge between renderer and main.
// Only whitelisted IPC channels are exposed. The renderer process
// has NO direct access to Node.js APIs, Electron APIs, or the
// file system. All communication goes through this bridge.
// ═══════════════════════════════════════════════════════════════════

import { contextBridge, ipcRenderer } from 'electron'
import { IPC } from '../shared/types'
import type { 
  Message, 
  Session, 
  ProviderConfig, 
  AppSettings, 
  ToolSettings, 
  Agent, 
  McpServer, 
  AgentRoute, 
  CustomSkill, 
  GrpcStatus,
  ToolApprovalRequest
} from '../shared/types'

// Type for the exposed API
export interface ElectronAPI {
  chat: {
    send: (message: string, sessionId: string, provider: string, model: string, systemPrompt?: string, taskMode?: string) => Promise<void>
    cancel: () => Promise<void>
    onChunk: (callback: (chunk: string) => void) => () => void
    onEnd: (callback: (data: { content: string; tokensUsed: number }) => void) => () => void
    onError: (callback: (error: string) => void) => () => void
  }
  tool: {
    onApprovalRequest: (callback: (request: ToolApprovalRequest) => void) => () => void
    respond: (requestId: string, approved: boolean, alwaysAllow: boolean) => Promise<void>
    onResult: (callback: (result: { toolName: string; result: string }) => void) => () => void
  }
  session: {
    list: () => Promise<Session[]>
    load: (sessionId: string) => Promise<{ session: Session; messages: Message[] }>
    create: (provider: string, model: string, agentId?: string) => Promise<Session>
    delete: (sessionId: string) => Promise<boolean>
    rename: (sessionId: string, title: string) => Promise<void>
    export: (sessionId: string, format: 'json' | 'markdown') => Promise<string>
    setWorkspace: (sessionId: string, workspacePath: string | null) => Promise<void>
  }
  provider: {
    list: () => Promise<ProviderConfig[]>
    save: (config: ProviderConfig) => Promise<void>
    delete: (provider: string) => Promise<boolean>
    test: (provider: string) => Promise<{ success: boolean; error?: string }>
    models: (provider: string) => Promise<{ id: string; label: string }[]>
  }
  settings: {
    get: () => Promise<AppSettings>
    set: (key: keyof AppSettings, value: any) => Promise<void>
    getTool: () => Promise<ToolSettings[]>
    setTool: (settings: ToolSettings[]) => Promise<void>
    getPermissionMode: () => Promise<string>
    setPermissionMode: (mode: string) => Promise<void>
  }
  agent: {
    list: () => Promise<Agent[]>
    save: (agent: Partial<Agent>) => Promise<Agent>
    delete: (agentId: string) => Promise<boolean>
  }
  mcp: {
    list: () => Promise<McpServer[]>
    save: (server: Partial<McpServer>) => Promise<McpServer>
    delete: (id: string) => Promise<boolean>
    start: (id: string) => Promise<McpServer>
    stop: (id: string) => Promise<McpServer>
    test: (id: string) => Promise<{ success: boolean; error?: string }>
    import: (filePath: string) => Promise<McpServer[]>
    onStatusChange: (callback: (change: { serverId: string; status: string; lastError?: string }) => void) => () => void
  }
  routing: {
    list: () => Promise<AgentRoute[]>
    save: (route: Partial<AgentRoute>) => Promise<AgentRoute>
    delete: (id: string) => Promise<boolean>
  }
  skill: {
    list: () => Promise<CustomSkill[]>
    save: (skill: Partial<CustomSkill>) => Promise<CustomSkill>
    delete: (id: string) => Promise<boolean>
    import: (filePath: string) => Promise<CustomSkill>
  }
  grpc: {
    start: (port?: number) => Promise<GrpcStatus>
    stop: () => Promise<GrpcStatus>
    status: () => Promise<GrpcStatus>
    onClientConnected: (callback: (status: { connected: boolean; clientId?: string }) => void) => () => void
    onActionRequired: (callback: (action: any) => void) => () => void
  }
  auth: {
    googleLogin: () => Promise<{ isLoggedIn: boolean; email?: string; error?: string }>
    googleLogout: () => Promise<{ isLoggedIn: boolean }>
    googleStatus: () => Promise<{ isLoggedIn: boolean; email?: string; expiresAt?: number }>
    googleSetup: (config: { clientId: string; clientSecret: string }) => Promise<{ success: boolean }>
    googleGetSetup: () => Promise<{ isConfigured: boolean; clientId?: string | null }>
    githubLogin: () => Promise<{ isLoggedIn: boolean; email?: string; error?: string }>
    githubLogout: () => Promise<{ isLoggedIn: boolean }>
    githubStatus: () => Promise<{ isLoggedIn: boolean; email?: string; expiresAt?: number }>
    githubSetup: (config: { clientId: string; clientSecret: string }) => Promise<{ success: boolean }>
    githubGetSetup: () => Promise<{ isConfigured: boolean; clientId?: string | null }>
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
  dialog: {
    showOpenDialog: (options: any) => Promise<{ canceled: boolean; filePaths: string[] }>
  }
  fs: {
    listDir: (dirPath: string) => Promise<{ name: string; isDirectory: boolean }[]>
    readFile: (filePath: string) => Promise<string>
    writeFile: (filePath: string, content: string) => Promise<boolean>
    onFileModified: (callback: (filePath: string) => void) => () => void
  }
  task: {
    run: (name: string, command: string, args: string[], cwd: string) => Promise<string>
    stop: (taskId: string) => Promise<void>
    onOutput: (callback: (taskId: string, data: string, type: 'stdout' | 'stderr' | 'system') => void) => () => void
    onExit: (callback: (taskId: string, code: number | null) => void) => () => void
  }
  // Menu event listeners
  onMenuNewSession: (callback: () => void) => () => void
  onMenuSettings: (callback: () => void) => () => void
  onMenuAbout: (callback: () => void) => () => void
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
    send: (message: string, sessionId: string, provider: string, model: string, systemPrompt?: string, taskMode?: string) =>
      ipcRenderer.invoke(IPC.CHAT_SEND, { message, sessionId, provider, model, systemPrompt, taskMode }),
    cancel: () => ipcRenderer.invoke(IPC.CHAT_CANCEL),
    onChunk: (cb: (chunk: string) => void) => createListener(IPC.CHAT_STREAM_CHUNK, cb),
    onEnd: (cb: (data: { content: string; tokensUsed: number }) => void) => createListener(IPC.CHAT_STREAM_END, cb),
    onError: (cb: (error: string) => void) => createListener(IPC.CHAT_ERROR, cb)
  },

  // ── Tool Approval ──
  tool: {
    onApprovalRequest: (cb: (request: ToolApprovalRequest) => void) =>
      createListener(IPC.TOOL_APPROVAL_REQUEST, cb),
    respond: (requestId: string, approved: boolean, alwaysAllow: boolean) =>
      ipcRenderer.invoke(IPC.TOOL_APPROVAL_RESPONSE, { requestId, approved, alwaysAllow }),
    onResult: (cb: (result: { toolName: string; result: string }) => void) =>
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
      ipcRenderer.invoke(IPC.SESSION_EXPORT, { sessionId, format }),
    setWorkspace: (sessionId: string, workspacePath: string | null) =>
      ipcRenderer.invoke(IPC.SESSION_SET_WORKSPACE, { sessionId, workspacePath })
  },

  // ── Providers ──
  provider: {
    list: () => ipcRenderer.invoke(IPC.PROVIDER_LIST),
    save: (config: ProviderConfig) => ipcRenderer.invoke(IPC.PROVIDER_SAVE, config),
    delete: (provider: string) => ipcRenderer.invoke(IPC.PROVIDER_DELETE, provider),
    test: (provider: string) => ipcRenderer.invoke(IPC.PROVIDER_TEST, provider),
    models: (provider: string) => ipcRenderer.invoke(IPC.PROVIDER_MODELS, provider)
  },

  // ── Settings ──
  settings: {
    get: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
    set: (key: keyof AppSettings, value: any) => ipcRenderer.invoke(IPC.SETTINGS_SET, { key, value }),
    getTool: () => ipcRenderer.invoke(IPC.SETTINGS_GET_TOOL),
    setTool: (settings: ToolSettings[]) => ipcRenderer.invoke(IPC.SETTINGS_SET_TOOL, settings),
    getPermissionMode: () => ipcRenderer.invoke(IPC.PERMISSION_MODE_GET),
    setPermissionMode: (mode: string) => ipcRenderer.invoke(IPC.PERMISSION_MODE_SET, mode)
  },

  // ── Agents ──
  agent: {
    list: () => ipcRenderer.invoke(IPC.AGENT_LIST),
    save: (agent: Partial<Agent>) => ipcRenderer.invoke(IPC.AGENT_SAVE, agent),
    delete: (agentId: string) => ipcRenderer.invoke(IPC.AGENT_DELETE, agentId)
  },

  mcp: {
    list: () => ipcRenderer.invoke(IPC.MCP_LIST),
    save: (server: Partial<McpServer>) => ipcRenderer.invoke(IPC.MCP_SAVE, server),
    delete: (id: string) => ipcRenderer.invoke(IPC.MCP_DELETE, id),
    start: (id: string) => ipcRenderer.invoke(IPC.MCP_START, id),
    stop: (id: string) => ipcRenderer.invoke(IPC.MCP_STOP, id),
    test: (id: string) => ipcRenderer.invoke(IPC.MCP_TEST, id),
    import: (filePath: string) => ipcRenderer.invoke(IPC.MCP_IMPORT, filePath),
    onStatusChange: (cb: (change: { serverId: string; status: string; lastError?: string }) => void) => createListener(IPC.MCP_STATUS_CHANGE, cb)
  },

  routing: {
    list: () => ipcRenderer.invoke(IPC.ROUTING_LIST),
    save: (route: Partial<AgentRoute>) => ipcRenderer.invoke(IPC.ROUTING_SAVE, route),
    delete: (id: string) => ipcRenderer.invoke(IPC.ROUTING_DELETE, id)
  },

  skill: {
    list: () => ipcRenderer.invoke(IPC.SKILL_LIST),
    save: (skill: Partial<CustomSkill>) => ipcRenderer.invoke(IPC.SKILL_SAVE, skill),
    delete: (id: string) => ipcRenderer.invoke(IPC.SKILL_DELETE, id),
    import: (filePath: string) => ipcRenderer.invoke(IPC.SKILL_IMPORT, filePath)
  },

  grpc: {
    start: (port?: number) => ipcRenderer.invoke(IPC.GRPC_START, port),
    stop: () => ipcRenderer.invoke(IPC.GRPC_STOP),
    status: () => ipcRenderer.invoke(IPC.GRPC_STATUS),
    onClientConnected: (cb: (status: { connected: boolean; clientId?: string }) => void) => createListener(IPC.GRPC_CLIENT_CONNECTED, cb),
    onActionRequired: (cb: (action: any) => void) => createListener(IPC.GRPC_ACTION_REQUIRED, cb)
  },

  // ── Auth (Google OAuth) ──
  auth: {
    googleLogin: () => ipcRenderer.invoke(IPC.AUTH_GOOGLE_LOGIN),
    googleLogout: () => ipcRenderer.invoke(IPC.AUTH_GOOGLE_LOGOUT),
    googleStatus: () => ipcRenderer.invoke(IPC.AUTH_GOOGLE_STATUS),
    googleSetup: (config: { clientId: string; clientSecret: string }) =>
      ipcRenderer.invoke(IPC.AUTH_GOOGLE_SETUP, config),
    googleGetSetup: () => ipcRenderer.invoke(IPC.AUTH_GOOGLE_GET_SETUP),
    githubLogin: () => ipcRenderer.invoke(IPC.AUTH_GITHUB_LOGIN),
    githubLogout: () => ipcRenderer.invoke(IPC.AUTH_GITHUB_LOGOUT),
    githubStatus: () => ipcRenderer.invoke(IPC.AUTH_GITHUB_STATUS),
    githubSetup: (config: { clientId: string; clientSecret: string }) =>
      ipcRenderer.invoke(IPC.AUTH_GITHUB_SETUP, config),
    githubGetSetup: () => ipcRenderer.invoke(IPC.AUTH_GITHUB_GET_SETUP)
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

  // ── Dialog ──
  dialog: {
    showOpenDialog: (options: any) => ipcRenderer.invoke(IPC.DIALOG_SHOW_OPEN, options)
  },

  // ── File System ──
  fs: {
    listDir: (dirPath: string) => ipcRenderer.invoke(IPC.FS_LIST_DIR, dirPath),
    readFile: (filePath: string) => ipcRenderer.invoke(IPC.FS_READ_FILE, filePath),
    writeFile: (filePath: string, content: string) => ipcRenderer.invoke(IPC.FS_WRITE_FILE, { filePath, content }),
    onFileModified: (cb: (filePath: string) => void) => createListener(IPC.FS_FILE_MODIFIED, cb)
  },

  // ── Tasks ──
  task: {
    run: (name: string, command: string, args: string[], cwd: string) => ipcRenderer.invoke(IPC.TASK_RUN, { name, command, args, cwd }),
    stop: (taskId: string) => ipcRenderer.invoke(IPC.TASK_STOP, taskId),
    onOutput: (cb: (taskId: string, data: string, type: 'stdout' | 'stderr' | 'system') => void) => createListener(IPC.TASK_OUTPUT, cb),
    onExit: (cb: (taskId: string, code: number | null) => void) => createListener(IPC.TASK_EXIT, cb)
  },

  // ── Menu Events ──
  onMenuNewSession: (cb: () => void) => createListener('menu:new-session', cb),
  onMenuSettings: (cb: () => void) => createListener('menu:settings', cb),
  onMenuAbout: (cb: () => void) => createListener('menu:about', cb),
  onMenuToggleSidebar: (cb: () => void) => createListener('menu:toggle-sidebar', cb)
} satisfies ElectronAPI)
