// ═══════════════════════════════════════════════════════════════════
// Lumiq — Sidebar Component
// Session list with search, date grouping, and navigation
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react'
import { useSessionStore } from '@renderer/store/sessionStore'
import { useProviderStore } from '@renderer/store/providerStore'
import { groupByDate, truncate } from '@renderer/utils/formatters'
import { ProjectExplorer } from './ProjectExplorer'
import type { Session } from '@shared/types'

interface SidebarProps {
  isVisible: boolean
  onNavigate: (page: 'chat' | 'settings' | 'agents' | 'composer') => void
  currentPage: string
}

export function Sidebar({ isVisible, onNavigate, currentPage }: SidebarProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<'sessions' | 'explorer'>('sessions')
  const [searchQuery, setSearchQuery] = useState('')
  const { sessions, activeSessionId, setActiveSession, createSession, deleteSession } = useSessionStore()
  const { activeProvider, activeModel } = useProviderStore()

  const filteredSessions = useMemo(() => {
    if (!searchQuery) return sessions
    const q = searchQuery.toLowerCase()
    return sessions.filter((s) => s.title.toLowerCase().includes(q))
  }, [sessions, searchQuery])

  const groupedSessions = useMemo(() => groupByDate(filteredSessions), [filteredSessions])

  const handleNewSession = async (): Promise<void> => {
    const session = await createSession(activeProvider, activeModel)
    setActiveSession(session.id)
    onNavigate('chat')
  }

  const handleDeleteSession = async (e: React.MouseEvent, sessionId: string): Promise<void> => {
    e.stopPropagation()
    if (confirm('Delete this session?')) {
      await deleteSession(sessionId)
    }
  }

  return (
    <div
      className="flex flex-col h-full overflow-hidden shrink-0 transition-all duration-300"
      style={{
        width: isVisible ? '280px' : '0px',
        minWidth: isVisible ? '280px' : '0px',
        background: 'transparent',
      }}
    >
      <div className="flex flex-col h-full mx-3 mb-3 rounded-xl overflow-hidden bg-[var(--sidebar-bg)] border border-[var(--border)] backdrop-blur-md shadow-lg">
        {/* Tabs */}
        <div className="flex shrink-0 border-b border-[var(--border)] bg-black/5 dark:bg-white/5">
          <button
            onClick={() => setActiveTab('sessions')}
            className={`flex-1 py-3 text-sm transition-colors duration-200 border-b-2 ${activeTab === 'sessions' ? 'border-[var(--accent-blue)] text-[var(--text-primary)] font-semibold' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] font-medium'}`}
          >
            Chats
          </button>
          <button
            onClick={() => setActiveTab('explorer')}
            className={`flex-1 py-3 text-sm transition-colors duration-200 border-b-2 ${activeTab === 'explorer' ? 'border-[var(--accent-blue)] text-[var(--text-primary)] font-semibold' : 'border-transparent text-[var(--text-muted)] hover:text-[var(--text-secondary)] font-medium'}`}
          >
            Explorer
          </button>
        </div>

        {activeTab === 'sessions' ? (
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* New Session Button */}
            <div className="p-3 shrink-0">
              <button
                id="btn-new-session"
                onClick={handleNewSession}
                title="Create a new chat session"
                className="w-full py-2.5 px-3 flex items-center gap-2 rounded-lg border border-[var(--border)] bg-transparent hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-primary)] text-sm font-medium transition-all duration-200 cursor-pointer group"
              >
                <span className="text-lg bg-[var(--accent-blue)] text-white w-6 h-6 flex items-center justify-center rounded-md shadow-sm group-hover:scale-105 transition-transform">+</span>
                New Session
                <span className="ml-auto text-xs text-[var(--text-muted)] font-mono opacity-0 group-hover:opacity-100 transition-opacity">
                  Ctrl+N
                </span>
              </button>
            </div>

            {/* Search */}
            <div className="px-3 pb-2 shrink-0">
              <div className="relative group">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--text-muted)] text-sm transition-colors group-focus-within:text-[var(--accent-blue)]">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
                </span>
                <input
                  id="input-search-sessions"
                  type="text"
                  placeholder="Search sessions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full py-2 px-3 pl-9 bg-black/5 dark:bg-white/5 border border-[var(--border)] rounded-lg text-[var(--text-primary)] text-xs outline-none focus:border-[var(--accent-blue)] transition-all duration-200 placeholder-[var(--text-muted)]"
                />
              </div>
            </div>

            {/* Session List */}
            <div className="flex-1 overflow-y-auto px-2 pb-2 custom-scrollbar">
              {groupedSessions.map((group) => (
                <div key={group.label} className="mb-2">
                  <div className="px-2 py-1.5 text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wider">
                    {group.label}
                  </div>
                  {group.items.map((session: Session) => (
                    <div
                      key={session.id}
                      onClick={() => {
                        setActiveSession(session.id)
                        onNavigate('chat')
                      }}
                      className={`group flex items-center gap-2 px-2.5 py-2 mb-0.5 rounded-lg cursor-pointer transition-all duration-200 ${
                        session.id === activeSessionId
                          ? 'bg-[var(--accent-blue)] bg-opacity-10 text-[var(--accent-blue)]'
                          : 'hover:bg-black/5 dark:hover:bg-white/5 text-[var(--text-secondary)] hover:text-[var(--text-primary)]'
                      }`}
                    >
                      <span className={`text-[10px] ${session.id === activeSessionId ? 'text-[var(--accent-blue)]' : 'text-gray-400 opacity-50'}`}>●</span>
                      <span className="flex-1 text-[13px] truncate font-medium">
                        {truncate(session.title, 30)}
                      </span>
                      <button
                        onClick={(e) => handleDeleteSession(e, session.id)}
                        title="Delete session"
                        className="opacity-0 group-hover:opacity-100 p-1 text-[var(--text-muted)] hover:text-[var(--accent-red)] hover:bg-[var(--accent-red)] hover:bg-opacity-10 rounded transition-all duration-200"
                      >
                        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
                      </button>
                    </div>
                  ))}
                </div>
              ))}

              {sessions.length === 0 && (
                <div className="text-center py-8 text-[var(--text-muted)] text-sm flex flex-col items-center gap-2">
                  <div className="w-12 h-12 rounded-full bg-black/5 dark:bg-white/5 flex items-center justify-center mb-2">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
                  </div>
                  No sessions yet
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-hidden bg-white/30 dark:bg-black/20">
            <ProjectExplorer onNavigate={onNavigate} onSelectTab={setActiveTab} />
          </div>
        )}

        {/* Footer Nav */}
        <div className="p-2 border-t border-[var(--border)] bg-black/5 dark:bg-white/5 shrink-0 flex gap-1">
          {[
            { id: 'composer' as const, label: 'Composer', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"></path></svg> },
            { id: 'agents' as const, label: 'Agents', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"></rect><circle cx="12" cy="5" r="2"></circle><path d="M12 7v4"></path><line x1="8" y1="16" x2="8" y2="16"></line><line x1="16" y1="16" x2="16" y2="16"></line></svg> },
            { id: 'settings' as const, label: 'Settings', icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"></circle><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"></path></svg> }
          ].map((item) => (
            <button
              key={item.id}
              id={`nav-${item.id}`}
              onClick={() => onNavigate(item.id)}
              title={`Go to ${item.label}`}
              className={`flex-1 py-2 px-2 rounded-lg flex flex-col items-center gap-1 transition-all duration-200 cursor-pointer ${
                currentPage === item.id
                  ? 'bg-[var(--accent-blue)] text-white shadow-md'
                  : 'text-[var(--text-secondary)] hover:bg-black/10 dark:hover:bg-white/10 hover:text-[var(--text-primary)]'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-medium">{item.label}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
