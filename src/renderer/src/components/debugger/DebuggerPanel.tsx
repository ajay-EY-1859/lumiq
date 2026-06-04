import React, { useState, useEffect } from 'react'
import { DapState } from '@shared/types'
import { useEditorStore } from '@renderer/store/editorStore'
import { useSessionStore } from '@renderer/store/sessionStore'

export function DebuggerPanel(): React.JSX.Element {
  const { activeTabId } = useEditorStore()
  const { sessions, activeSessionId } = useSessionStore()
  
  const [port, setPort] = useState<number>(9229)
  const [scriptPath, setScriptPath] = useState<string>('')
  const [dapState, setDapState] = useState<DapState>({
    state: 'inactive',
    port: 0,
    scriptPath: '',
    breakpoints: [],
    stackFrames: [],
    scopes: [],
    activeFrameId: null
  })

  const [aiExplanation, setAiExplanation] = useState<string>('')
  const [loadingAi, setLoadingAi] = useState<boolean>(false)

  // Sync default script path with active editor tab
  useEffect(() => {
    if (activeTabId && !scriptPath) {
      setScriptPath(activeTabId)
    }
  }, [activeTabId, scriptPath])

  // Listen to DAP state updates from main process
  useEffect(() => {
    if (window.electronAPI && window.electronAPI.dap) {
      const cleanup = window.electronAPI.dap.onStateUpdate((updatedState) => {
        setDapState(updatedState)
      })
      return cleanup
    }
    return undefined
  }, [])

  const handleStartSession = async () => {
    if (!scriptPath) {
      alert('Please specify a script path to debug.')
      return
    }
    setAiExplanation('')
    await window.electronAPI.dap.start(port, scriptPath)
  }

  const handleStopSession = async () => {
    await window.electronAPI.dap.stop()
    setAiExplanation('')
  }

  const handleContinue = async () => {
    await window.electronAPI.dap.continue()
  }

  const handleStepOver = async () => {
    await window.electronAPI.dap.stepOver()
  }

  const handleStepInto = async () => {
    await window.electronAPI.dap.stepInto()
  }

  const handleStepOut = async () => {
    await window.electronAPI.dap.stepOut()
  }

  const handleExplainState = async () => {
    setLoadingAi(true)
    setAiExplanation('')
    try {
      const activeSession = sessions.find(s => s.id === activeSessionId)
      const goal = activeSession?.title || 'Debug TypeError exception'
      const explanation = await window.electronAPI.dap.explainState(goal)
      setAiExplanation(explanation)
    } catch (err) {
      setAiExplanation(`[Error] Failed to explain debugger state: ${(err as Error).message}`)
    } finally {
      setLoadingAi(false)
    }
  }

  const renderDebuggerControls = () => {
    const isPaused = dapState.state === 'paused'
    const isRunning = dapState.state === 'running' || isPaused

    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', borderBottom: '1px solid var(--border)', padding: '6px 12px', background: 'var(--bg-secondary)', flexShrink: 0 }}>
        {!isRunning ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
            <label style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Port:</label>
            <input
              type="number"
              value={port}
              onChange={(e) => setPort(parseInt(e.target.value) || 9229)}
              style={{ width: '60px', padding: '2px 4px', fontSize: '11px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)' }}
            />
            <label style={{ fontSize: '11px', color: 'var(--text-muted)', marginLeft: '4px' }}>Script:</label>
            <input
              type="text"
              value={scriptPath}
              onChange={(e) => setScriptPath(e.target.value)}
              placeholder="relative/path/to/script.ts"
              style={{ flex: 1, padding: '2px 6px', fontSize: '11px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '4px', color: 'var(--text-primary)' }}
            />
            <button
              onClick={handleStartSession}
              style={{ background: 'var(--accent-blue)', color: '#fff', border: 'none', padding: '3px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer' }}
            >
              🚀 Launch Debugger
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', width: '100%' }}>
            <span style={{ fontSize: '11px', color: isPaused ? '#ef4444' : '#10b981', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginRight: '12px' }}>
              <span style={{ width: '8px', height: '8px', borderRadius: '50%', background: isPaused ? '#ef4444' : '#10b981', boxShadow: isPaused ? '0 0 6px #ef4444' : '0 0 6px #10b981' }} />
              {isPaused ? 'PAUSED' : 'RUNNING'}
            </span>

            {/* Stepping controls */}
            <button
              onClick={handleContinue}
              disabled={!isPaused}
              title="Continue (F5)"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--border)', cursor: isPaused ? 'pointer' : 'not-allowed', color: isPaused ? 'var(--text-primary)' : 'var(--text-muted)', padding: '4px 8px', borderRadius: '4px' }}
            >
              ▶
            </button>
            <button
              onClick={handleStepOver}
              disabled={!isPaused}
              title="Step Over (F10)"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--border)', cursor: isPaused ? 'pointer' : 'not-allowed', color: isPaused ? 'var(--text-primary)' : 'var(--text-muted)', padding: '4px 8px', borderRadius: '4px' }}
            >
              ↷ Over
            </button>
            <button
              onClick={handleStepInto}
              disabled={!isPaused}
              title="Step Into (F11)"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--border)', cursor: isPaused ? 'pointer' : 'not-allowed', color: isPaused ? 'var(--text-primary)' : 'var(--text-muted)', padding: '4px 8px', borderRadius: '4px' }}
            >
              ↳ Into
            </button>
            <button
              onClick={handleStepOut}
              disabled={!isPaused}
              title="Step Out (Shift+F11)"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'none', border: '1px solid var(--border)', cursor: isPaused ? 'pointer' : 'not-allowed', color: isPaused ? 'var(--text-primary)' : 'var(--text-muted)', padding: '4px 8px', borderRadius: '4px' }}
            >
              ↱ Out
            </button>

            <button
              onClick={handleStopSession}
              title="Stop Debugger (Shift+F5)"
              style={{ marginLeft: 'auto', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', padding: '3px 10px', fontSize: '11px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer' }}
            >
              ⏹ Stop
            </button>
          </div>
        )}
      </div>
    )
  }

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg-primary)', overflow: 'hidden' }}>
      {renderDebuggerControls()}
      
      {dapState.state === 'inactive' ? (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyItems: 'center', justifyContent: 'center', color: 'var(--text-muted)', gap: '8px' }}>
          <span style={{ fontSize: '24px' }}>🐞</span>
          <span style={{ fontSize: '12px' }}>Debugger offline. Launch or attach a Node inspect script to begin.</span>
        </div>
      ) : (
        <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: '8px', gap: '8px' }}>
          {/* Call Stack & Breakpoints */}
          <div style={{ flex: '1', minWidth: '150px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '6px 10px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
              Call Stack
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '6px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              {dapState.stackFrames.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '8px' }}>Active thread running...</div>
              ) : (
                dapState.stackFrames.map((frame) => {
                  const isActive = dapState.activeFrameId === frame.id
                  return (
                    <div
                      key={frame.id}
                      style={{
                        padding: '6px 8px', borderRadius: '4px', fontSize: '11px',
                        background: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
                        color: isActive ? 'var(--accent-blue)' : 'var(--text-secondary)',
                        border: isActive ? '1px solid rgba(59, 130, 246, 0.3)' : '1px solid transparent',
                        cursor: 'pointer'
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{frame.name}</div>
                      <div style={{ fontSize: '9px', color: 'var(--text-muted)' }}>
                        {frame.source.name}:{frame.line}:{frame.column}
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          </div>

          {/* Variables Explorer */}
          <div style={{ flex: '1.2', minWidth: '180px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '6px 10px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)' }}>
              Variables
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {dapState.scopes.length === 0 ? (
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontStyle: 'italic', padding: '4px' }}>No variables in scope.</div>
              ) : (
                dapState.scopes.map((scope) => (
                  <div key={scope.name} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                    <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)' }}>
                      [Scope: {scope.name}]
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', paddingLeft: '6px' }}>
                      {scope.variables.map((v) => (
                        <div key={v.name} style={{ fontSize: '11px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                          <span style={{ color: 'var(--accent-blue)', fontWeight: 600 }}>{v.name}</span>: <span style={{ color: v.type === 'number' ? '#f59e0b' : v.value === 'undefined' || v.value === 'null' ? '#ef4444' : 'var(--text-primary)' }}>{v.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* AI Debug Explainer */}
          <div style={{ flex: '1.8', minWidth: '220px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
            <div style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', padding: '6px 10px', borderBottom: '1px solid var(--border)', background: 'rgba(0,0,0,0.1)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              Lumiq AI Explainer
              {dapState.state === 'paused' && (
                <button
                  onClick={handleExplainState}
                  disabled={loadingAi}
                  style={{
                    background: 'linear-gradient(135deg, #6366f1 0%, #3b82f6 100%)', border: 'none', color: '#fff',
                    padding: '2px 8px', fontSize: '9px', fontWeight: 600, borderRadius: '4px', cursor: 'pointer'
                  }}
                >
                  {loadingAi ? 'Analyzing...' : '💡 Auto-Fix'}
                </button>
              )}
            </div>
            <div style={{ flex: 1, overflowY: 'auto', padding: '8px', fontSize: '11px', color: 'var(--text-secondary)', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {loadingAi && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', gap: '8px', color: 'var(--text-muted)' }}>
                  <span className="animate-spin" style={{ fontSize: '18px' }}>⏳</span>
                  <span>Analyzing state parameters and stack trace...</span>
                </div>
              )}
              {!loadingAi && !aiExplanation && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--text-muted)', textAlign: 'center', padding: '20px' }}>
                  <span>{dapState.state === 'paused' ? 'Click "Auto-Fix" to generate an interactive explanation & repair diff for this paused exception.' : 'Lumiq AI will explain crashes and generate code fixes once an exception occurs.'}</span>
                </div>
              )}
              {!loadingAi && aiExplanation && (
                <div style={{ whiteSpace: 'pre-wrap', fontFamily: 'var(--font-mono)', lineHeight: '1.4' }}>
                  {aiExplanation}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
