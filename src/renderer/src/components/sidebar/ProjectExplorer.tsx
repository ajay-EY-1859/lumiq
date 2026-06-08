import React, { useState, useEffect, useCallback, useRef } from 'react'
import { useSessionStore } from '@renderer/store/sessionStore'
import { useEditorStore } from '@renderer/store/editorStore'
import { useChatStore } from '@renderer/store/chatStore'
import { useProviderStore } from '@renderer/store/providerStore'
import { normalizePath } from '@renderer/utils/paths'

// ── Helpers ──────────────────────────────────────────────────────────

function getFileIcon(name: string, isDir: boolean, isOpen?: boolean): string {
  if (isDir) return isOpen ? '▾ 📂' : '▸ 📁'
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const icons: Record<string, string> = {
    ts: '🔷', tsx: '🔷', js: '🟨', jsx: '🟨', json: '📋',
    css: '🎨', scss: '🎨', html: '🌐', md: '📝', py: '🐍',
    yml: '⚙️', yaml: '⚙️', sh: '💻', ps1: '💻', sql: '🗄️',
    png: '🖼️', jpg: '🖼️', jpeg: '🖼️', svg: '🖼️', gif: '🖼️',
    env: '🔒', gitignore: '🚫', lock: '🔒',
  }
  return icons[ext] ?? '📄'
}

// ── Types ─────────────────────────────────────────────────────────────
interface FileNode {
  name: string
  isDirectory: boolean
  path: string
  children?: FileNode[]
  isOpen?: boolean
  isLoading?: boolean
}

type ContextMenuState = { x: number; y: number; node: FileNode } | null
type CreatingState = { parentPath: string; type: 'file' | 'folder' } | null

function updateFileTree(
  nodes: FileNode[], targetPath: string, updates: Partial<FileNode>
): FileNode[] {
  return nodes.map((n) => {
    if (n.path === targetPath) return { ...n, ...updates }
    if (n.children) return { ...n, children: updateFileTree(n.children, targetPath, updates) }
    return n
  })
}

// ── TreeNode ──────────────────────────────────────────────────────────
function TreeNode({
  node, level, activeFilePath, onToggle, onSelect, onContextMenu,
  renamingNode, renameValue, onRenameChange, onRenameSubmit, onRenameCancel,
  creatingIn, createValue, onCreateChange, onCreateSubmit, onCreateCancel,
}: {
  node: FileNode; level: number; activeFilePath: string | null
  onToggle: (node: FileNode) => void
  onSelect: (node: FileNode) => void
  onContextMenu: (e: React.MouseEvent, node: FileNode) => void
  renamingNode: FileNode | null; renameValue: string
  onRenameChange: (v: string) => void; onRenameSubmit: () => void; onRenameCancel: () => void
  creatingIn: CreatingState; createValue: string
  onCreateChange: (v: string) => void; onCreateSubmit: () => void; onCreateCancel: () => void
}): React.JSX.Element {
  const isRenaming = renamingNode?.path === node.path
  const isActive = !node.isDirectory && activeFilePath === node.path
  const isCreatingHere = creatingIn?.parentPath === node.path

  return (
    <div>
      {/* Row */}
      <div
        role={node.isDirectory ? 'button' : 'button'}
        tabIndex={0}
        aria-expanded={node.isDirectory ? node.isOpen : undefined}
        onClick={() => { if (!isRenaming) { node.isDirectory ? onToggle(node) : onSelect(node) } }}
        onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !isRenaming) { node.isDirectory ? onToggle(node) : onSelect(node) } }}
        onContextMenu={(e) => onContextMenu(e, node)}
        style={{
          padding: `3px 8px 3px ${8 + level * 14}px`,
          cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px',
          fontSize: '13px', borderRadius: '4px', userSelect: 'none',
          background: isActive ? 'var(--accent-blue-dim, rgba(37,99,235,0.18))' : 'transparent',
          color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
          transition: 'background 0.1s',
          outline: 'none',
        }}
        onMouseEnter={(e) => { if (!isActive) { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)' } }}
        onMouseLeave={(e) => { if (!isActive) { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' } }}
      >
        <span style={{ fontSize: '12px', flexShrink: 0, lineHeight: 1 }}>
          {node.isLoading ? '⏳' : getFileIcon(node.name, node.isDirectory, node.isOpen)}
        </span>
        {isRenaming ? (
          <input autoFocus value={renameValue} onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') onRenameSubmit(); if (e.key === 'Escape') onRenameCancel() }}
            onBlur={onRenameCancel} onClick={(e) => e.stopPropagation()}
            style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-blue)', color: 'var(--text-primary)', padding: '1px 4px', fontSize: '13px', borderRadius: '3px', outline: 'none', flex: 1, minWidth: 0 }} />
        ) : (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{node.name}</span>
        )}
      </div>

      {/* Children */}
      {node.isDirectory && node.isOpen && (
        <div>
          {/* Inline create input */}
          {isCreatingHere && (
            <div style={{ padding: `3px 8px 3px ${8 + (level + 1) * 14}px`, display: 'flex', alignItems: 'center', gap: '5px' }}>
              <span style={{ fontSize: '12px' }}>{creatingIn?.type === 'folder' ? '📁' : '📄'}</span>
              <input autoFocus value={createValue} onChange={(e) => onCreateChange(e.target.value)}
                onKeyDown={(e) => { if (e.key === 'Enter') onCreateSubmit(); if (e.key === 'Escape') onCreateCancel() }}
                onBlur={onCreateCancel} placeholder={creatingIn?.type === 'folder' ? 'folder name' : 'file name'}
                style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-blue)', color: 'var(--text-primary)', padding: '2px 6px', fontSize: '13px', borderRadius: '3px', outline: 'none', flex: 1, minWidth: 0 }} />
            </div>
          )}
          {node.children && node.children.length > 0 ? (
            node.children.map(child => (
              <TreeNode key={child.path} node={child} level={level + 1} activeFilePath={activeFilePath}
                onToggle={onToggle} onSelect={onSelect} onContextMenu={onContextMenu}
                renamingNode={renamingNode} renameValue={renameValue}
                onRenameChange={onRenameChange} onRenameSubmit={onRenameSubmit} onRenameCancel={onRenameCancel}
                creatingIn={creatingIn} createValue={createValue}
                onCreateChange={onCreateChange} onCreateSubmit={onCreateSubmit} onCreateCancel={onCreateCancel} />
            ))
          ) : (
            !isCreatingHere && (
              <div style={{ padding: `3px 8px 3px ${8 + (level + 1) * 14}px`, fontSize: '12px', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                empty
              </div>
            )
          )}
        </div>
      )}
    </div>
  )
}

interface ProjectExplorerProps {
  onNavigate?: (page: 'chat' | 'settings' | 'agents') => void
  onSelectTab?: (tab: 'sessions' | 'explorer') => void
}

// ── Main Component ────────────────────────────────────────────────────
export function ProjectExplorer({ onNavigate, onSelectTab }: ProjectExplorerProps): React.JSX.Element {
  const { activeSessionId, sessions, setWorkspace, createSession, setActiveSession } = useSessionStore()
  const { openFile, activeTabId } = useEditorStore()
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const workspacePath = activeSession?.workspacePath ?? null

  const [rootNodes, setRootNodes] = useState<FileNode[]>([])
  const [ignoredPaths, setIgnoredPaths] = useState<Set<string>>(new Set())
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null)
  const [renamingNode, setRenamingNode] = useState<FileNode | null>(null)
  const [renameValue, setRenameValue] = useState('')
  const [creatingIn, setCreatingIn] = useState<CreatingState>(null)
  const [createValue, setCreateValue] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const ignoredRef = useRef<Set<string>>(new Set())

  // Keep ref in sync so loadDir closure always has fresh ignores
  useEffect(() => { ignoredRef.current = ignoredPaths }, [ignoredPaths])

  const loadDir = useCallback(async (dirPath: string): Promise<FileNode[]> => {
    try {
      const norm = normalizePath(dirPath)
      const entries: { name: string; isDirectory: boolean }[] = await window.electronAPI.fs.listDir(norm)
      const ws = workspacePath ? normalizePath(workspacePath) : ''
      const ignores = ignoredRef.current

      const nodes: FileNode[] = entries.map((e) => ({
        name: e.name,
        isDirectory: e.isDirectory,
        path: normalizePath(`${norm}/${e.name}`),
      }))

      return nodes.filter((node) => {
        if (!ws) return true
        let rel = node.path.replace(ws, '')
        if (rel.startsWith('/')) rel = rel.slice(1)
        const parts = rel.split('/')
        for (let i = 1; i <= parts.length; i++) {
          if (ignores.has(parts.slice(0, i).join('/'))) return false
        }
        return true
      })
    } catch {
      return []
    }
  }, [workspacePath])

  const handleSelectWorkspace = async (): Promise<void> => {
    let sessionId = activeSessionId
    if (!sessionId) {
      try {
        const { activeProvider, activeModel } = useProviderStore.getState()
        const session = await createSession(activeProvider, activeModel || 'default')
        sessionId = session.id
        setActiveSession(sessionId)
      } catch (err) {
        console.error('Failed to create session:', err)
        alert(`Failed to create session: ${(err as Error).message}`)
        return
      }
    }

    const result = await window.electronAPI.dialog.showOpenDialog({
      properties: ['openDirectory']
    })
    if (!result.canceled && result.filePaths.length > 0) {
      const selectedPath = result.filePaths[0]
      await setWorkspace(sessionId, selectedPath)
      await useChatStore.getState().loadSession(sessionId)
    }
  }

  // ── Initial load ──────────────────────────────────────────────────
  const loadWorkspace = useCallback(async () => {
    if (!workspacePath) { setRootNodes([]); return }
    setIsLoading(true)
    try {
      const ignored = await window.electronAPI.git.getIgnored(workspacePath).catch(() => [] as string[])
      const ignoreSet = new Set(ignored.map((p: string) => p.replace(/\/$/, '')))
      ignoreSet.add('.git')
      ignoredRef.current = ignoreSet
      setIgnoredPaths(ignoreSet)
      const nodes = await loadDir(workspacePath)
      setRootNodes(nodes)
    } finally {
      setIsLoading(false)
    }
  }, [workspacePath, loadDir])

  useEffect(() => { loadWorkspace() }, [loadWorkspace])

  // Close context menu on outside click
  useEffect(() => {
    const handler = () => setContextMenu(null)
    window.addEventListener('click', handler)
    return () => window.removeEventListener('click', handler)
  }, [])

  // ── Immutable tree updater ────────────────────────────────────────
  const updateTree = useCallback((
    nodes: FileNode[], targetPath: string, updates: Partial<FileNode>
  ): FileNode[] => updateFileTree(nodes, targetPath, updates), [])

  // ── Toggle folder ─────────────────────────────────────────────────
  const toggleNode = useCallback(async (node: FileNode) => {
    if (!node.isDirectory) return

    if (node.isOpen) {
      // Collapse — keep children cached for instant re-open
      setRootNodes((prev) => updateTree(prev, node.path, { isOpen: false }))
      return
    }

    // Expand — load children if not yet loaded
    if (!node.children) {
      // Show loading spinner immediately
      setRootNodes((prev) => updateTree(prev, node.path, { isOpen: true, isLoading: true }))
      const children = await loadDir(node.path)
      setRootNodes((prev) => updateTree(prev, node.path, { isOpen: true, isLoading: false, children }))
    } else {
      setRootNodes((prev) => updateTree(prev, node.path, { isOpen: true }))
    }
  }, [loadDir, updateTree])

  // ── Context menu actions ──────────────────────────────────────────
  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault(); e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  const startRename = (node: FileNode) => {
    setRenamingNode(node); setRenameValue(node.name); setContextMenu(null)
  }

  const submitRename = async () => {
    if (!renamingNode || !renameValue.trim() || renameValue === renamingNode.name) {
      setRenamingNode(null); return
    }
    try {
      const dir = renamingNode.path.substring(0, renamingNode.path.lastIndexOf('/'))
      await window.electronAPI.fs.rename(renamingNode.path, `${dir}/${renameValue.trim()}`)
      await loadWorkspace()
    } catch (e) { alert(`Rename failed: ${(e as Error).message}`) }
    setRenamingNode(null)
  }

  const deleteNode = async (node: FileNode) => {
    setContextMenu(null)
    if (!confirm(`Delete "${node.name}"? This cannot be undone.`)) return
    try {
      await window.electronAPI.fs.delete(node.path)
      await loadWorkspace()
    } catch (e) { alert(`Delete failed: ${(e as Error).message}`) }
  }

  const startCreate = (parentPath: string, type: 'file' | 'folder') => {
    setContextMenu(null); setCreatingIn({ parentPath, type }); setCreateValue('')
    // Ensure parent is open
    setRootNodes((prev) => updateTree(prev, parentPath, { isOpen: true }))
  }

  const submitCreate = async () => {
    if (!creatingIn || !createValue.trim()) { setCreatingIn(null); return }
    const fullPath = `${creatingIn.parentPath}/${createValue.trim()}`
    try {
      if (creatingIn.type === 'folder') {
        await window.electronAPI.fs.mkdir(fullPath)
      } else {
        await window.electronAPI.fs.writeFile(fullPath, '')
        openFile(normalizePath(fullPath), createValue.trim())
      }
      await loadWorkspace()
    } catch (e) { alert(`Create failed: ${(e as Error).message}`) }
    setCreatingIn(null)
  }

  const triggerRefactoring = (action: 'js-to-ts' | 'tests' | 'perf' | 'docs', node: FileNode) => {
    setContextMenu(null)
    const isDir = node.isDirectory
    const targetType = isDir ? 'folder' : 'file'
    let prompt = ''

    switch (action) {
      case 'js-to-ts':
        prompt = `Convert the JavaScript ${targetType} at "${node.path}" to TypeScript. Update the code to follow modern TypeScript standards, generate correct types/interfaces, and rename files from .js/.jsx to .ts/.tsx as appropriate.`
        break
      case 'tests':
        prompt = `Generate comprehensive unit tests for the ${targetType} at "${node.path}". Cover edge cases, typical usage, and error boundary conditions using the standard testing tools in the project.`
        break
      case 'perf':
        prompt = `Analyze and optimize performance for the ${targetType} at "${node.path}". Focus on adding memoization, reducing redundant computations, optimizing algorithm complexity, and explain the performance changes made.`
        break
      case 'docs':
        prompt = `Write clear JSDoc / documentation comments for the ${targetType} at "${node.path}". Document all public functions, classes, arguments, and return types without altering the functional logic of the code.`
        break
    }

    useChatStore.getState().setDraftMessage(prompt)
    if (onSelectTab) onSelectTab('sessions')
    if (onNavigate) onNavigate('chat')
  }


  // ── Search filter ─────────────────────────────────────────────────
  const flattenNodes = (nodes: FileNode[]): FileNode[] =>
    nodes.flatMap((n) => [n, ...(n.children ? flattenNodes(n.children) : [])])

  const filteredNodes = searchQuery.trim()
    ? flattenNodes(rootNodes).filter(
        (n) => !n.isDirectory && n.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : null

  // ── No workspace ──────────────────────────────────────────────────
  if (!workspacePath) {
    return (
      <div style={{
        padding: '40px 16px',
        textAlign: 'center',
        color: 'var(--text-muted)',
        fontSize: '13px',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        boxSizing: 'border-box',
        gap: '16px'
      }}>
        {/* Glow pulsing folder icon */}
        <div style={{
          position: 'relative',
          width: '64px',
          height: '64px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderRadius: '50%',
          background: 'rgba(37, 99, 235, 0.08)',
          border: '1px solid rgba(37, 99, 235, 0.2)',
          boxShadow: '0 0 20px rgba(37, 99, 235, 0.1)',
          animation: 'pulseGlow 2.5s infinite ease-in-out'
        }}>
          <style dangerouslySetInnerHTML={{__html: `
            @keyframes pulseGlow {
              0% { box-shadow: 0 0 15px rgba(37, 99, 235, 0.1); border-color: rgba(37, 99, 235, 0.2); }
              50% { box-shadow: 0 0 25px rgba(37, 99, 235, 0.3); border-color: rgba(37, 99, 235, 0.5); }
              100% { box-shadow: 0 0 15px rgba(37, 99, 235, 0.1); border-color: rgba(37, 99, 235, 0.2); }
            }
          `}} />
          <span style={{ fontSize: '32px', lineHeight: 1 }}>📁</span>
        </div>

        <div>
          <div style={{ fontWeight: 600, color: 'var(--text-primary)', fontSize: '14px', marginBottom: '6px' }}>
            No Workspace Bound
          </div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: '1.4', maxWidth: '220px', margin: '0 auto' }}>
            Connect a local directory to enable file indexing, semantic search, and project tasks.
          </div>
        </div>

        {/* Premium Bind button */}
        <button
          onClick={handleSelectWorkspace}
          style={{
            marginTop: '8px',
            padding: '8px 16px',
            borderRadius: '8px',
            border: 'none',
            background: 'linear-gradient(135deg, #2563eb, #1d4ed8)',
            color: '#ffffff',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 4px 12px rgba(37,99,235,0.3)',
            transition: 'transform 0.2s, opacity 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'scale(1.02)'
            e.currentTarget.style.opacity = '0.95'
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'scale(1)'
            e.currentTarget.style.opacity = '1'
          }}
        >
          Bind Workspace Folder
        </button>
      </div>
    )
  }

  const projectName = workspacePath.split(/[/\\]/).pop() || 'WORKSPACE'

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '6px 8px', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '6px' }}>
          <span style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={workspacePath}>
            {projectName}
          </span>
          <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
            <button title="New File" onClick={() => startCreate(normalizePath(workspacePath), 'file')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: '2px 4px', borderRadius: '3px', lineHeight: 1 }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>＋📄</button>
            <button title="New Folder" onClick={() => startCreate(normalizePath(workspacePath), 'folder')}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: '2px 4px', borderRadius: '3px', lineHeight: 1 }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>＋📁</button>
            <button title="Refresh" onClick={loadWorkspace}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', padding: '2px 4px', borderRadius: '3px', lineHeight: 1 }}
              onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
              onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}>↺</button>
          </div>
        </div>
        {/* Search */}
        <input value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search files…"
          style={{ width: '100%', padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '5px', color: 'var(--text-primary)', fontSize: '12px', outline: 'none', boxSizing: 'border-box' }} />
      </div>

      {/* Tree / Search results */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '4px 2px' }}>
        {isLoading ? (
          <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>Loading…</div>
        ) : filteredNodes ? (
          filteredNodes.length === 0 ? (
            <div style={{ padding: '16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>No files match "{searchQuery}"</div>
          ) : (
            filteredNodes.map((n) => (
              <div key={n.path} role="button" tabIndex={0}
                onClick={() => openFile(n.path, n.name)}
                onKeyDown={(e) => { if (e.key === 'Enter') openFile(n.path, n.name) }}
                style={{ padding: '3px 8px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px', color: activeTabId === n.path ? 'var(--accent-blue)' : 'var(--text-secondary)', borderRadius: '4px', outline: 'none' }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}>
                <span style={{ fontSize: '12px' }}>{getFileIcon(n.name, false)}</span>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }}>{n.name}</span>
                <span style={{ fontSize: '10px', color: 'var(--text-muted)', flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '80px', whiteSpace: 'nowrap' }}>
                  {n.path.replace(normalizePath(workspacePath), '').replace(/^\//, '').replace(/\/[^/]+$/, '') || '/'}
                </span>
              </div>
            ))
          )
        ) : (
          <>
            {/* Root-level inline create */}
            {creatingIn?.parentPath === normalizePath(workspacePath) && (
              <div style={{ padding: '3px 8px', display: 'flex', alignItems: 'center', gap: '5px' }}>
                <span style={{ fontSize: '12px' }}>{creatingIn.type === 'folder' ? '📁' : '📄'}</span>
                <input autoFocus value={createValue} onChange={(e) => setCreateValue(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') submitCreate(); if (e.key === 'Escape') setCreatingIn(null) }}
                  onBlur={() => setCreatingIn(null)} placeholder={creatingIn.type === 'folder' ? 'folder name' : 'file name'}
                  style={{ background: 'var(--bg-secondary)', border: '1px solid var(--accent-blue)', color: 'var(--text-primary)', padding: '2px 6px', fontSize: '13px', borderRadius: '3px', outline: 'none', flex: 1 }} />
              </div>
            )}
            {rootNodes.map((node) => (
              <TreeNode key={node.path} node={node} level={0} activeFilePath={activeTabId}
                onToggle={toggleNode} onSelect={(n) => openFile(n.path, n.name)}
                onContextMenu={handleContextMenu}
                renamingNode={renamingNode} renameValue={renameValue}
                onRenameChange={setRenameValue} onRenameSubmit={submitRename} onRenameCancel={() => setRenamingNode(null)}
                creatingIn={creatingIn} createValue={createValue}
                onCreateChange={setCreateValue} onCreateSubmit={submitCreate} onCreateCancel={() => setCreatingIn(null)} />
            ))}
          </>
        )}
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <div style={{ position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 9999, background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '7px', boxShadow: '0 6px 20px rgba(0,0,0,0.4)', padding: '4px', minWidth: '180px', fontSize: '13px' }}
          onClick={(e) => e.stopPropagation()}>
          {contextMenu.node.isDirectory && (<>
            <button style={ctxBtnStyle} onMouseEnter={ctxHover} onMouseLeave={ctxLeave}
              onClick={() => startCreate(contextMenu.node.path, 'file')}>＋ New File</button>
            <button style={ctxBtnStyle} onMouseEnter={ctxHover} onMouseLeave={ctxLeave}
              onClick={() => startCreate(contextMenu.node.path, 'folder')}>＋ New Folder</button>
            <div style={{ height: '1px', background: 'var(--border)', margin: '3px 0' }} />
          </>)}
          <button style={ctxBtnStyle} onMouseEnter={ctxHover} onMouseLeave={ctxLeave}
            onClick={() => startRename(contextMenu.node)}>✏️ Rename</button>
          <button style={{ ...ctxBtnStyle, color: 'var(--error, #ef4444)' }} onMouseEnter={ctxHover} onMouseLeave={ctxLeave}
            onClick={() => deleteNode(contextMenu.node)}>🗑️ Delete</button>

          {/* AI Refactorings Section */}
          <div style={{ height: '1px', background: 'var(--border)', margin: '3px 0' }} />
          <div style={{ padding: '4px 10px 2px 10px', fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
            ✨ AI Refactoring
          </div>
          {(contextMenu.node.isDirectory || contextMenu.node.name.endsWith('.js') || contextMenu.node.name.endsWith('.jsx')) && (
            <button
              style={{ ...ctxBtnStyle, color: 'var(--accent-blue, #2563eb)' }}
              onMouseEnter={ctxHover}
              onMouseLeave={ctxLeave}
              onClick={() => triggerRefactoring('js-to-ts', contextMenu.node)}
            >
              🔷 Convert JS to TS
            </button>
          )}
          <button
            style={{ ...ctxBtnStyle, color: 'var(--accent-blue, #2563eb)' }}
            onMouseEnter={ctxHover}
            onMouseLeave={ctxLeave}
            onClick={() => triggerRefactoring('tests', contextMenu.node)}
          >
            🧪 Generate Unit Tests
          </button>
          <button
            style={{ ...ctxBtnStyle, color: 'var(--accent-blue, #2563eb)' }}
            onMouseEnter={ctxHover}
            onMouseLeave={ctxLeave}
            onClick={() => triggerRefactoring('perf', contextMenu.node)}
          >
            ⚡ Optimize Performance
          </button>
          <button
            style={{ ...ctxBtnStyle, color: 'var(--accent-blue, #2563eb)' }}
            onMouseEnter={ctxHover}
            onMouseLeave={ctxLeave}
            onClick={() => triggerRefactoring('docs', contextMenu.node)}
          >
            📝 Write JSDoc / Docs
          </button>
        </div>
      )}
    </div>
  )
}

const ctxBtnStyle: React.CSSProperties = {
  display: 'block', width: '100%', padding: '6px 10px', textAlign: 'left',
  background: 'transparent', border: 'none', color: 'var(--text-primary)',
  cursor: 'pointer', borderRadius: '4px', fontSize: '13px',
}
const ctxHover = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'var(--bg-tertiary)' }
const ctxLeave = (e: React.MouseEvent<HTMLButtonElement>) => { e.currentTarget.style.background = 'transparent' }
