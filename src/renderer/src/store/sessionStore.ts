// ═══════════════════════════════════════════════════════════════════
// Lumiq — Session Store (Zustand)
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type { Session } from '@shared/types'

interface SessionState {
  sessions: Session[]
  activeSessionId: string | null
  isLoading: boolean

  // Actions
  loadSessions: () => Promise<void>
  setActiveSession: (sessionId: string) => void
  createSession: (provider: string, model: string) => Promise<Session>
  deleteSession: (sessionId: string) => Promise<void>
  renameSession: (sessionId: string, title: string) => Promise<void>
}

export const useSessionStore = create<SessionState>((set) => ({
  sessions: [],
  activeSessionId: null,
  isLoading: true,

  loadSessions: async () => {
    try {
      const sessions = await window.electronAPI.session.list() as Session[]
      set({ sessions, isLoading: false })
    } catch {
      set({ isLoading: false })
    }
  },

  setActiveSession: (sessionId) => {
    set({ activeSessionId: sessionId })
  },

  createSession: async (provider, model) => {
    const session = await window.electronAPI.session.create(provider, model) as Session
    set((state) => ({
      sessions: [session, ...state.sessions],
      activeSessionId: session.id
    }))
    return session
  },

  deleteSession: async (sessionId) => {
    await window.electronAPI.session.delete(sessionId)
    set((state) => ({
      sessions: state.sessions.filter((s) => s.id !== sessionId),
      activeSessionId: state.activeSessionId === sessionId ? null : state.activeSessionId
    }))
  },

  renameSession: async (sessionId, title) => {
    await window.electronAPI.session.rename(sessionId, title)
    set((state) => ({
      sessions: state.sessions.map((s) =>
        s.id === sessionId ? { ...s, title } : s
      )
    }))
  }
}))
