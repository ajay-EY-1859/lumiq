// Lumiq — Agent Builder Page
import React, { useState, useEffect } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { showToast } from '@renderer/components/ui/Toast'
import type { Agent, ProviderType } from '@shared/types'
import { PROVIDER_MODELS } from '@shared/types'

interface AgentBuilderPageProps {
  onNavigate?: (page: 'chat' | 'settings' | 'agents') => void
}

export function AgentBuilderPage({ onNavigate }: AgentBuilderPageProps): React.JSX.Element {
  const [agents, setAgents] = useState<Agent[]>([])
  const [editing, setEditing] = useState<Partial<Agent> | null>(null)

  const loadAgents = async (): Promise<void> => {
    const list = await window.electronAPI.agent.list() as Agent[]
    setAgents(list)
  }

  useEffect(() => { loadAgents() }, [])

  const handleSave = async (): Promise<void> => {
    if (!editing?.name || !editing?.systemPrompt) {
      showToast('error', 'Name and system prompt required'); return
    }
    await window.electronAPI.agent.save(editing)
    showToast('success', 'Agent saved')
    setEditing(null)
    loadAgents()
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('Delete this agent?')) return
    await window.electronAPI.agent.delete(id)
    showToast('info', 'Agent deleted')
    loadAgents()
  }

  if (editing) {
    return (
      <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        <div style={{ maxWidth: '600px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <button onClick={() => setEditing(null)} title="Back to agents list" aria-label="Back to agents list" style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-secondary)' }}>←</button>
            <h1 style={{ fontSize: '20px', fontWeight: 700 }}>{editing.id ? 'Edit Agent' : 'New Agent'}</h1>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input label="Name *" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="My Custom Agent" />
            <Input label="Description" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="What does this agent do?" />
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>System Prompt *</label>
              <textarea value={editing.systemPrompt || ''} onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })} placeholder="You are a helpful assistant..." rows={8}
                style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-mono)', resize: 'vertical', outline: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Provider</label>
                <select value={editing.provider || ''} onChange={(e) => setEditing({ ...editing, provider: e.target.value })} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  <option value="">Use default</option>
                  {(['anthropic', 'openai', 'gemini', 'ollama', 'deepseek', 'nvidia'] as ProviderType[]).map((p) => <option key={p} value={p}>{p}</option>)}
                </select>
              </div>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Model</label>
                <select value={editing.model || ''} onChange={(e) => setEditing({ ...editing, model: e.target.value })} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  <option value="">Use default</option>
                  {editing.provider && PROVIDER_MODELS[editing.provider as ProviderType]?.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
                </select>
              </div>
            </div>
            <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', paddingTop: '16px' }}>
              <Button variant="outline" onClick={() => setEditing(null)}>Cancel</Button>
              <Button onClick={handleSave}>Save Agent</Button>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {onNavigate && (
            <button
              id="btn-agents-back"
              onClick={() => onNavigate('chat')}
              title="Back to Chat"
              aria-label="Back to Chat"
              style={{
                background: 'none',
                border: '1px solid var(--border)',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'var(--text-secondary)',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 12px',
                borderRadius: '8px',
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                transition: 'all var(--transition-fast)'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--bg-tertiary)'
                e.currentTarget.style.color = 'var(--accent-blue)'
                e.currentTarget.style.borderColor = 'var(--accent-blue)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'none'
                e.currentTarget.style.color = 'var(--text-secondary)'
                e.currentTarget.style.borderColor = 'var(--border)'
              }}
            >
              ← Back
            </button>
          )}
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>🤖 Agents</h1>
        </div>
        <Button onClick={() => setEditing({ name: '', systemPrompt: '', tools: [] })} title="Create a new agent">+ New Agent</Button>
      </div>
      {agents.length === 0 ? (
        <div style={{ textAlign: 'center', padding: '48px', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '36px', marginBottom: '8px', opacity: 0.3 }}>🤖</div>
          <div>No agents yet. Create one to get started.</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', maxWidth: '600px' }}>
          {agents.map((agent) => (
            <div key={agent.id} style={{ padding: '14px 16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div style={{ width: '36px', height: '36px', borderRadius: '8px', background: 'var(--bg-tertiary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '18px' }}>🤖</div>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 600, fontSize: '14px' }}>{agent.name}</div>
                {agent.description && <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{agent.description}</div>}
              </div>
              <Button variant="ghost" size="sm" onClick={() => setEditing(agent)}>Edit</Button>
              <Button variant="ghost" size="sm" onClick={() => handleDelete(agent.id)} style={{ color: 'var(--accent-red)' }}>Delete</Button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
