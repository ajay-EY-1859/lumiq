// ═══════════════════════════════════════════════════════════════════
// Lumiq — DiffViewer Component
// Renders unified diff output with syntax-highlighted hunks,
// per-hunk accept/reject controls, and apply-to-file actions.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useMemo, useCallback, useEffect } from 'react'

// ─── Types ──────────────────────────────────────────────────────────
interface DiffLine {
  type: '+' | '-' | ' '
  content: string
}

interface DiffHunk {
  id: string
  header: string   // e.g. "@@ -1,5 +1,7 @@"
  lines: DiffLine[]
  status: 'pending' | 'accepted' | 'rejected'
}

interface ParsedDiff {
  fileA: string
  fileB: string
  hunks: DiffHunk[]
}

interface DiffViewerProps {
  diffContent: string
  sessionId: string
  messageId?: string
}

// ─── Parser ─────────────────────────────────────────────────────────
function parseDiff(raw: string): ParsedDiff | null {
  const lines = raw.split('\n')
  let fileA = ''
  let fileB = ''
  const hunks: DiffHunk[] = []
  let currentHunk: DiffHunk | null = null
  let hunkIdx = 0

  for (const line of lines) {
    if (line.startsWith('--- ')) {
      fileA = line.slice(4).trim()
      continue
    }
    if (line.startsWith('+++ ')) {
      fileB = line.slice(4).trim()
      continue
    }
    if (line.startsWith('@@ ')) {
      // Save previous hunk
      if (currentHunk) hunks.push(currentHunk)
      currentHunk = {
        id: `hunk_${hunkIdx++}`,
        header: line,
        lines: [],
        status: 'pending'
      }
      continue
    }
    if (currentHunk) {
      if (line.startsWith('+')) {
        currentHunk.lines.push({ type: '+', content: line.slice(1) })
      } else if (line.startsWith('-')) {
        currentHunk.lines.push({ type: '-', content: line.slice(1) })
      } else {
        currentHunk.lines.push({ type: ' ', content: line.startsWith(' ') ? line.slice(1) : line })
      }
    }
  }

  // Push last hunk
  if (currentHunk) hunks.push(currentHunk)

  if (!fileA && !fileB && hunks.length === 0) return null

  return { fileA, fileB, hunks }
}

// ─── Component ──────────────────────────────────────────────────────
export function DiffViewer({ diffContent, sessionId, messageId }: DiffViewerProps): React.JSX.Element | null {
  const parsed = useMemo(() => parseDiff(diffContent), [diffContent])
  const [hunks, setHunks] = useState<DiffHunk[]>(() => parsed?.hunks ?? [])
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    setHunks(parsed?.hunks ?? [])
  }, [parsed])

  const targetFile = parsed?.fileB || parsed?.fileA || ''

  const getHunkPatch = useCallback((hunk: DiffHunk): string => {
    const header = `${parsed?.fileA ? `${parsed.fileA}\n` : ''}${parsed?.fileB ? `${parsed.fileB}\n` : ''}${hunk.header}`
    const body = hunk.lines.map((line) => `${line.type}${line.content}`).join('\n')
    return `${header}\n${body}`
  }, [parsed])

  const recordDecision = useCallback(async (hunk: DiffHunk, decision: 'accepted' | 'rejected' | 'applied') => {
    if (!sessionId || !targetFile) return
    try {
      await window.electronAPI.editDecision.record({
        sessionId,
        messageId: messageId || null,
        targetFile,
        hunkHeader: hunk.header,
        decision,
        patchText: getHunkPatch(hunk)
      })
    } catch (error) {
      console.error('Failed to record edit decision', error)
    }
  }, [getHunkPatch, messageId, sessionId, targetFile])

  const updateHunkStatus = useCallback((hunkId: string, status: 'accepted' | 'rejected') => {
    const hunk = hunks.find((item) => item.id === hunkId)
    setHunks(prev => prev.map(h => h.id === hunkId ? { ...h, status } : h))
    if (hunk) void recordDecision(hunk, status)
  }, [hunks, recordDecision])

  const handleCopyPatch = useCallback(() => {
    navigator.clipboard.writeText(diffContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [diffContent])

  const handleApplyToFile = useCallback(async () => {
    if (!parsed) return
    const filePath = parsed.fileB || parsed.fileA
    if (!filePath || filePath === 'text-a' || filePath === 'text-b') {
      alert('Cannot apply: no target file path in diff')
      return
    }

    try {
      const currentContent = await window.electronAPI.fs.readFile(filePath)
      const contentLines = currentContent.split('\n')

      // Apply accepted hunks in reverse order to maintain line numbers
      const acceptedHunks = hunks.filter(h => h.status === 'accepted')
      if (acceptedHunks.length === 0) {
        alert('No hunks accepted. Accept at least one hunk to apply.')
        return
      }

      // Simple patch approach: apply full diff to file
      // For accepted hunks, apply the changes
      let result = [...contentLines]
      let offset = 0

      for (const hunk of acceptedHunks) {
        // Parse hunk header for line numbers
        const match = hunk.header.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/)
        if (!match) continue

        const startA = parseInt(match[1], 10) - 1 + offset
        const removedLines = hunk.lines.filter(l => l.type === '-').map(l => l.content)
        const addedLines = hunk.lines.filter(l => l.type === '+').map(l => l.content)

        // Find and replace the removed lines with added lines
        let foundIdx = -1
        for (let i = Math.max(0, startA - 2); i < result.length; i++) {
          const slice = result.slice(i, i + removedLines.length)
          if (slice.length === removedLines.length && slice.every((s, idx) => s === removedLines[idx])) {
            foundIdx = i
            break
          }
        }

        if (foundIdx !== -1) {
          result.splice(foundIdx, removedLines.length, ...addedLines)
          offset += addedLines.length - removedLines.length
        }
      }

      await window.electronAPI.fs.writeFile(filePath, result.join('\n'))
      await Promise.all(acceptedHunks.map((hunk) => recordDecision(hunk, 'applied')))

      // Mark all accepted as applied
      setHunks(prev => prev.map(h =>
        h.status === 'accepted' ? { ...h, status: 'accepted' as const } : h
      ))
      alert(`Applied ${acceptedHunks.length} hunk(s) to ${filePath}`)
    } catch (e) {
      alert(`Failed to apply: ${(e as Error).message}`)
    }
  }, [parsed, hunks, recordDecision])

  if (!parsed || parsed.hunks.length === 0) return null

  const acceptedCount = hunks.filter(h => h.status === 'accepted').length
  const rejectedCount = hunks.filter(h => h.status === 'rejected').length
  const pendingCount = hunks.filter(h => h.status === 'pending').length

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '8px',
      overflow: 'hidden',
      marginTop: '8px',
      background: 'var(--bg-primary)'
    }}>
      {/* Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '8px 12px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        gap: '8px'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', minWidth: 0 }}>
          <span style={{ fontSize: '12px', color: 'var(--accent-blue)', fontWeight: 600 }}>📝 DIFF</span>
          <span style={{
            fontSize: '12px',
            color: 'var(--text-secondary)',
            fontFamily: 'var(--font-mono)',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap'
          }}>
            {parsed.fileA} → {parsed.fileB}
          </span>
        </div>
        <div style={{ display: 'flex', gap: '6px', flexShrink: 0 }}>
          {/* Status badges */}
          {acceptedCount > 0 && (
            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(63, 185, 80, 0.15)', color: '#3fb950' }}>
              ✓ {acceptedCount}
            </span>
          )}
          {rejectedCount > 0 && (
            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(248, 81, 73, 0.15)', color: '#f85149' }}>
              ✕ {rejectedCount}
            </span>
          )}
          {pendingCount > 0 && (
            <span style={{ fontSize: '11px', padding: '2px 6px', borderRadius: '4px', background: 'rgba(139, 148, 158, 0.15)', color: '#8b949e' }}>
              ◌ {pendingCount}
            </span>
          )}
        </div>
      </div>

      {/* Hunks */}
      <div style={{ maxHeight: '400px', overflowY: 'auto' }}>
        {hunks.map((hunk) => (
          <HunkView
            key={hunk.id}
            hunk={hunk}
            onAccept={() => updateHunkStatus(hunk.id, 'accepted')}
            onReject={() => updateHunkStatus(hunk.id, 'rejected')}
          />
        ))}
      </div>

      {/* Action Bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'flex-end',
        padding: '8px 12px',
        gap: '8px',
        borderTop: '1px solid var(--border)',
        background: 'var(--bg-secondary)'
      }}>
        <button
          onClick={() => {
            setHunks(prev => {
              void Promise.all(prev.map((hunk) => recordDecision(hunk, 'accepted')))
              return prev.map(h => ({ ...h, status: 'accepted' as const }))
            })
          }}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '12px',
            color: '#3fb950',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'background 0.15s'
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(63,185,80,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          Accept All
        </button>
        <button
          onClick={() => {
            setHunks(prev => {
              void Promise.all(prev.map((hunk) => recordDecision(hunk, 'rejected')))
              return prev.map(h => ({ ...h, status: 'rejected' as const }))
            })
          }}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '12px',
            color: '#f85149',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'background 0.15s'
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,81,73,0.08)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          Reject All
        </button>
        <button
          onClick={handleCopyPatch}
          style={{
            background: 'none',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '4px 10px',
            fontSize: '12px',
            color: 'var(--text-secondary)',
            cursor: 'pointer',
            fontWeight: 500,
            transition: 'background 0.15s'
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'none')}
        >
          {copied ? '✓ Copied' : '📋 Copy Patch'}
        </button>
        {acceptedCount > 0 && (
          <button
            onClick={handleApplyToFile}
            style={{
              background: 'linear-gradient(135deg, #238636, #2ea043)',
              border: 'none',
              borderRadius: '6px',
              padding: '4px 12px',
              fontSize: '12px',
              color: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'opacity 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
          >
            Apply {acceptedCount} Hunk{acceptedCount > 1 ? 's' : ''}
          </button>
        )}
      </div>
    </div>
  )
}

// ─── Hunk View ──────────────────────────────────────────────────────
function HunkView({ hunk, onAccept, onReject }: {
  hunk: DiffHunk
  onAccept: () => void
  onReject: () => void
}): React.JSX.Element {
  const statusBorder = hunk.status === 'accepted'
    ? '3px solid #3fb950'
    : hunk.status === 'rejected'
      ? '3px solid #f85149'
      : '3px solid transparent'

  const statusBg = hunk.status === 'accepted'
    ? 'rgba(63,185,80,0.04)'
    : hunk.status === 'rejected'
      ? 'rgba(248,81,73,0.04)'
      : 'transparent'

  return (
    <div style={{
      borderLeft: statusBorder,
      background: statusBg,
      transition: 'border-color 0.2s, background 0.2s'
    }}>
      {/* Hunk header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '4px 10px',
        background: 'rgba(130,80,223,0.06)',
        borderBottom: '1px solid var(--border)',
        borderTop: '1px solid var(--border)'
      }}>
        <span style={{
          fontFamily: 'var(--font-mono)',
          fontSize: '11px',
          color: '#8250df'
        }}>
          {hunk.header}
        </span>
        <div style={{ display: 'flex', gap: '4px' }}>
          {hunk.status === 'pending' ? (
            <>
              <button
                onClick={onAccept}
                title="Accept this hunk"
                style={{
                  background: 'none',
                  border: '1px solid rgba(63,185,80,0.3)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  color: '#3fb950',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(63,185,80,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                ✓ Accept
              </button>
              <button
                onClick={onReject}
                title="Reject this hunk"
                style={{
                  background: 'none',
                  border: '1px solid rgba(248,81,73,0.3)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  color: '#f85149',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(248,81,73,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                ✕ Reject
              </button>
            </>
          ) : (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: hunk.status === 'accepted' ? '#3fb950' : '#f85149',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {hunk.status === 'accepted' ? '✓ Accepted' : '✕ Rejected'}
            </span>
          )}
        </div>
      </div>

      {/* Diff lines */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.6 }}>
        {hunk.lines.map((line, i) => (
          <div
            key={i}
            style={{
              padding: '0 10px',
              background: line.type === '+'
                ? 'rgba(63,185,80,0.10)'
                : line.type === '-'
                  ? 'rgba(248,81,73,0.10)'
                  : 'transparent',
              color: line.type === '+'
                ? '#3fb950'
                : line.type === '-'
                  ? '#f85149'
                  : 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              opacity: hunk.status === 'rejected' ? 0.4 : 1,
              transition: 'opacity 0.2s',
              borderLeft: line.type === '+'
                ? '2px solid rgba(63,185,80,0.4)'
                : line.type === '-'
                  ? '2px solid rgba(248,81,73,0.4)'
                  : '2px solid transparent'
            }}
          >
            <span style={{ display: 'inline-block', width: '16px', opacity: 0.5, userSelect: 'none' }}>
              {line.type}
            </span>
            {line.content}
          </div>
        ))}
      </div>
    </div>
  )
}
