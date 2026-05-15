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

function TreeNode({ node, level, onToggle, onSelect }: { node: FileNode; level: number; onToggle: (node: FileNode) => void; onSelect: (node: FileNode) => void }): React.JSX.Element {
  return (
    <div>
      <div
        onClick={() => node.isDirectory ? onToggle(node) : onSelect(node)}
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
        <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{node.name}</span>
      </div>
      {node.isDirectory && node.isOpen && node.children && (
        <div>
          {node.children.map(child => (
            <TreeNode key={child.path} node={child} level={level + 1} onToggle={onToggle} onSelect={onSelect} />
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

  useEffect(() => {
    if (activeSession?.workspacePath) {
      loadDir(activeSession.workspacePath).then(setRootNodes)
    } else {
      setRootNodes([])
    }
  }, [activeSession?.workspacePath])

  const loadDir = async (dirPath: string): Promise<FileNode[]> => {
    try {
      const entries = await window.electronAPI.fs.listDir(dirPath)
      return entries.map((e: { name: string, isDirectory: boolean }) => ({
        name: e.name,
        isDirectory: e.isDirectory,
        path: `${dirPath}/${e.name}`.replace(/\\/g, '/'), // basic normalization
      }))
    } catch (e) {
      console.error(e)
      return []
    }
  }

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
          key={node.path}
          node={node}
          level={0}
          onToggle={toggleNode}
          onSelect={(n) => openFile(n.path, n.name)}
        />
      ))}
    </div>
  )
}
