// ═══════════════════════════════════════════════════════════════════
// Lumiq — Custom TitleBar Component
// Frameless window titlebar with window controls and provider/model
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect } from 'react'
import { useProviderStore } from '@renderer/store/providerStore'
import { PROVIDER_MODELS } from '@shared/types'
import type { ProviderType } from '@shared/types'

export function TitleBar(): React.JSX.Element {
  const [isMaximized, setIsMaximized] = useState(false)
  const { activeProvider, activeModel, setActiveProvider, setActiveModel } = useProviderStore()

  useEffect(() => {
    const checkMaximized = async (): Promise<void> => {
      const result = await window.electronAPI.window.isMaximized()
      setIsMaximized(result)
    }
    checkMaximized()
  }, [])

  const providers: { id: ProviderType; label: string; emoji: string }[] = [
    { id: 'anthropic', label: 'Anthropic', emoji: '🟣' },
    { id: 'openai', label: 'OpenAI', emoji: '🟢' },
    { id: 'gemini', label: 'Google', emoji: '🔵' },
    { id: 'ollama', label: 'Ollama', emoji: '🦙' },
    { id: 'deepseek', label: 'DeepSeek', emoji: '🔮' },
    { id: 'bedrock', label: 'Bedrock', emoji: '🟠' },
    { id: 'custom', label: 'Custom', emoji: '⚡' }
  ]

  const models = PROVIDER_MODELS[activeProvider] || []

  return (
    <div
      className="titlebar-drag"
      style={{
        height: '40px',
        background: 'var(--bg-secondary)',
        borderBottom: '1px solid var(--border)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 12px',
        userSelect: 'none',
        flexShrink: 0
      }}
    >
      {/* Left: App icon and name */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '16px' }}>✦</span>
        <span
          style={{
            fontSize: '13px',
            fontWeight: 700,
            letterSpacing: '0.02em',
            background: 'linear-gradient(135deg, var(--accent-blue), #8B5CF6)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent'
          }}
        >
          Lumiq
        </span>
      </div>

      {/* Center: Provider and Model selectors */}
      <div
        className="titlebar-no-drag"
        style={{ display: 'flex', gap: '6px', alignItems: 'center' }}
      >
        <select
          value={activeProvider}
          onChange={(e) => setActiveProvider(e.target.value as ProviderType)}
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '3px 8px',
            fontSize: '12px',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            outline: 'none'
          }}
        >
          {providers.map((p) => (
            <option key={p.id} value={p.id}>
              {p.emoji} {p.label}
            </option>
          ))}
        </select>

        <select
          value={activeModel}
          onChange={(e) => setActiveModel(e.target.value)}
          style={{
            background: 'var(--bg-tertiary)',
            color: 'var(--text-primary)',
            border: '1px solid var(--border)',
            borderRadius: '6px',
            padding: '3px 8px',
            fontSize: '12px',
            fontFamily: 'var(--font-sans)',
            cursor: 'pointer',
            outline: 'none',
            maxWidth: '160px'
          }}
        >
          {models.map((m) => (
            <option key={m.id} value={m.id}>
              {m.label}
            </option>
          ))}
        </select>
      </div>

      {/* Right: Window controls */}
      <div
        className="titlebar-no-drag"
        style={{ display: 'flex', alignItems: 'center', gap: '4px' }}
      >
        {[
          { label: '─', action: () => window.electronAPI.window.minimize(), title: 'Minimize' },
          { label: isMaximized ? '❐' : '□', action: () => { window.electronAPI.window.maximize(); setIsMaximized(!isMaximized) }, title: isMaximized ? 'Restore' : 'Maximize' },
          { label: '✕', action: () => window.electronAPI.window.close(), isDanger: true, title: 'Close' }
        ].map((btn, i) => (
          <button
            key={i}
            onClick={btn.action}
            title={btn.title}
            aria-label={btn.title}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--text-secondary)',
              cursor: 'pointer',
              width: '32px',
              height: '28px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '4px',
              fontSize: '12px',
              transition: 'all var(--transition-fast)'
            }}
            onMouseEnter={(e) => {
              const target = e.currentTarget
              target.style.background = (btn as { isDanger?: boolean }).isDanger ? 'var(--accent-red)' : 'var(--bg-tertiary)'
              if ((btn as { isDanger?: boolean }).isDanger) target.style.color = 'white'
            }}
            onMouseLeave={(e) => {
              const target = e.currentTarget
              target.style.background = 'none'
              target.style.color = 'var(--text-secondary)'
            }}
          >
            {btn.label}
          </button>
        ))}
      </div>
    </div>
  )
}
