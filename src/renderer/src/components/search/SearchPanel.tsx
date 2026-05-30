// ═══════════════════════════════════════════════════════════════════
// Lumiq — SearchPanel (Find in Files)
// Premium search UI with regex, case-sensitivity, include/exclude
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

  const workspacePath = useSessionStore(s => s.sessions.find(s2 => s2.id === s.activeSessionId)?.workspacePath)
  const openFile = useEditorStore(s => s.openFile)
  const inputRef = useRef<HTMLInputElement>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Debounced search
  const debounceTimer = useRef<NodeJS.Timeout | null>(null)
  const triggerSearch = useCallback(() => {
    if (!workspacePath) return
    if (debounceTimer.current) clearTimeout(debounceTimer.current)
    debounceTimer.current = setTimeout(() => {
      if (mode === 'semantic') {
        semanticSearch(workspacePath)
      } else {
        search(workspacePath)
      }
    }, 300)
  }, [workspacePath, mode, search, semanticSearch])

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
    setQuery(e.target.value)
    triggerSearch()
  }

  const handleKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      if (debounceTimer.current) clearTimeout(debounceTimer.current)
      if (workspacePath) {
        if (mode === 'semantic') {
          semanticSearch(workspacePath)
        } else {
          search(workspacePath)
        }
      }
    }
    if (e.key === 'Escape') {
      clearResults()
      setQuery('')
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
      {/* Search Input */}
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
            placeholder="Search in files… (Ctrl+Shift+F)"
            value={query}
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

          {/* Toggle buttons */}
          {mode === 'text' && (
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
            disabled={mode === 'semantic'}
            onClick={() => setShowFilters(!showFilters)}
            style={{
              ...toggleBtnStyle,
              opacity: mode === 'semantic' ? 0.4 : 1,
              background: showFilters && mode === 'text' ? 'var(--accent-blue)' : 'transparent',
              color: showFilters && mode === 'text' ? '#fff' : 'var(--text-muted)'
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3" /></svg>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '6px', marginTop: '8px' }}>
          <button
            onClick={() => setMode('text')}
            style={{
              ...modeBtnStyle,
              background: mode === 'text' ? 'var(--accent-blue)' : 'transparent',
              color: mode === 'text' ? '#fff' : 'var(--text-muted)'
            }}
          >
            Text
          </button>
          <button
            onClick={() => {
              setMode('semantic')
              if (workspacePath) {
                loadSemanticStatus(workspacePath)
                if (query.trim()) semanticSearch(workspacePath)
              }
            }}
            style={{
              ...modeBtnStyle,
              background: mode === 'semantic' ? 'var(--accent-blue)' : 'transparent',
              color: mode === 'semantic' ? '#fff' : 'var(--text-muted)'
            }}
          >
            Semantic
          </button>
          {mode === 'semantic' && (
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
        {showFilters && mode === 'text' && (
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

        {/* Status line */}
        {mode === 'text' && (totalMatches > 0 || isSearching || error) && (
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

        {mode === 'semantic' && (
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
      </div>

      {/* Results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 0' }} className="custom-scrollbar">
        {mode === 'text' && groupedResults.map(([file, matches]) => (
            <FileGroup key={file} file={file} matches={matches} onResultClick={handleResultClick} />
          ))}

        {mode === 'semantic' && semanticResults.map(match => (
          <SemanticResult key={`${match.filePath}-${match.chunkIndex}`} match={match} onResultClick={handleSemanticResultClick} />
        ))}

        {mode === 'text' && !isSearching && results.length === 0 && query && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.3 }}>🔍</div>
            No results found
          </div>
        )}

        {mode === 'semantic' && !workspacePath && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Select a workspace to use semantic search
          </div>
        )}

        {mode === 'semantic' && workspacePath && semanticStatus?.state !== 'ready' && !isIndexing && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Build a semantic index for this workspace
          </div>
        )}

        {mode === 'semantic' && workspacePath && semanticStatus?.state === 'ready' && !isSemanticSearching && semanticResults.length === 0 && query && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            No semantic matches found
          </div>
        )}

        {!query && mode === 'text' && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.2 }}>⌨</div>
            Type to search across all files
          </div>
        )}

        {!query && mode === 'semantic' && workspacePath && semanticStatus?.state === 'ready' && (
          <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
            Ask for code conceptually
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
