// ═══════════════════════════════════════════════════════════════════
// Lumiq — CDP Web Sandbox & Inspector Console
// Visual DOM Tree Inspector, Computed Styles Editor, Console Stream & Heap Profiler.
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react'
import { useSessionStore } from '@renderer/store/sessionStore'

interface WebInspectorConsoleProps {
  onBack: () => void
}

interface DomNode {
  nodeId: number
  nodeName: string
  nodeType: number
  attributes: Record<string, string>
  children?: DomNode[]
  computedStyles?: Record<string, string>
}

export function WebInspectorConsole({ onBack }: WebInspectorConsoleProps): React.JSX.Element {
  const { activeSessionId, sessions } = useSessionStore()
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const workspacePath = activeSession?.workspacePath ?? ''

  const [server, setServer] = useState<{ id: string; port: number; status: string } | null>(null)
  const [activeTab, setActiveTab] = useState<'dom' | 'styles' | 'console' | 'memory'>('dom')
  
  const [domTree, setDomTree] = useState<DomNode | null>(null)
  const [selectedSelector, setSelectedSelector] = useState<string>('.welcome-card')
  const [styles, setStyles] = useState<Record<string, string>>({})
  const [newProp, setNewProp] = useState<string>('')
  const [newVal, setNewVal] = useState<string>('')

  const [consoleLogs, setConsoleLogs] = useState<any[]>([])
  const [heapSnapshot, setHeapSnapshot] = useState<{ totalJSHeapSize: number; usedJSHeapSize: number; timestamp: number } | null>(null)

  // Start Sandbox Preview Server
  const handleStartServer = async () => {
    if (!workspacePath) return
    try {
      const serverInfo = await window.electronAPI.sandbox.start(workspacePath)
      setServer(serverInfo)
      void loadDomTree()
    } catch (err: any) {
      alert(`Failed to start preview server: ${err.message}`)
    }
  }

  // Stop Sandbox Server
  const handleStopServer = async () => {
    if (!server) return
    try {
      await window.electronAPI.sandbox.stop(server.id)
      setServer(null)
    } catch (err: any) {
      console.error('Failed to stop server:', err)
    }
  }

  // Load DOM Tree
  const loadDomTree = useCallback(async () => {
    try {
      const tree = await window.electronAPI.sandbox.getDomTree(workspacePath)
      setDomTree(tree)
    } catch (err) {
      console.error('Failed to get DOM tree:', err)
    }
  }, [workspacePath])

  // Load Computed Styles for selected selector
  const loadStyles = useCallback(async (selector: string) => {
    try {
      const s = await window.electronAPI.sandbox.inspectStyles(server?.id || 'default', selector)
      setStyles(s)
    } catch (err) {
      console.error('Failed to inspect styles:', err)
    }
  }, [server])

  // Update dynamic element style
  const handleAddStyle = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newProp || !newVal || !selectedSelector) return
    try {
      await window.electronAPI.sandbox.updateStyle(selectedSelector, newProp, newVal)
      setNewProp('')
      setNewVal('')
      await loadStyles(selectedSelector)
    } catch (err: any) {
      alert(`Failed to update style: ${err.message}`)
    }
  }

  // Load Console Logs
  const loadConsoleLogs = async () => {
    try {
      const logs = await window.electronAPI.sandbox.getConsoleLogs()
      setConsoleLogs(logs)
    } catch (err) {
      console.error('Failed to load console logs:', err)
    }
  }

  // Take Memory Heap Snapshot
  const handleTakeHeapSnapshot = async () => {
    try {
      const snapshot = await window.electronAPI.sandbox.takeHeapSnapshot()
      setHeapSnapshot(snapshot)
    } catch (err) {
      console.error('Failed to take heap snapshot:', err)
    }
  }

  useEffect(() => {
    if (workspacePath) {
      void loadDomTree()
    }
  }, [workspacePath, loadDomTree])

  useEffect(() => {
    if (selectedSelector) {
      void loadStyles(selectedSelector)
    }
  }, [selectedSelector, loadStyles])

  useEffect(() => {
    if (activeTab === 'console') {
      void loadConsoleLogs()
    } else if (activeTab === 'memory') {
      void handleTakeHeapSnapshot()
    }
  }, [activeTab])

  const renderDomNode = (node: DomNode, depth = 0) => {
    const isSelected = selectedSelector === `.${node.attributes.class}` || selectedSelector === `#${node.attributes.id}`
    const label = node.nodeName.toLowerCase()
    const classStr = node.attributes.class ? ` class="${node.attributes.class}"` : ''
    const idStr = node.attributes.id ? ` id="${node.attributes.id}"` : ''

    return (
      <div key={node.nodeId} style={{ paddingLeft: depth * 16 }} className="my-1">
        <span
          onClick={() => {
            if (node.attributes.class) setSelectedSelector(`.${node.attributes.class}`)
            else if (node.attributes.id) setSelectedSelector(`#${node.attributes.id}`)
          }}
          className={`cursor-pointer font-mono text-xs px-2 py-1 rounded transition-colors ${
            isSelected
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold'
              : 'hover:bg-[var(--bg-secondary)] text-sky-400'
          }`}
        >
          &lt;{label}
          <span className="text-emerald-400">{idStr}</span>
          <span className="text-purple-300">{classStr}</span>&gt;
        </span>
        {node.children && node.children.map((c) => renderDomNode(c, depth + 1))}
      </div>
    )
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[var(--bg-primary)] p-6 custom-scrollbar flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🌐</span>
            <h1 className="text-2xl font-extrabold text-white">CDP Web Sandbox & Inspector</h1>
          </div>
          <p className="text-xs text-[var(--text-secondary)] mt-1">
            Real-time HTML preview server, Chrome DevTools Protocol DOM inspector & Memory profiler.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-3 py-1.5 rounded text-xs font-semibold bg-[var(--bg-secondary)] hover:bg-[var(--bg-tertiary)] text-[var(--text-secondary)] transition-colors"
        >
          ← Back to IDE
        </button>
      </div>

      {/* Server Status Bar */}
      <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4 mb-6 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className={`w-3 h-3 rounded-full ${server ? 'bg-emerald-500 animate-pulse' : 'bg-rose-500'}`} />
          <div>
            <div className="text-sm font-semibold text-white">
              {server ? `Preview Running on Port ${server.port}` : 'Preview Server Offline'}
            </div>
            <div className="text-xs text-[var(--text-secondary)]">
              {server ? `http://localhost:${server.port}` : 'Click Start Server to launch preview HTTP server'}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {server ? (
            <>
              <button
                onClick={() => window.open(`http://localhost:${server.port}`, '_blank')}
                className="px-3 py-1.5 rounded text-xs font-medium bg-sky-600 hover:bg-sky-500 text-white transition-colors"
              >
                Open in Browser ↗
              </button>
              <button
                onClick={handleStopServer}
                className="px-3 py-1.5 rounded text-xs font-medium bg-rose-600 hover:bg-rose-500 text-white transition-colors"
              >
                Stop Server
              </button>
            </>
          ) : (
            <button
              onClick={handleStartServer}
              className="px-3 py-1.5 rounded text-xs font-medium bg-emerald-600 hover:bg-emerald-500 text-white transition-colors"
            >
              Start Preview Server ▶
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-color)] pb-3 mb-6">
        <button
          onClick={() => setActiveTab('dom')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'dom'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-secondary)]'
          }`}
        >
          🌲 DOM Tree Inspector
        </button>
        <button
          onClick={() => setActiveTab('styles')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'styles'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-secondary)]'
          }`}
        >
          🎨 Computed Styles Editor
        </button>
        <button
          onClick={() => setActiveTab('console')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'console'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-secondary)]'
          }`}
        >
          📑 Console Logs ({consoleLogs.length})
        </button>
        <button
          onClick={() => setActiveTab('memory')}
          className={`px-4 py-2 rounded-lg text-xs font-semibold transition-all ${
            activeTab === 'memory'
              ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
              : 'text-[var(--text-secondary)] hover:text-white hover:bg-[var(--bg-secondary)]'
          }`}
        >
          ⚡ JS Heap Profiler
        </button>
      </div>

      {/* Tab Contents */}
      {activeTab === 'dom' && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4 font-mono text-sm overflow-x-auto">
          {domTree ? renderDomNode(domTree) : <div className="text-[var(--text-secondary)]">Loading DOM Tree...</div>}
        </div>
      )}

      {activeTab === 'styles' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Computed Styles for: <span className="text-amber-400 font-mono">{selectedSelector}</span></h3>
            <div className="space-y-2 font-mono text-xs">
              {Object.entries(styles).map(([k, v]) => (
                <div key={k} className="flex items-center justify-between border-b border-[var(--border-color)]/40 pb-1">
                  <span className="text-purple-300">{k}</span>
                  <span className="text-emerald-400">{v}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4">
            <h3 className="text-sm font-semibold text-white mb-3">Inject Dynamic CSS Rule</h3>
            <form onSubmit={handleAddStyle} className="space-y-3">
              <div>
                <label className="text-xs text-[var(--text-secondary)] block mb-1">CSS Property</label>
                <input
                  type="text"
                  placeholder="e.g. background-color"
                  value={newProp}
                  onChange={(e) => setNewProp(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
              <div>
                <label className="text-xs text-[var(--text-secondary)] block mb-1">Value</label>
                <input
                  type="text"
                  placeholder="e.g. #3b82f6"
                  value={newVal}
                  onChange={(e) => setNewVal(e.target.value)}
                  className="w-full bg-[var(--bg-primary)] border border-[var(--border-color)] rounded px-3 py-1.5 text-xs text-white"
                />
              </div>
              <button
                type="submit"
                className="w-full py-2 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold transition-colors"
              >
                Apply Style via CDP
              </button>
            </form>
          </div>
        </div>
      )}

      {activeTab === 'console' && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-4 font-mono text-xs space-y-2 max-h-96 overflow-y-auto">
          {consoleLogs.length === 0 ? (
            <div className="text-[var(--text-secondary)]">No console log entries recorded yet.</div>
          ) : (
            consoleLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-2 border-b border-[var(--border-color)]/30 pb-1">
                <span className="text-gray-500">{log.timestamp}</span>
                <span className={`font-bold uppercase ${log.level === 'error' ? 'text-rose-400' : log.level === 'warn' ? 'text-amber-400' : 'text-sky-400'}`}>
                  [{log.level}]
                </span>
                <span className="text-gray-300 flex-1">{log.message}</span>
                <span className="text-gray-500 text-[10px]">{log.source}</span>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'memory' && (
        <div className="bg-[var(--bg-secondary)] border border-[var(--border-color)] rounded-xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-white">JavaScript Memory Heap Snapshot</h3>
            <button
              onClick={handleTakeHeapSnapshot}
              className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white rounded text-xs font-semibold transition-colors"
            >
              Take Heap Snapshot 📸
            </button>
          </div>
          {heapSnapshot ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 font-mono">
              <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)]">
                <div className="text-xs text-[var(--text-secondary)]">Total JS Heap Size</div>
                <div className="text-lg font-bold text-sky-400 mt-1">{(heapSnapshot.totalJSHeapSize / 1024 / 1024).toFixed(2)} MB</div>
              </div>
              <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)]">
                <div className="text-xs text-[var(--text-secondary)]">Used JS Heap Size</div>
                <div className="text-lg font-bold text-emerald-400 mt-1">{(heapSnapshot.usedJSHeapSize / 1024 / 1024).toFixed(2)} MB</div>
              </div>
              <div className="bg-[var(--bg-primary)] p-4 rounded-lg border border-[var(--border-color)]">
                <div className="text-xs text-[var(--text-secondary)]">Timestamp</div>
                <div className="text-sm font-bold text-gray-300 mt-1">{new Date(heapSnapshot.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          ) : (
            <div className="text-xs text-[var(--text-secondary)]">Click button above to capture memory profile snapshot.</div>
          )}
        </div>
      )}
    </div>
  )
}
