// Lumiq — Settings: Developer Server Tab (Redesigned)
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
    <div style={{ maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Web Scraping Info */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(16, 185, 129, 0.04)',
        border: '1px solid rgba(16, 185, 129, 0.2)',
        borderRadius: '12px',
        display: 'flex',
        gap: '10px',
        alignItems: 'flex-start'
      }}>
        <span style={{ fontSize: '16px', flexShrink: 0 }}>🌐</span>
        <div>
          <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '3px' }}>
            Web Scraping — No API Key Required
          </div>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Web pages are fetched using <strong style={{ color: 'var(--text-secondary)' }}>Jina AI Reader</strong> (free, no signup) which returns clean markdown from any URL. Falls back to direct HTTP fetch if unavailable.
          </div>
        </div>
      </div>

      {/* Context Settings */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>🧠</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Context Settings</span>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <Input
            label="Context Window Size"
            type="number"
            value={String(settings.contextLimit)}
            onChange={(e) => updateSetting('contextLimit', e.target.value)}
            placeholder="150"
            min={10}
            max={500}
          />
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
            Controls how many recent messages are preserved in the AI context. Higher values keep more history but consume more tokens.
          </div>
        </div>
      </div>

      {/* gRPC Server */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>🖥️</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Local gRPC Server</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <div style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: status.running ? 'var(--accent-green)' : 'var(--text-muted)',
              boxShadow: status.running ? '0 0 6px var(--accent-green)' : 'none',
              transition: 'all var(--transition-fast)'
            }} />
            <span style={{ fontSize: '11px', color: status.running ? 'var(--accent-green)' : 'var(--text-muted)', fontWeight: 600 }}>
              {status.running ? 'Running' : 'Stopped'}
            </span>
          </div>
        </div>
        <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {status.running && (
            <div style={{
              padding: '8px 12px',
              background: 'rgba(16, 185, 129, 0.06)',
              border: '1px solid rgba(16, 185, 129, 0.2)',
              borderRadius: '8px',
              fontSize: '12px',
              color: 'var(--accent-green)',
              fontFamily: 'var(--font-mono)'
            }}>
              {status.host}:{status.port}
            </div>
          )}
          <Input
            label="Port"
            value={port}
            onChange={(e) => setPort(e.target.value)}
            placeholder="43187"
            type="number"
          />
          <div style={{ display: 'flex', gap: '8px' }}>
            <Button
              size="sm"
              onClick={() => window.electronAPI.grpc.start(parseInt(port, 10) || 43187).then((s) => setStatus(s as GrpcStatus))}
              disabled={status.running}
            >
              Start Server
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => window.electronAPI.grpc.stop().then((s) => setStatus(s as GrpcStatus))}
              disabled={!status.running}
            >
              Stop Server
            </Button>
          </div>
        </div>
      </div>

    </div>
  )
}
