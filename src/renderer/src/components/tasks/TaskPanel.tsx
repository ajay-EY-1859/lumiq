import React, { useState, useEffect, useRef } from 'react'
import { useTaskStore } from '@renderer/store/taskStore'
import { useSessionStore } from '@renderer/store/sessionStore'
import { useChatStore } from '@renderer/store/chatStore'
import { Button } from '@renderer/components/ui/Button'

export function TaskPanel(): React.JSX.Element {
  const { tasks, definitions, activeTaskId, setActiveTask, runTask, stopTask, removeTask, sendInput } = useTaskStore()
  const { activeSessionId, sessions } = useSessionStore()
  const activeSession = sessions.find(s => s.id === activeSessionId)
  
  const [activeTab, setActiveTab] = useState<'tasks' | 'terminal' | 'problems'>('tasks')
  const [terminalInput, setTerminalInput] = useState('')
  const terminalEndRef = useRef<HTMLDivElement>(null)
  const activeTask = tasks.find(t => t.id === activeTaskId)

  // Auto-scroll terminal
  useEffect(() => {
    if (activeTab === 'terminal') {
      terminalEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    }
  }, [activeTask?.logs, activeTab])

  const handleRunTask = (name: string, command: string, args: string[]) => {
    if (!activeSession?.workspacePath) {
      alert('Please bind a workspace to this session first.')
      return
    }
    runTask(name, command, args, activeSession.workspacePath)
    // Removed auto-switch to 'terminal' so it stays in the background
  }

  const handleSendInput = async (event: React.FormEvent) => {
    event.preventDefault()
    if (!activeTask || activeTask.status !== 'running' || !terminalInput) return
    await sendInput(activeTask.id, `${terminalInput}\n`)
    setTerminalInput('')
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
            TASKS
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
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px' }}>
                  <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>
                    Workspace: {activeSession.workspacePath}
                  </div>
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

            {/* Terminal Output */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', background: '#0D1117', minWidth: 0 }}>
              <div style={{ flex: 1, padding: '12px', color: '#E6EDF3', fontFamily: 'var(--font-mono)', fontSize: '13px', overflowY: 'auto' }}>
                {activeTask ? (
                  <>
                    <div style={{ marginBottom: '8px', color: '#8B949E', display: 'flex', justifyContent: 'space-between', gap: '12px' }}>
                      <span>$ {activeTask.command} {activeTask.args.join(' ')}</span>
                      {activeTask.status === 'running' && (
                        <button
                          onClick={() => stopTask(activeTask.id)}
                          style={{ background: 'none', border: '1px solid #30363D', borderRadius: '4px', color: '#FF7B72', cursor: 'pointer', fontSize: '12px', padding: '2px 8px' }}
                        >
                          Stop
                        </button>
                      )}
                    </div>
                    {activeTask.logs.map((log) => (
                      <span key={log.id} style={{
                        color: log.type === 'stderr' ? '#FF7B72' : log.type === 'system' ? '#79C0FF' : '#E6EDF3',
                        whiteSpace: 'pre-wrap',
                        wordBreak: 'break-all'
                      }}>
                        {log.data}
                      </span>
                    ))}
                    <div ref={terminalEndRef} />
                  </>
                ) : (
                  <div style={{ color: '#8B949E' }}>Select a task to view output</div>
                )}
              </div>
              <form onSubmit={handleSendInput} style={{ display: 'flex', alignItems: 'center', gap: '8px', borderTop: '1px solid #30363D', padding: '8px 12px' }}>
                <span style={{ color: '#8B949E', fontFamily: 'var(--font-mono)', fontSize: '13px' }}>&gt;</span>
                <input
                  value={terminalInput}
                  onChange={(event) => setTerminalInput(event.target.value)}
                  disabled={!activeTask || activeTask.status !== 'running'}
                  placeholder={activeTask?.status === 'running' ? 'Send input to task' : 'No running task'}
                  style={{ flex: 1, minWidth: 0, background: 'transparent', border: 'none', outline: 'none', color: '#E6EDF3', fontFamily: 'var(--font-mono)', fontSize: '13px' }}
                />
              </form>
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
