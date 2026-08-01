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
  InstalledPlugin,
  PluginMarketplaceItem,
  GrpcStatus,
  ToolApprovalRequest,
  WorkspaceTaskDefinition,
  TaskSelfHealSuggestion,
  EditDecision,
  SearchRequest,
  SearchResponse,
  SemanticSearchRequest,
  SemanticSearchResponse,
  SemanticIndexStatus,
  GitStatusResult,
  DocumentSymbol,
  DefinitionResult,
  ReferenceResult,
  SelfHealingAttempt,
  ComposerTaskStatus,
  DapState,
  CollaborationState,
  TimelineAction,
  HoverResult
} from '../shared/types'
import type { DBTableInfo, DBColumnInfo, TestRunResult } from '../shared/services'

// Type for the exposed API
export interface ElectronAPI {
  chat: {
    send: (message: string, sessionId: string, provider: string, model: string, systemPrompt?: string, taskMode?: string) => Promise<void>
    cancel: () => Promise<void>
    onChunk: (callback: (chunk: string) => void) => () => void
    onEnd: (callback: (data: { content: string; tokensUsed: number }) => void) => () => void
    onError: (callback: (error: string) => void) => () => void
    onMessageUpdated: (callback: () => void) => () => void
    predictOneShot: (prompt: string, systemPrompt: string, provider: string, model: string) => Promise<string>
  }
  autocomplete: {
    predict: (prefix: string, suffix: string, provider: string, model: string) => Promise<string>
  }
  tool: {
    onApprovalRequest: (callback: (request: ToolApprovalRequest) => void) => () => void
    respond: (requestId: string, approved: boolean, alwaysAllow: boolean) => Promise<void>
    onResult: (callback: (result: { toolName: string; result: string }) => void) => () => void
    onActivity: (callback: (activity: { toolName: string; phase: 'running' | 'completed'; message?: string }) => void) => () => void
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
    deleteMessagesFrom: (sessionId: string, messageId: string) => Promise<boolean>
  }
  provider: {
    list: () => Promise<ProviderConfig[]>
    save: (config: Omit<ProviderConfig, 'id'> & Partial<Pick<ProviderConfig, 'id'>>) => Promise<void>
    delete: (provider: string) => Promise<boolean>
    test: (provider: string, config?: any) => Promise<{ success: boolean; error?: string }>
    models: (provider: string, config?: any) => Promise<{ id: string; label: string }[]>
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
    listTraces: () => Promise<Array<{ name: string; sizeBytes: number; createdAt: string }>>
    getCostsSummary: () => Promise<any>
  }
  agent: {
    list: () => Promise<Agent[]>
    save: (agent: Partial<Agent>) => Promise<Agent>
    delete: (agentId: string) => Promise<boolean>
    getEditHistory: (sessionId?: string) => Promise<any[]>
    undoEdit: (snapshotId: string) => Promise<boolean>
    redoEdit: (snapshotId: string) => Promise<boolean>
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
    onLog: (callback: (entry: { serverId: string; type: 'stdout' | 'stderr' | 'system'; message: string }) => void) => () => void
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
  plugin: {
    marketplace: () => Promise<PluginMarketplaceItem[]>
    installed: () => Promise<InstalledPlugin[]>
    install: (pluginId: string) => Promise<InstalledPlugin>
    uninstall: (pluginId: string) => Promise<boolean>
    import: (folderPath: string) => Promise<InstalledPlugin>
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
    run: (taskId: string, name: string, command: string, args: string[], cwd: string) => Promise<string>
    stop: (taskId: string) => Promise<void>
    stdin: (taskId: string, input: string) => Promise<void>
    listDefinitions: (workspacePath: string) => Promise<WorkspaceTaskDefinition[]>
    syncWorkspace: (workspacePath: string) => Promise<WorkspaceTaskDefinition[]>
    saveDefinition: (definition: Omit<WorkspaceTaskDefinition, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) => Promise<WorkspaceTaskDefinition>
    deleteDefinition: (workspacePath: string, name: string) => Promise<boolean>
    onOutput: (callback: (taskId: string, data: string, type: 'stdout' | 'stderr' | 'system') => void) => () => void
    onExit: (callback: (taskId: string, code: number | null) => void) => () => void
    onSelfHeal: (callback: (suggestion: TaskSelfHealSuggestion) => void) => () => void
  }
  selfHealing: {
    getActive: (sessionId: string) => Promise<SelfHealingAttempt | null>
    apply: (attemptId: string) => Promise<{ success: boolean; error?: string }>
    decline: (attemptId: string) => Promise<void>
    refine: (attemptId: string) => Promise<void>
    onFailureDetected: (callback: (attempt: SelfHealingAttempt) => void) => () => void
    onProposalGenerated: (callback: (attempt: SelfHealingAttempt) => void) => () => void
  }
  editDecision: {
    record: (decision: Omit<EditDecision, 'id' | 'createdAt'>) => Promise<EditDecision>
    list: (sessionId: string) => Promise<EditDecision[]>
  }
  search: {
    files: (request: SearchRequest) => Promise<SearchResponse>
    sessions: (query: string) => Promise<any[]>
  }
  semantic: {
    search: (request: SemanticSearchRequest) => Promise<SemanticSearchResponse>
    index: (workspacePath: string, force?: boolean) => Promise<SemanticIndexStatus>
    status: (workspacePath: string) => Promise<SemanticIndexStatus>
  }
  lsp: {
    getDocumentSymbols: (filePath: string) => Promise<DocumentSymbol[]>
    getWorkspaceSymbols: (workspacePath: string, query: string) => Promise<DocumentSymbol[]>
    getDefinition: (workspacePath: string, filePath: string, line: number, column: number, content?: string) => Promise<DefinitionResult | null>
    getReferences: (workspacePath: string, filePath: string, line: number, column: number, content?: string) => Promise<ReferenceResult[]>
    getIndexStats: () => Promise<{ files: number; symbols: number; references: number }>
    startServer: (languageId: string, workspacePath: string) => Promise<boolean>
    stopServer: (languageId: string) => Promise<void>
    getHover: (filePath: string, line: number, column: number, content?: string) => Promise<HoverResult | null>
    getCompletion: (filePath: string, line: number, column: number, content?: string) => Promise<any[]>
    getSignatureHelp: (filePath: string, line: number, column: number, content?: string) => Promise<any | null>
    onPublishDiagnostics: (callback: (data: { languageId: string; uri: string; diagnostics: any[] }) => void) => () => void
  }
  collaboration: {
    createRoom: (roomName: string, passcode?: string) => Promise<{ roomId: string; inviteCode: string }>
    joinRoom: (inviteCode: string, user: string) => Promise<boolean>
    leaveRoom: () => Promise<void>
    getRoomState: () => Promise<CollaborationState>
    broadcastCursor: (filePath: string, line: number, column: number) => void
    sendChangePacket: (filePath: string, changeText: string, range: any) => void
    getTimeline: () => Promise<TimelineAction[]>
    logTimelineAction: (user: string, action: string) => void
    encrypt: (payload: string) => Promise<string>
    decrypt: (cipher: string) => Promise<string>
    onStateUpdate: (callback: (state: CollaborationState) => void) => () => void
    onCursorSync: (callback: (presence: { user: string; filePath: string; line: number; column: number }) => void) => () => void
    onChangePacket: (callback: (packet: { user: string; filePath: string; changeText: string; range: any }) => void) => () => void
    onTimelineUpdate: (callback: (action: TimelineAction) => void) => () => void
  }
  composer: {
    start: (goal: string, workspacePath: string) => Promise<void>
    cancel: () => Promise<void>
    approve: () => Promise<void>
    reject: () => Promise<void>
    getDiffPreview: (filePath: string) => Promise<{ original: string; proposed: string }>
    onStatusUpdate: (callback: (status: ComposerTaskStatus) => void) => () => void
  }
  dap: {
    start: (port: number, scriptPath: string) => Promise<void>
    stop: () => Promise<void>
    toggleBreakpoint: (filePath: string, line: number) => Promise<void>
    stepOver: () => Promise<void>
    stepInto: () => Promise<void>
    stepOut: () => Promise<void>
    continue: () => Promise<void>
    explainState: (goal: string) => Promise<string>
    onStateUpdate: (callback: (state: DapState) => void) => () => void
  }
  sandbox: {
    start: (workspacePath: string) => Promise<any>
    stop: (serverId: string) => Promise<boolean>
    inspectStyles: (serverId: string, selector: string) => Promise<Record<string, string>>
    updateStyle: (selector: string, property: string, value: string) => Promise<boolean>
    getDomTree: (workspacePath: string, htmlContent?: string) => Promise<any>
    getConsoleLogs: () => Promise<any[]>
    takeHeapSnapshot: () => Promise<{ totalJSHeapSize: number; usedJSHeapSize: number; timestamp: number }>
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
  ipc: {
    call: (channel: string, method: string, args: any[]) => Promise<any>
  }
  database: {
    getTables: () => Promise<DBTableInfo[]>
    getTableSchema: (tableName: string) => Promise<DBColumnInfo[]>
    executeQuery: (sql: string) => Promise<any[]>
    generateSchemaDeclaration: (format: 'prisma' | 'drizzle') => Promise<string>
    generateMockData: (tableName: string, count: number) => Promise<any[]>
  }
  test: {
    generateTestSuite: (filePath: string, testContent: string) => Promise<string>
    runTestSuite: (testFilePath: string) => Promise<TestRunResult>
    autonomousRepairLoop: (testFilePath: string, sourceFilePath: string, maxRetries?: number) => Promise<boolean>
  }
  deploy: {
    generateIaC: (workspacePath: string, target: 'docker' | 'serverless') => Promise<{ filePath: string; content: string }>
    verifyPreDeployBuild: (workspacePath: string) => Promise<{ success: boolean; log: string }>
  }
  wiki: {
    analyzeCodebase: (workspacePath: string) => Promise<{ filesParsed: number; importsMap: Record<string, string[]> }>
    generateMermaidDiagram: (workspacePath: string) => Promise<string>
    writeWikiFile: (workspacePath: string) => Promise<string>
  }
  clipboard: {
    writeText: (text: string) => Promise<void>
    readText: () => Promise<string>
    saveImage: () => Promise<string | null>
  }
  // Menu event listeners
  onMenuNewSession: (callback: () => void) => () => void
  onMenuSettings: (callback: () => void) => () => void
  onMenuAbout: (callback: () => void) => () => void
  onMenuToggleSidebar: (callback: () => void) => () => void
}

// Helper to create safe IPC listener with cleanup
function createListener(channel: string, callback: (...args: any[]) => void): () => void {
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
    onError: (cb: (error: string) => void) => createListener(IPC.CHAT_ERROR, cb),
    onMessageUpdated: (cb: () => void) => createListener(IPC.MESSAGE_UPDATED, cb),
    predictOneShot: (prompt: string, systemPrompt: string, provider: string, model: string) =>
      ipcRenderer.invoke(IPC.CHAT_PREDICT_ONE_SHOT, { prompt, systemPrompt, provider, model })
  },

  // ── Autocomplete ──
  autocomplete: {
    predict: (prefix: string, suffix: string, provider: string, model: string) =>
      ipcRenderer.invoke(IPC.AUTOCOMPLETE_PREDICT, { prefix, suffix, provider, model })
  },

  // ── Tool Approval ──
  tool: {
    onApprovalRequest: (cb: (request: ToolApprovalRequest) => void) =>
      createListener(IPC.TOOL_APPROVAL_REQUEST, cb),
    respond: (requestId: string, approved: boolean, alwaysAllow: boolean) =>
      ipcRenderer.invoke(IPC.TOOL_APPROVAL_RESPONSE, { requestId, approved, alwaysAllow }),
    onResult: (cb: (result: { toolName: string; result: string }) => void) =>
      createListener(IPC.TOOL_RESULT, cb),
    onActivity: (cb: (activity: { toolName: string; phase: 'running' | 'completed'; message?: string }) => void) =>
      createListener(IPC.TOOL_ACTIVITY, cb)
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
      ipcRenderer.invoke(IPC.SESSION_COMPACT_MESSAGES, { sessionId, keepCount }),
    deleteMessagesFrom: (sessionId: string, messageId: string) =>
      ipcRenderer.invoke(IPC.SESSION_DELETE_MESSAGES_FROM, { sessionId, messageId })
  },

  // ── Providers ──
  provider: {
    list: () => ipcRenderer.invoke(IPC.PROVIDER_LIST),
    save: (config: Omit<ProviderConfig, 'id'> & Partial<Pick<ProviderConfig, 'id'>>) => ipcRenderer.invoke(IPC.PROVIDER_SAVE, config),
    delete: (provider: string) => ipcRenderer.invoke(IPC.PROVIDER_DELETE, provider),
    test: (provider: string, config?: any) => ipcRenderer.invoke(IPC.PROVIDER_TEST, provider, config),
    models: (provider: string, config?: any) => ipcRenderer.invoke(IPC.PROVIDER_MODELS, provider, config)
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
    setPermissionMode: (mode: string) => ipcRenderer.invoke(IPC.PERMISSION_MODE_SET, mode),
    listTraces: () => ipcRenderer.invoke(IPC.TRACES_LIST),
    getCostsSummary: () => ipcRenderer.invoke(IPC.COSTS_SUMMARY)
  },

  // ── Agents ──
  agent: {
    list: () => ipcRenderer.invoke(IPC.AGENT_LIST),
    save: (agent: Partial<Agent>) => ipcRenderer.invoke(IPC.AGENT_SAVE, agent),
    delete: (agentId: string) => ipcRenderer.invoke(IPC.AGENT_DELETE, agentId),
    getEditHistory: (sessionId?: string) => ipcRenderer.invoke(IPC.AGENT_EDIT_HISTORY, sessionId),
    undoEdit: (snapshotId: string) => ipcRenderer.invoke(IPC.AGENT_EDIT_UNDO, snapshotId),
    redoEdit: (snapshotId: string) => ipcRenderer.invoke(IPC.AGENT_EDIT_REDO, snapshotId)
  },

  mcp: {
    list: () => ipcRenderer.invoke(IPC.MCP_LIST),
    save: (server: Partial<McpServer>) => ipcRenderer.invoke(IPC.MCP_SAVE, server),
    delete: (id: string) => ipcRenderer.invoke(IPC.MCP_DELETE, id),
    start: (id: string) => ipcRenderer.invoke(IPC.MCP_START, id),
    stop: (id: string) => ipcRenderer.invoke(IPC.MCP_STOP, id),
    test: (id: string) => ipcRenderer.invoke(IPC.MCP_TEST, id),
    import: (filePath: string) => ipcRenderer.invoke(IPC.MCP_IMPORT, filePath),
    onStatusChange: (cb: (change: { serverId: string; status: string; lastError?: string }) => void) => createListener(IPC.MCP_STATUS_CHANGE, cb),
    onLog: (cb: (entry: { serverId: string; type: 'stdout' | 'stderr' | 'system'; message: string }) => void) => createListener(IPC.MCP_LOG, cb)
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

  plugin: {
    marketplace: () => ipcRenderer.invoke(IPC.PLUGIN_MARKETPLACE_LIST),
    installed: () => ipcRenderer.invoke(IPC.PLUGIN_INSTALLED_LIST),
    install: (pluginId: string) => ipcRenderer.invoke(IPC.PLUGIN_INSTALL, pluginId),
    uninstall: (pluginId: string) => ipcRenderer.invoke(IPC.PLUGIN_UNINSTALL, pluginId),
    import: (folderPath: string) => ipcRenderer.invoke(IPC.PLUGIN_IMPORT, folderPath)
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
    run: (taskId: string, name: string, command: string, args: string[], cwd: string) => ipcRenderer.invoke(IPC.TASK_RUN, { taskId, name, command, args, cwd }),
    stop: (taskId: string) => ipcRenderer.invoke(IPC.TASK_STOP, taskId),
    stdin: (taskId: string, input: string) => ipcRenderer.invoke(IPC.TASK_STDIN, { taskId, input }),
    listDefinitions: (workspacePath: string) => ipcRenderer.invoke(IPC.TASK_LIST_DEFINITIONS, workspacePath),
    syncWorkspace: (workspacePath: string) => ipcRenderer.invoke(IPC.TASK_SYNC_WORKSPACE, workspacePath),
    saveDefinition: (definition: Omit<WorkspaceTaskDefinition, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }) =>
      ipcRenderer.invoke(IPC.TASK_SAVE_DEFINITION, definition),
    deleteDefinition: (workspacePath: string, name: string) => ipcRenderer.invoke(IPC.TASK_DELETE_DEFINITION, { workspacePath, name }),
    onOutput: (cb: (taskId: string, data: string, type: 'stdout' | 'stderr' | 'system') => void) => createListener(IPC.TASK_OUTPUT, cb),
    onExit: (cb: (taskId: string, code: number | null) => void) => createListener(IPC.TASK_EXIT, cb),
    onSelfHeal: (cb: (suggestion: TaskSelfHealSuggestion) => void) => createListener(IPC.TASK_SELF_HEAL, cb)
  },

  selfHealing: {
    getActive: (sessionId: string) => ipcRenderer.invoke(IPC.SELF_HEALING_GET_ACTIVE, sessionId),
    apply: (attemptId: string) => ipcRenderer.invoke(IPC.SELF_HEALING_APPLY, attemptId),
    decline: (attemptId: string) => ipcRenderer.invoke(IPC.SELF_HEALING_DECLINE, attemptId),
    refine: (attemptId: string) => ipcRenderer.invoke(IPC.SELF_HEALING_REFINE, attemptId),
    onFailureDetected: (cb: (attempt: SelfHealingAttempt) => void) => createListener('self-healing:failure-detected', cb),
    onProposalGenerated: (cb: (attempt: SelfHealingAttempt) => void) => createListener('self-healing:proposal-generated', cb)
  },

  editDecision: {
    record: (decision: Omit<EditDecision, 'id' | 'createdAt'>) =>
      ipcRenderer.invoke(IPC.EDIT_DECISION_RECORD, decision),
    list: (sessionId: string) => ipcRenderer.invoke(IPC.EDIT_DECISION_LIST, sessionId)
  },

  // ── Search ──
  search: {
    files: (request: SearchRequest) => ipcRenderer.invoke(IPC.SEARCH_FILES, request),
    sessions: (query: string) => ipcRenderer.invoke(IPC.SEARCH_SESSIONS, query)
  },

  semantic: {
    search: (request: SemanticSearchRequest) => ipcRenderer.invoke(IPC.SEMANTIC_SEARCH, request),
    index: (workspacePath: string, force?: boolean) => ipcRenderer.invoke(IPC.SEMANTIC_INDEX, { workspacePath, force }),
    status: (workspacePath: string) => ipcRenderer.invoke(IPC.SEMANTIC_STATUS, workspacePath)
  },

  // ── LSP (Code Intelligence) ──
  lsp: {
    getDocumentSymbols: (filePath: string) => ipcRenderer.invoke(IPC.LSP_DOCUMENT_SYMBOLS, filePath),
    getWorkspaceSymbols: (workspacePath: string, query: string) => ipcRenderer.invoke(IPC.LSP_WORKSPACE_SYMBOLS, { workspacePath, query }),
    getDefinition: (workspacePath: string, filePath: string, line: number, column: number, content?: string) => ipcRenderer.invoke(IPC.LSP_DEFINITION, { workspacePath, filePath, line, column, content }),
    getReferences: (workspacePath: string, filePath: string, line: number, column: number, content?: string) => ipcRenderer.invoke(IPC.LSP_REFERENCES, { workspacePath, filePath, line, column, content }),
    getIndexStats: () => ipcRenderer.invoke(IPC.LSP_INDEX_STATS),
    startServer: (languageId: string, workspacePath: string) => ipcRenderer.invoke(IPC.LSP_START_SERVER, { languageId, workspacePath }),
    stopServer: (languageId: string) => ipcRenderer.invoke(IPC.LSP_STOP_SERVER, languageId),
    getHover: (filePath: string, line: number, column: number, content?: string) => ipcRenderer.invoke(IPC.LSP_GET_HOVER, { filePath, line, column, content }),
    getCompletion: (filePath: string, line: number, column: number, content?: string) => ipcRenderer.invoke(IPC.LSP_GET_COMPLETION, { filePath, line, column, content }),
    getSignatureHelp: (filePath: string, line: number, column: number, content?: string) => ipcRenderer.invoke(IPC.LSP_GET_SIGNATURE_HELP, { filePath, line, column, content }),
    onPublishDiagnostics: (cb: (data: { languageId: string; uri: string; diagnostics: any[] }) => void) => createListener('lsp:publish-diagnostics', cb)
  },
  collaboration: {
    createRoom: (roomName: string, passcode?: string) => ipcRenderer.invoke(IPC.COLLABORATION_CREATE_ROOM, { roomName, passcode }),
    joinRoom: (inviteCode: string, user: string) => ipcRenderer.invoke(IPC.COLLABORATION_JOIN_ROOM, { inviteCode, user }),
    leaveRoom: () => ipcRenderer.invoke(IPC.COLLABORATION_LEAVE_ROOM),
    getRoomState: () => ipcRenderer.invoke(IPC.COLLABORATION_GET_STATE),
    broadcastCursor: (filePath: string, line: number, column: number) => ipcRenderer.send(IPC.COLLABORATION_SEND_CURSOR, { filePath, line, column }),
    sendChangePacket: (filePath: string, changeText: string, range: any) => ipcRenderer.send(IPC.COLLABORATION_SEND_CHANGE, { filePath, changeText, range }),
    getTimeline: () => ipcRenderer.invoke(IPC.COLLABORATION_GET_TIMELINE),
    logTimelineAction: (user: string, action: string) => ipcRenderer.send(IPC.COLLABORATION_LOG_ACTION, { user, action }),
    encrypt: (payload: string) => ipcRenderer.invoke(IPC.COLLABORATION_ENCRYPT, { payload }),
    decrypt: (cipher: string) => ipcRenderer.invoke(IPC.COLLABORATION_DECRYPT, { cipher }),
    onStateUpdate: (cb: (state: CollaborationState) => void) => createListener('collaboration:state-update', cb),
    onCursorSync: (cb: (presence: { user: string; filePath: string; line: number; column: number }) => void) => createListener('collaboration:cursor-sync', cb),
    onChangePacket: (cb: (packet: { user: string; filePath: string; changeText: string; range: any }) => void) => createListener('collaboration:change-packet', cb),
    onTimelineUpdate: (cb: (action: TimelineAction) => void) => createListener('collaboration:timeline-update', cb)
  },
  composer: {
    start: (goal: string, workspacePath: string) => ipcRenderer.invoke(IPC.COMPOSER_START, { goal, workspacePath }),
    cancel: () => ipcRenderer.invoke(IPC.COMPOSER_CANCEL),
    approve: () => ipcRenderer.invoke(IPC.COMPOSER_APPROVE),
    reject: () => ipcRenderer.invoke(IPC.COMPOSER_REJECT),
    getDiffPreview: (filePath: string) => ipcRenderer.invoke(IPC.COMPOSER_DIFF_PREVIEW, { filePath }),
    onStatusUpdate: (callback: (status: ComposerTaskStatus) => void) => {
      const handler = (_event: any, status: ComposerTaskStatus) => callback(status)
      ipcRenderer.on(IPC.COMPOSER_STATUS, handler)
      return () => { ipcRenderer.removeListener(IPC.COMPOSER_STATUS, handler) }
    }
  },
  dap: {
    start: (port: number, scriptPath: string) => ipcRenderer.invoke(IPC.DAP_START, { port, scriptPath }),
    stop: () => ipcRenderer.invoke(IPC.DAP_STOP),
    toggleBreakpoint: (filePath: string, line: number) => ipcRenderer.invoke(IPC.DAP_SET_BREAKPOINT, { filePath, line }),
    stepOver: () => ipcRenderer.invoke(IPC.DAP_STEP_OVER),
    stepInto: () => ipcRenderer.invoke(IPC.DAP_STEP_INTO),
    stepOut: () => ipcRenderer.invoke(IPC.DAP_STEP_OUT),
    continue: () => ipcRenderer.invoke(IPC.DAP_CONTINUE),
    explainState: (goal: string) => ipcRenderer.invoke(IPC.DAP_EXPLAIN_STATE, { goal }),
    onStateUpdate: (callback: (state: DapState) => void) => {
      const handler = (_event: any, state: DapState) => callback(state)
      ipcRenderer.on(IPC.DAP_STATUS, handler)
      return () => { ipcRenderer.removeListener(IPC.DAP_STATUS, handler) }
    }
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
  ipc: {
    call: (channel: string, method: string, args: any[]) =>
      ipcRenderer.invoke(IPC.FRAMEWORK_CALL, { channel, method, args })
  },
  database: {
    getTables: () => ipcRenderer.invoke(IPC.DATABASE_GET_TABLES),
    getTableSchema: (tableName: string) => ipcRenderer.invoke(IPC.DATABASE_GET_SCHEMA, tableName),
    executeQuery: (sql: string) => ipcRenderer.invoke(IPC.DATABASE_EXECUTE_QUERY, sql),
    generateSchemaDeclaration: (format: 'prisma' | 'drizzle') =>
      ipcRenderer.invoke(IPC.DATABASE_GENERATE_DECLARATION, format),
    generateMockData: (tableName: string, count: number) =>
      ipcRenderer.invoke(IPC.DATABASE_GENERATE_MOCK_DATA, { tableName, count })
  },
  test: {
    generateTestSuite: (filePath: string, testContent: string) =>
      ipcRenderer.invoke(IPC.TEST_GENERATE_SUITE, { filePath, testContent }),
    runTestSuite: (testFilePath: string) => ipcRenderer.invoke(IPC.TEST_RUN_SUITE, testFilePath),
    autonomousRepairLoop: (testFilePath: string, sourceFilePath: string, maxRetries?: number) =>
      ipcRenderer.invoke(IPC.TEST_REPAIR_LOOP, { testFilePath, sourceFilePath, maxRetries })
  },
  deploy: {
    generateIaC: (workspacePath: string, target: 'docker' | 'serverless') =>
      ipcRenderer.invoke(IPC.DEPLOY_GENERATE_IAC, { workspacePath, target }),
    verifyPreDeployBuild: (workspacePath: string) =>
      ipcRenderer.invoke(IPC.DEPLOY_VERIFY_BUILD, workspacePath)
  },
  wiki: {
    analyzeCodebase: (workspacePath: string) => ipcRenderer.invoke(IPC.WIKI_ANALYZE, workspacePath),
    generateMermaidDiagram: (workspacePath: string) => ipcRenderer.invoke(IPC.WIKI_MERMAID, workspacePath),
    writeWikiFile: (workspacePath: string) => ipcRenderer.invoke(IPC.WIKI_WRITE, workspacePath)
  },
  clipboard: {
    writeText: (text: string) => ipcRenderer.invoke(IPC.CLIPBOARD_WRITE_TEXT, text),
    readText: () => ipcRenderer.invoke(IPC.CLIPBOARD_READ_TEXT),
    saveImage: () => ipcRenderer.invoke(IPC.CLIPBOARD_SAVE_IMAGE)
  },
  sandbox: {
    start: (workspacePath: string) => ipcRenderer.invoke(IPC.SANDBOX_START, workspacePath),
    stop: (serverId: string) => ipcRenderer.invoke(IPC.SANDBOX_STOP, serverId),
    inspectStyles: (serverId: string, selector: string) => ipcRenderer.invoke(IPC.SANDBOX_INSPECT_STYLES, { serverId, selector }),
    updateStyle: (selector: string, property: string, value: string) => ipcRenderer.invoke(IPC.SANDBOX_UPDATE_STYLE, { selector, property, value }),
    getDomTree: (workspacePath: string, htmlContent?: string) => ipcRenderer.invoke(IPC.SANDBOX_GET_DOM_TREE, { workspacePath, htmlContent }),
    getConsoleLogs: () => ipcRenderer.invoke(IPC.SANDBOX_GET_CONSOLE_LOGS),
    takeHeapSnapshot: () => ipcRenderer.invoke(IPC.SANDBOX_TAKE_HEAP_SNAPSHOT)
  },

  // ── Menu Events ──
  onMenuNewSession: (cb: () => void) => createListener('menu:new-session', cb),
  onMenuSettings: (cb: () => void) => createListener('menu:settings', cb),
  onMenuAbout: (cb: () => void) => createListener('menu:about', cb),
  onMenuToggleSidebar: (cb: () => void) => createListener('menu:toggle-sidebar', cb)
} satisfies ElectronAPI)
