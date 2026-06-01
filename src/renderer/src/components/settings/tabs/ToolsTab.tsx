// Lumiq — Settings: Tools Tab (Redesigned)
import React, { useEffect } from 'react'
import { useSettingsStore } from '@renderer/store/settingsStore'
import type { ToolPermission } from '@shared/types'

const TOOL_META: Record<string, { icon: string; label: string; description: string; risk: 'safe' | 'moderate' | 'danger' }> = {
  SearchWebTool: { icon: '🔎', label: 'Web Search', description: 'Search the web for documentation and answers.', risk: 'safe' },
  FileReadTool: { icon: '📄', label: 'Read File', description: 'Read content of local workspace files.', risk: 'safe' },
  GrepSearchTool: { icon: '🔍', label: 'Code Search', description: 'Find patterns inside codebase files.', risk: 'safe' },
  ListDirectoryTool: { icon: '📁', label: 'List Directory', description: 'List files and folders in a directory.', risk: 'safe' },
  FileWriteTool: { icon: '✏️', label: 'Write File', description: 'Create new files in the workspace.', risk: 'moderate' },
  FileEditTool: { icon: '📝', label: 'Edit File', description: 'Apply edits to existing code files.', risk: 'moderate' },
  TerminalCommandTool: { icon: '🐚', label: 'Run Command', description: 'Execute scripts and commands in terminal.', risk: 'danger' },
  PowerShellTool: { icon: '🐚', label: 'PowerShell', description: 'Run commands in Windows PowerShell.', risk: 'danger' }
}

const RISK_COLORS = {
  safe: 'var(--accent-green)',
  moderate: '#d97706',
  danger: 'var(--accent-red)'
}

const RISK_LABELS = {
  safe: 'Safe',
  moderate: 'Write',
  danger: 'High Risk'
}

function getMeta(name: string) {
  if (TOOL_META[name]) return TOOL_META[name]
  const isRead = /read|list|search|grep/i.test(name)
  const isWrite = /write|edit|save/i.test(name)
  return {
    icon: isRead ? '📄' : isWrite ? '📝' : '🔧',
    label: name.replace(/Tool$/, '').replace(/([A-Z])/g, ' $1').trim(),
    description: `Allows the AI agent to execute the ${name} operation.`,
    risk: (isRead ? 'safe' : isWrite ? 'moderate' : 'danger') as 'safe' | 'moderate' | 'danger'
  }
}

export function ToolsTab(): React.JSX.Element {
  const { toolSettings, loadToolSettings, updateToolSettings } = useSettingsStore()

  useEffect(() => { loadToolSettings() }, [loadToolSettings])

  const toggle = (name: string): void => {
    updateToolSettings(toolSettings.map((t) => t.name === name ? { ...t, enabled: !t.enabled } : t))
  }

  const setPerm = (name: string, p: string): void => {
    updateToolSettings(toolSettings.map((t) => t.name === name ? { ...t, permission: p as ToolPermission } : t))
  }

  return (
    <div style={{ maxWidth: '680px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{
        padding: '12px 16px',
        background: 'rgba(59, 130, 246, 0.04)',
        border: '1px solid rgba(59, 130, 246, 0.15)',
        borderRadius: '10px',
        fontSize: '12px',
        color: 'var(--text-muted)',
        marginBottom: '8px',
        display: 'flex',
        gap: '8px',
        alignItems: 'flex-start'
      }}>
        <span style={{ fontSize: '14px', flexShrink: 0 }}>💡</span>
        <span>For fine-grained per-tool permissions, visit the <strong style={{ color: 'var(--text-secondary)' }}>Permissions</strong> tab. This tab provides a quick enable/disable toggle.</span>
      </div>

      {toolSettings.map((tool) => {
        const meta = getMeta(tool.name)
        const riskColor = RISK_COLORS[meta.risk]

        return (
          <div
            key={tool.name}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '14px',
              padding: '12px 16px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              transition: 'all var(--transition-fast)',
              opacity: tool.enabled ? 1 : 0.6
            }}
            onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)' }}
            onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
          >
            {/* Toggle */}
            <button
              onClick={() => toggle(tool.name)}
              title={tool.enabled ? `Disable ${meta.label}` : `Enable ${meta.label}`}
              aria-label={tool.enabled ? `Disable ${meta.label}` : `Enable ${meta.label}`}
              style={{
                width: '40px',
                height: '22px',
                borderRadius: '11px',
                background: tool.enabled ? 'var(--accent-blue)' : 'var(--bg-tertiary)',
                border: `1.5px solid ${tool.enabled ? 'var(--accent-blue)' : 'var(--border)'}`,
                cursor: 'pointer',
                position: 'relative',
                padding: 0,
                transition: 'all 0.2s ease',
                flexShrink: 0
              }}
            >
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                background: 'white',
                position: 'absolute',
                top: '1.5px',
                left: tool.enabled ? '20px' : '1.5px',
                transition: 'left 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)',
                boxShadow: '0 1px 3px rgba(0,0,0,0.25)'
              }} />
            </button>

            {/* Icon + Info */}
            <span style={{ fontSize: '18px', flexShrink: 0 }}>{meta.icon}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{meta.label}</span>
                <span style={{
                  fontSize: '9px',
                  padding: '1px 6px',
                  background: `${riskColor}18`,
                  color: riskColor,
                  border: `1px solid ${riskColor}30`,
                  borderRadius: '4px',
                  fontWeight: 700
                }}>
                  {RISK_LABELS[meta.risk]}
                </span>
              </div>
              <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {meta.description}
              </div>
            </div>

            {/* Permission select */}
            <select
              value={tool.permission}
              onChange={(e) => setPerm(tool.name, e.target.value)}
              title={`Permission for ${meta.label}`}
              disabled={!tool.enabled}
              style={{
                padding: '5px 10px',
                background: 'var(--bg-tertiary)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                fontSize: '11px',
                color: 'var(--text-secondary)',
                fontFamily: 'var(--font-sans)',
                cursor: tool.enabled ? 'pointer' : 'default',
                flexShrink: 0,
                outline: 'none'
              }}
            >
              <option value="always-ask">Ask</option>
              <option value="always-allow">Allow</option>
              <option value="always-deny">Deny</option>
            </select>
          </div>
        )
      })}
    </div>
  )
}
