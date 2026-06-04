import React, { useState, useEffect, useRef } from 'react'
import { DiffEditor } from '@monaco-editor/react'
import { useSessionStore } from '@renderer/store/sessionStore'
import { ComposerTaskStatus, ComposerState } from '@shared/types'

interface ComposerWorkspaceProps {
  onNavigate: (page: 'chat' | 'settings' | 'agents' | 'composer') => void
}

function getLanguage(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase()
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    json: 'json', css: 'css', html: 'html', md: 'markdown', py: 'python',
    rs: 'rust', go: 'go', java: 'java', cs: 'csharp'
  }
  return ext ? (map[ext] ?? 'plaintext') : 'plaintext'
}

export function ComposerWorkspace({ onNavigate }: ComposerWorkspaceProps): React.JSX.Element {
  const { sessions, activeSessionId } = useSessionStore()
  const [goal, setGoal] = useState('')
  const [activeNodeId, setActiveNodeId] = useState<'architect' | 'coder' | 'tester' | 'reviewer'>('architect')
  const [activeDiffFile, setActiveDiffFile] = useState<string | null>(null)
  const [diffOriginal, setDiffOriginal] = useState('')
  const [diffProposed, setDiffProposed] = useState('')

  const [task, setTask] = useState<ComposerTaskStatus>({
    goal: '',
    state: 'idle',
    nodes: [
      { id: 'architect', label: 'Architect', status: 'idle', logs: [] },
      { id: 'coder', label: 'Coder', status: 'idle', logs: [] },
      { id: 'tester', label: 'Tester', status: 'idle', logs: [] },
      { id: 'reviewer', label: 'Reviewer', status: 'idle', logs: [] }
    ],
    stagedFiles: []
  })

  const logsEndRef = useRef<HTMLDivElement>(null)

  // Listen to background Composer status streams
  useEffect(() => {
    const cleanup = window.electronAPI.composer.onStatusUpdate((status) => {
      setTask(status)
      
      // Auto-focus the active agent's log
      const activeNode = status.nodes.find(n => n.status === 'running')
      if (activeNode) {
        setActiveNodeId(activeNode.id)
      }
    })
    return cleanup
  }, [])

  // Auto-scroll agent logs
  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [task.nodes, activeNodeId])

  // Get active workspace path
  const activeWorkspacePath = sessions.find(s => s.id === activeSessionId)?.workspacePath || ''

  const handleStartTask = () => {
    if (!goal.trim()) return
    if (!activeWorkspacePath) {
      alert('Please select a workspace folder first (load a folder in Chats explorer sidebar).')
      return
    }
    setActiveDiffFile(null)
    window.electronAPI.composer.start(goal, activeWorkspacePath)
  }

  const handleCancelTask = () => {
    window.electronAPI.composer.cancel()
  }

  const handleApprove = () => {
    window.electronAPI.composer.approve()
    setActiveDiffFile(null)
  }

  const handleReject = () => {
    window.electronAPI.composer.reject()
    setActiveDiffFile(null)
  }

  const handlePreviewDiff = async (filePath: string) => {
    const diff = await window.electronAPI.composer.getDiffPreview(filePath)
    setActiveDiffFile(filePath)
    setDiffOriginal(diff.original)
    setDiffProposed(diff.proposed)
  }

  const activeNode = task.nodes.find(n => n.id === activeNodeId)

  // Helpers for SVG node styling
  const isNodeActive = (id: string) => {
    const node = task.nodes.find(n => n.id === id)
    return node?.status === 'running'
  }

  const getNodeColor = (id: string) => {
    const node = task.nodes.find(n => n.id === id)
    if (!node) return 'var(--border)'
    switch (node.status) {
      case 'running': return '#3b82f6' // Blue pulse
      case 'completed': return '#10b981' // Green
      case 'failed': return '#ef4444' // Red
      default: return 'var(--border)'
    }
  }

  const getStatusText = (state: ComposerState) => {
    switch (state) {
      case 'planning': return '🧠 Architect: Analyzing workspace and planning modifications...'
      case 'coding': return '💻 Coder: Staging file edits in parallel...'
      case 'testing': return '⚡ Swarm Verification: Running tests & reviewing code concurrently...'
      case 'reviewing': return '🛡️ Swarm Verification: Running tests & reviewing code concurrently...'
      case 'awaiting_approval': return '🤝 Verification Success. Staged diffs ready for review!'
      case 'completed': return '🎉 Commits finalized successfully!'
      case 'cancelled': return '⚠️ Orchestration session aborted.'
      case 'failed': return '🚨 Swarm pipeline failed.'
      default: return 'Swarm offline. Formulate a goal to begin.'
    }
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      
      {/* Dynamic Keyframes Animation Injection */}
      <style dangerouslySetInnerHTML={{__html: `
        @keyframes dashflow {
          to { stroke-dashoffset: -20; }
        }
        .animate-flow {
          animation: dashflow 1s linear infinite;
        }
        @keyframes pulseBorder {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }
        .pulse-active {
          animation: pulseBorder 2s infinite;
        }
      `}} />

      {/* Header bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 24px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '18px' }}>✦</span>
          <h1 style={{ fontSize: '15px', fontWeight: 600, margin: 0 }}>Composer Agent Swarm Workspace</h1>
        </div>
        <button
          onClick={() => onNavigate('chat')}
          style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', color: 'var(--text-secondary)', fontSize: '12px', padding: '6px 12px', borderRadius: '6px', transition: 'all 0.2s' }}
          onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--text-secondary)'; e.currentTarget.style.color = 'var(--text-primary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)'; e.currentTarget.style.color = 'var(--text-secondary)' }}
        >
          Return to Chat
        </button>
      </div>

      {/* Main Body */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        
        {/* Left Column: Input, Pipeline status & Terminal Logs */}
        <div style={{ width: '380px', borderRight: '1px solid var(--border)', display: 'flex', flexDirection: 'column', flexShrink: 0, padding: '20px', gap: '20px', overflowY: 'auto', background: 'var(--bg-secondary)' }}>
          
          {/* Goal section */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Swarm Goal</label>
            <textarea
              placeholder="What changes would you like to orchestrate? (e.g. 'Create a logging utility with file rotates and bind it in src/main.ts')"
              value={goal}
              onChange={(e) => setGoal(e.target.value)}
              disabled={task.state !== 'idle' && task.state !== 'completed' && task.state !== 'cancelled' && task.state !== 'failed'}
              style={{
                width: '100%', height: '90px', background: 'var(--bg-primary)', border: '1px solid var(--border)',
                borderRadius: '8px', padding: '10px', fontSize: '12px', color: 'var(--text-primary)',
                resize: 'none', outline: 'none', transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = 'var(--accent-blue)'}
              onBlur={(e) => e.target.style.borderColor = 'var(--border)'}
            />
            
            {/* Control buttons */}
            <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
              {(task.state === 'idle' || task.state === 'completed' || task.state === 'cancelled' || task.state === 'failed') ? (
                <button
                  onClick={handleStartTask}
                  style={{ flex: 1, background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, padding: '10px', borderRadius: '6px', cursor: 'pointer', transition: 'transform 0.15s, opacity 0.2s', boxShadow: '0 4px 12px rgba(99, 102, 241, 0.25)' }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Deploy Swarm
                </button>
              ) : (
                <button
                  onClick={handleCancelTask}
                  style={{ flex: 1, background: 'linear-gradient(135deg, #f43f5e 0%, #e11d48 100%)', border: 'none', color: '#fff', fontSize: '12px', fontWeight: 600, padding: '10px', borderRadius: '6px', cursor: 'pointer', transition: 'opacity 0.2s' }}
                  onMouseEnter={(e) => e.currentTarget.style.opacity = '0.9'}
                  onMouseLeave={(e) => e.currentTarget.style.opacity = '1'}
                >
                  Abort Swarm
                </button>
              )}
            </div>
          </div>

          {/* Pipeline node selector tabs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Agent Nodes</label>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {task.nodes.map((node) => {
                const isActive = activeNodeId === node.id
                const isRunning = node.status === 'running'
                const isDone = node.status === 'completed'
                const isErr = node.status === 'failed'

                return (
                  <button
                    key={node.id}
                    onClick={() => setActiveNodeId(node.id as any)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: '10px', padding: '10px 12px',
                      background: isActive ? 'var(--bg-primary)' : 'rgba(255,255,255,0.02)',
                      border: isActive ? '1px solid var(--border)' : '1px solid transparent',
                      borderRadius: '8px', cursor: 'pointer', textAlign: 'left',
                      color: isActive ? 'var(--text-primary)' : 'var(--text-muted)', transition: 'all 0.2s'
                    }}
                  >
                    <span style={{
                      width: '8px', height: '8px', borderRadius: '50%',
                      background: isRunning ? '#3b82f6' : isDone ? '#10b981' : isErr ? '#ef4444' : '#4b5563',
                      boxShadow: isRunning ? '0 0 8px #3b82f6' : 'none'
                    }} />
                    <span style={{ fontSize: '12px', fontWeight: 600, flex: 1 }}>{node.label}</span>
                    {isRunning && <span style={{ fontSize: '10px', color: '#3b82f6', background: 'rgba(59,130,246,0.1)', padding: '2px 6px', borderRadius: '4px' }}>active</span>}
                    {isDone && <span style={{ fontSize: '10px', color: '#10b981' }}>✓</span>}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Node Terminal Logs */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minHeight: '200px', border: '1px solid var(--border)', borderRadius: '8px', background: 'var(--bg-primary)', overflow: 'hidden' }}>
            <div style={{ display: 'flex', alignItems: 'center', padding: '6px 12px', borderBottom: '1px solid var(--border)', background: 'var(--bg-secondary)', fontSize: '10px', color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              {activeNode?.label} Console Logs
            </div>
            <div style={{ flex: 1, padding: '12px', overflowY: 'auto', fontFamily: 'var(--font-mono)', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px', lineBreak: 'anywhere' }}>
              {activeNode?.logs.length === 0 ? (
                <div style={{ color: 'var(--text-muted)', fontStyle: 'italic', textAlign: 'center', marginTop: '20px' }}>No logs streamed yet.</div>
              ) : (
                activeNode?.logs.map((log, index) => (
                  <div key={index} style={{ whiteSpace: 'pre-wrap' }}>{log}</div>
                ))
              )}
              <div ref={logsEndRef} />
            </div>
          </div>

        </div>

        {/* Right Column: Node Graph & Diff viewer */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', padding: '20px', gap: '20px' }}>
          
          {/* Visual Node Graph (SVG vector tree) */}
          <div style={{ height: '240px', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg-secondary)', position: 'relative', flexShrink: 0, overflow: 'hidden' }}>
            <div style={{ position: 'absolute', top: '12px', left: '16px', fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>
              Orchestration Flow
            </div>
            
            <svg width="100%" height="100%" viewBox="0 0 800 240" style={{ pointerEvents: 'auto' }}>
              {/* Curve connections */}
              {/* Goal to Architect */}
              <path
                d="M 60 140 L 200 140"
                fill="none"
                stroke={isNodeActive('architect') ? '#3b82f6' : (task.nodes.find(n => n.id === 'architect')?.status === 'completed' || task.state === 'awaiting_approval' || task.state === 'completed') ? '#10b981' : 'var(--border)'}
                strokeWidth="2"
                strokeDasharray={isNodeActive('architect') ? "6 6" : "none"}
                className={isNodeActive('architect') ? "animate-flow" : ""}
              />
              {/* Architect to Coder */}
              <path
                d="M 200 140 L 340 140"
                fill="none"
                stroke={isNodeActive('coder') ? '#3b82f6' : (task.nodes.find(n => n.id === 'coder')?.status === 'completed' || task.state === 'awaiting_approval' || task.state === 'completed') ? '#10b981' : 'var(--border)'}
                strokeWidth="2"
                strokeDasharray={isNodeActive('coder') ? "6 6" : "none"}
                className={isNodeActive('coder') ? "animate-flow" : ""}
              />
              {/* Coder to Tester (split path) */}
              <path
                d="M 340 140 C 400 140, 420 80, 480 80"
                fill="none"
                stroke={isNodeActive('tester') ? '#3b82f6' : (task.nodes.find(n => n.id === 'tester')?.status === 'completed' || task.state === 'awaiting_approval' || task.state === 'completed') ? '#10b981' : 'var(--border)'}
                strokeWidth="2"
                strokeDasharray={isNodeActive('tester') ? "6 6" : "none"}
                className={isNodeActive('tester') ? "animate-flow" : ""}
              />
              {/* Coder to Reviewer (split path) */}
              <path
                d="M 340 140 C 400 140, 420 200, 480 200"
                fill="none"
                stroke={isNodeActive('reviewer') ? '#3b82f6' : (task.nodes.find(n => n.id === 'reviewer')?.status === 'completed' || task.state === 'awaiting_approval' || task.state === 'completed') ? '#10b981' : 'var(--border)'}
                strokeWidth="2"
                strokeDasharray={isNodeActive('reviewer') ? "6 6" : "none"}
                className={isNodeActive('reviewer') ? "animate-flow" : ""}
              />
              {/* Tester to Commit */}
              <path
                d="M 480 80 C 540 80, 560 140, 620 140"
                fill="none"
                stroke={(task.nodes.find(n => n.id === 'tester')?.status === 'completed' || task.state === 'awaiting_approval' || task.state === 'completed') ? '#10b981' : 'var(--border)'}
                strokeWidth="2"
              />
              {/* Reviewer to Commit */}
              <path
                d="M 480 200 C 540 200, 560 140, 620 140"
                fill="none"
                stroke={(task.nodes.find(n => n.id === 'reviewer')?.status === 'completed' || task.state === 'awaiting_approval' || task.state === 'completed') ? '#10b981' : 'var(--border)'}
                strokeWidth="2"
              />

              {/* Goal/Start Node */}
              <g transform="translate(60, 140)">
                <circle r="22" fill="var(--bg-primary)" stroke={task.state !== 'idle' ? '#6366f1' : 'var(--border)'} strokeWidth="2" />
                <text textAnchor="middle" y="5" fill="var(--text-primary)" fontSize="18">🎯</text>
              </g>

              {/* Architect Node */}
              <g transform="translate(200, 140)" style={{ cursor: 'pointer' }} onClick={() => setActiveNodeId('architect')}>
                <circle r="20" fill="var(--bg-primary)" stroke={getNodeColor('architect')} strokeWidth="2.5" className={isNodeActive('architect') ? "pulse-active" : ""} />
                <text textAnchor="middle" y="5" fill="var(--text-primary)" fontSize="16">🧠</text>
                <text textAnchor="middle" y="32" fill="var(--text-secondary)" fontSize="10" fontWeight="600">Architect</text>
              </g>

              {/* Coder Node */}
              <g transform="translate(340, 140)" style={{ cursor: 'pointer' }} onClick={() => setActiveNodeId('coder')}>
                <circle r="20" fill="var(--bg-primary)" stroke={getNodeColor('coder')} strokeWidth="2.5" className={isNodeActive('coder') ? "pulse-active" : ""} />
                <text textAnchor="middle" y="5" fill="var(--text-primary)" fontSize="16">💻</text>
                <text textAnchor="middle" y="32" fill="var(--text-secondary)" fontSize="10" fontWeight="600">Coder</text>
              </g>

              {/* Tester Node */}
              <g transform="translate(480, 80)" style={{ cursor: 'pointer' }} onClick={() => setActiveNodeId('tester')}>
                <circle r="20" fill="var(--bg-primary)" stroke={getNodeColor('tester')} strokeWidth="2.5" className={isNodeActive('tester') ? "pulse-active" : ""} />
                <text textAnchor="middle" y="5" fill="var(--text-primary)" fontSize="16">⚡</text>
                <text textAnchor="middle" y="32" fill="var(--text-secondary)" fontSize="10" fontWeight="600">Tester</text>
              </g>

              {/* Reviewer Node */}
              <g transform="translate(480, 200)" style={{ cursor: 'pointer' }} onClick={() => setActiveNodeId('reviewer')}>
                <circle r="20" fill="var(--bg-primary)" stroke={getNodeColor('reviewer')} strokeWidth="2.5" className={isNodeActive('reviewer') ? "pulse-active" : ""} />
                <text textAnchor="middle" y="5" fill="var(--text-primary)" fontSize="16">🛡️</text>
                <text textAnchor="middle" y="32" fill="var(--text-secondary)" fontSize="10" fontWeight="600">Reviewer</text>
              </g>

              {/* Commit Node */}
              <g transform="translate(620, 140)">
                <circle r="22" fill="var(--bg-primary)" stroke={(task.state === 'awaiting_approval' || task.state === 'completed') ? '#10b981' : 'var(--border)'} strokeWidth="2" />
                <text textAnchor="middle" y="5" fill="var(--text-primary)" fontSize="18">🤝</text>
                <text textAnchor="middle" y="32" fill="var(--text-secondary)" fontSize="10" fontWeight="600">Commit</text>
              </g>
            </svg>
            
            {/* Status ticker */}
            <div style={{ position: 'absolute', bottom: '12px', left: '16px', right: '16px', display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 12px', background: 'var(--bg-primary)', borderRadius: '6px', border: '1px solid var(--border)' }}>
              <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: task.state === 'idle' ? '#4b5563' : task.state === 'awaiting_approval' || task.state === 'completed' ? '#10b981' : task.state === 'failed' ? '#ef4444' : '#3b82f6', boxShadow: task.state !== 'idle' ? '0 0 6px currentcolor' : 'none' }} />
              <span style={{ fontSize: '11px', color: 'var(--text-secondary)', fontWeight: 500 }}>{getStatusText(task.state)}</span>
            </div>
          </div>

          {/* Bottom section: Diff Previewer / File staging panel */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', border: '1px solid var(--border)', borderRadius: '12px', background: 'var(--bg-secondary)', overflow: 'hidden' }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
              <span style={{ fontSize: '11px', fontWeight: 700, textTransform: 'uppercase', color: 'var(--text-muted)', letterSpacing: '0.05em' }}>Staged Modifications ({task.stagedFiles.length})</span>
              
              {/* Approval controls */}
              {task.state === 'awaiting_approval' && (
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    onClick={handleReject}
                    style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', fontSize: '11px', fontWeight: 600, padding: '4px 10px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s' }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.15)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.1)' }}
                  >
                    Reject changes
                  </button>
                  <button
                    onClick={handleApprove}
                    style={{ background: '#10b981', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 600, padding: '4px 12px', borderRadius: '4px', cursor: 'pointer', transition: 'all 0.2s', boxShadow: '0 2px 8px rgba(16, 185, 129, 0.25)' }}
                    onMouseEnter={(e) => { e.currentTarget.style.opacity = '0.9' }}
                    onMouseLeave={(e) => { e.currentTarget.style.opacity = '1' }}
                  >
                    Approve & Commit
                  </button>
                </div>
              )}
            </div>

            {/* Split panel: Left file list, Right Monaco Diff */}
            <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
              
              {/* Staged files sidebar list */}
              <div style={{ width: '220px', borderRight: '1px solid var(--border)', flexShrink: 0, overflowY: 'auto', padding: '10px', display: 'flex', flexDirection: 'column', gap: '4px', background: 'var(--bg-primary)' }}>
                {task.stagedFiles.length === 0 ? (
                  <div style={{ padding: '20px', fontSize: '11px', color: 'var(--text-muted)', textAlign: 'center', fontStyle: 'italic' }}>No files modified yet.</div>
                ) : (
                  task.stagedFiles.map((file) => {
                    const isSelected = activeDiffFile === file.path
                    const label = file.path.split('/').pop() || ''
                    return (
                      <button
                        key={file.path}
                        onClick={() => handlePreviewDiff(file.path)}
                        style={{
                          display: 'flex', alignItems: 'center', gap: '8px', padding: '8px',
                          background: isSelected ? 'rgba(59,130,246,0.1)' : 'transparent',
                          border: 'none', borderRadius: '6px', cursor: 'pointer', textAlign: 'left',
                          color: isSelected ? 'var(--accent-blue)' : 'var(--text-secondary)', width: '100%'
                        }}
                      >
                        <span style={{ fontSize: '10px', color: file.status === 'created' ? '#10b981' : '#f59e0b' }}>
                          {file.status === 'created' ? 'A' : 'M'}
                        </span>
                        <span style={{ fontSize: '11px', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', flex: 1 }} title={file.path}>
                          {label}
                        </span>
                      </button>
                    )
                  })
                )}
              </div>

              {/* Monaco Diff Editor view */}
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
                {activeDiffFile ? (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
                    <div style={{ padding: '4px 12px', background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border)', fontSize: '10px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      Diff Review: {activeDiffFile}
                    </div>
                    <div style={{ flex: 1, overflow: 'hidden' }}>
                      <DiffEditor
                        original={diffOriginal}
                        modified={diffProposed}
                        language={getLanguage(activeDiffFile)}
                        theme="lumiq-dark"
                        options={{
                          readOnly: true,
                          originalEditable: false,
                          automaticLayout: true,
                          minimap: { enabled: false }
                        }}
                      />
                    </div>
                  </div>
                ) : (
                  <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '8px' }}>
                    <span style={{ fontSize: '24px' }}>🔍</span>
                    <span style={{ fontSize: '12px' }}>Select a staged file on the left to preview diff modifications.</span>
                  </div>
                )}
              </div>

            </div>
          </div>

        </div>
      </div>

    </div>
  )
}
