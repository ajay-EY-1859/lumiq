// Lumiq — Settings: MCP Servers Tab (Redesigned)
import React, { useState, useEffect } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { showToast } from '@renderer/components/ui/Toast'
import type { McpServer } from '@shared/types'

const STATUS_COLORS: Record<string, string> = {
  running: 'var(--accent-green)',
  stopped: 'var(--text-muted)',
  error: 'var(--accent-red)',
  starting: 'var(--accent-yellow)'
}

export function McpServersTab(): React.JSX.Element {
  const [servers, setServers] = useState<McpServer[]>([])
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [env, setEnv] = useState('')
  const [logs, setLogs] = useState<Record<string, string[]>>({})
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({})
  const [isFormExpanded, setIsFormExpanded] = useState(false)

  const load = async (): Promise<void> => {
    setServers(await window.electronAPI.mcp.list() as McpServer[])
  }

  useEffect(() => {
    load()
    const removeStatus = window.electronAPI.mcp.onStatusChange(() => { void load() })
    const removeLog = window.electronAPI.mcp.onLog((entry) => {
      setLogs((prev) => ({
        ...prev,
        [entry.serverId]: [...(prev[entry.serverId] || []).slice(-99), `${entry.type.toUpperCase()}: ${entry.message.trim()}`]
      }))
    })
    return () => { removeStatus(); removeLog() }
  }, [])

  const save = async (): Promise<void> => {
    if (!name.trim() || !command.trim()) { showToast('error', 'Required', 'Name and command are required.'); return }
    let parsedEnv: Record<string, string> = {}
    if (env.trim()) {
      try { parsedEnv = JSON.parse(env) as Record<string, string> }
      catch { showToast('error', 'Invalid Env', 'Environment must be a valid JSON object.'); return }
    }
    await window.electronAPI.mcp.save({
      name: name.trim(),
      command: command.trim(),
      args: args.trim() ? args.trim().split(/\s+/) : [],
      env: parsedEnv,
      active: true
    })
    setName(''); setCommand(''); setArgs(''); setEnv('')
    setIsFormExpanded(false)
    await load()
  }

  const handleImport = async (): Promise<void> => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'JSON Config', extensions: ['json'] }]
      })
      if (!result.canceled && result.filePaths.length > 0) {
        await window.electronAPI.mcp.import(result.filePaths[0])
        showToast('success', 'Imported', 'MCP server imported successfully.')
        await load()
      }
    } catch (e) { showToast('error', 'Import Failed', (e as Error).message) }
  }

  const restart = async (serverId: string): Promise<void> => {
    try {
      await window.electronAPI.mcp.stop(serverId)
      await window.electronAPI.mcp.start(serverId)
      await load()
    } catch (e) { showToast('error', 'Restart Failed', (e as Error).message) }
  }

  return (
    <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Add Server Form */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        overflow: 'hidden'
      }}>
        <button
          onClick={() => setIsFormExpanded(!isFormExpanded)}
          style={{
            width: '100%',
            padding: '14px 18px',
            background: 'none',
            border: 'none',
            borderBottom: isFormExpanded ? '1px solid var(--border)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'background var(--transition-fast)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
        >
          <span style={{ fontSize: '16px' }}>🧩</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>Add MCP Server</span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', transform: isFormExpanded ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition-fast)' }}>▾</span>
        </button>

        {isFormExpanded && (
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="filesystem" />
              <Input label="Command" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" />
            </div>
            <Input label="Arguments" value={args} onChange={(e) => setArgs(e.target.value)} placeholder="@modelcontextprotocol/server-filesystem D:\project" />
            <Input label="Environment (JSON)" value={env} onChange={(e) => setEnv(e.target.value)} placeholder='{"TOKEN": "..."}' />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button variant="outline" size="sm" onClick={handleImport}>📥 Import Config</Button>
              <Button size="sm" onClick={save}>Save Server</Button>
            </div>
          </div>
        )}
      </div>

      {/* Servers List */}
      {servers.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 2px' }}>
            {servers.length} Server{servers.length !== 1 ? 's' : ''}
          </div>
          {servers.map((server) => (
            <div key={server.id} style={{ display: 'flex', flexDirection: 'column', gap: '0' }}>
              <div style={{
                padding: '14px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: expandedLogs[server.id] ? '12px 12px 0 0' : '12px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                transition: 'border-color var(--transition-fast)'
              }}>
                {/* Status dot */}
                <div style={{
                  width: 10,
                  height: 10,
                  borderRadius: '50%',
                  background: STATUS_COLORS[server.status] || 'var(--text-muted)',
                  boxShadow: server.status === 'running' ? `0 0 6px ${STATUS_COLORS.running}` : 'none',
                  flexShrink: 0,
                  transition: 'all var(--transition-fast)'
                }} />

                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '3px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{server.name}</span>
                    <span style={{
                      fontSize: '9px',
                      padding: '1px 6px',
                      background: `${STATUS_COLORS[server.status] || 'var(--text-muted)'}18`,
                      color: STATUS_COLORS[server.status] || 'var(--text-muted)',
                      border: `1px solid ${STATUS_COLORS[server.status] || 'var(--text-muted)'}30`,
                      borderRadius: '4px',
                      fontWeight: 700,
                      textTransform: 'uppercase'
                    }}>
                      {server.status}
                    </span>
                    {server.toolsCount > 0 && (
                      <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>{server.toolsCount} tools</span>
                    )}
                  </div>
                  <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {server.command} {server.args.join(' ')}
                  </div>
                  {server.lastError && (
                    <div style={{ fontSize: '11px', color: 'var(--accent-red)', marginTop: '3px' }}>{server.lastError}</div>
                  )}
                </div>

                {/* Actions */}
                <div style={{ display: 'flex', gap: '6px', flexShrink: 0, flexWrap: 'wrap' }}>
                  <Button variant="outline" size="sm" onClick={() => setExpandedLogs((p) => ({ ...p, [server.id]: !p[server.id] }))}>
                    Logs
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => window.electronAPI.mcp.test(server.id).then(load)}>Test</Button>
                  {server.status === 'running'
                    ? <Button variant="outline" size="sm" onClick={() => window.electronAPI.mcp.stop(server.id).then(load)}>Stop</Button>
                    : <Button size="sm" onClick={() => window.electronAPI.mcp.start(server.id).then(load).catch((e: Error) => showToast('error', 'Start Failed', e.message))}>Start</Button>
                  }
                  <Button variant="outline" size="sm" onClick={() => restart(server.id)}>↺</Button>
                  <Button variant="danger" size="sm" onClick={() => window.electronAPI.mcp.delete(server.id).then(load)}>✕</Button>
                </div>
              </div>

              {/* Log Panel */}
              {expandedLogs[server.id] && (
                <div style={{
                  padding: '12px 16px',
                  background: 'var(--bg-primary)',
                  border: '1px solid var(--border)',
                  borderTop: 'none',
                  borderRadius: '0 0 12px 12px',
                  fontSize: '11px',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  whiteSpace: 'pre-wrap',
                  maxHeight: '200px',
                  overflowY: 'auto',
                  lineHeight: 1.6
                }}>
                  {logs[server.id]?.length
                    ? logs[server.id].map((entry, i) => (
                        <div key={`${server.id}-log-${i}`} style={{
                          color: entry.startsWith('ERROR') ? 'var(--accent-red)' : entry.startsWith('WARN') ? 'var(--accent-yellow)' : 'var(--text-muted)'
                        }}>
                          {entry}
                        </div>
                      ))
                    : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>No logs yet for this server.</span>
                  }
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {servers.length === 0 && !isFormExpanded && (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          background: 'var(--bg-secondary)',
          border: '1px dashed var(--border)',
          borderRadius: '14px',
          color: 'var(--text-muted)',
          fontSize: '13px'
        }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🧩</div>
          <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>No MCP servers configured</div>
          <div>Add a server to extend the agent with external tools.</div>
        </div>
      )}
    </div>
  )
}
