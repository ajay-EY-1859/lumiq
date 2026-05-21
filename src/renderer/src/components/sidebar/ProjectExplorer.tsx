import React, { useState, useEffect } from 'react'
import { useSessionStore } from '@renderer/store/sessionStore'
import { useEditorStore } from '@renderer/store/editorStore'

interface FileNode {
  name: string
  isDirectory: boolean
  path: string
  children?: FileNode[]
  isOpen?: boolean
}

function TreeNode({ node, level, onToggle, onSelect, onContextMenu, renamingNode, renameValue, onRenameChange, onRenameSubmit, onRenameCancel }: { node: FileNode; level: number; onToggle: (node: FileNode) => void; onSelect: (node: FileNode) => void; onContextMenu: (e: React.MouseEvent, node: FileNode) => void; renamingNode: FileNode | null; renameValue: string; onRenameChange: (v: string) => void; onRenameSubmit: () => void; onRenameCancel: () => void }): React.JSX.Element {
  const isRenaming = renamingNode?.path === node.path
  
  return (
    <div>
      <div
        onClick={() => {
          if (!isRenaming) {
            node.isDirectory ? onToggle(node) : onSelect(node)
          }
        }}
        onContextMenu={(e) => onContextMenu(e, node)}
        style={{
          padding: `4px 8px 4px ${8 + level * 12}px`,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: '6px',
          fontSize: '13px',
          color: 'var(--text-secondary)',
          borderRadius: '4px',
          transition: 'background var(--transition-fast)'
        }}
        onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
        onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; e.currentTarget.style.color = 'var(--text-secondary)' }}
      >
        <span style={{ fontSize: '14px', width: '16px', textAlign: 'center' }}>
          {node.isDirectory ? (node.isOpen ? '📂' : '📁') : '📄'}
        </span>
        {isRenaming ? (
          <input
            autoFocus
            value={renameValue}
            onChange={(e) => onRenameChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onRenameSubmit()
              if (e.key === 'Escape') onRenameCancel()
            }}
            onBlur={onRenameCancel}
            onClick={(e) => e.stopPropagation()}
            style={{ 
              background: 'var(--bg-secondary)', border: '1px solid var(--accent-blue)', 
              color: 'var(--text-primary)', padding: '2px 4px', fontSize: '13px', 
              borderRadius: '2px', outline: 'none', flex: 1 
            }}
          />
        ) : (
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
        )}
      </div>
      {node.isDirectory && node.isOpen && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode 
              key={child.path} node={child} level={level + 1} 
              onToggle={onToggle} onSelect={onSelect} onContextMenu={onContextMenu}
              renamingNode={renamingNode} renameValue={renameValue}
              onRenameChange={onRenameChange} onRenameSubmit={onRenameSubmit} onRenameCancel={onRenameCancel}
            />
          ))}
        </div>
      )}
    </div>
  )
}

export function ProjectExplorer(): React.JSX.Element {
  const { activeSessionId, sessions } = useSessionStore()
  const { openFile } = useEditorStore()
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const [rootNodes, setRootNodes] = useState<FileNode[]>([])
  const [ignoredPaths, setIgnoredPaths] = useState<Set<string>>(new Set())
  
  const [contextMenu, setContextMenu] = useState<{ x: number, y: number, node: FileNode } | null>(null)
  const [renamingNode, setRenamingNode] = useState<FileNode | null>(null)
  const [renameValue, setRenameValue] = useState('')

  const loadDir = async (dirPath: string, ignores: Set<string> = ignoredPaths): Promise<FileNode[]> => {
    try {
      const entries = await window.electronAPI.fs.listDir(dirPath)
      const nodes = entries.map((e: { name: string, isDirectory: boolean }) => ({
        name: e.name,
        isDirectory: e.isDirectory,
        path: `${dirPath}/${e.name}`.replace(/\\/g, '/'), // basic normalization
      }))

      // Filter ignored
      const workspacePath = activeSession?.workspacePath
      if (!workspacePath) return nodes

      const normalizedWorkspacePath = workspacePath.replace(/\\/g, '/')
      
      return nodes.filter(node => {
        // compute relative path
        let rel = node.path.replace(normalizedWorkspacePath, '')
        if (rel.startsWith('/')) rel = rel.slice(1)
        
        // Also check if any parent directory is ignored
        const parts = rel.split('/')
        for (let i = 1; i <= parts.length; i++) {
          const subPath = parts.slice(0, i).join('/')
          if (ignores.has(subPath)) return false
        }
        return true
      })
    } catch (e) {
      console.error(e)
      return []
    }
  }

  useEffect(() => {
    const handleGlobalClick = () => setContextMenu(null)
    window.addEventListener('click', handleGlobalClick)
    return () => window.removeEventListener('click', handleGlobalClick)
  }, [])

  useEffect(() => {
    const workspacePath = activeSession?.workspacePath
    if (workspacePath) {
      // First fetch ignored files
      window.electronAPI.git.getIgnored(workspacePath)
        .then(ignored => {
          // git ls-files outputs directories with trailing slashes, so let's normalize
          const ignoreSet = new Set(ignored.map(p => p.replace(/\/$/, '')))
          // Hardcode .git as ignored
          ignoreSet.add('.git')
          setIgnoredPaths(ignoreSet)
          return loadDir(workspacePath, ignoreSet)
        })
        .then(setRootNodes)
        .catch(() => setRootNodes([]))
    } else {
      setRootNodes([])
      setIgnoredPaths(new Set())
    }
  }, [activeSession?.workspacePath])

  const toggleNode = async (node: FileNode) => {
    if (!node.isDirectory) return

    if (node.isOpen) {
      updateNode(rootNodes, node.path, { isOpen: false })
    } else {
      if (!node.children) {
        const children = await loadDir(node.path)
        updateNode(rootNodes, node.path, { isOpen: true, children })
      } else {
        updateNode(rootNodes, node.path, { isOpen: true })
      }
    }
  }

  const updateNode = (nodes: FileNode[], path: string, updates: Partial<FileNode>) => {
    const newNodes = [...nodes]
    const dfs = (list: FileNode[]): boolean => {
      for (let i = 0; i < list.length; i++) {
        if (list[i].path === path) {
          list[i] = { ...list[i], ...updates }
          return true
        }
        if (list[i].children) {
          const newChildren: FileNode[] = [...(list[i].children || [])]
          if (dfs(newChildren)) {
            list[i] = { ...list[i], children: newChildren }
            return true
          }
        }
      }
      return false
    }
    dfs(newNodes)
    setRootNodes(newNodes)
  }

  const reloadWorkspace = () => {
    const workspacePath = activeSession?.workspacePath
    if (workspacePath) {
      window.electronAPI.git.getIgnored(workspacePath)
        .then(ignored => {
          const ignoreSet = new Set(ignored.map(p => p.replace(/\/$/, '')))
          ignoreSet.add('.git')
          setIgnoredPaths(ignoreSet)
          return loadDir(workspacePath, ignoreSet)
        })
        .then(setRootNodes)
    }
  }

  const handleContextMenu = (e: React.MouseEvent, node: FileNode) => {
    e.preventDefault()
    e.stopPropagation()
    setContextMenu({ x: e.clientX, y: e.clientY, node })
  }

  const startRename = (node: FileNode) => {
    setRenamingNode(node)
    setRenameValue(node.name)
    setContextMenu(null)
  }

  const submitRename = async () => {
    if (!renamingNode || renameValue === renamingNode.name) {
      setRenamingNode(null)
      return
    }
    try {
      const oldPath = renamingNode.path
      const newPath = oldPath.substring(0, oldPath.lastIndexOf('/')) + '/' + renameValue
      await window.electronAPI.fs.rename(oldPath, newPath)
      reloadWorkspace()
    } catch (e) {
      console.error(e)
      alert(`Failed to rename: ${(e as Error).message}`)
    }
    setRenamingNode(null)
  }

  const deleteNode = async (node: FileNode) => {
    setContextMenu(null)
    if (confirm(`Are you sure you want to delete ${node.name}? This action cannot be undone.`)) {
      try {
        await window.electronAPI.fs.delete(node.path)
        reloadWorkspace()
      } catch (e) {
        console.error(e)
        alert(`Failed to delete: ${(e as Error).message}`)
      }
    }
  }

  if (!activeSession?.workspacePath) {
    return (
      <div style={{ padding: '32px 16px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '13px' }}>
        No workspace bound. Bind a workspace in the chat header to see project files.
      </div>
    )
  }

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '8px 4px' }}>
      <div style={{ padding: '4px 8px', fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }} title={activeSession.workspacePath}>
        {activeSession.workspacePath.split(/[/\\]/).pop() || 'WORKSPACE'}
      </div>
      {rootNodes.map(node => (
        <TreeNode
          key={node.path} node={node} level={0}
          onToggle={toggleNode} onSelect={(n) => openFile(n.path, n.name)}
          onContextMenu={handleContextMenu}
          renamingNode={renamingNode} renameValue={renameValue}
          onRenameChange={setRenameValue} onRenameSubmit={submitRename} onRenameCancel={() => setRenamingNode(null)}
        />
      ))}
      
      {contextMenu && (
        <div style={{
          position: 'fixed', top: contextMenu.y, left: contextMenu.x, zIndex: 1000,
          background: 'var(--bg-secondary)', border: '1px solid var(--border)',
          borderRadius: '6px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
          padding: '4px', minWidth: '140px', fontSize: '13px', display: 'flex', flexDirection: 'column'
        }} onClick={(e) => e.stopPropagation()}>
          <button style={{ padding: '6px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--text-primary)', cursor: 'pointer', borderRadius: '4px' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            onClick={() => startRename(contextMenu.node)}>
            Rename
          </button>
          <button style={{ padding: '6px 12px', textAlign: 'left', background: 'transparent', border: 'none', color: 'var(--error)', cursor: 'pointer', borderRadius: '4px' }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'var(--bg-tertiary)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
            onClick={() => deleteNode(contextMenu.node)}>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
