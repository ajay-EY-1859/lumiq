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
  toolInput?: Record<string, unknown>
  toolResult?: string
  tokensUsed?: number
  createdAt: string // ISO string for serialization safety
}

// ─── Session ────────────────────────────────────────────────────────
export interface Session {
  id: string
  title: string
  provider: string
  model: string
  agentId?: string
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

export interface TestResult {
  success: boolean
  error?: string
}

// ─── App Settings ───────────────────────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'system'
export type FontSize = '12' | '14' | '16'
export type ToolPermission = 'always-ask' | 'always-allow' | 'always-deny'

export interface AppSettings {
  theme: ThemeMode
  fontSize: FontSize
  defaultProvider: ProviderType
  defaultModel: string
  sidebarVisible: boolean
  autoSave: boolean
  contextLimit: number
}

export interface ToolSettings {
  name: string
  enabled: boolean
  permission: ToolPermission
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

  // Provider management
  PROVIDER_LIST: 'provider:list',
  PROVIDER_SAVE: 'provider:save',
  PROVIDER_DELETE: 'provider:delete',
  PROVIDER_TEST: 'provider:test',
  PROVIDER_MODELS: 'provider:models',

  // Settings
  SETTINGS_GET: 'settings:get',
  SETTINGS_SET: 'settings:set',
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

  // Shell
  SHELL_OPEN_EXTERNAL: 'shell:open-external'
} as const

// Type for IPC channel values
export type IPCChannel = (typeof IPC)[keyof typeof IPC]

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
  custom: null
}
