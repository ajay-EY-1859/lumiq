// ═══════════════════════════════════════════════════════════════════
// Lumiq — Sidebar Component
// Session list with search, date grouping, and navigation
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo } from 'react'
import { useSessionStore } from '@renderer/store/sessionStore'
import { useProviderStore } from '@renderer/store/providerStore'
import { groupByDate, truncate } from '@renderer/utils/formatters'
import type { Session } from '@shared/types'

interface SidebarProps {
  isVisible: boolean
  onNavigate: (page: 'chat' | 'settings' | 'agents') => void
  currentPage: string
}

export function Sidebar({ isVisible, onNavigate, currentPage }: SidebarProps): React.JSX.Element {
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
      style={{
        width: isVisible ? '260px' : '0px',
        minWidth: isVisible ? '260px' : '0px',
        height: '100%',
        background: 'var(--bg-secondary)',
        borderRight: isVisible ? '1px solid var(--border)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        transition: 'width var(--transition-normal), min-width var(--transition-normal)',
        flexShrink: 0
      }}
    >
      {/* New Session Button */}
      <div style={{ padding: '12px' }}>
        <button
          id="btn-new-session"
          onClick={handleNewSession}
          title="Create a new chat session"
          aria-label="New Session"
          style={{
            width: '100%',
            padding: '8px 12px',
            background: 'transparent',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            color: 'var(--text-primary)',
            fontSize: '13px',
            fontWeight: 500,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            transition: 'all var(--transition-fast)',
            fontFamily: 'var(--font-sans)'
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = 'var(--bg-tertiary)'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = 'transparent'
          }}
        >
          <span style={{ fontSize: '16px' }}>+</span>
          New Session
          <span
            style={{
              marginLeft: 'auto',
              fontSize: '11px',
              color: 'var(--text-muted)'
            }}
          >
            Ctrl+N
          </span>
        </button>
      </div>

      {/* Search */}
      <div style={{ padding: '0 12px 8px' }}>
        <div style={{ position: 'relative' }}>
          <span
            style={{
              position: 'absolute',
              left: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: 'var(--text-muted)',
              fontSize: '13px'
            }}
          >
            🔍
          </span>
          <input
            id="input-search-sessions"
            type="text"
            placeholder="Search sessions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '7px 12px 7px 32px',
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              outline: 'none',
              fontFamily: 'var(--font-sans)'
            }}
          />
        </div>
      </div>

      {/* Session List */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '0 8px' }}>
        {groupedSessions.map((group) => (
          <div key={group.label}>
            <div
              style={{
                padding: '8px 8px 4px',
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--text-muted)',
                textTransform: 'uppercase',
                letterSpacing: '0.05em'
              }}
            >
              {group.label}
            </div>
            {group.items.map((session: Session) => (
              <div
                key={session.id}
                onClick={() => {
                  setActiveSession(session.id)
                  onNavigate('chat')
                }}
                style={{
                  padding: '8px 10px',
                  borderRadius: '8px',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'background var(--transition-fast)',
                  background:
                    session.id === activeSessionId
                      ? 'rgba(37, 99, 235, 0.1)'
                      : 'transparent',
                  color:
                    session.id === activeSessionId
                      ? 'var(--accent-blue)'
                      : 'var(--text-secondary)'
                }}
                onMouseEnter={(e) => {
                  if (session.id !== activeSessionId) {
                    e.currentTarget.style.background = 'var(--bg-tertiary)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (session.id !== activeSessionId) {
                    e.currentTarget.style.background = 'transparent'
                  }
                }}
              >
                <span style={{ fontSize: '12px', opacity: 0.6 }}>○</span>
                <span
                  style={{
                    flex: 1,
                    fontSize: '13px',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap'
                  }}
                >
                  {truncate(session.title, 30)}
                </span>
                <button
                  onClick={(e) => handleDeleteSession(e, session.id)}
                  title="Delete session"
                  aria-label="Delete session"
                  style={{
                    background: 'none',
                    border: 'none',
                    color: 'var(--text-muted)',
                    cursor: 'pointer',
                    fontSize: '11px',
                    opacity: 0,
                    padding: '2px 4px',
                    borderRadius: '4px',
                    transition: 'opacity var(--transition-fast)'
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.opacity = '1'
                    e.currentTarget.style.color = 'var(--accent-red)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.opacity = '0'
                    e.currentTarget.style.color = 'var(--text-muted)'
                  }}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        ))}

        {sessions.length === 0 && (
          <div
            style={{
              textAlign: 'center',
              padding: '32px 16px',
              color: 'var(--text-muted)',
              fontSize: '13px'
            }}
          >
            No sessions yet
          </div>
        )}
      </div>

      {/* Footer Nav */}
      <div
        style={{
          borderTop: '1px solid var(--border)',
          padding: '8px'
        }}
      >
        {[
          { id: 'agents' as const, label: 'Agents', emoji: '🤖' },
          { id: 'settings' as const, label: 'Settings', emoji: '⚙️' }
        ].map((item) => (
          <button
            key={item.id}
            id={`nav-${item.id}`}
            onClick={() => onNavigate(item.id)}
            title={`Go to ${item.label}`}
            aria-label={item.label}
            style={{
              width: '100%',
              padding: '8px 12px',
              background:
                currentPage === item.id
                  ? 'rgba(37, 99, 235, 0.1)'
                  : 'transparent',
              border: 'none',
              borderRadius: '6px',
              color:
                currentPage === item.id
                  ? 'var(--accent-blue)'
                  : 'var(--text-secondary)',
              fontSize: '13px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              fontFamily: 'var(--font-sans)',
              transition: 'all var(--transition-fast)'
            }}
            onMouseEnter={(e) => {
              if (currentPage !== item.id) {
                e.currentTarget.style.background = 'var(--bg-tertiary)'
              }
            }}
            onMouseLeave={(e) => {
              if (currentPage !== item.id) {
                e.currentTarget.style.background = 'transparent'
              }
            }}
          >
            <span>{item.emoji}</span>
            {item.label}
          </button>
        ))}
      </div>
    </div>
  )
}
