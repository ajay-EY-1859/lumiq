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

interface AgentTemplate {
  id: string
  label: string
  icon: string
  description: string
  defaults: Partial<Agent>
}

const DEFAULT_TOOLS: string[] = ['FileReadTool', 'FileWriteTool', 'BashTool', 'GrepTool', 'GitTool', 'WebSearchTool']
const AGENT_TEMPLATES: AgentTemplate[] = [
  {
    id: 'code-reviewer',
    label: 'Code Reviewer',
    icon: '🧐',
    description: 'Reviews code for quality, security, and maintainability.',
    defaults: {
      name: 'Code Reviewer',
      description: 'AI agent specialized in reviewing code for quality, security, and maintainability.',
      systemPrompt: 'You are an expert code reviewer. You analyze code for quality, security issues, performance problems, and maintainability. Provide constructive feedback with specific recommendations.',
      tools: DEFAULT_TOOLS,
      provider: 'openai',
      model: 'gpt-4o'
    }
  },
  {
    id: 'debugger',
    label: 'Debugger',
    icon: '🐞',
    description: 'Identifies, analyzes, and fixes bugs in code.',
    defaults: {
      name: 'Debugger',
      description: 'AI agent that diagnoses bugs, traces errors, and generates fixes.',
      systemPrompt: 'You are an expert debugger. Your task is to identify, analyze, and fix bugs in code. Analyze error messages, stack traces, and code to find the root cause. Provide clear explanations and working fixes.',
      tools: DEFAULT_TOOLS,
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514'
    }
  },
  {
    id: 'fullstack-developer',
    label: 'Full-Stack Developer',
    icon: '🧑‍💻',
    description: 'Builds complete features across frontend, backend, and database.',
    defaults: {
      name: 'Full-Stack Developer',
      description: 'Expert full-stack agent that builds complete features end-to-end.',
      systemPrompt: 'You are a senior full-stack developer. You build complete features across frontend, backend, and database. You write clean, scalable code and follow best practices.',
      tools: DEFAULT_TOOLS,
      provider: 'anthropic',
      model: 'claude-sonnet-4-20250514'
    }
  },
  {
    id: 'sql-expert',
    label: 'Database / SQL Expert',
    icon: '🗄️',
    description: 'Specialized in database design, SQL queries, and data modeling.',
    defaults: {
      name: 'Database Expert',
      description: 'AI agent specialized in database design, SQL optimization, and data modeling.',
      systemPrompt: 'You are a database expert. You specialize in database design, SQL query optimization, migrations, indexing, and data modeling. You work with PostgreSQL, MySQL, SQLite, and modern ORMs.',
      tools: DEFAULT_TOOLS,
      provider: 'openai',
      model: 'gpt-4o'
    }
  },
  {
    id: 'intexposer',
    label: 'Intexposer',
    icon: '💳',
    description: 'Expert in Intexposer product development and deployment.',
    defaults: {
      name: 'Intexposer',
      description: 'AI agent specialized in Intexposer product development, integration, and deployment.',
      systemPrompt: 'You are an Intexposer expert. You understand the platform deeply and specialize in building, integrating, and deploying Intexposer solutions. Focus on practical implementation and best practices.',
      tools: DEFAULT_TOOLS,
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4-20250514'
    }
  },
  {
    id: 'walmart-agent',
    label: 'Walmart Agent',
    icon: '🏬',
    description: 'Specialized in Walmart integrations, APIs, and workflows.',
    defaults: {
      name: 'Walmart Agent',
      description: 'AI agent specialized in Walmart integrations, APIs, and workflows.',
      systemPrompt: 'You are a Walmart integration expert. You specialize in Walmart APIs, marketplace integrations, suppliers, and related workflows. Keep implementations practical and aligned with real working patterns.',
      tools: DEFAULT_TOOLS,
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4-20250514'
    }
  },
  {
    id: 'devops-engineer',
    label: 'DevOps / Infra Engineer',
    icon: '⚙️',
    description: 'Handles infrastructure, CI/CD, Docker, Kubernetes, and deployments.',
    defaults: {
      name: 'DevOps Engineer',
      description: 'AI agent for infrastructure, CI/CD, containers, and cloud deployments.',
      systemPrompt: 'You are a DevOps engineer. You handle infrastructure as code, CI/CD pipelines, Docker, Kubernetes, monitoring, and cloud deployments. You prioritize reliability, scalability, and automation.',
      tools: ['BashTool', 'GitTool', 'FileReadTool', 'FileWriteTool'],
      provider: 'openrouter',
      model: 'anthropic/claude-sonnet-4-20250514'
    }
  }
]

function loadAgents(): Promise<Agent[]> {
  if (!window.electronAPI?.agent?.list) {
    console.warn('[AgentBuilderPage] electronAPI.agent.list is not available')
    return Promise.resolve([] as Agent[])
  }
  return window.electronAPI.agent.list() as Promise<Agent[]>
}

export function AgentBuilderPage({ onNavigate }: AgentBuilderPageProps): React.JSX.Element {
  const [agents, setAgents] = useState<Agent[]>([])
  const [editing, setEditing] = useState<Partial<Agent> | null>(null)

  useEffect(() => {
    let cancelled = false
    loadAgents().then((list) => {
      if (!cancelled) setAgents(list)
    })
    return () => {
      cancelled = true
    }
  }, [])

  const refreshAgents = (): void => {
    loadAgents().then(setAgents)
  }

  const startTemplate = (template: AgentTemplate): void => {
    setEditing({ ...template.defaults } as Partial<Agent>)
    showToast('success', `Loaded template: ${template.label}`)
  }

  const handleSave = async (): Promise<void> => {
    if (!editing?.name || !editing?.systemPrompt) {
      showToast('error', 'Name and system prompt required')
      return
    }
    if (!window.electronAPI?.agent?.save) {
      showToast('error', 'Agent save is not available')
      return
    }
    await window.electronAPI.agent.save(editing)
    showToast('success', 'Agent saved')
    setEditing(null)
    refreshAgents()
  }

  const handleDelete = async (id: string): Promise<void> => {
    if (!confirm('Delete this agent?')) return
    if (!window.electronAPI?.agent?.delete) {
      showToast('error', 'Agent delete is not available')
      return
    }
    await window.electronAPI.agent.delete(id)
    showToast('info', 'Agent deleted')
    refreshAgents()
  }

  if (editing) {
    const selectedProviderModelList = (editing.provider && (PROVIDER_MODELS as unknown as Record<string, readonly { id: string; label: string }[]>)[editing.provider]) || []

    return (
      <div style={{ flex: 1, padding: '24px', overflow: 'auto' }}>
        <div style={{ maxWidth: '600px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '24px' }}>
            <button
              onClick={() => setEditing(null)}
              title="Back to agents list"
              aria-label="Back to agents list"
              style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '18px', color: 'var(--text-secondary)' }}
            >
              ←
            </button>
            <h1 style={{ fontSize: '20px', fontWeight: 700 }}>{editing.id ? 'Edit Agent' : 'New Agent'}</h1>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <Input label="Name *" value={editing.name || ''} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="My Custom Agent" />
            <Input label="Description" value={editing.description || ''} onChange={(e) => setEditing({ ...editing, description: e.target.value })} placeholder="What does this agent do?" />

            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>System Prompt *</label>
              <textarea value={editing.systemPrompt || ''} onChange={(e) => setEditing({ ...editing, systemPrompt: e.target.value })} placeholder="You are a helpful assistant..." rows={8} style={{ width: '100%', padding: '10px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-mono)', resize: 'vertical', outline: 'none' }} />
            </div>

            <div style={{ display: 'flex', gap: '12px' }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Provider</label>
                <select
                  value={editing.provider || ''}
                  onChange={(e) => setEditing({ ...editing, provider: e.target.value })}
                  style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-sans)' }}
                >
                  <option value="">Use default</option>
                  {(['anthropic', 'openai', 'gemini', 'ollama', 'deepseek', 'nvidia', 'openrouter', 'bedrock', 'github', 'groq', 'custom'] as ProviderType[]).map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>

              <div style={{ flex: 1 }}>
                <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Model</label>
                <select value={editing.model || ''} onChange={(e) => setEditing({ ...editing, model: e.target.value })} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
                  <option value="">Use default</option>
                  {selectedProviderModelList.map((m) => (
                    <option key={m.id} value={m.id}>{m.label}</option>
                  ))}
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
              onClick={() => onNavigate('chat')}
              title="Back to Chat"
              aria-label="Back to Chat"
              style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontFamily: 'var(--font-sans)', fontWeight: 500, transition: 'all var(--transition-fast)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'var(--accent-blue)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              ← Back
            </button>
          )}
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>🤖 Agents</h1>
        </div>
        <Button onClick={() => setEditing({ name: '', systemPrompt: '', tools: [] })} title="Create a new agent">+ New Agent</Button>
      </div>

      {/* Pre-built Agent Templates */}
      <div style={{ marginBottom: '24px' }}>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          ⚡ Quick Start Templates
        </h2>
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          {AGENT_TEMPLATES.map((template) => (
            <button
              key={template.id}
              onClick={() => startTemplate(template)}
              title={template.description}
              style={{
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                cursor: 'pointer',
                color: 'var(--text-primary)',
                textAlign: 'left',
                minWidth: '180px',
                transition: 'all 0.15s ease'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = 'var(--accent-blue)'
                e.currentTarget.style.transform = 'translateY(-1px)'
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'var(--border)'
                e.currentTarget.style.transform = 'translateY(0)'
              }}
            >
              <div style={{ fontSize: '18px', marginBottom: '6px' }}>{template.icon}</div>
              <div style={{ fontWeight: 600, fontSize: '13px' }}>{template.label}</div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', marginTop: '4px' }}>{template.description}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Custom Agents List */}
      <div>
        <h2 style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text-secondary)', marginBottom: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
          🧠 Custom Agents
        </h2>
        {agents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '28px', marginBottom: '8px', opacity: 0.3 }}>🤖</div>
            <div style={{ fontSize: '13px' }}>No custom agents yet. Use a template above or create one.</div>
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
    </div>
  )
}