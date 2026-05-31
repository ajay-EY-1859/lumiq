// ═══════════════════════════════════════════════════════════════════
// Lumiq — SearchPanel (Find in Files, Semantic Search, and Chat Archive)
// Premium search UI with regex, case-sensitivity, semantic codebase search,
// and full-text past session indexing.
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSearchStore } from '@renderer/store/searchStore'
import { useSessionStore } from '@renderer/store/sessionStore'
import { useEditorStore } from '@renderer/store/editorStore'
import type { SearchMatch, SemanticSearchMatch } from '@shared/types'

export function SearchPanel(): React.JSX.Element {
  const {
    mode,
    query, isRegex, caseSensitive, includePattern, excludePattern,
    results, totalMatches, truncated, elapsed, isSearching, error,
    semanticResults, semanticTotalMatches, semanticElapsed, semanticStatus, isSemanticSearching, isIndexing, semanticError,
    setMode,
    setQuery, setIsRegex, setCaseSensitive, setIncludePattern, setExcludePattern,
    search, semanticSearch, loadSemanticStatus, indexWorkspace, clearResults
  } = useSearchStore()

  const { setActiveSession } = useSessionStore()
  const workspacePath = useSessionStore(s => s.sessions.find(s2 => s2.id === s.activeSessionId)?.workspacePath)
  const openFile = useEditorStore(s => s.openFile)
  const inputRef = useRef<HTMLInputElement>(null)
  
  const [localMode, setLocalMode] = useState<'text' | 'semantic' | 'sessions'>('text')
  const [showFilters, setShowFilters] = useState(false)

  // Session search states
  const [sessionQuery, setSessionQuery] = useState('')
  const [sessionResults, setSessionResults] = useState<any[]>([])
  const [isSessionSearching, setIsSessionSearching] = useState(false)

  // Sync localMode with global store mode
  useEffect(() => {
    if (mode === 'text' || mode === 'semantic') {
      setLocalMode(mode)
    }
  }, [mode])

  // Sync global store mode when localMode toggles
  useEffect(() => {
    if (localMode === 'text' || localMode === 'semantic') {
      setMode(localMode)
    }
  }, [localMode, setMode])

  // Debounced search
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  
  const runSessionSearch = useCallback(async (q: string): Promise<void> => {
    if (!q.trim()) {
      setSessionResults([])
      return
    }
    setIsSessionSearching(true)
    try {
      const matched = await window.electronAPI.search.sessions(q)
      setSessionResults(matched)
    } catch (err) {
      console.error('[SearchPanel] Session search failed:', err)
    } finally {
      setIsSessionSearching(false)
    }
  }, [])

  const triggerSearch = useCallback(() => {
    if (localMode === 'sessions') {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      debounceTimer.current = setTimeout(() => {
        runSessionSearch(sessionQuery)
      }, 300)
      return
    }

    if (!workspacePath) return
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      if (localMode === 'semantic') {
        semanticSearch(workspacePath)
      } else {
        search(workspacePath)
      }
    }, 300)
  }, [workspacePath, localMode, sessionQuery, search, semanticSearch, runSessionSearch])

  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
    }
  }, [])

  useEffect(() => {
    if (!workspacePath) return
    loadSemanticStatus(workspacePath)
  }, [workspacePath, loadSemanticStatus])

  useEffect(() => {
    if (!workspacePath || !isIndexing) return
    const interval = window.setInterval(() => {
      loadSemanticStatus(workspacePath)
    }, 1500)
    return () => window.clearInterval(interval)
  }, [workspacePath, isIndexing, loadSemanticStatus])

  // Ctrl+Shift+F global shortcut focuses search
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key === 'f') {
        e.preventDefault()
        inputRef.current?.focus()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    if (localMode === 'sessions') {
      setSessionQuery(e.target.value)
    } else {
      setQuery(e.target.value)
    }
    triggerSearch()
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (localMode === 'sessions') {
        runSessionSearch(sessionQuery)
      } else if (workspacePath) {
        if (localMode === 'semantic') {
          semanticSearch(workspacePath)
        } else {
          search(workspacePath)
        }
      }
    }
    if (e.key === 'Escape') {
      if (localMode === 'sessions') {
        setSessionQuery('')
        setSessionResults([])
      } else {
        clearResults()
        setQuery('')
      }
    }
  }

  const handleResultClick = (match: SearchMatch): void => {
    if (!workspacePath) return
    const fullPath = `${workspacePath}/${match.file}`.replace(/\//g, '\\')
    const fileName = match.file.split('/').pop() || match.file
    openFile(fullPath, fileName)
  }

  const handleSemanticResultClick = (match: SemanticSearchMatch): void => {
    if (!workspacePath) return
    const fullPath = `${workspacePath}/${match.filePath}`.replace(/\//g, '\\')
    const fileName = match.filePath.split(/[\\/]/).pop() || match.filePath
    openFile(fullPath, fileName)
  }

  const handleSessionClick = (sessionId: string): void => {
    setActiveSession(sessionId)
  }

  // Group results by file
  const groupedResults = useMemo(() => {
    const groups: Record<string, SearchMatch[]> = {}
    for (const m of results) {
      if (!groups[m.file]) groups[m.file] = []
      groups[m.file].push(m)
    }
    return Object.entries(groups)
  }, [results])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
      
      {/* Search Input Box */}
      <div style={{ padding: '12px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ position: 'relative', display: 'flex', gap: '4px', alignItems: 'center' }}>
          
          {/* Search icon */}
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--text-muted)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ position: 'absolute', left: '10px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
          </svg>

          <input
            ref={inputRef}
            id="input-search-files"
            type="text"
            placeholder={localMode === 'sessions' ? 'Search past chats…' : 'Search in files… (Ctrl+Shift+F)'}
            value={localMode === 'sessions' ? sessionQuery : query}
            onChange={handleQueryChange}
            onKeyDown={handleKeyDown}
            style={{
              flex: 1,
              padding: '8px 8px 8px 32px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '13px',
              outline: 'none',
              transition: 'border-color 0.2s'
            }}
          />

          {/* Toggle filter buttons */}
          {localMode === 'text' && (
            <>
              <button
                title="Match Case"
                onClick={() => { setCaseSensitive(!caseSensitive); triggerSearch() }}
                style={{
                  ...toggleBtnStyle,
                  background: caseSensitive ? 'var(--accent-blue)' : 'transparent',
                  color: caseSensitive ? '#fff' : 'var(--text-muted)'
                }}
              >
                Aa
              </button>
              <button
                title="Use Regex"
                onClick={() => { setIsRegex(!isRegex); triggerSearch() }}
                style={{
                  ...toggleBtnStyle,
                  background: isRegex ? 'var(--accent-blue)' : 'transparent',
                  color: isRegex ? '#fff' : 'var(--text-muted)'
                }}
              >
                .*
              </button>
            </>
          )}
          <button
            title="Toggle Filters"
            disabled={localMode !== 'text'}
            onClick={() => setShowFilters(!showFilters)}
            style={{
              ...toggleBtnStyle,
              opacity: localMode !== 'text' ? 0.4 : 1,
              background: showFilters && localMode === 'text' ? 'var(--accent-blue)' : 'transparent',
              color: showFilters && localMode === 'text' ? '#fff' : 'var(--text-muted)'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          </button>
        </div>

        {/* Search Mode Tab Buttons */}
        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          <button
            onClick={() => setLocalMode('text')}
            style={{
              ...modeBtnStyle,
              background: localMode === 'text' ? 'var(--accent-blue)' : 'transparent',
              color: localMode === 'text' ? '#fff' : 'var(--text-muted)'
            }}
          >
            Text
          </button>
          <button
            onClick={() => {
              setLocalMode('semantic')
              if (workspacePath) {
                loadSemanticStatus(workspacePath)
                if (query.trim()) semanticSearch(workspacePath)
              }
            }}
            style={{
              ...modeBtnStyle,
              background: localMode === 'semantic' ? 'var(--accent-blue)' : 'transparent',
              color: localMode === 'semantic' ? '#fff' : 'var(--text-muted)'
            }}
          >
            Semantic
          </button>
          <button
            onClick={() => setLocalMode('sessions')}
            style={{
              ...modeBtnStyle,
              background: localMode === 'sessions' ? 'var(--accent-blue)' : 'transparent',
              color: localMode === 'sessions' ? '#fff' : 'var(--text-muted)'
            }}
          >
            Chats Archive
          </button>
          
          {localMode === 'semantic' && (
            <button
              disabled={!workspacePath || isIndexing}
              onClick={() => workspacePath && indexWorkspace(workspacePath, semanticStatus?.state === 'ready')}
              style={{
                ...modeBtnStyle,
                marginLeft: 'auto',
                opacity: !workspacePath || isIndexing ? 0.5 : 1
              }}
            >
              {semanticStatus?.state === 'ready' ? 'Rebuild Index' : isIndexing ? 'Indexing...' : 'Index Workspace'}
            </button>
          )}
        </div>

        {/* Filters row */}
        {showFilters && localMode === 'text' && (
          <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
            <input
              placeholder="Include (e.g. *.ts,*.tsx)"
              value={includePattern}
              onChange={e => { setIncludePattern(e.target.value); triggerSearch() }}
              style={{ ...filterInputStyle }}
            />
            <input
              placeholder="Exclude (e.g. dist,out)"
              value={excludePattern}
              onChange={e => { setExcludePattern(e.target.value); triggerSearch() }}
              style={{ ...filterInputStyle }}
            />
          </div>
        )}

        {/* Status Line */}
        {localMode === 'text' && (totalMatches > 0 || isSearching || error) && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isSearching && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                Searching…
              </span>
            )}
            {!isSearching && totalMatches > 0 && (
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>{totalMatches}</strong> result{totalMatches !== 1 ? 's' : ''} in{' '}
                <strong style={{ color: 'var(--text-primary)' }}>{groupedResults.length}</strong> file{groupedResults.length !== 1 ? 's' : ''}
                {truncated && <span style={{ color: 'var(--accent-yellow, #e2b340)' }}> (truncated)</span>}
                <span style={{ opacity: 0.6 }}> · {elapsed}ms</span>
              </span>
            )}
            {error && <span style={{ color: 'var(--accent-red, #ef4444)' }}>{error}</span>}
          </div>
        )}

        {localMode === 'semantic' && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center', minHeight: '16px' }}>
            {(isSemanticSearching || isIndexing) && (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                {isIndexing ? 'Indexing workspace...' : 'Searching semantically...'}
              </span>
            )}
            {!isSemanticSearching && !isIndexing && semanticStatus && (
              <span>
                <strong style={{ color: 'var(--text-primary)' }}>{semanticStatus.chunksStored}</strong> chunks
                {semanticStatus.state !== 'ready' && <span> · {semanticStatus.state}</span>}
                {semanticTotalMatches > 0 && (
                  <span>
                    {' '}· <strong style={{ color: 'var(--text-primary)' }}>{semanticTotalMatches}</strong> matches
                    <span style={{ opacity: 0.6 }}> · {semanticElapsed}ms</span>
                  </span>
                )}
              </span>
            )}
            {semanticError && <span style={{ color: 'var(--accent-red, #ef4444)' }}>{semanticError}</span>}
          </div>
        )}

        {localMode === 'sessions' && (isSessionSearching || sessionResults.length > 0) && (
          <div style={{ marginTop: '8px', fontSize: '11px', color: 'var(--text-muted)', display: 'flex', gap: '8px', alignItems: 'center' }}>
            {isSessionSearching ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <span style={{ width: '10px', height: '10px', border: '2px solid var(--accent-blue)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.6s linear infinite', display: 'inline-block' }} />
                Searching archives…
              </span>
            ) : (
              <span>Found <strong style={{ color: 'var(--text-primary)' }}>{sessionResults.length}</strong> matching chats</span>
            )}
          </div>
        )}
      </div>

      {/* Results Viewport */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }} className="custom-scrollbar">
        {localMode === 'text' && groupedResults.map(([file, matches]) => (
          <FileGroup key={file} file={file} matches={matches} onResultClick={handleResultClick} />
        ))}

        {localMode === 'semantic' && semanticResults.map(match => (
          <SemanticResult key={`${match.filePath}-${match.chunkIndex}`} match={match} onResultClick={handleSemanticResultClick} />
        ))}

        {localMode === 'sessions' && sessionResults.map(res => (
          <button
            key={res.id}
            onClick={() => handleSessionClick(res.id)}
            style={{
              width: '100%',
              display: 'block',
              padding: '10px 14px',
              background: 'none',
              border: 'none',
              borderBottom: '1px solid var(--border)',
              cursor: 'pointer',
              textAlign: 'left',
              color: 'var(--text-secondary)',
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '4px' }}>
              <span style={{ color: 'var(--accent-blue)', fontSize: '12px', fontWeight: 700 }}>
                💬 {res.title}
              </span>
              <span style={{ marginLeft: 'auto', fontSize: '9px', padding: '2px 5px', borderRadius: '4px', background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                {res.provider}
              </span>
            </div>
            <div style={{
              fontSize: '11px',
              color: 'var(--text-muted)',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              lineHeight: 1.4
            }}>
              {res.matchedContent}
            </div>
          </button>
        ))}

        {/* Empty States */}
        {localMode === 'text' && !isSearching && results.length === 0 && query && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.3 }}>🔍</div>
            No results found
          </div>
        )}

        {localMode === 'semantic' && !workspacePath && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Select a workspace to use semantic search
          </div>
        )}

        {localMode === 'semantic' && workspacePath && semanticStatus?.state !== 'ready' && !isIndexing && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Build a semantic index for this workspace
          </div>
        )}

        {localMode === 'semantic' && workspacePath && semanticStatus?.state === 'ready' && !isSemanticSearching && semanticResults.length === 0 && query && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            No semantic matches found
          </div>
        )}

        {localMode === 'sessions' && !isSessionSearching && sessionResults.length === 0 && sessionQuery && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            No matching chat archives found
          </div>
        )}

        {!query && localMode === 'text' && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.2 }}>⌨</div>
            Type to search across all files
          </div>
        )}

        {!query && localMode === 'semantic' && workspacePath && semanticStatus?.state === 'ready' && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Ask for code conceptually
          </div>
        )}

        {!sessionQuery && localMode === 'sessions' && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.2 }}>💬</div>
            Search past chat session archives
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

// ── Collapsible file group ──────────────────────────────────────────
function FileGroup({ file, matches, onResultClick }: {
  file: string
  matches: SearchMatch[]
  onResultClick: (m: SearchMatch) => void
}): React.JSX.Element {
  const [collapsed, setCollapsed] = useState(false)
  const fileName = file.split('/').pop() || file
  const dirPath = file.includes('/') ? file.slice(0, file.lastIndexOf('/')) : ''

  return (
    <div style={{ marginBottom: '2px' }}>
      {/* File header */}
      <button
        onClick={() => setCollapsed(!collapsed)}
        style={{
          width: '100%',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          padding: '4px 12px',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          color: 'var(--text-primary)',
          fontSize: '12px',
          fontWeight: 600,
          textAlign: 'left',
          transition: 'background 0.15s'
        }}
        onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'none')}
      >
        <span style={{ transform: collapsed ? 'rotate(-90deg)' : 'rotate(0)', transition: 'transform 0.15s', fontSize: '10px', opacity: 0.5 }}>▼</span>
        <span style={{ color: 'var(--accent-blue)' }}>{fileName}</span>
        {dirPath && <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontWeight: 400 }}>{dirPath}</span>}
        <span style={{
          marginLeft: 'auto',
          fontSize: '10px',
          padding: '1px 6px',
          borderRadius: '8px',
          background: 'var(--accent-blue)',
          color: '#fff',
          fontWeight: 600,
          opacity: 0.8
        }}>
          {matches.length}
        </span>
      </button>

      {/* Matches */}
      {!collapsed && matches.map((m, i) => (
        <button
          key={`${m.line}-${i}`}
          onClick={() => onResultClick(m)}
          style={{
            width: '100%',
            display: 'flex',
            alignItems: 'baseline',
            gap: '8px',
            padding: '3px 12px 3px 28px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            textAlign: 'left',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            transition: 'background 0.15s'
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          <span style={{ color: 'var(--text-muted)', fontSize: '11px', fontFamily: 'var(--font-mono)', minWidth: '32px', textAlign: 'right' }}>
            {m.line}
          </span>
          <span style={{
            flex: 1,
            fontFamily: 'var(--font-mono)',
            fontSize: '11.5px',
            whiteSpace: 'nowrap',
            overflow: 'hidden',
            textOverflow: 'ellipsis'
          }}>
            {m.content}
          </span>
        </button>
      ))}
    </div>
  )
}

function SemanticResult({ match, onResultClick }: {
  match: SemanticSearchMatch
  onResultClick: (m: SemanticSearchMatch) => void
}): React.JSX.Element {
  const fileName = match.filePath.split(/[\\/]/).pop() || match.filePath
  const dirPath = match.filePath.includes('/') ? match.filePath.slice(0, match.filePath.lastIndexOf('/')) : ''

  return (
    <button
      onClick={() => onResultClick(match)}
      style={{
        width: '100%',
        display: 'block',
        padding: '8px 12px',
        background: 'none',
        border: 'none',
        borderBottom: '1px solid var(--border)',
        cursor: 'pointer',
        textAlign: 'left',
        color: 'var(--text-secondary)',
        transition: 'background 0.15s'
      }}
      onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-secondary)')}
      onMouseLeave={e => (e.currentTarget.style.background = 'none')}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '5px' }}>
        <span style={{ color: 'var(--accent-blue)', fontSize: '12px', fontWeight: 700 }}>{fileName}</span>
        {dirPath && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{dirPath}</span>}
        <span style={{ marginLeft: 'auto', color: 'var(--text-muted)', fontSize: '10px', fontFamily: 'var(--font-mono)' }}>
          {(match.score * 100).toFixed(0)}%
        </span>
      </div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: '11.5px',
        lineHeight: 1.45,
        color: 'var(--text-secondary)',
        display: '-webkit-box',
        WebkitLineClamp: 4,
        WebkitBoxOrient: 'vertical',
        overflow: 'hidden',
        whiteSpace: 'pre-wrap'
      }}>
        {match.content}
      </div>
    </button>
  )
}

// ── Styles ──
const toggleBtnStyle: React.CSSProperties = {
  width: '28px',
  height: '28px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  cursor: 'pointer',
  fontSize: '12px',
  fontWeight: 700,
  fontFamily: 'var(--font-mono)',
  transition: 'all 0.15s',
  flexShrink: 0
}

const modeBtnStyle: React.CSSProperties = {
  padding: '5px 8px',
  minHeight: '26px',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  background: 'transparent',
  color: 'var(--text-muted)',
  cursor: 'pointer',
  fontSize: '11px',
  fontWeight: 700,
  transition: 'all 0.15s'
}

const filterInputStyle: React.CSSProperties = {
  flex: 1,
  padding: '5px 8px',
  background: 'var(--bg-secondary)',
  border: '1px solid var(--border)',
  borderRadius: '6px',
  color: 'var(--text-primary)',
  fontSize: '11px',
  outline: 'none'
}
