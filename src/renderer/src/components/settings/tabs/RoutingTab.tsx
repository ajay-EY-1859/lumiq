// Lumiq — Settings: Routing Tab (Redesigned)
import React, { useState, useEffect } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import type { AgentRoute, ProviderType } from '@shared/types'
import { PROVIDER_MODELS } from '@shared/types'
import styles from '../SettingsPage.module.css'

export function RoutingTab(): React.JSX.Element {
  const [routes, setRoutes] = useState<AgentRoute[]>([])
  const [taskName, setTaskName] = useState('')
  const [provider, setProvider] = useState<ProviderType>('anthropic')
  const [model, setModel] = useState('claude-sonnet-4-20250514')

  const load = async (): Promise<void> => setRoutes(await window.electronAPI.routing.list() as AgentRoute[])
  useEffect(() => { load() }, [])

  const save = async (): Promise<void> => {
    if (!taskName.trim()) return
    await window.electronAPI.routing.save({ taskName, provider, model })
    setTaskName('')
    await load()
  }

  return (
    <div style={{ maxWidth: '700px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Info Banner */}
      <div style={{
        padding: '12px 16px',
        background: 'rgba(59, 130, 246, 0.04)',
        border: '1px solid rgba(59, 130, 246, 0.15)',
        borderRadius: '10px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-start'
      }}>
        <span style={{ fontSize: '14px', flexShrink: 0 }}>🧭</span>
        <span>Route specific task types to different AI providers and models. For example, route <code style={{ fontFamily: 'var(--font-mono)', fontSize: '11px', background: 'var(--bg-tertiary)', padding: '1px 5px', borderRadius: '4px' }}>review</code> tasks to a faster model.</span>
      </div>

      {/* Add Route Form */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        overflow: 'hidden'
      }}>
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '14px' }}>➕</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Add Route</span>
        </div>
        <div style={{ padding: '16px 18px' }}>
          <div className={styles.routingGrid}>
            <Input
              label="Task Name"
              value={taskName}
              onChange={(e) => setTaskName(e.target.value)}
              placeholder="review"
              onKeyDown={(e) => { if (e.key === 'Enter') save() }}
            />
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>Provider</label>
              <select
                aria-label="Select provider for routing"
                value={provider}
                onChange={(e) => setProvider(e.target.value as ProviderType)}
                className={styles.select}
              >
                {Object.keys(PROVIDER_MODELS).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <Input
              label="Model"
              value={model}
              onChange={(e) => setModel(e.target.value)}
              placeholder="claude-sonnet-4-20250514"
            />
            <Button size="sm" onClick={save} style={{ alignSelf: 'flex-end' }}>Add</Button>
          </div>
        </div>
      </div>

      {/* Routes List */}
      {routes.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 2px' }}>
            {routes.length} Route{routes.length !== 1 ? 's' : ''}
          </div>
          {routes.map((route) => (
            <div
              key={route.id}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                transition: 'border-color var(--transition-fast)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <span style={{ fontSize: '16px' }}>🧭</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px', color: 'var(--accent-blue)', fontWeight: 600 }}>
                    /{route.taskName}
                  </code>
                  <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>→</span>
                  <span style={{ fontSize: '12px', color: 'var(--text-secondary)', fontWeight: 500 }}>{route.provider}</span>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>{route.model}</span>
                </div>
              </div>
              <Button
                variant="danger"
                size="sm"
                onClick={() => window.electronAPI.routing.delete(route.id).then(load)}
              >
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}

      {routes.length === 0 && (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          background: 'var(--bg-secondary)',
          border: '1px dashed var(--border)',
          borderRadius: '14px',
          color: 'var(--text-muted)',
          fontSize: '13px'
        }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>🧭</div>
          <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>No routes configured</div>
          <div>Add a route to direct specific tasks to a preferred model.</div>
        </div>
      )}
    </div>
  )
}
