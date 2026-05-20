// Lumiq — Settings: Developer Server Tab
import React, { useState, useEffect } from 'react'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import type { GrpcStatus } from '@shared/types'

export function DeveloperServerTab(): React.JSX.Element {
  const { settings, updateSetting } = useSettingsStore()
  const [status, setStatus] = useState<GrpcStatus>({ running: false, host: '127.0.0.1', port: 43187 })
  const [port, setPort] = useState('43187')

  const load = async (): Promise<void> => setStatus(await window.electronAPI.grpc.status() as GrpcStatus)
  useEffect(() => { load() }, [])

  return (
    <div style={{ maxWidth: '520px', display: 'flex', flexDirection: 'column', gap: '14px' }}>
      <Input label="Firecrawl API Key" type="password" value={settings.firecrawlApiKey || ''} onChange={(e) => updateSetting('firecrawlApiKey', e.target.value)} placeholder="fc-..." />
      <Input
        label="Context Window Size"
        type="number"
        value={String(settings.contextLimit)}
        onChange={(e) => updateSetting('contextLimit', e.target.value)}
        placeholder="150"
        min={10}
        max={500}
      />
      <div style={{ fontSize: '12px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
        This controls how many recent messages are preserved in the AI context. Higher values keep more IDE history, while the runtime also trims by estimated token cost.
      </div>
      <div style={{ padding: '12px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <div style={{ fontSize: '13px', fontWeight: 700 }}>Local gRPC Server</div>
        <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{status.running ? `Running on ${status.host}:${status.port}` : 'Stopped'}</div>
        <Input label="Port" value={port} onChange={(e) => setPort(e.target.value)} />
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button size="sm" onClick={() => window.electronAPI.grpc.start(parseInt(port, 10) || 43187).then((s) => setStatus(s as GrpcStatus))}>Start</Button>
          <Button variant="outline" size="sm" onClick={() => window.electronAPI.grpc.stop().then((s) => setStatus(s as GrpcStatus))}>Stop</Button>
        </div>
      </div>
    </div>
  )
}
