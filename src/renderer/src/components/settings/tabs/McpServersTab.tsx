// Lumiq — Settings: MCP Servers Tab
import React, { useState, useEffect } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { showToast } from '@renderer/components/ui/Toast'
import type { McpServer } from '@shared/types'

export function McpServersTab(): React.JSX.Element {
  const [servers, setServers] = useState<McpServer[]>([])
  const [name, setName] = useState('')
  const [command, setCommand] = useState('')
  const [args, setArgs] = useState('')
  const [env, setEnv] = useState('')
  const [logs, setLogs] = useState<Record<string, string[]>>({})
  const [expandedLogs, setExpandedLogs] = useState<Record<string, boolean>>({})

  const load = async (): Promise<void> => {
    setServers(await window.electronAPI.mcp.list() as McpServer[])
  }

  useEffect(() => {
    load()
    const removeStatus = window.electronAPI.mcp.onStatusChange(() => { void load() })
    const removeLog = window.electronAPI.mcp.onLog((entry) => {
      setLogs((prev) => ({
        ...prev,
        [entry.serverId]: [...(prev[entry.serverId] || []), `${entry.type.toUpperCase()}: ${entry.message.trim()}`]
      }))
    })
    return () => {
      removeStatus()
      removeLog()
    }
  }, [])

  const save = async (): Promise<void> => {
    if (!name.trim() || !command.trim()) return
    let parsedEnv: Record<string, string> = {}
    if (env.trim()) {
      try {
        parsedEnv = JSON.parse(env) as Record<string, string>
      } catch {
        showToast('error', 'Invalid Env', 'Environment must be a JSON object.')
        return
      }
    }
    await window.electronAPI.mcp.save({
      name: name.trim(),
      command: command.trim(),
      args: args.trim() ? args.trim().split(/\s+/) : [],
      env: parsedEnv,
      active: true
    })
    setName('')
    setCommand('')
    setArgs('')
    setEnv('')
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
    } catch (e) {
      showToast('error', 'Import Failed', (e as Error).message)
    }
  }

  const restart = async (serverId: string): Promise<void> => {
    try {
      await window.electronAPI.mcp.stop(serverId)
      await window.electronAPI.mcp.start(serverId)
      await load()
    } catch (e) {
      showToast('error', 'MCP Restart Failed', (e as Error).message)
    }
  }

  const toggleLogs = (serverId: string): void => {
    setExpandedLogs((prev) => ({
      ...prev,
      [serverId]: !prev[serverId]
    }))
  }

  return (
    <div style={{ maxWidth: '760px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <div style={{ padding: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
        <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="filesystem" />
        <Input label="Command" value={command} onChange={(e) => setCommand(e.target.value)} placeholder="npx" />
        <Input label="Args" value={args} onChange={(e) => setArgs(e.target.value)} placeholder="@modelcontextprotocol/server-filesystem D:\\project" />
        <Input label="Env JSON" value={env} onChange={(e) => setEnv(e.target.value)} placeholder='{"TOKEN":"..."}' />
        <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between' }}>
          <Button variant="outline" size="sm" onClick={handleImport}>📥 Import Config</Button>
          <Button size="sm" onClick={save}>Save Server</Button>
        </div>
      </div>
      {servers.map((server) => (
        <div key={server.id} style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', gap: '10px', alignItems: 'center' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: '13px', fontWeight: 700 }}>{server.name} <span style={{ color: 'var(--text-muted)', fontWeight: 500 }}>({server.status}, {server.toolsCount} tools)</span></div>
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{server.command} {server.args.join(' ')}</div>
              {server.tools && server.tools.length > 0 && (
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '6px' }}>
                  Tools: {server.tools.join(', ')}
                </div>
              )}
              {server.lastError && <div style={{ fontSize: '11px', color: 'var(--accent-red)' }}>{server.lastError}</div>}
            </div>
            <Button variant="outline" size="sm" onClick={() => toggleLogs(server.id)}>Logs</Button>
            <Button variant="outline" size="sm" onClick={() => window.electronAPI.mcp.test(server.id).then(load)}>Test</Button>
            {server.status === 'running'
              ? <Button variant="outline" size="sm" onClick={() => window.electronAPI.mcp.stop(server.id).then(load)}>Stop</Button>
              : <Button size="sm" onClick={() => window.electronAPI.mcp.start(server.id).then(load).catch((e: Error) => showToast('error', 'MCP Start Failed', e.message))}>Start</Button>}
            <Button variant="outline" size="sm" onClick={() => restart(server.id)}>Restart</Button>
            <Button variant="danger" size="sm" onClick={() => window.electronAPI.mcp.delete(server.id).then(load)}>Delete</Button>
          </div>
          {expandedLogs[server.id] && (
            <div style={{ padding: '10px 14px', background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: '8px', fontSize: '12px', color: 'var(--text-muted)', whiteSpace: 'pre-wrap', maxHeight: '220px', overflowY: 'auto' }}>
              {logs[server.id]?.length ? (
                logs[server.id].map((entry, index) => <div key={`${server.id}-log-${index}`}>{entry}</div>)
              ) : (
                <div style={{ color: 'var(--text-muted)' }}>No logs yet for this server.</div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
