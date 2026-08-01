// ═══════════════════════════════════════════════════════════════════
// Lumiq — Sidebar Component (Premium Redesign v2)
// Glass rail · Glow navigation · Session cards with gradients
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react'
import { useSessionStore } from '@renderer/store/sessionStore'
import { useProviderStore } from '@renderer/store/providerStore'
import { groupByDate, truncate } from '@renderer/utils/formatters'
import { ProjectExplorer } from './ProjectExplorer'
import type { Session } from '@shared/types'

interface SidebarProps {
  isVisible: boolean
  onNavigate: (page: 'chat' | 'settings' | 'agents' | 'composer' | 'hub') => void
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

  const navItems = [
    {
      id: 'composer' as const,
      label: 'Composer',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z"/></svg>,
    },
    {
      id: 'agents' as const,
      label: 'Agents',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="11" width="18" height="10" rx="2"/><circle cx="12" cy="5" r="2"/><path d="M12 7v4"/><line x1="8" y1="16" x2="8" y2="16"/><line x1="16" y1="16" x2="16" y2="16"/></svg>,
    },
    {
      id: 'hub' as const,
      label: 'Tools',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="9" rx="1"/><rect x="14" y="3" width="7" height="5" rx="1"/><rect x="14" y="12" width="7" height="9" rx="1"/><rect x="3" y="16" width="7" height="5" rx="1"/></svg>,
    },
    {
      id: 'settings' as const,
      label: 'Settings',
      icon: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>,
    },
  ]

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        height: '100%',
        overflow: 'hidden',
        flexShrink: 0,
        width: isVisible ? '280px' : '0px',
        minWidth: isVisible ? '280px' : '0px',
        background: 'transparent',
        transition: 'width 0.3s cubic-bezier(0.4, 0, 0.2, 1), min-width 0.3s cubic-bezier(0.4, 0, 0.2, 1)',
      }}
    >
      <div
        className="glass-card noise-overlay"
        style={{
          display: 'flex',
          flexDirection: 'column',
          height: 'calc(100% - 12px)',
          margin: '0 10px 12px 10px',
          overflow: 'hidden',
          background: 'var(--sidebar-bg)',
          borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--glass-border)',
        }}
      >
        {/* Tabs */}
        <div style={{
          display: 'flex',
          flexShrink: 0,
          borderBottom: '1px solid var(--border)',
        }}>
          {['sessions', 'explorer'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab as 'sessions' | 'explorer')}
              style={{
                flex: 1,
                padding: '12px 0',
                fontSize: '12px',
                fontWeight: activeTab === tab ? 700 : 500,
                color: activeTab === tab ? 'var(--text-primary)' : 'var(--text-muted)',
                background: 'none',
                border: 'none',
                borderBottom: activeTab === tab ? '2px solid var(--accent-blue)' : '2px solid transparent',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
                letterSpacing: '0.02em',
              }}
            >
              {tab === 'sessions' ? 'Chats' : 'Explorer'}
            </button>
          ))}
        </div>

        {activeTab === 'sessions' ? (
          <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>
            {/* New Session Button */}
            <div style={{ padding: '10px 10px 4px' }}>
              <button
                id="btn-new-session"
                onClick={handleNewSession}
                title="Create a new chat session"
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '10px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px solid var(--border)',
                  background: 'none',
                  color: 'var(--text-primary)',
                  fontSize: '13px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.3)'
                  e.currentTarget.style.background = 'rgba(59, 130, 246, 0.04)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'var(--border)'
                  e.currentTarget.style.background = 'none'
                }}
              >
                <span style={{
                  width: '22px',
                  height: '22px',
                  borderRadius: 'var(--radius-sm)',
                  background: 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  fontSize: '14px',
                  fontWeight: 700,
                  boxShadow: '0 2px 8px rgba(59, 130, 246, 0.2)',
                }}>+</span>
                New Session
                <span style={{
                  marginLeft: 'auto',
                  fontSize: '10px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  opacity: 0.6,
                }}>
                  ⌃N
                </span>
              </button>
            </div>

            {/* Search */}
            <div style={{ padding: '6px 10px' }}>
              <div style={{ position: 'relative' }}>
                <svg
                  width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
                  style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)' }}
                >
                  <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                </svg>
                <input
                  id="input-search-sessions"
                  type="text"
                  placeholder="Search sessions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '8px 10px 8px 32px',
                    background: 'var(--bg-tertiary)',
                    border: '1px solid var(--border)',
                    borderRadius: 'var(--radius-md)',
                    color: 'var(--text-primary)',
                    fontSize: '12px',
                    outline: 'none',
                    transition: 'border-color 0.2s ease',
                  }}
                  onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(59,130,246,0.3)'}
                  onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
                />
              </div>
            </div>

            {/* Session List */}
            <div style={{ flex: 1, overflowY: 'auto', padding: '0 6px 8px' }}>
              {groupedSessions.map((group) => (
                <div key={group.label} style={{ marginBottom: '6px' }}>
                  <div style={{
                    padding: '6px 8px 4px',
                    fontSize: '10px',
                    fontWeight: 700,
                    color: 'var(--text-muted)',
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}>
                    {group.label}
                  </div>
                  {group.items.map((session: Session) => {
                    const isActive = session.id === activeSessionId
                    return (
                      <div
                        key={session.id}
                        onClick={() => {
                          setActiveSession(session.id)
                          onNavigate('chat')
                        }}
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          padding: '8px 10px',
                          marginBottom: '2px',
                          borderRadius: 'var(--radius-md)',
                          cursor: 'pointer',
                          transition: 'all 0.2s ease',
                          background: isActive ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                          borderLeft: isActive ? '3px solid var(--accent-blue)' : '3px solid transparent',
                          color: isActive ? 'var(--text-primary)' : 'var(--text-secondary)',
                        }}
                        onMouseEnter={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'var(--bg-tertiary)'
                          }
                        }}
                        onMouseLeave={(e) => {
                          if (!isActive) {
                            e.currentTarget.style.background = 'transparent'
                          }
                        }}
                      >
                        {/* Session dot */}
                        <span style={{
                          width: '6px',
                          height: '6px',
                          borderRadius: '50%',
                          background: isActive ? 'var(--accent-blue)' : 'var(--text-muted)',
                          opacity: isActive ? 1 : 0.3,
                          boxShadow: isActive ? '0 0 8px rgba(59, 130, 246, 0.4)' : 'none',
                          flexShrink: 0,
                          transition: 'all 0.2s ease',
                        }} />

                        <span style={{
                          flex: 1,
                          fontSize: '13px',
                          fontWeight: isActive ? 600 : 500,
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}>
                          {truncate(session.title, 28)}
                        </span>

                        {/* Delete button */}
                        <button
                          onClick={(e) => handleDeleteSession(e, session.id)}
                          title="Delete session"
                          style={{
                            opacity: 0,
                            padding: '4px',
                            background: 'none',
                            border: 'none',
                            cursor: 'pointer',
                            color: 'var(--text-muted)',
                            borderRadius: '4px',
                            display: 'flex',
                            alignItems: 'center',
                            transition: 'all 0.15s ease',
                          }}
                          onMouseEnter={(e) => {
                            e.currentTarget.style.color = 'var(--accent-red)'
                            e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)'
                          }}
                          onMouseLeave={(e) => {
                            e.currentTarget.style.color = 'var(--text-muted)'
                            e.currentTarget.style.background = 'none'
                          }}
                          className="group-hover-visible"
                        >
                          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                            <polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/>
                          </svg>
                        </button>
                      </div>
                    )
                  })}
                </div>
              ))}

              {sessions.length === 0 && (
                <div style={{
                  textAlign: 'center',
                  padding: '32px 16px',
                  color: 'var(--text-muted)',
                  fontSize: '13px',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '10px',
                }}>
                  <div style={{
                    width: '48px',
                    height: '48px',
                    borderRadius: '16px',
                    background: 'var(--bg-tertiary)',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}>
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                    </svg>
                  </div>
                  No sessions yet
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', opacity: 0.7 }}>
                    Press Ctrl+N to start
                  </span>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ProjectExplorer onNavigate={onNavigate} onSelectTab={setActiveTab} />
          </div>
        )}

        {/* Footer Nav */}
        <div style={{
          padding: '6px 8px',
          borderTop: '1px solid var(--border)',
          flexShrink: 0,
          display: 'flex',
          gap: '2px',
        }}>
          {navItems.map((item) => {
            const isActive = currentPage === item.id
            return (
              <button
                key={item.id}
                id={`nav-${item.id}`}
                onClick={() => onNavigate(item.id)}
                title={`Go to ${item.label}`}
                style={{
                  flex: 1,
                  padding: '8px 4px',
                  borderRadius: 'var(--radius-md)',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: '3px',
                  border: 'none',
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                  background: isActive
                    ? 'linear-gradient(135deg, var(--accent-blue), var(--accent-cyan))'
                    : 'transparent',
                  color: isActive ? 'white' : 'var(--text-muted)',
                  boxShadow: isActive ? '0 4px 12px rgba(59, 130, 246, 0.2)' : 'none',
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'var(--bg-tertiary)'
                    e.currentTarget.style.color = 'var(--text-primary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.background = 'transparent'
                    e.currentTarget.style.color = 'var(--text-muted)'
                  }
                }}
              >
                {item.icon}
                <span style={{ fontSize: '9px', fontWeight: 600, letterSpacing: '0.02em' }}>{item.label}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
