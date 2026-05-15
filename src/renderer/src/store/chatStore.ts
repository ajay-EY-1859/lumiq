// ═══════════════════════════════════════════════════════════════════
// Lumiq — Chat Store (Zustand)
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type { Message, ToolApprovalRequest } from '@shared/types'

interface ChatState {
  messages: Message[]
  isStreaming: boolean
  streamingContent: string
  error: string | null
  pendingApproval: ToolApprovalRequest | null

  // Actions
  setMessages: (messages: Message[]) => void
  addMessage: (message: Message) => void
  setStreaming: (streaming: boolean) => void
  appendStreamChunk: (chunk: string) => void
  resetStream: () => void
  setError: (error: string | null) => void
  setPendingApproval: (request: ToolApprovalRequest | null) => void
  clearMessages: () => void

  loadSession: (sessionId: string) => Promise<void>
  sendMessage: (message: string, sessionId: string, provider: string, model: string, systemPrompt?: string, taskMode?: string) => Promise<void>
  cancelStream: () => Promise<void>
  respondToApproval: (requestId: string, approved: boolean, alwaysAllow: boolean) => Promise<void>
}

export const useChatStore = create<ChatState>((set) => ({
  messages: [],
  isStreaming: false,
  streamingContent: '',
  error: null,
  pendingApproval: null,

  setMessages: (messages) => set({ messages }),
  addMessage: (message) => set((s) => ({ messages: [...s.messages, message] })),
  setStreaming: (streaming) => set({ isStreaming: streaming }),
  appendStreamChunk: (chunk) => set((s) => ({ streamingContent: s.streamingContent + chunk })),
  resetStream: () => set({ streamingContent: '', isStreaming: false }),
  setError: (error) => set({ error }),
  setPendingApproval: (request) => set({ pendingApproval: request }),
  clearMessages: () => set({ messages: [], streamingContent: '', error: null }),

  loadSession: async (sessionId) => {
    try {
      const data = (await window.electronAPI.session.load(sessionId)) as unknown as {
        session: unknown
        messages: Message[]
      }
      set({ messages: data.messages, error: null })
    } catch (error) {
      set({ error: (error as Error).message })
    }
  },

  sendMessage: async (message, sessionId, provider, model, systemPrompt, taskMode) => {
    set({ isStreaming: true, streamingContent: '', error: null })
    try {
      await window.electronAPI.chat.send(message, sessionId, provider, model, systemPrompt, taskMode)
    } catch (error) {
      set({ isStreaming: false, error: (error as Error).message })
    }
  },

  cancelStream: async () => {
    await window.electronAPI.chat.cancel()
    set({ isStreaming: false })
  },

  respondToApproval: async (requestId, approved, alwaysAllow) => {
    await window.electronAPI.tool.respond(requestId, approved, alwaysAllow)
    set({ pendingApproval: null })
  }
}))
