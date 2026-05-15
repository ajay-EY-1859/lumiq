// Lumiq — Settings: Routing Tab
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
    await window.electronAPI.routing.save({ taskName, provider, model })
    setTaskName('')
    await load()
  }

  return (
    <div className={styles.routingContainer}>
      <div className={styles.routingGrid}>
        <Input label="Task" value={taskName} onChange={(e) => setTaskName(e.target.value)} placeholder="review" />
        <div><label style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>Provider</label><select aria-label="Select provider for routing" value={provider} onChange={(e) => setProvider(e.target.value as ProviderType)} className={styles.select}>{Object.keys(PROVIDER_MODELS).map((p) => <option key={p} value={p}>{p}</option>)}</select></div>
        <Input label="Model" value={model} onChange={(e) => setModel(e.target.value)} />
        <Button size="sm" onClick={save}>Save</Button>
      </div>
      {routes.map((route) => (
        <div key={route.id} className={styles.routingItem}>
          <span style={{ flex: 1, fontSize: '13px' }}><strong>/{route.taskName}</strong> routes to {route.provider} / {route.model}</span>
          <Button variant="danger" size="sm" onClick={() => window.electronAPI.routing.delete(route.id).then(load)}>Delete</Button>
        </div>
      ))}
    </div>
  )
}
