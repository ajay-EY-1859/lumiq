// ═══════════════════════════════════════════════════════════════════
// Lumiq — DiffViewer Component
// Visual Studio-inspired multi-file interactive diff review interface.
// Handles parsing of multi-file diff payloads, side-by-side explorer list,
// granular hunk-level actions, and global bulk actions.
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

interface FileDiff {
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
function parseMultiFileDiff(raw: string): FileDiff[] {
  const lines = raw.split('\n')
  const files: FileDiff[] = []
  let currentFile: FileDiff | null = null
  let currentHunk: DiffHunk | null = null
  let hunkIdx = 0

  for (const line of lines) {
    // Detect standard git diff or unified diff file headers
    if (line.startsWith('--- ')) {
      const fileA = line.slice(4).trim()
      
      // If we already have an active file block, save it first
      if (currentFile && currentFile.fileA !== fileA) {
        if (currentHunk) {
          currentFile.hunks.push(currentHunk)
          currentHunk = null
        }
        files.push(currentFile)
        currentFile = null
      }
      
      if (!currentFile) {
        currentFile = { fileA, fileB: '', hunks: [] }
      } else {
        currentFile.fileA = fileA
      }
      continue
    }

    if (line.startsWith('+++ ')) {
      const fileB = line.slice(4).trim()
      if (!currentFile) {
        currentFile = { fileA: '', fileB, hunks: [] }
      } else {
        currentFile.fileB = fileB
      }
      continue
    }

    if (line.startsWith('@@ ')) {
      if (currentHunk && currentFile) {
        currentFile.hunks.push(currentHunk)
      }
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

  // Push final active hunk and file blocks
  if (currentHunk && currentFile) {
    currentFile.hunks.push(currentHunk)
  }
  if (currentFile) {
    files.push(currentFile)
  }

  // Filter out any invalid empty files
  return files.filter(f => (f.fileA || f.fileB) && f.hunks.length > 0)
}

// ─── Component ──────────────────────────────────────────────────────
export function DiffViewer({ diffContent, sessionId, messageId }: DiffViewerProps): React.JSX.Element | null {
  const parsedFiles = useMemo(() => parseMultiFileDiff(diffContent), [diffContent])
  
  // React state storing statuses of all hunks indexed by `${fileIndex}_${hunkId}`
  const [fileHunks, setFileHunks] = useState<Record<string, 'pending' | 'accepted' | 'rejected'>>({})
  const [selectedFileIdx, setSelectedFileIdx] = useState<number>(0)
  const [copied, setCopied] = useState(false)

  // Initialize hunk states when parsed files list updates
  useEffect(() => {
    const initial: Record<string, 'pending' | 'accepted' | 'rejected'> = {}
    parsedFiles.forEach((file, fIdx) => {
      file.hunks.forEach((hunk) => {
        initial[`${fIdx}_${hunk.id}`] = 'pending'
      })
    })
    setFileHunks(initial)
    setSelectedFileIdx(0)
  }, [parsedFiles])



  const recordDecision = useCallback(async (filePath: string, hunk: DiffHunk, decision: 'accepted' | 'rejected' | 'applied') => {
    if (!sessionId || !filePath) return
    try {
      await window.electronAPI.editDecision.record({
        sessionId,
        messageId: messageId || null,
        targetFile: filePath,
        hunkHeader: hunk.header,
        decision,
        patchText: `${filePath}\n${hunk.header}\n${hunk.lines.map((l) => `${l.type}${l.content}`).join('\n')}`
      })
    } catch (error) {
      console.error('Failed to record edit decision', error)
    }
  }, [messageId, sessionId])

  const updateHunkStatus = useCallback((fileIdx: number, hunkId: string, status: 'accepted' | 'rejected') => {
    const key = `${fileIdx}_${hunkId}`
    setFileHunks(prev => ({ ...prev, [key]: status }))
    
    const file = parsedFiles[fileIdx]
    const hunk = file?.hunks.find((h) => h.id === hunkId)
    if (file && hunk) {
      void recordDecision(file.fileB || file.fileA, hunk, status)
    }
  }, [parsedFiles, recordDecision])

  const handleCopyPatch = useCallback(() => {
    navigator.clipboard.writeText(diffContent)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [diffContent])

  const handleApplyAll = useCallback(async () => {
    const filesToApply: { fileIndex: number; filePath: string; acceptedHunks: DiffHunk[] }[] = []
    
    parsedFiles.forEach((file, fIdx) => {
      const accepted = file.hunks.filter(h => fileHunks[`${fIdx}_${h.id}`] === 'accepted')
      if (accepted.length > 0) {
        filesToApply.push({
          fileIndex: fIdx,
          filePath: file.fileB || file.fileA,
          acceptedHunks: accepted
        })
      }
    })

    if (filesToApply.length === 0) {
      alert('No hunks accepted. Accept at least one hunk across any file to apply.')
      return
    }

    let successCount = 0
    const failureMessages: string[] = []

    for (const item of filesToApply) {
      const filePath = item.filePath
      if (!filePath || filePath === 'text-a' || filePath === 'text-b') {
        continue
      }

      try {
        const currentContent = await window.electronAPI.fs.readFile(filePath)
        const contentLines = currentContent.split('\n')

        const result = [...contentLines]
        let offset = 0

        for (const hunk of item.acceptedHunks) {
          const match = hunk.header.match(/@@ -(\d+),?(\d*) \+(\d+),?(\d*) @@/)
          if (!match) continue

          const startA = parseInt(match[1], 10) - 1 + offset
          const removedLines = hunk.lines.filter(l => l.type === '-').map(l => l.content)
          const addedLines = hunk.lines.filter(l => l.type === '+').map(l => l.content)

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
          } else {
            throw new Error(`Line mismatch: could not find original block in ${filePath}`)
          }
        }

        // Save file changes back to disk
        await window.electronAPI.fs.writeFile(filePath, result.join('\n'))
        
        // Log all applied hunk decisions to SQLite
        await Promise.all(item.acceptedHunks.map((hunk) => recordDecision(filePath, hunk, 'applied')))
        successCount++
      } catch (e) {
        failureMessages.push(`Failed applying changes to ${filePath}: ${(e as Error).message}`)
      }
    }

    if (successCount > 0) {
      alert(`Applied changes to ${successCount} file(s) successfully!`)
    }
    if (failureMessages.length > 0) {
      alert(failureMessages.join('\n'))
    }
  }, [parsedFiles, fileHunks, recordDecision])

  const handleAcceptAllGlobal = useCallback(() => {
    setFileHunks((prev) => {
      const next = { ...prev }
      parsedFiles.forEach((file, fIdx) => {
        file.hunks.forEach((hunk) => {
          next[`${fIdx}_${hunk.id}`] = 'accepted'
          void recordDecision(file.fileB || file.fileA, hunk, 'accepted')
        })
      })
      return next
    })
  }, [parsedFiles, recordDecision])

  const handleRejectAllGlobal = useCallback(() => {
    setFileHunks((prev) => {
      const next = { ...prev }
      parsedFiles.forEach((file, fIdx) => {
        file.hunks.forEach((hunk) => {
          next[`${fIdx}_${hunk.id}`] = 'rejected'
          void recordDecision(file.fileB || file.fileA, hunk, 'rejected')
        })
      })
      return next
    })
  }, [parsedFiles, recordDecision])

  if (parsedFiles.length === 0) return null

  const activeFile = parsedFiles[selectedFileIdx]

  // Global counts across all modified files
  let totalAccepted = 0
  let totalRejected = 0
  let totalPending = 0
  parsedFiles.forEach((file, fIdx) => {
    file.hunks.forEach((h) => {
      const status = fileHunks[`${fIdx}_${h.id}`] || 'pending'
      if (status === 'accepted') totalAccepted++
      else if (status === 'rejected') totalRejected++
      else totalPending++
    })
  })

  return (
    <div style={{
      border: '1px solid var(--border)',
      borderRadius: '12px',
      overflow: 'hidden',
      marginTop: '12px',
      background: 'var(--bg-primary)',
      display: 'flex',
      flexDirection: 'column',
      boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)'
    }}>
      
      {/* Visual Studio Style Global Control Header */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '10px 16px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        gap: '12px',
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '13px', color: 'var(--accent-blue)', fontWeight: 700 }}>🔍 DIFF REVIEWER</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '11px' }}>|</span>
          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
            <strong>{parsedFiles.length}</strong> file(s) modified
          </span>
          <div style={{ display: 'flex', gap: '4px', marginLeft: '8px' }}>
            {totalAccepted > 0 && <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontWeight: 600 }}>✓ {totalAccepted}</span>}
            {totalRejected > 0 && <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 600 }}>✕ {totalRejected}</span>}
            {totalPending > 0 && <span style={{ fontSize: '10px', padding: '1px 5px', borderRadius: '4px', background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', fontWeight: 600 }}>◌ {totalPending}</span>}
          </div>
        </div>

        {/* Global Bulk Actions */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button
            onClick={handleAcceptAllGlobal}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11.5px',
              color: '#22c55e',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.08)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            Accept All
          </button>
          <button
            onClick={handleRejectAllGlobal}
            style={{
              background: 'none',
              border: '1px solid var(--border)',
              borderRadius: '6px',
              padding: '4px 10px',
              fontSize: '11.5px',
              color: '#ef4444',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.08)')}
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
              fontSize: '11.5px',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              fontWeight: 600,
              transition: 'background 0.15s'
            }}
            onMouseEnter={e => (e.currentTarget.style.background = 'var(--bg-tertiary)')}
            onMouseLeave={e => (e.currentTarget.style.background = 'none')}
          >
            {copied ? '✓ Copied' : '📋 Copy Patch'}
          </button>
          {totalAccepted > 0 && (
            <button
              onClick={handleApplyAll}
              style={{
                background: 'linear-gradient(135deg, #22c55e, #15803d)',
                border: 'none',
                borderRadius: '6px',
                padding: '5px 12px',
                fontSize: '11.5px',
                color: '#fff',
                cursor: 'pointer',
                fontWeight: 700,
                boxShadow: '0 2px 8px rgba(34, 197, 94, 0.3)',
                transition: 'opacity 0.15s'
              }}
              onMouseEnter={e => (e.currentTarget.style.opacity = '0.9')}
              onMouseLeave={e => (e.currentTarget.style.opacity = '1')}
            >
              Apply All ({totalAccepted})
            </button>
          )}
        </div>
      </div>

      {/* Main Split Layout: Left Changes Explorer | Right Active Diff Detail */}
      <div style={{ display: 'flex', height: '400px', borderTop: '1px solid var(--border)' }}>
        
        {/* Left Changes Explorer Panel */}
        <div style={{
          width: '240px',
          flexShrink: 0,
          borderRight: '1px solid var(--border)',
          background: 'var(--bg-secondary)',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto'
        }} className="custom-scrollbar">
          <div style={{
            padding: '8px 12px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'var(--text-muted)',
            textTransform: 'uppercase',
            letterSpacing: '0.05em',
            borderBottom: '1px solid var(--border)',
            background: 'var(--bg-tertiary)',
            flexShrink: 0
          }}>
            Solution Explorer ({parsedFiles.length})
          </div>
          
          <div style={{ flex: 1 }}>
            {parsedFiles.map((file, fIdx) => {
              const fileKey = file.fileB || file.fileA
              const fileName = fileKey.split(/[/\\]/).pop() || fileKey
              const dirPath = fileKey.includes('/') || fileKey.includes('\\') 
                ? fileKey.slice(0, Math.max(fileKey.lastIndexOf('/'), fileKey.lastIndexOf('\\'))) 
                : ''

              const accepted = file.hunks.filter(h => fileHunks[`${fIdx}_${h.id}`] === 'accepted').length
              const rejected = file.hunks.filter(h => fileHunks[`${fIdx}_${h.id}`] === 'rejected').length
              const pending = file.hunks.filter(h => fileHunks[`${fIdx}_${h.id}`] === 'pending').length
              
              const isSelected = selectedFileIdx === fIdx

              return (
                <div
                  key={fIdx}
                  onClick={() => setSelectedFileIdx(fIdx)}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    borderBottom: '1px solid var(--border)',
                    background: isSelected ? 'rgba(59, 130, 246, 0.08)' : 'transparent',
                    transition: 'background 0.15s'
                  }}
                  onMouseEnter={e => { if (!isSelected) e.currentTarget.style.background = 'var(--bg-tertiary)' }}
                  onMouseLeave={e => { if (!isSelected) e.currentTarget.style.background = 'transparent' }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '14px' }}>📄</span>
                    <span style={{
                      fontWeight: 600,
                      fontSize: '12px',
                      color: isSelected ? 'var(--accent-blue)' : 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap'
                    }}>
                      {fileName}
                    </span>
                  </div>
                  {dirPath && (
                    <span style={{
                      fontSize: '10px',
                      color: 'var(--text-muted)',
                      marginLeft: '20px',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                      marginTop: '2px'
                    }}>
                      {dirPath}
                    </span>
                  )}
                  
                  {/* Visual Status Badges */}
                  <div style={{ display: 'flex', gap: '6px', marginLeft: '20px', marginTop: '6px' }}>
                    {accepted > 0 && (
                      <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(34, 197, 94, 0.15)', color: '#22c55e', fontWeight: 700 }}>
                        {accepted} Acc
                      </span>
                    )}
                    {rejected > 0 && (
                      <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', fontWeight: 700 }}>
                        {rejected} Rej
                      </span>
                    )}
                    {pending > 0 && (
                      <span style={{ fontSize: '9px', padding: '1px 4px', borderRadius: '3px', background: 'rgba(156, 163, 175, 0.15)', color: '#9ca3af', fontWeight: 700 }}>
                        {pending} Pend
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Right Active Diff Detail Panel */}
        <div style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: 'var(--bg-primary)'
        }}>
          
          {/* Active File Title & Actions */}
          {activeFile && (
            <div style={{
              padding: '10px 16px',
              borderBottom: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              background: 'var(--bg-secondary)',
              flexShrink: 0
            }}>
              <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Reviewing File Changes
                </span>
                <span style={{
                  fontSize: '12px',
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--text-primary)',
                  fontWeight: 600,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                  marginTop: '2px'
                }}>
                  {activeFile.fileA} → {activeFile.fileB}
                </span>
              </div>
              
              {/* File-level Hunk Swappers */}
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={() => {
                    setFileHunks((prev) => {
                      const next = { ...prev }
                      activeFile.hunks.forEach((hunk) => {
                        next[`${selectedFileIdx}_${hunk.id}`] = 'accepted'
                        void recordDecision(activeFile.fileB || activeFile.fileA, hunk, 'accepted')
                      })
                      return next
                    })
                  }}
                  style={{
                    background: 'rgba(34, 197, 94, 0.1)',
                    border: '1px solid rgba(34, 197, 94, 0.2)',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    color: '#22c55e',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Accept File
                </button>
                <button
                  onClick={() => {
                    setFileHunks((prev) => {
                      const next = { ...prev }
                      activeFile.hunks.forEach((hunk) => {
                        next[`${selectedFileIdx}_${hunk.id}`] = 'rejected'
                        void recordDecision(activeFile.fileB || activeFile.fileA, hunk, 'rejected')
                      })
                      return next
                    })
                  }}
                  style={{
                    background: 'rgba(239, 68, 68, 0.1)',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                    borderRadius: '4px',
                    padding: '3px 8px',
                    fontSize: '11px',
                    color: '#ef4444',
                    cursor: 'pointer',
                    fontWeight: 600
                  }}
                >
                  Reject File
                </button>
              </div>
            </div>
          )}

          {/* Active File Hunks scroll view */}
          <div style={{ flex: 1, overflowY: 'auto' }} className="custom-scrollbar">
            {activeFile?.hunks.map((hunk) => {
              const status = fileHunks[`${selectedFileIdx}_${hunk.id}`] || 'pending'
              return (
                <HunkView
                  key={hunk.id}
                  hunk={{ ...hunk, status }}
                  onAccept={() => updateHunkStatus(selectedFileIdx, hunk.id, 'accepted')}
                  onReject={() => updateHunkStatus(selectedFileIdx, hunk.id, 'rejected')}
                />
              )
            })}
          </div>
        </div>

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
    ? '3px solid #22c55e'
    : hunk.status === 'rejected'
      ? '3px solid #ef4444'
      : '3px solid transparent'

  const statusBg = hunk.status === 'accepted'
    ? 'rgba(34, 197, 94, 0.04)'
    : hunk.status === 'rejected'
      ? 'rgba(239, 68, 68, 0.04)'
      : 'transparent'

  return (
    <div style={{
      borderLeft: statusBorder,
      background: statusBg,
      transition: 'border-color 0.2s, background 0.2s'
    }}>
      {/* Hunk Header */}
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
                  border: '1px solid rgba(34,197,94,0.3)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  color: '#22c55e',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(34,197,94,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                ✓ Accept
              </button>
              <button
                onClick={onReject}
                title="Reject this hunk"
                style={{
                  background: 'none',
                  border: '1px solid rgba(239,68,68,0.3)',
                  borderRadius: '4px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  color: '#ef4444',
                  cursor: 'pointer',
                  fontWeight: 600,
                  transition: 'background 0.15s'
                }}
                onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                onMouseLeave={e => (e.currentTarget.style.background = 'none')}
              >
                ✕ Reject
              </button>
            </>
          ) : (
            <span style={{
              fontSize: '11px',
              fontWeight: 600,
              color: hunk.status === 'accepted' ? '#22c55e' : '#ef4444',
              textTransform: 'uppercase',
              letterSpacing: '0.05em'
            }}>
              {hunk.status === 'accepted' ? '✓ Accepted' : '✕ Rejected'}
            </span>
          )}
        </div>
      </div>

      {/* Diff Lines */}
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', lineHeight: 1.6 }}>
        {hunk.lines.map((line, i) => (
          <div
            key={i}
            style={{
              padding: '0 10px',
              background: line.type === '+'
                ? 'rgba(34, 197, 94, 0.10)'
                : line.type === '-'
                  ? 'rgba(239, 68, 68, 0.10)'
                  : 'transparent',
              color: line.type === '+'
                ? '#22c55e'
                : line.type === '-'
                  ? '#ef4444'
                  : 'var(--text-secondary)',
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-all',
              opacity: hunk.status === 'rejected' ? 0.4 : 1,
              transition: 'opacity 0.2s',
              borderLeft: line.type === '+'
                ? '2px solid rgba(34, 197, 94, 0.4)'
                : line.type === '-'
                  ? '2px solid rgba(239, 68, 68, 0.4)'
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
