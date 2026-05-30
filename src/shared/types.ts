// ═══════════════════════════════════════════════════════════════════
// Lumiq — Shared Types (Main Process ↔ Renderer Process)
// WARNING: This file is used by BOTH processes via contextBridge.
// Never add Node.js-specific imports here.
// ═══════════════════════════════════════════════════════════════════

// ─── Message ────────────────────────────────────────────────────────
export interface Message {
  id: string
  sessionId: string
  role: 'user' | 'assistant' | 'system' | 'tool'
  content: string
  toolName?: string
  toolCallId?: string
  toolCalls?: ToolCall[]
  toolInput?: Record<string, unknown>
  toolResult?: string
  tokensUsed?: number
  executionStatus?: 'streaming' | 'completed' | 'interrupted'
  createdAt: string // ISO string for serialization safety
}

// ─── Session ────────────────────────────────────────────────────────
export interface Session {
  id: string
  title: string
  provider: string
  model: string
  agentId?: string
  workspacePath?: string | null
  createdAt: string
  updatedAt: string
}

// ─── Provider Config ────────────────────────────────────────────────
export type ProviderType =
  | 'anthropic'
  | 'openai'
  | 'gemini'
  | 'ollama'
  | 'deepseek'
  | 'bedrock'
  | 'github'
  | 'openrouter'
  | 'groq'
  | 'custom'

export type AuthMethod = 'apikey' | 'oauth'

export interface ProviderConfig {
  id: string
  provider: ProviderType
  apiKey?: string // encrypted at rest — NEVER log this
  baseUrl?: string
  defaultModel: string
  isActive: boolean
  authMethod?: AuthMethod // 'apikey' (default) or 'oauth'
  // Bedrock-specific
  awsAccessKeyId?: string
  awsSecretAccessKey?: string // encrypted at rest
  awsSessionToken?: string
  awsRegion?: string
}

// ─── OAuth Types ────────────────────────────────────────────────────
export interface OAuthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt: number // Unix timestamp in ms
  tokenType: string
  scope?: string
}

export interface OAuthStatus {
  isLoggedIn: boolean
  email?: string
  expiresAt?: number
}

export interface GoogleOAuthConfig {
  clientId: string
  clientSecret: string
}

export interface GitHubOAuthConfig {
  clientId: string
  clientSecret: string
}

// ─── Agent ──────────────────────────────────────────────────────────
export interface Agent {
  id: string
  name: string
  description?: string
  systemPrompt: string
  provider?: string
  model?: string
  tools: string[] // enabled tool names
  createdAt: string
}

// ─── Tool Approval ──────────────────────────────────────────────────
export interface ToolApprovalRequest {
  requestId: string
  toolName: string
  toolDescription: string
  toolInput: Record<string, unknown>
  workingDirectory?: string
}

export interface ToolApprovalResponse {
  requestId: string
  approved: boolean
  alwaysAllow: boolean
}

// ─── AI Provider Interface Results ──────────────────────────────────
export interface SendOptions {
  model: string
  stream: boolean
  systemPrompt?: string
  maxTokens?: number
  onChunk?: (chunk: string) => void
  signal?: AbortSignal
  tools?: AIToolDefinition[]
}

export interface SendResult {
  content: string
  tokensUsed: number
  stopReason: string
  toolCalls?: ToolCall[]
}

export interface ToolCall {
  id: string
  toolName: string
  input: Record<string, unknown>
}

export interface AIToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface TestResult {
  success: boolean
  error?: string
}

// ─── App Settings ───────────────────────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'system'
export type FontSize = '12' | '14' | '16'
export type ToolPermission = 'always-ask' | 'always-allow' | 'always-deny'
export type PermissionMode = 'MANUAL' | 'LIMITED' | 'EXTENDED' | 'AUTO'

export interface AppSettings {
  theme: ThemeMode
  fontSize: FontSize
  defaultProvider: ProviderType
  defaultModel: string
  sidebarVisible: boolean
  autoSave: boolean
  contextLimit: number
  firecrawlApiKey?: string
}

export interface ToolSettings {
  name: string
  enabled: boolean
  permission: ToolPermission
}

// ─── MCP Servers ───────────────────────────────────────────────────
export type McpServerStatus = 'stopped' | 'starting' | 'running' | 'error'

export interface McpServer {
  id: string
  name: string
  command: string
  args: string[]
  env: Record<string, string>
  active: boolean
  approved: boolean
  status: McpServerStatus
  lastError?: string
  toolsCount: number
  tools?: string[]
  createdAt: string
  updatedAt: string
}

export interface McpToolDefinition {
  name: string
  description: string
  inputSchema: Record<string, unknown>
}

export interface McpStatusChange {
  serverId: string
  status: McpServerStatus
  lastError?: string
  toolsCount?: number
}

// ─── Agent Routing & Skills ────────────────────────────────────────
export interface AgentRoute {
  id: string
  taskName: string
  provider: ProviderType
  model: string
  createdAt: string
  updatedAt: string
}

export interface CustomSkill {
  id: string
  name: string
  description: string
  promptTemplate: string
  allowedTools: string[]
  createdAt: string
  updatedAt: string
}

export interface CustomCommand {
  id: string
  name: string
  description: string
  command: string          // shell command or prompt template
  type: 'shell' | 'prompt' // shell = run in terminal, prompt = inject into chat
  args: string[]
  createdAt: string
  updatedAt: string
}

export interface GrpcStatus {
  running: boolean
  host: '127.0.0.1'
  port: number
}

// ─── IPC Channels ───────────────────────────────────────────────────
// SECURITY: All channels are whitelisted. Only these channels
// can be used via contextBridge. Adding a new channel requires
// updating both preload.ts AND this list.
export const IPC = {
  // Chat
  CHAT_SEND: 'chat:send',
  CHAT_STREAM_CHUNK: 'chat:stream-chunk',
  CHAT_STREAM_END: 'chat:stream-end',
  CHAT_ERROR: 'chat:error',
  CHAT_CANCEL: 'chat:cancel',

  // Tool approval
  TOOL_APPROVAL_REQUEST: 'tool:approval-request',
  TOOL_APPROVAL_RESPONSE: 'tool:approval-response',
  TOOL_RESULT: 'tool:result',

  // Session management
  SESSION_LIST: 'session:list',
  SESSION_LOAD: 'session:load',
  SESSION_CREATE: 'session:create',
  SESSION_DELETE: 'session:delete',
  SESSION_RENAME: 'session:rename',
  SESSION_EXPORT: 'session:export',
  SESSION_SET_WORKSPACE: 'session:set-workspace',
  SESSION_CLEAR_MESSAGES: 'session:clear-messages',
  SESSION_COMPACT_MESSAGES: 'session:compact-messages',
  SESSION_DELETE_MESSAGES_FROM: 'session:delete-messages-from',

  // Provider management
  PROVIDER_LIST: 'provider:list',
  PROVIDER_SAVE: 'provider:save',
  PROVIDER_DELETE: 'provider:delete',
  PROVIDER_TEST: 'provider:test',
  PROVIDER_MODELS: 'provider:models',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
  SETTINGS_WORKSPACE_GET: 'settings:workspace-get',
  SETTINGS_WORKSPACE_SET: 'settings:workspace-set',
  SETTINGS_GET_TOOL: 'settings:get-tool',
  SETTINGS_SET_TOOL: 'settings:set-tool',

  // Agent management
  AGENT_LIST: 'agent:list',
  AGENT_SAVE: 'agent:save',
  AGENT_DELETE: 'agent:delete',

  // OAuth / Authentication
  AUTH_GOOGLE_LOGIN: 'auth:google-login',
  AUTH_GOOGLE_LOGOUT: 'auth:google-logout',
  AUTH_GOOGLE_STATUS: 'auth:google-status',
  AUTH_GOOGLE_SETUP: 'auth:google-setup',
  AUTH_GOOGLE_GET_SETUP: 'auth:google-get-setup',
  AUTH_GITHUB_LOGIN: 'auth:github-login',
  AUTH_GITHUB_LOGOUT: 'auth:github-logout',
  AUTH_GITHUB_STATUS: 'auth:github-status',
  AUTH_GITHUB_SETUP: 'auth:github-setup',
  AUTH_GITHUB_GET_SETUP: 'auth:github-get-setup',

  // Shell
  SHELL_OPEN_EXTERNAL: 'shell:open-external',

  // Permission mode
  PERMISSION_MODE_GET: 'permission:mode-get',
  PERMISSION_MODE_SET: 'permission:mode-set',

  // MCP servers
  MCP_LIST: 'mcp:list',
  MCP_SAVE: 'mcp:save',
  MCP_DELETE: 'mcp:delete',
  MCP_START: 'mcp:start',
  MCP_STOP: 'mcp:stop',
  MCP_TEST: 'mcp:test',
  MCP_STATUS_CHANGE: 'mcp:status-change',
  MCP_LOG: 'mcp:log',
  MCP_IMPORT: 'mcp:import',

  // Agent routing
  ROUTING_LIST: 'routing:list',
  ROUTING_SAVE: 'routing:save',
  ROUTING_DELETE: 'routing:delete',

  // Custom skills
  SKILL_LIST: 'skill:list',
  SKILL_SAVE: 'skill:save',
  SKILL_DELETE: 'skill:delete',
  SKILL_IMPORT: 'skill:import',
  SKILL_IMPORT_FOLDER: 'skill:import-folder',

  // Custom commands
  COMMAND_LIST: 'command:list',
  COMMAND_SAVE: 'command:save',
  COMMAND_DELETE: 'command:delete',
  COMMAND_IMPORT_FOLDER: 'command:import-folder',

  // Local developer server
  GRPC_START: 'grpc:start',
  GRPC_STOP: 'grpc:stop',
  GRPC_STATUS: 'grpc:status',
  GRPC_CLIENT_CONNECTED: 'grpc:client-connected',
  GRPC_ACTION_REQUIRED: 'grpc:action-required',

  // Dialog
  DIALOG_SHOW_OPEN: 'dialog:show-open',

  // File System
  FS_LIST_DIR: 'fs:list-dir',
  FS_READ_FILE: 'fs:read-file',
  FS_WRITE_FILE: 'fs:write-file',
  FS_RENAME: 'fs:rename',
  FS_DELETE: 'fs:delete',
  FS_MKDIR: 'fs:mkdir',
  FS_FILE_MODIFIED: 'fs:file-modified',

  // Tasks
  TASK_LIST_DEFINITIONS: 'task:list-definitions',
  TASK_SYNC_WORKSPACE: 'task:sync-workspace',
  TASK_SAVE_DEFINITION: 'task:save-definition',
  TASK_DELETE_DEFINITION: 'task:delete-definition',
  TASK_RUN: 'task:run',
  TASK_STOP: 'task:stop',
  TASK_STDIN: 'task:stdin',
  TASK_OUTPUT: 'task:output',
  TASK_EXIT: 'task:exit',
  TASK_SELF_HEAL: 'task:self-heal',

  // Edit decisions
  EDIT_DECISION_RECORD: 'edit-decision:record',
  EDIT_DECISION_LIST: 'edit-decision:list',

  // Search (Find in Files)
  SEARCH_FILES: 'search:files',

  // Semantic Search / Codebase RAG
  SEMANTIC_SEARCH: 'semantic:search',
  SEMANTIC_INDEX: 'semantic:index',
  SEMANTIC_STATUS: 'semantic:status',

  // Code Intelligence (LSP)
  LSP_DOCUMENT_SYMBOLS: 'lsp:document-symbols',
  LSP_WORKSPACE_SYMBOLS: 'lsp:workspace-symbols',
  LSP_DEFINITION: 'lsp:definition',

  // Git
  GIT_STATUS: 'git:status',
  GIT_BRANCH: 'git:branch',
  GIT_DIFF_FILE: 'git:diff-file',
  GIT_STAGE: 'git:stage',
  GIT_UNSTAGE: 'git:unstage',
  GIT_DISCARD: 'git:discard',
  GIT_COMMIT: 'git:commit',
  GIT_IGNORED: 'git:ignored'
} as const

// ─── Edit Decision Types ───────────────────────────────────────────
export type EditDecisionType = 'accepted' | 'rejected' | 'applied'

export interface EditDecision {
  id: string
  sessionId: string
  messageId?: string | null
  targetFile: string
  hunkHeader: string
  decision: EditDecisionType
  patchText: string
  createdAt: string
}

// ─── Task Types ──────────────────────────────────────────────────────
export interface WorkspaceTaskDefinition {
  id: string
  workspacePath: string
  name: string
  command: string
  args: string[]
  source: 'package' | 'custom'
  createdAt: string
  updatedAt: string
}

export interface TaskProblem {
  file: string
  line: number
  column: number
  message: string
  severity: 'error' | 'warning'
}

export interface TaskSelfHealSuggestion {
  taskId: string
  recommendation: string
  summary: string
  errorLines: string[]
}

export interface TaskLog {
  id: string
  timestamp: number
  data: string
  type: 'stdout' | 'stderr' | 'system'
}

export interface TaskState {
  id: string
  name: string
  command: string
  args: string[]
  cwd: string
  status: 'running' | 'success' | 'error' | 'stopped'
  logs: TaskLog[]
  problems: TaskProblem[]
  selfHealSuggestion?: TaskSelfHealSuggestion
}

// Type for IPC channel values
export type IPCChannel = (typeof IPC)[keyof typeof IPC]

// ─── Search Types ──────────────────────────────────────────────────
export interface SearchMatch {
  file: string
  line: number
  column: number
  content: string
}

export interface SearchRequest {
  query: string
  workspacePath: string
  isRegex?: boolean
  caseSensitive?: boolean
  includePattern?: string // e.g. "*.ts,*.tsx"
  excludePattern?: string // e.g. "node_modules,dist"
}

export interface SearchResponse {
  matches: SearchMatch[]
  totalMatches: number
  truncated: boolean
  elapsed: number // ms
}

// ─── Semantic Search Types ─────────────────────────────────────────
export type SemanticIndexState = 'idle' | 'indexing' | 'ready' | 'error'

export interface SemanticIndexStatus {
  workspacePath: string
  state: SemanticIndexState
  filesScanned: number
  filesIndexed: number
  chunksStored: number
  lastIndexedAt?: string
  lastError?: string
}

export interface SemanticSearchMatch {
  filePath: string
  chunkIndex: number
  content: string
  score: number
}

export interface SemanticSearchRequest {
  query: string
  workspacePath: string
  topK?: number
}

export interface SemanticSearchResponse {
  matches: SemanticSearchMatch[]
  totalMatches: number
  elapsed: number
}

// ─── Code Intelligence Types (LSP) ─────────────────────────────────
export enum SymbolKind {
  File = 1,
  Module = 2,
  Namespace = 3,
  Package = 4,
  Class = 5,
  Method = 6,
  Property = 7,
  Field = 8,
  Constructor = 9,
  Enum = 10,
  Interface = 11,
  Function = 12,
  Variable = 13,
  Constant = 14,
  String = 15,
  Number = 16,
  Boolean = 17,
  Array = 18,
  Object = 19,
  Key = 20,
  Null = 21,
  EnumMember = 22,
  Struct = 23,
  Event = 24,
  Operator = 25,
  TypeParameter = 26
}

export interface DocumentSymbol {
  name: string
  detail?: string
  kind: SymbolKind
  range: {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }
  selectionRange: {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }
  children?: DocumentSymbol[]
}

export interface DefinitionResult {
  uri: string
  range: {
    startLineNumber: number
    startColumn: number
    endLineNumber: number
    endColumn: number
  }
}

// ─── Git Types ────────────────────────────────────────────────────
export type GitFileStatus = 'modified' | 'added' | 'deleted' | 'renamed' | 'untracked' | 'conflicted'

export interface GitFileChange {
  file: string
  status: GitFileStatus
  staged: boolean
}

export interface GitStatusResult {
  branch: string
  ahead: number
  behind: number
  changes: GitFileChange[]
  isRepo: boolean
}

// ─── Static Model Lists (fallback when API unavailable) ─────────────
export const PROVIDER_MODELS: Record<ProviderType, { id: string; label: string }[]> = {
  anthropic: [
    { id: 'claude-opus-4-20250514', label: 'Claude Opus 4' },
    { id: 'claude-sonnet-4-20250514', label: 'Claude Sonnet 4' },
    { id: 'claude-haiku-4-20250506', label: 'Claude Haiku 4' }
  ],
  openai: [
    { id: 'gpt-4o', label: 'GPT-4o' },
    { id: 'gpt-4o-mini', label: 'GPT-4o Mini' },
    { id: 'gpt-4-turbo', label: 'GPT-4 Turbo' },
    { id: 'gpt-3.5-turbo', label: 'GPT-3.5 Turbo' }
  ],
  gemini: [
    { id: 'gemini-1.5-pro', label: 'Gemini 1.5 Pro' },
    { id: 'gemini-1.5-flash', label: 'Gemini 1.5 Flash' },
    { id: 'gemini-pro', label: 'Gemini Pro' }
  ],
  ollama: [
    { id: 'llama3.2', label: 'Llama 3.2' },
    { id: 'mistral', label: 'Mistral' },
    { id: 'qwen2.5-coder', label: 'Qwen 2.5 Coder' },
    { id: 'phi3', label: 'Phi-3' }
  ],
  deepseek: [
    { id: 'deepseek-chat', label: 'DeepSeek Chat' },
    { id: 'deepseek-coder', label: 'DeepSeek Coder' }
  ],
  bedrock: [
    { id: 'anthropic.claude-sonnet-4-20250514-v1:0', label: 'Claude Sonnet 4 (Bedrock)' },
    { id: 'anthropic.claude-haiku-4-20250506-v1:0', label: 'Claude Haiku 4 (Bedrock)' },
    { id: 'amazon.titan-text-express-v1', label: 'Titan Text Express' }
  ],
  github: [
    { id: 'openai/gpt-4.1', label: 'GPT-4.1 (GitHub Models)' },
    { id: 'openai/gpt-4.1-mini', label: 'GPT-4.1 Mini (GitHub Models)' },
    { id: 'openai/gpt-4o-mini', label: 'GPT-4o Mini (GitHub Models)' }
  ],
  openrouter: [
    { id: 'anthropic/claude-sonnet-4-20250514', label: 'Claude Sonnet 4 (OpenRouter)' },
    { id: 'openai/gpt-4o', label: 'GPT-4o (OpenRouter)' },
    { id: 'google/gemini-2.5-pro-preview', label: 'Gemini 2.5 Pro (OpenRouter)' },
    { id: 'meta-llama/llama-3.3-70b-instruct', label: 'Llama 3.3 70B (OpenRouter)' },
    { id: 'deepseek/deepseek-chat-v3', label: 'DeepSeek V3 (OpenRouter)' },
    { id: 'qwen/qwen-2.5-coder-32b-instruct', label: 'Qwen 2.5 Coder 32B (OpenRouter)' }
  ],
  groq: [
    { id: 'llama-3.3-70b-versatile', label: 'Llama 3.3 70B (Groq)' },
    { id: 'llama-3.1-8b-instant', label: 'Llama 3.1 8B Instant (Groq)' },
    { id: 'mixtral-8x7b-32768', label: 'Mixtral 8x7B (Groq)' },
    { id: 'gemma2-9b-it', label: 'Gemma 2 9B (Groq)' }
  ],
  custom: []
}

// ─── Provider Console URLs (for "Get API Key" buttons) ──────────────
export const PROVIDER_CONSOLE_URLS: Record<ProviderType, { label: string; url: string } | null> = {
  anthropic: { label: 'Anthropic Console', url: 'https://console.anthropic.com/settings/keys' },
  openai: { label: 'OpenAI Platform', url: 'https://platform.openai.com/api-keys' },
  gemini: { label: 'Google AI Studio', url: 'https://aistudio.google.com/apikey' },
  ollama: null, // Local — no URL needed
  deepseek: { label: 'DeepSeek Platform', url: 'https://platform.deepseek.com/api_keys' },
  bedrock: { label: 'AWS Console', url: 'https://console.aws.amazon.com/bedrock/' },
  github: { label: 'GitHub Tokens', url: 'https://github.com/settings/tokens' },
  openrouter: { label: 'OpenRouter Keys', url: 'https://openrouter.ai/keys' },
  groq: { label: 'Groq Console', url: 'https://console.groq.com/keys' },
  custom: null
}
