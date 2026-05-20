// ═══════════════════════════════════════════════════════════════════
// Lumiq — GitPanel (Source Control)
// Git status, stage/unstage, diff preview, and commit
// ═══════════════════════════════════════════════════════════════════

import React, { useCallback, useEffect, useState } from 'react'
import { useGitStore } from '@renderer/store/gitStore'
import { useSessionStore } from '@renderer/store/sessionStore'
import { useEditorStore } from '@renderer/store/editorStore'
import type { GitFileChange, GitFileStatus } from '@shared/types'

const STATUS_ICONS: Record<GitFileStatus, { letter: string; color: string }> = {
  modified:   { letter: 'M', color: '#e2b340' },
  added:      { letter: 'A', color: '#3fb950' },
  deleted:    { letter: 'D', color: '#f85149' },
  renamed:    { letter: 'R', color: '#a371f7' },
  untracked:  { letter: 'U', color: '#8b949e' },
  conflicted: { letter: '!', color: '#f85149' }
}

export function GitPanel(): React.JSX.Element {
  const {
    isRepo, branch, ahead, behind, changes, isLoading,
    selectedFile, diffContent, commitMessage,
    refresh, selectFile, loadDiff, stage, unstage, discard, commit, setCommitMessage
  } = useGitStore()

  const workspacePath = useSessionStore(s => s.sessions.find(s2 => s2.id === s.activeSessionId)?.workspacePath)
  const openFile = useEditorStore(s => s.openFile)
  const [showDiff, setShowDiff] = useState(false)

  // Auto-refresh on mount and periodically
  useEffect(() => {
    if (!workspacePath) return
    refresh(workspacePath)
    const interval = setInterval(() => refresh(workspacePath), 10_000) // 10s polling
    return () => clearInterval(interval)
  }, [workspacePath, refresh])

  const handleRefresh = useCallback(() => {
    if (workspacePath) refresh(workspacePath)
  }, [workspacePath, refresh])

  const handleStage = useCallback(async (files: string[]) => {
    if (workspacePath) await stage(workspacePath, files)
  }, [workspacePath, stage])

  const handleUnstage = useCallback(async (files: string[]) => {
    if (workspacePath) await unstage(workspacePath, files)
  }, [workspacePath, unstage])

  const handleDiscard = useCallback(async (files: string[]) => {
    if (!workspacePath) return
    if (confirm(`Discard changes to ${files.length} file(s)? This cannot be undone.`)) {
      await discard(workspacePath, files)
    }
  }, [workspacePath, discard])

  const handleCommit = useCallback(async () => {
    if (!workspacePath) return
    const ok = await commit(workspacePath)
    if (!ok) alert('Commit failed. Make sure you have staged changes and a commit message.')
  }, [workspacePath, commit])

  const handleFileClick = useCallback((change: GitFileChange) => {
    selectFile(change.file)
    if (workspacePath) {
      loadDiff(workspacePath, change.file, change.staged)
      setShowDiff(true)
    }
  }, [workspacePath, loadDiff, selectFile])

  const handleOpenFile = useCallback((file: string) => {
    if (!workspacePath) return
    const fullPath = `${workspacePath}\\${file.replace(/\//g, '\\')}`
    const fileName = file.split('/').pop() || file
    openFile(fullPath, fileName)
  }, [workspacePath, openFile])

  // Not a git repo
  if (!isRepo && !isLoading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', padding: '32px', color: 'var(--text-muted)', background: 'var(--bg-primary)' }}>
        <div style={{ fontSize: '40px', marginBottom: '12px', opacity: 0.2 }}>⎇</div>
        <div style={{ fontSize: '13px', textAlign: 'center' }}>
          {workspacePath ? 'Not a git repository' : 'Bind a workspace to see git status'}
        </div>
      </div>
    )
  }

  const stagedChanges = changes.filter(c => c.staged)
  const unstagedChanges = changes.filter(c => !c.staged)

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)' }}>
      {/* Header */}
      <div style={{
        padding: '10px 12px',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        gap: '8px',
        flexShrink: 0
      }}>
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-blue)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <circle cx="18" cy="18" r="3" /><circle cx="6" cy="6" r="3" /><path d="M13 6h3a2 2 0 0 1 2 2v7" /><line x1="6" y1="9" x2="6" y2="21" />
        </svg>
        <span style={{ fontWeight: 600, fontSize: '13px', color: 'var(--text-primary)' }}>
          {branch || 'HEAD'}
        </span>
        {ahead > 0 && <span style={{ fontSize: '10px', color: '#3fb950', fontWeight: 600 }}>↑{ahead}</span>}
        {behind > 0 && <span style={{ fontSize: '10px', color: '#f85149', fontWeight: 600 }}>↓{behind}</span>}
        <span style={{
          fontSize: '10px',
          padding: '1px 6px',
          borderRadius: '8px',
          background: changes.length > 0 ? 'var(--accent-blue)' : 'var(--bg-secondary)',
          color: changes.length > 0 ? '#fff' : 'var(--text-muted)',
          fontWeight: 600
        }}>
          {changes.length}
        </span>
        <button
          onClick={handleRefresh}
          title="Refresh"
          style={{
            marginLeft: 'auto',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            color: 'var(--text-muted)',
            padding: '4px',
            borderRadius: '4px',
            display: 'flex',
            transition: 'color 0.15s'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
            style={{ animation: isLoading ? 'spin 1s linear infinite' : 'none' }}>
            <polyline points="23 4 23 10 17 10" /><polyline points="1 20 1 14 7 14" />
            <path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15" />
          </svg>
        </button>
      </div>

      {/* Main content — split between file list and diff */}
      <div style={{ flex: 1, display: 'flex', flexDirection: showDiff ? 'row' : 'column', overflow: 'hidden' }}>
        {/* Changes list */}
        <div style={{ flex: showDiff ? '0 0 200px' : 1, overflowY: 'auto', borderRight: showDiff ? '1px solid var(--border)' : 'none' }} className="custom-scrollbar">
          {/* Staged */}
          {stagedChanges.length > 0 && (
            <ChangeSection
              title="Staged Changes"
              count={stagedChanges.length}
              changes={stagedChanges}
              selectedFile={selectedFile}
              onFileClick={handleFileClick}
              onOpenFile={handleOpenFile}
              actions={[
                { label: 'Unstage All', onClick: () => handleUnstage(stagedChanges.map(c => c.file)) }
              ]}
              fileActions={(c) => [
                { label: '−', title: 'Unstage', onClick: () => handleUnstage([c.file]) }
              ]}
            />
          )}

          {/* Unstaged */}
          {unstagedChanges.length > 0 && (
            <ChangeSection
              title="Changes"
              count={unstagedChanges.length}
              changes={unstagedChanges}
              selectedFile={selectedFile}
              onFileClick={handleFileClick}
              onOpenFile={handleOpenFile}
              actions={[
                { label: 'Stage All', onClick: () => handleStage(unstagedChanges.map(c => c.file)) },
                { label: 'Discard All', onClick: () => handleDiscard(unstagedChanges.filter(c => c.status !== 'untracked').map(c => c.file)) }
              ]}
              fileActions={(c) => [
                { label: '+', title: 'Stage', onClick: () => handleStage([c.file]) },
                ...(c.status !== 'untracked' ? [{ label: '↺', title: 'Discard', onClick: () => handleDiscard([c.file]) }] : [])
              ]}
            />
          )}

          {changes.length === 0 && !isLoading && (
            <div style={{ textAlign: 'center', padding: '32px 16px', color: 'var(--text-muted)', fontSize: '13px' }}>
              <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.3 }}>✓</div>
              No changes
            </div>
          )}
        </div>

        {/* Diff preview */}
        {showDiff && diffContent && (
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{
              padding: '6px 12px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontSize: '12px',
              color: 'var(--text-muted)',
              flexShrink: 0
            }}>
              <span style={{ fontFamily: 'var(--font-mono)' }}>{selectedFile}</span>
              <button
                onClick={() => setShowDiff(false)}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px' }}
              >✕</button>
            </div>
            <pre style={{
              flex: 1,
              overflowY: 'auto',
              padding: '8px 12px',
              margin: 0,
              fontSize: '11.5px',
              lineHeight: 1.6,
              fontFamily: 'var(--font-mono)',
              color: 'var(--text-secondary)',
              background: 'var(--bg-secondary)'
            }} className="custom-scrollbar">
              {diffContent.split('\n').map((line, i) => (
                <div key={i} style={{
                  color: line.startsWith('+') ? '#3fb950'
                    : line.startsWith('-') ? '#f85149'
                    : line.startsWith('@@') ? '#a371f7'
                    : 'inherit',
                  background: line.startsWith('+') ? 'rgba(63,185,80,0.08)'
                    : line.startsWith('-') ? 'rgba(248,81,73,0.08)'
                    : 'transparent'
                }}>
                  {line}
                </div>
              ))}
            </pre>
          </div>
        )}
      </div>

      {/* Commit area */}
      {stagedChanges.length > 0 && (
        <div style={{
          padding: '10px 12px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          gap: '6px',
          flexShrink: 0
        }}>
          <input
            id="input-commit-message"
            placeholder="Commit message…"
            value={commitMessage}
            onChange={e => setCommitMessage(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && commitMessage.trim()) handleCommit() }}
            style={{
              flex: 1,
              padding: '7px 10px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              color: 'var(--text-primary)',
              fontSize: '12px',
              outline: 'none'
            }}
          />
          <button
            id="btn-git-commit"
            onClick={handleCommit}
            disabled={!commitMessage.trim()}
            style={{
              padding: '7px 14px',
              background: commitMessage.trim() ? 'var(--accent-blue)' : 'var(--bg-secondary)',
              color: commitMessage.trim() ? '#fff' : 'var(--text-muted)',
              border: 'none',
              borderRadius: '6px',
              fontSize: '12px',
              fontWeight: 600,
              cursor: commitMessage.trim() ? 'pointer' : 'not-allowed',
              transition: 'all 0.15s'
            }}
          >
            ✓ Commit
          </button>
        </div>
      )}

      <style>{`
        @keyframes spin { to { transform: rotate(360deg) } }
      `}</style>
    </div>
  )
}

// ── ChangeSection sub-component ─────────────────────────────────────
function ChangeSection({ title, count, changes, selectedFile, onFileClick, onOpenFile, actions, fileActions }: {
  title: string
  count: number
  changes: GitFileChange[]
  selectedFile: string | null
  onFileClick: (c: GitFileChange) => void
  onOpenFile: (file: string) => void
  actions: { label: string; onClick: () => void }[]
  fileActions: (c: GitFileChange) => { label: string; title: string; onClick: () => void }[]
}): React.JSX.Element {
  return (
    <div>
      {/* Section header */}
      <div style={{
        padding: '6px 12px',
        display: 'flex',
        alignItems: 'center',
        gap: '6px',
        fontSize: '11px',
        fontWeight: 700,
        color: 'var(--text-muted)',
        textTransform: 'uppercase',
        letterSpacing: '0.5px'
      }}>
        <span>{title}</span>
        <span style={{ fontSize: '10px', padding: '0 4px', borderRadius: '6px', background: 'var(--bg-secondary)', fontWeight: 600 }}>{count}</span>
        <div style={{ flex: 1 }} />
        {actions.map(a => (
          <button
            key={a.label}
            onClick={a.onClick}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: 'var(--accent-blue)',
              fontSize: '10px',
              fontWeight: 600,
              padding: '2px 4px',
              borderRadius: '4px',
              transition: 'opacity 0.15s'
            }}
          >
            {a.label}
          </button>
        ))}
      </div>

      {/* File list */}
      {changes.map(c => {
        const si = STATUS_ICONS[c.status]
        const fileName = c.file.split('/').pop() || c.file
        const dirPath = c.file.includes('/') ? c.file.slice(0, c.file.lastIndexOf('/')) : ''
        const isSelected = selectedFile === c.file

        return (
          <div
            key={c.file}
            onClick={() => onFileClick(c)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: '3px 12px',
              cursor: 'pointer',
              background: isSelected ? 'rgba(88,166,255,0.08)' : 'transparent',
              transition: 'background 0.1s',
              fontSize: '12px'
            }}
            onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-secondary)' }}
            onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
          >
            <span style={{
              width: '14px',
              height: '14px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '10px',
              fontWeight: 700,
              fontFamily: 'var(--font-mono)',
              color: si.color,
              borderRadius: '3px',
              flexShrink: 0
            }}>
              {si.letter}
            </span>
            <span
              onClick={(e) => { e.stopPropagation(); onOpenFile(c.file) }}
              style={{ color: 'var(--text-primary)', fontWeight: 500, cursor: 'pointer' }}
              title="Open in editor"
            >
              {fileName}
            </span>
            {dirPath && <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>{dirPath}</span>}

            {/* File-level actions */}
            <div style={{ marginLeft: 'auto', display: 'flex', gap: '2px', opacity: 0.6 }}
              className="git-file-actions"
            >
              {fileActions(c).map(a => (
                <button
                  key={a.label}
                  onClick={e => { e.stopPropagation(); a.onClick() }}
                  title={a.title}
                  style={{
                    width: '20px',
                    height: '20px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    color: 'var(--text-muted)',
                    fontSize: '14px',
                    fontWeight: 700,
                    borderRadius: '3px',
                    transition: 'color 0.1s'
                  }}
                >
                  {a.label}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
}
