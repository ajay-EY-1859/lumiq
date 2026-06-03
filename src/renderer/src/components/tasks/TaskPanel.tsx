import React, { useState, useEffect, useRef } from 'react'
import { useTaskStore } from '@renderer/store/taskStore'
import { useSessionStore } from '@renderer/store/sessionStore'
import { useChatStore } from '@renderer/store/chatStore'
import { Button } from '@renderer/components/ui/Button'
import { useProviderStore } from '@renderer/store/providerStore'
import 'xterm/css/xterm.css'

export function TaskPanel(): React.JSX.Element {
  const { tasks, definitions, activeTaskId, setActiveTask, runTask, stopTask, removeTask } = useTaskStore()
  const { activeSessionId, sessions } = useSessionStore()
  const activeSession = sessions.find(s => s.id === activeSessionId)
  
  const [activeTab, setActiveTab] = useState<'tasks' | 'terminal' | 'problems'>('tasks')
  const terminalEndRef = useRef<HTMLDivElement>(null)
  const activeTask = tasks.find(t => t.id === activeTaskId)

  // xterm refs & states
  const terminalContainerRef = useRef<HTMLDivElement>(null)
  const xtermInstanceRef = useRef<any>(null)
  const lastLoggedIndexRef = useRef<number>(0)

  const [aiPrompt, setAiPrompt] = useState('')
  const [aiResponse, setAiResponse] = useState('')
  const [isAiLoading, setIsAiLoading] = useState(false)
  const [showAiOverlay, setShowAiOverlay] = useState(false)

  // Auto-scroll terminal (fallback for static sections, no-op for xterm)
  useEffect(() => {
    if (activeTab === 'terminal') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeTask?.logs, activeTab])

  // Initialize & Mount xterm.js instance
  useEffect(() => {
    if (activeTab !== 'terminal' || !terminalContainerRef.current || !activeTask) {
      return
    }

    let term: any
    let resizeObserver: ResizeObserver
    let onDataDisposable: any

    // Dynamically import xterm to avoid bundler issues
    Promise.all([
      import('xterm'),
      import('xterm-addon-fit')
    ]).then(([{ Terminal }, { FitAddon }]) => {
      if (!terminalContainerRef.current) return

      terminalContainerRef.current.innerHTML = ''

      term = new Terminal({
        cursorBlink: true,
        fontSize: 13,
        fontFamily: 'var(--font-mono)',
        theme: {
          background: '#0D1117',
          foreground: '#E6EDF3',
          cursor: '#58a6ff',
          selectionBackground: '#264f78',
          black: '#0d1117',
          red: '#ff7b72',
          green: '#3fb950',
          yellow: '#d29922',
          blue: '#58a6ff',
          magenta: '#bc8cff',
          cyan: '#39c5cf',
          white: '#e6edf3'
        },
        allowProposedApi: true
      })

      const fitAddon = new FitAddon()
      term.loadAddon(fitAddon)
      term.open(terminalContainerRef.current)
      fitAddon.fit()
      setTimeout(() => term.focus(), 0)

      xtermInstanceRef.current = term

      // Write initial logs
      activeTask.logs.forEach((log) => {
        term.write(log.data)
      })
      lastLoggedIndexRef.current = activeTask.logs.length

      // Intercept Escape key in terminal to refocus the editor
      term.attachCustomKeyEventHandler((arg: KeyboardEvent) => {
        if (arg.key === 'Escape') {
          window.dispatchEvent(new CustomEvent('lumiq-focus-editor'))
          return false
        }
        return true
      })

      // Bind keyboard input to task stdin. xterm handles local rendering; we only forward the bytes.
      onDataDisposable = term.onData((data) => {
        if (activeTask.status === 'running') {
          void window.electronAPI.task.stdin(activeTask.id, data)
        }
      })

      // Resize observer to auto-fit terminal on container resizing
      resizeObserver = new ResizeObserver(() => {
        try { fitAddon.fit() } catch {}
      })
      resizeObserver.observe(terminalContainerRef.current)
    })

    return () => {
      if (onDataDisposable) onDataDisposable.dispose()
      if (resizeObserver) resizeObserver.disconnect()
      if (term) term.dispose()
      xtermInstanceRef.current = null
      lastLoggedIndexRef.current = 0
    }
  }, [activeTab, activeTaskId])

  // Incremental logs streaming to xterm without resetting
  useEffect(() => {
    const term = xtermInstanceRef.current
    if (!term || !activeTask) return

    // If logs were reset or task restarted, clear and reset pointer
    if (activeTask.logs.length < lastLoggedIndexRef.current) {
      term.clear()
      lastLoggedIndexRef.current = 0
    }

    const newLogs = activeTask.logs.slice(lastLoggedIndexRef.current)
    newLogs.forEach((log) => {
      term.write(log.data)
    })
    lastLoggedIndexRef.current = activeTask.logs.length
  }, [activeTask?.logs])

  // Ctrl+K keyboard shortcut listener inside terminal tab
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && activeTab === 'terminal') {
        e.preventDefault()
        setShowAiOverlay((prev) => !prev)
      }
      if (e.key === 'Escape' && activeTab === 'terminal') {
        window.dispatchEvent(new CustomEvent('lumiq-focus-editor'))
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeTab])

  // AI Command Generator helper
  const handleGenerateCommand = async () => {
    if (!aiPrompt.trim() || !activeTask) return
    setIsAiLoading(true)
    try {
      const provider = useProviderStore.getState().activeProvider
      const model = useProviderStore.getState().activeModel

      const systemPrompt = `You are a terminal command assistant.
Your job is to generate ONLY the exact, single shell command (e.g. "git commit -m 'updates'") that answers the user's prompt.
Do NOT write markdown code blocks, explanation, or conversational text. Output ONLY the raw command.`

      const response = await window.electronAPI.chat.predictOneShot(aiPrompt, systemPrompt, provider, model)
      setAiResponse(response.trim())
    } catch (err) {
      console.error('[AI Terminal] Failed to generate command:', err)
      setAiResponse(`Error: ${(err as Error).message}`)
    } finally {
      setIsAiLoading(false)
    }
  }

  // Load workspace task definitions automatically when workspace path changes
  useEffect(() => {
    if (activeSession?.workspacePath) {
      useTaskStore.getState().loadDefinitions(activeSession.workspacePath)
    }
  }, [activeSession?.workspacePath])

  const handleRunTask = (name: string, command: string, args: string[]) => {
    if (!activeSession?.workspacePath) {
      alert('Please bind a workspace to this session first.')
      return
    }
    runTask(name, command, args, activeSession.workspacePath)
    // Removed auto-switch to 'terminal' so it stays in the background
  }

  const handleRestartTask = async (task: NonNullable<typeof activeTask>) => {
    if (task.status === 'running') {
      await stopTask(task.id)
      await new Promise(resolve => setTimeout(resolve, 500))
    }
    removeTask(task.id)
    runTask(task.name, task.command, task.args, task.cwd)
  }

  // Count problems
  const totalProblems = tasks.reduce((acc, t) => acc + t.problems.length, 0)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: 'var(--bg-primary)', borderTop: '1px solid var(--border)' }}>
      {/* Panel Header */}
      <div style={{ display: 'flex', alignItems: 'center', background: 'var(--bg-primary)', borderBottom: '1px solid var(--border)', padding: '0 16px' }}>
        <div style={{ display: 'flex', gap: '24px' }}>
          <button
            onClick={() => setActiveTab('tasks')}
            style={{
              background: 'none', border: 'none', padding: '8px 0', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
              color: activeTab === 'tasks' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'tasks' ? '1px solid var(--text-primary)' : '1px solid transparent',
              transition: 'color var(--transition-fast)'
            }}
          >
            RUNNER
          </button>
          <button
            onClick={() => setActiveTab('terminal')}
            style={{
              background: 'none', border: 'none', padding: '8px 0', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
              color: activeTab === 'terminal' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'terminal' ? '1px solid var(--text-primary)' : '1px solid transparent',
              transition: 'color var(--transition-fast)'
            }}
          >
            TERMINAL {tasks.length > 0 && `(${tasks.length})`}
          </button>
          <button
            onClick={() => setActiveTab('problems')}
            style={{
              background: 'none', border: 'none', padding: '8px 0', fontSize: '11px', fontWeight: 600, cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.05em',
              color: activeTab === 'problems' ? 'var(--text-primary)' : 'var(--text-muted)',
              borderBottom: activeTab === 'problems' ? '1px solid var(--text-primary)' : '1px solid transparent',
              transition: 'color var(--transition-fast)'
            }}
          >
            PROBLEMS {totalProblems > 0 && `(${totalProblems})`}
          </button>
        </div>
      </div>

      {/* Panel Content */}
      <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
        {activeTab === 'tasks' && (
          <div style={{ padding: '16px', overflowY: 'auto', height: '100%' }}>
            {activeSession?.workspacePath ? (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', maxWidth: '500px' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '8px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    Workspace: {activeSession.workspacePath}
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => useTaskStore.getState().syncWorkspace(activeSession.workspacePath!)}
                    style={{ display: 'flex', alignItems: 'center', gap: '4px', flexShrink: 0, padding: '2px 8px', fontSize: '11px' }}
                  >
                    🔄 Refresh
                  </Button>
                </div>
                {definitions.length > 0 ? (
                  definitions.map(task => (
                    <div key={task.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                      <div>
                        <div style={{ fontSize: '13px', fontWeight: 600 }}>{task.name}</div>
                        <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                          {task.command} {task.args.join(' ')}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => handleRunTask(task.name, task.command, task.args)}>
                        Run
                      </Button>
                    </div>
                  ))
                ) : (
                  <div style={{ color: 'var(--text-muted)', fontSize: '13px', padding: '12px', background: 'var(--bg-secondary)', borderRadius: '6px' }}>
                    No workspace tasks are configured yet.
                  </div>
                )}
              </div>
            ) : (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                Please bind a workspace in the chat panel to run tasks.
              </div>
            )}
          </div>
        )}

        {activeTab === 'terminal' && (
          <div style={{ display: 'flex', height: '100%' }}>
            {/* Sidebar with active tasks */}
            <div style={{ width: '200px', borderRight: '1px solid var(--border)', background: 'var(--bg-secondary)', overflowY: 'auto' }}>
              {tasks.length === 0 ? (
                <div style={{ padding: '16px', fontSize: '12px', color: 'var(--text-muted)' }}>No active tasks</div>
              ) : (
                tasks.map(t => (
                  <div
                    key={t.id}
                    onClick={() => setActiveTask(t.id)}
                    style={{
                      padding: '8px 12px', fontSize: '13px', cursor: 'pointer',
                      background: activeTaskId === t.id ? 'var(--bg-tertiary)' : 'transparent',
                      borderLeft: activeTaskId === t.id ? '3px solid var(--accent-blue)' : '3px solid transparent',
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between'
                    }}
                  >
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: t.status === 'error' ? 'var(--accent-red)' : 'var(--text-primary)' }}>
                      {t.status === 'running' ? '🔄' : t.status === 'success' ? '✅' : '❌'} {t.name}
                    </span>
                    <button
                      onClick={(e) => { e.stopPropagation(); removeTask(t.id) }}
                      style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
                    >✕</button>
                  </div>
                ))
              )}
            </div>

            {/* Terminal Panel */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0D1117', minWidth: 0, position: 'relative' }}>
              {activeTask ? (
                <>
                  {/* Terminal Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', padding: '8px 12px', borderBottom: '1px solid #30363D', flexShrink: 0 }}>
                    <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', color: '#8B949E', fontSize: '12px', fontFamily: 'var(--font-mono)' }}>
                      $ {activeTask.command} {activeTask.args.join(' ')}
                    </span>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                      <button
                        onClick={() => setShowAiOverlay((prev) => !prev)}
                        style={{
                          background: 'rgba(37,99,235,0.15)', border: '1px solid transparent', borderRadius: '4px',
                          color: 'var(--accent-blue)', cursor: 'pointer', fontSize: '12px', padding: '2px 8px', display: 'flex', alignItems: 'center', gap: '4px'
                        }}
                      >
                        🤖 Ask AI (Ctrl+K)
                      </button>
                      {activeTask.status === 'running' ? (
                        <button
                          onClick={() => stopTask(activeTask.id)}
                          style={{ background: 'none', border: '1px solid #30363D', borderRadius: '4px', color: '#FF7B72', cursor: 'pointer', fontSize: '12px', padding: '2px 8px' }}
                        >
                          Stop
                        </button>
                      ) : (
                        <span style={{ fontSize: '12px', color: activeTask.status === 'success' ? '#3fb950' : '#f85149', padding: '2px 4px', background: '#21262d', borderRadius: '4px' }}>
                          {activeTask.status.toUpperCase()}
                        </span>
                      )}
                      <button
                        onClick={() => handleRestartTask(activeTask)}
                        style={{ background: 'none', border: '1px solid #30363D', borderRadius: '4px', color: '#58a6ff', cursor: 'pointer', fontSize: '12px', padding: '2px 8px' }}
                      >
                        🔄 Restart
                      </button>
                    </div>
                  </div>

                  {/* Self-Heal Recommendation Overlay */}
                  {activeTask.selfHealSuggestion && (
                    <div style={{ margin: '8px 12px 0 12px', padding: '10px 12px', borderRadius: '6px', background: '#161b22', border: '1px solid #30363D', flexShrink: 0 }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'center', marginBottom: '4px' }}>
                        <div>
                          <div style={{ fontSize: '12px', fontWeight: 600, color: '#58a6ff' }}>Self-Heal Recommendation</div>
                          <div style={{ fontSize: '11px', color: '#8B949E' }}>{activeTask.selfHealSuggestion.summary}</div>
                        </div>
                        <Button size="sm" variant="outline" style={{ padding: '2px 8px', fontSize: '11px' }} onClick={() => {
                          const message = `The task \`${activeTask.name}\` failed. Please apply this suggested fix:\n\n${activeTask.selfHealSuggestion?.recommendation}`
                          useChatStore.getState().setDraftMessage(message)
                        }}>
                          Ask Lumiq to Fix
                        </Button>
                      </div>
                      <pre style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', color: '#C9D1D9', margin: 0, whiteSpace: 'pre-wrap', maxHeight: '60px', overflowY: 'auto' }}>
                        {activeTask.selfHealSuggestion.recommendation}
                      </pre>
                    </div>
                  )}

                  {/* Real xterm.js Terminal Container */}
                  <div ref={terminalContainerRef} style={{ flex: 1, padding: '8px', overflow: 'hidden' }} />

                  {/* AI Terminal Assistant (Ctrl+K) Overlay Panel */}
                  {showAiOverlay && (
                    <div style={{
                      position: 'absolute', bottom: '16px', right: '16px', left: '16px',
                      background: 'var(--bg-secondary)', border: '1px solid var(--border)',
                      borderRadius: '8px', padding: '12px', zIndex: 100,
                      boxShadow: '0 4px 16px rgba(0,0,0,0.6)', display: 'flex', flexDirection: 'column', gap: '8px'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '11px', fontWeight: 600, color: 'var(--accent-blue)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                          🤖 AI Terminal Companion (Ctrl+K)
                        </span>
                        <button
                          onClick={() => { setShowAiOverlay(false); setAiPrompt(''); setAiResponse('') }}
                          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '12px' }}
                        >
                          ✕
                        </button>
                      </div>

                      {!aiResponse && (
                        <div style={{ display: 'flex', gap: '8px' }}>
                          <input
                            value={aiPrompt}
                            onChange={(e) => setAiPrompt(e.target.value)}
                            placeholder="Write a git status command, ask to explain an error..."
                            style={{
                              flex: 1, padding: '6px 10px', fontSize: '12px',
                              background: 'var(--bg-primary)', border: '1px solid var(--border)',
                              borderRadius: '4px', color: 'var(--text-primary)', outline: 'none'
                            }}
                            onKeyDown={async (e) => {
                              if (e.key === 'Enter') {
                                e.preventDefault()
                                await handleGenerateCommand()
                              }
                            }}
                          />
                          <Button size="sm" onClick={handleGenerateCommand} disabled={isAiLoading || !aiPrompt.trim()}>
                            {isAiLoading ? 'Thinking...' : 'Generate'}
                          </Button>
                        </div>
                      )}

                      {aiResponse && (
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                          <pre style={{
                            fontFamily: 'var(--font-mono)', fontSize: '12px', color: '#E6EDF3',
                            background: '#0D1117', padding: '8px', borderRadius: '4px',
                            border: '1px solid var(--border)', margin: 0, whiteSpace: 'pre-wrap'
                          }}>
                            {aiResponse}
                          </pre>
                          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                            <Button size="sm" variant="outline" onClick={() => {
                              if (activeTask && activeTask.status === 'running') {
                                window.electronAPI.task.stdin(activeTask.id, aiResponse)
                              }
                              setShowAiOverlay(false)
                              setAiPrompt('')
                              setAiResponse('')
                            }}>
                              Type Command
                            </Button>
                            <Button size="sm" onClick={() => {
                              if (activeTask && activeTask.status === 'running') {
                                window.electronAPI.task.stdin(activeTask.id, aiResponse + '\n')
                              }
                              setShowAiOverlay(false)
                              setAiPrompt('')
                              setAiResponse('')
                            }}>
                              Execute
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </>
              ) : (
                <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#8B949E', fontSize: '13px' }}>
                  Select a task to view output
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'problems' && (
          <div style={{ padding: '16px', overflowY: 'auto', height: '100%' }}>
            {tasks.flatMap(t => t.problems.map((p, i) => (
              <div key={`${t.id}-${i}`} style={{ display: 'flex', flexDirection: 'column', gap: '4px', padding: '12px', border: '1px solid var(--border)', borderRadius: '6px', marginBottom: '8px', background: 'var(--bg-secondary)' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                  <div style={{ fontSize: '13px', fontWeight: 600, color: p.severity === 'error' ? 'var(--accent-red)' : 'var(--accent-orange)' }}>
                    {p.severity.toUpperCase()} in {p.file}:{p.line}:{p.column}
                  </div>
                  <Button size="sm" variant="outline" onClick={() => {
                    const message = `Please fix this problem in ${p.file} at line ${p.line}:\n\n${p.message}`
                    useChatStore.getState().setDraftMessage(message)
                  }}>
                    Ask Lumiq to Fix
                  </Button>
                </div>
                <div style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
                  {p.message}
                </div>
              </div>
            )))}
            {totalProblems === 0 && (
              <div style={{ color: 'var(--text-muted)', fontSize: '13px' }}>
                No problems detected in task output.
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
