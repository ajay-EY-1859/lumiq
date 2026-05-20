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
  CustomCommand,
  GrpcStatus,
  ToolApprovalRequest,
  WorkspaceTaskDefinition,
  SearchRequest,
  SearchResponse,
  GitStatusResult,
  DocumentSymbol,
  DefinitionResult
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
    clearMessages: (sessionId: string) => Promise<boolean>
    compactMessages: (sessionId: string, keepCount?: number) => Promise<boolean>
  }
  provider: {
    list: () => Promise<ProviderConfig[]>
    save: (config: Omit<ProviderConfig, 'id'> & Partial<Pick<ProviderConfig, 'id'>>) => Promise<void>
    delete: (provider: string) => Promise<boolean>
    test: (provider: string) => Promise<{ success: boolean; error?: string }>
    models: (provider: string) => Promise<{ id: string; label: string }[]>
  }
  settings: {
    get: () => Promise<AppSettings>
    set: (key: keyof AppSettings, value: any) => Promise<void>
    getWorkspace: (workspacePath: string) => Promise<Partial<AppSettings>>
    setWorkspace: (workspacePath: string, settings: Partial<AppSettings>) => Promise<void>
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
    save: (skill: Partial<CustomSkill> & Pick<CustomSkill, 'name' | 'promptTemplate'>) => Promise<CustomSkill>
    delete: (id: string) => Promise<boolean>
    import: (filePath: string) => Promise<CustomSkill>
    importFolder: (folderPath: string) => Promise<number>
  }
  command: {
    list: () => Promise<CustomCommand[]>
    save: (cmd: Partial<CustomCommand> & Pick<CustomCommand, 'name' | 'command'>) => Promise<CustomCommand>
    delete: (id: string) => Promise<boolean>
    importFolder: (folderPath: string) => Promise<number>
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
    rename: (oldPath: string, newPath: string) => Promise<boolean>
    delete: (targetPath: string) => Promise<boolean>
    mkdir: (dirPath: string) => Promise<boolean>
    onFileModified: (callback: (filePath: string) => void) => () => void
  }
  task: {
    run: (name: string, command: string, args: string[], cwd: string) => Promise<string>
    stop: (taskId: string) => Promise<void>
    stdin: (taskId: string, input: string) => Promise<void>
    listDefinitions: (workspacePath: string) => Promise<WorkspaceTaskDefinition[]>
    syncWorkspace: (workspacePath: string) => Promise<WorkspaceTaskDefinition[]>
    saveDefinition: (definition: Omit<WorkspaceTaskDefinition, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<WorkspaceTaskDefinition>
    deleteDefinition: (workspacePath: string, name: string) => Promise<boolean>
    onOutput: (callback: (taskId: string, data: string, type: 'stdout' | 'stderr' | 'system') => void) => () => void
    onExit: (callback: (taskId: string, code: number | null) => void) => () => void
  }
  editDecision: {
    record: (decision: Omit<EditDecision, 'id' | 'createdAt'>) => Promise<EditDecision>
    list: (sessionId: string) => Promise<EditDecision[]>
  }
  search: {
    files: (request: SearchRequest) => Promise<SearchResponse>
  }
  lsp: {
    getDocumentSymbols: (filePath: string) => Promise<DocumentSymbol[]>
    getWorkspaceSymbols: (workspacePath: string, query: string) => Promise<DocumentSymbol[]>
    getDefinition: (workspacePath: string, filePath: string, line: number, column: number) => Promise<DefinitionResult | null>
  }
  git: {
    status: (workspacePath: string) => Promise<GitStatusResult>
    branches: (workspacePath: string) => Promise<string[]>
    diffFile: (workspacePath: string, file: string, staged: boolean) => Promise<string>
    stage: (workspacePath: string, files: string[]) => Promise<boolean>
    unstage: (workspacePath: string, files: string[]) => Promise<boolean>
    discard: (workspacePath: string, files: string[]) => Promise<boolean>
    commit: (workspacePath: string, message: string) => Promise<boolean>
    getIgnored: (workspacePath: string) => Promise<string[]>
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
      ipcRenderer.invoke(IPC.SESSION_SET_WORKSPACE, { sessionId, workspacePath }),
    clearMessages: (sessionId: string) => 
      ipcRenderer.invoke(IPC.SESSION_CLEAR_MESSAGES, sessionId),
    compactMessages: (sessionId: string, keepCount?: number) => 
      ipcRenderer.invoke(IPC.SESSION_COMPACT_MESSAGES, { sessionId, keepCount })
  },

  // ── Providers ──
  provider: {
    list: () => ipcRenderer.invoke(IPC.PROVIDER_LIST),
    save: (config: Omit<ProviderConfig, 'id'> & Partial<Pick<ProviderConfig, 'id'>>) => ipcRenderer.invoke(IPC.PROVIDER_SAVE, config),
    delete: (provider: string) => ipcRenderer.invoke(IPC.PROVIDER_DELETE, provider),
    test: (provider: string) => ipcRenderer.invoke(IPC.PROVIDER_TEST, provider),
    models: (provider: string) => ipcRenderer.invoke(IPC.PROVIDER_MODELS, provider)
  },

  // ── Settings ──
  settings: {
    get: () => ipcRenderer.invoke(IPC.SETTINGS_GET),
    set: (key: keyof AppSettings, value: any) => ipcRenderer.invoke(IPC.SETTINGS_SET, { key, value }),
    getWorkspace: (workspacePath: string) => ipcRenderer.invoke(IPC.SETTINGS_WORKSPACE_GET, workspacePath),
    setWorkspace: (workspacePath: string, settings: Partial<AppSettings>) => ipcRenderer.invoke(IPC.SETTINGS_WORKSPACE_SET, { workspacePath, settings }),
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
    save: (skill: Partial<CustomSkill> & Pick<CustomSkill, 'name' | 'promptTemplate'>) =>
      ipcRenderer.invoke(IPC.SKILL_SAVE, skill),
    delete: (id: string) => ipcRenderer.invoke(IPC.SKILL_DELETE, id),
    import: (filePath: string) => ipcRenderer.invoke(IPC.SKILL_IMPORT, filePath),
    importFolder: (folderPath: string) => ipcRenderer.invoke(IPC.SKILL_IMPORT_FOLDER, folderPath)
  },

  command: {
    list: () => ipcRenderer.invoke(IPC.COMMAND_LIST),
    save: (cmd: Partial<CustomCommand> & Pick<CustomCommand, 'name' | 'command'>) =>
      ipcRenderer.invoke(IPC.COMMAND_SAVE, cmd),
    delete: (id: string) => ipcRenderer.invoke(IPC.COMMAND_DELETE, id),
    importFolder: (folderPath: string) => ipcRenderer.invoke(IPC.COMMAND_IMPORT_FOLDER, folderPath)
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
    rename: (oldPath: string, newPath: string) => ipcRenderer.invoke(IPC.FS_RENAME, { oldPath, newPath }),
    delete: (targetPath: string) => ipcRenderer.invoke(IPC.FS_DELETE, targetPath),
    mkdir: (dirPath: string) => ipcRenderer.invoke(IPC.FS_MKDIR, dirPath),
    onFileModified: (callback: (filePath: string) => void) => createListener(IPC.FS_FILE_MODIFIED, callback)
  },

  // ── Tasks ──
  task: {
    run: (name: string, command: string, args: string[], cwd: string) => ipcRenderer.invoke(IPC.TASK_RUN, { name, command, args, cwd }),
    stop: (taskId: string) => ipcRenderer.invoke(IPC.TASK_STOP, taskId),
    stdin: (taskId: string, input: string) => ipcRenderer.invoke(IPC.TASK_STDIN, { taskId, input }),
    listDefinitions: (workspacePath: string) => ipcRenderer.invoke(IPC.TASK_LIST_DEFINITIONS, workspacePath),
    syncWorkspace: (workspacePath: string) => ipcRenderer.invoke(IPC.TASK_SYNC_WORKSPACE, workspacePath),
    saveDefinition: (definition: Omit<WorkspaceTaskDefinition, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) =>
      ipcRenderer.invoke(IPC.TASK_SAVE_DEFINITION, definition),
    deleteDefinition: (workspacePath: string, name: string) => ipcRenderer.invoke(IPC.TASK_DELETE_DEFINITION, { workspacePath, name }),
    onOutput: (cb: (taskId: string, data: string, type: 'stdout' | 'stderr' | 'system') => void) => createListener(IPC.TASK_OUTPUT, cb),
    onExit: (cb: (taskId: string, code: number | null) => void) => createListener(IPC.TASK_EXIT, cb)
  },

  editDecision: {
    record: (decision: Omit<EditDecision, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke(IPC.EDIT_DECISION_RECORD, decision),
    list: (sessionId: string) => ipcRenderer.invoke(IPC.EDIT_DECISION_LIST, sessionId)
  },

  // ── Search ──
  search: {
    files: (request: SearchRequest) => ipcRenderer.invoke(IPC.SEARCH_FILES, request)
  },

  // ── LSP (Code Intelligence) ──
  lsp: {
    getDocumentSymbols: (filePath: string) => ipcRenderer.invoke(IPC.LSP_DOCUMENT_SYMBOLS, filePath),
    getWorkspaceSymbols: (workspacePath: string, query: string) => ipcRenderer.invoke(IPC.LSP_WORKSPACE_SYMBOLS, { workspacePath, query }),
    getDefinition: (workspacePath: string, filePath: string, line: number, column: number) => ipcRenderer.invoke(IPC.LSP_DEFINITION, { workspacePath, filePath, line, column })
  },

  // ── Git ──
  git: {
    status: (workspacePath: string) => ipcRenderer.invoke(IPC.GIT_STATUS, workspacePath),
    branches: (workspacePath: string) => ipcRenderer.invoke(IPC.GIT_BRANCH, workspacePath),
    diffFile: (workspacePath: string, file: string, staged: boolean) =>
      ipcRenderer.invoke(IPC.GIT_DIFF_FILE, { workspacePath, file, staged }),
    stage: (workspacePath: string, files: string[]) =>
      ipcRenderer.invoke(IPC.GIT_STAGE, { workspacePath, files }),
    unstage: (workspacePath: string, files: string[]) =>
      ipcRenderer.invoke(IPC.GIT_UNSTAGE, { workspacePath, files }),
    discard: (workspacePath: string, files: string[]) =>
      ipcRenderer.invoke(IPC.GIT_DISCARD, { workspacePath, files }),
    commit: (workspacePath: string, message: string) =>
      ipcRenderer.invoke(IPC.GIT_COMMIT, { workspacePath, message }),
    getIgnored: (workspacePath: string) =>
      ipcRenderer.invoke(IPC.GIT_IGNORED, workspacePath)
  },

  // ── Menu Events ──
  onMenuNewSession: (cb: () => void) => createListener('menu:new-session', cb),
  onMenuSettings: (cb: () => void) => createListener('menu:settings', cb),
  onMenuAbout: (cb: () => void) => createListener('menu:about', cb),
  onMenuToggleSidebar: (cb: () => void) => createListener('menu:toggle-sidebar', cb)
} satisfies ElectronAPI)
