// Lumiq — Settings: Permissions & Security Control Hub
import React, { useState, useEffect, useMemo } from 'react'
import { showToast } from '@renderer/components/ui/Toast'
import { useSettingsStore } from '@renderer/store/settingsStore'
import type { ToolPermission } from '@shared/types'

type PermissionMode = 'MANUAL' | 'LIMITED' | 'EXTENDED' | 'AUTO'

const MODES: { 
  id: PermissionMode; 
  emoji: string; 
  label: string; 
  themeColor: string;
  bgGlow: string;
  borderColor: string;
  description: string;
  bullets: string[];
}[] = [
  { 
    id: 'MANUAL', 
    emoji: '🔒', 
    label: 'Manual Security', 
    themeColor: 'var(--accent-red)',
    bgGlow: 'rgba(239, 68, 68, 0.04)',
    borderColor: 'rgba(239, 68, 68, 0.4)',
    description: 'Maximum isolation and absolute control.',
    bullets: ['Prompts for every search, file read, write, and command.', 'No automatic operations are permitted.']
  },
  { 
    id: 'LIMITED', 
    emoji: '⚡', 
    label: 'Limited Safe-Access', 
    themeColor: '#d97706',
    bgGlow: 'rgba(217, 119, 6, 0.04)',
    borderColor: 'rgba(217, 119, 6, 0.4)',
    description: 'Allows read-only tools while guarding edits.',
    bullets: ['Auto-approves Web Search, File Read, and Grep Search.', 'Prompts for all file modifications and terminal commands.']
  },
  { 
    id: 'EXTENDED', 
    emoji: '🔧', 
    label: 'Extended Workspace', 
    themeColor: '#6366f1',
    bgGlow: 'rgba(99, 102, 241, 0.04)',
    borderColor: 'rgba(99, 102, 241, 0.4)',
    description: 'Auto-edits for fluid, fast development.',
    bullets: ['Auto-approves searches, file reads, and file writes/edits.', 'Prompts only for high-risk terminal/shell execution.']
  },
  { 
    id: 'AUTO', 
    emoji: '🚀', 
    label: 'Zero-Friction Auto', 
    themeColor: 'var(--accent-green)',
    bgGlow: 'rgba(34, 197, 94, 0.04)',
    borderColor: 'rgba(34, 197, 94, 0.4)',
    description: 'Hands-off automation for sandboxed sessions.',
    bullets: ['Auto-approves all operations including terminal commands.', 'Use with extreme caution inside trusted repositories.']
  }
]

const TOOL_METADATA: Record<string, { icon: string; label: string; risk: 'safe' | 'moderate' | 'danger'; description: string }> = {
  'SearchWebTool': { icon: '🔎', label: 'Web Search', risk: 'safe', description: 'Searches the web for up-to-date documentation and answers.' },
  'FileReadTool': { icon: '📄', label: 'Read File', risk: 'safe', description: 'Reads the exact text content of any local workspace file.' },
  'GrepSearchTool': { icon: '🔍', label: 'Code Search', risk: 'safe', description: 'Uses ripgrep to find patterns and text inside codebase files.' },
  'ListDirectoryTool': { icon: '📁', label: 'List Directory', risk: 'safe', description: 'Lists all files and subfolders within a local folder.' },
  'FileWriteTool': { icon: '✏️', label: 'Write File', risk: 'moderate', description: 'Creates new workspace files and writes complete code contents.' },
  'FileEditTool': { icon: '📝', label: 'Edit File', risk: 'moderate', description: 'Applies precise modifications and code edits to existing code.' },
  'TerminalCommandTool': { icon: '🐚', label: 'Run Command', risk: 'danger', description: 'Executes scripts, runs tests, and compiles code in the terminal.' },
  'PowerShellTool': { icon: '🐚', label: 'PowerShell Execution', risk: 'danger', description: 'Runs command lines and scripts directly on Windows PowerShell.' }
}

const getToolMeta = (name: string): { icon: string; label: string; risk: 'safe' | 'moderate' | 'danger'; description: string } => {
  if (TOOL_METADATA[name]) return TOOL_METADATA[name]
  const isRead = name.toLowerCase().includes('read') || name.toLowerCase().includes('list') || name.toLowerCase().includes('search') || name.toLowerCase().includes('grep')
  const isWrite = name.toLowerCase().includes('write') || name.toLowerCase().includes('edit') || name.toLowerCase().includes('save')
  
  return {
    icon: isRead ? '📄' : isWrite ? '📝' : '🔧',
    label: name.replace(/Tool$/, '').replace(/([A-Z])/g, ' $1').trim(),
    risk: isRead ? 'safe' : isWrite ? 'moderate' : 'danger',
    description: `Allows the AI agent to execute the ${name} operation.`
  }
}

export function PermissionsTab(): React.JSX.Element {
  const [globalMode, setGlobalMode] = useState<PermissionMode>('MANUAL')
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'safe' | 'moderate' | 'danger'>('all')

  const { toolSettings, loadToolSettings, updateToolSettings } = useSettingsStore()

  useEffect(() => {
    let mounted = true
    Promise.all([
      window.electronAPI.settings.getPermissionMode(),
      loadToolSettings()
    ]).then(([m]) => {
      if (!mounted) return
      setGlobalMode((m as PermissionMode) || 'MANUAL')
      setLoading(false)
    }).catch(() => {
      if (mounted) setLoading(false)
    })
    return () => { mounted = false }
  }, [loadToolSettings])

  const handleSelectMode = async (m: PermissionMode): Promise<void> => {
    setGlobalMode(m)
    await window.electronAPI.settings.setPermissionMode(m)
    showToast('success', 'Security Mode Updated', `Switched to ${m} authorization mode.`)
  }

  const toggleTool = async (name: string): Promise<void> => {
    const isEnabling = !toolSettings.find((t) => t.name === name)?.enabled
    const newSettings = toolSettings.map((t) => t.name === name ? { ...t, enabled: !t.enabled } : t)
    await updateToolSettings(newSettings)
    showToast('info', isEnabling ? 'Tool Enabled' : 'Tool Disabled', `${getToolMeta(name).label} has been ${isEnabling ? 'activated' : 'deactivated'}.`)
  }

  const setToolPermission = async (name: string, p: ToolPermission): Promise<void> => {
    const newSettings = toolSettings.map((t) => t.name === name ? { ...t, permission: p } : t)
    await updateToolSettings(newSettings)
    showToast('success', 'Permission Updated', `${getToolMeta(name).label} set to ${p.toUpperCase().replace('-', ' ')}.`)
  }

  // Filter tools based on search and risk tags
  const filteredTools = useMemo(() => {
    return toolSettings.filter((tool) => {
      const meta = getToolMeta(tool.name)
      const matchesSearch = meta.label.toLowerCase().includes(searchQuery.toLowerCase()) || 
                            tool.name.toLowerCase().includes(searchQuery.toLowerCase())
      const matchesFilter = activeFilter === 'all' || meta.risk === activeFilter
      return matchesSearch && matchesFilter
    })
  }, [toolSettings, searchQuery, activeFilter])

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '13px', padding: '12px' }}>
        <div style={{ width: '14px', height: '14px', border: '2px solid var(--border)', borderTopColor: 'var(--accent-blue)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
        <span>Loading security details...</span>
      </div>
    )
  }

  return (
    <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '24px', animation: 'fadeIn 0.22s ease' }}>
      
      {/* Tab Banner */}
      <div style={{ 
        padding: '16px 20px', 
        background: 'linear-gradient(135deg, rgba(30,41,59,0.5), rgba(15,23,42,0.6))', 
        border: '1px solid var(--border)', 
        borderRadius: '12px', 
        display: 'flex', 
        alignItems: 'center', 
        gap: '16px',
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.03)'
      }}>
        <div style={{ fontSize: '32px' }}>🛡️</div>
        <div>
          <h2 style={{ fontSize: '15px', fontWeight: 700, margin: '0 0 4px 0', color: 'var(--text-primary)', display: 'flex', alignItems: 'center', gap: '8px' }}>
            Security & Permissions Manager
            <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(34, 197, 94, 0.1)', color: 'var(--accent-green)', borderRadius: '6px', fontWeight: 600 }}>ACTIVE PROTECT</span>
          </h2>
          <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0, lineHeight: 1.4 }}>
            Control global sandbox restrictions or define individual overrides for workspace code manipulation, shell execution, and indexing tools.
          </p>
        </div>
      </div>

      {/* Global Protection Section */}
      <div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginBottom: '14px' }}>
          <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', margin: 0 }}>
            Global Permission Mode
          </h3>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Sets the baseline authorization prompt criteria for the AI developer.</span>
        </div>

        <div style={{ 
          display: 'grid', 
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', 
          gap: '12px' 
        }}>
          {MODES.map((m) => {
            const isActive = globalMode === m.id
            return (
              <button
                key={m.id}
                onClick={() => handleSelectMode(m.id)}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'flex-start',
                  padding: '16px',
                  background: isActive ? m.bgGlow : 'var(--bg-secondary)',
                  border: `1.5px solid ${isActive ? m.themeColor : 'var(--border)'}`,
                  borderRadius: '12px',
                  cursor: 'pointer',
                  textAlign: 'left',
                  fontFamily: 'var(--font-sans)',
                  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
                  boxShadow: isActive ? `0 0 14px -4px ${m.themeColor}33` : 'none',
                  transform: isActive ? 'translateY(-1px)' : 'none',
                  position: 'relative',
                  overflow: 'hidden'
                }}
                onMouseEnter={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = 'var(--text-muted)'
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.01)'
                  }
                }}
                onMouseLeave={(e) => {
                  if (!isActive) {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.background = 'var(--bg-secondary)'
                  }
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', marginBottom: '8px' }}>
                  <span style={{ fontSize: '24px', lineHeight: 1 }}>{m.emoji}</span>
                  {isActive && (
                    <span style={{ 
                      fontSize: '9px', 
                      padding: '2px 6px', 
                      background: m.themeColor, 
                      color: '#fff', 
                      borderRadius: '6px', 
                      fontWeight: 700, 
                      letterSpacing: '0.04em' 
                    }}>
                      ACTIVE
                    </span>
                  )}
                </div>
                <div style={{ fontSize: '13px', fontWeight: 700, color: isActive ? m.themeColor : 'var(--text-primary)', marginBottom: '4px' }}>
                  {m.label}
                </div>
                <div style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.3, marginBottom: '8px' }}>
                  {m.description}
                </div>
                <ul style={{ margin: 0, padding: '0 0 0 12px', fontSize: '10px', color: 'var(--text-muted)', lineHeight: 1.4, display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {m.bullets.map((b, idx) => <li key={idx}>{b}</li>)}
                </ul>
              </button>
            )
          })}
        </div>
      </div>

      {/* Fine-grained Granular Overrides Section */}
      <div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '16px', marginBottom: '14px', flexWrap: 'wrap' }}>
          <div>
            <h3 style={{ fontSize: '13px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-secondary)', margin: '0 0 2px 0' }}>
              Granular Tool Controls
            </h3>
            <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Customize security prompts per specific capability. Takes absolute priority over global mode.</span>
          </div>
          
          {/* Filtering Pills */}
          <div style={{ display: 'flex', gap: '6px' }}>
            {(['all', 'safe', 'moderate', 'danger'] as const).map((filter) => {
              const label = filter === 'all' ? 'All Operations' : filter === 'safe' ? 'Safe / Read' : filter === 'moderate' ? 'Write / Edit' : 'High Risk'
              const color = filter === 'safe' ? 'var(--accent-green)' : filter === 'moderate' ? '#d97706' : filter === 'danger' ? 'var(--accent-red)' : 'var(--accent-blue)'
              const isSelected = activeFilter === filter
              return (
                <button
                  key={filter}
                  onClick={() => setActiveFilter(filter)}
                  style={{
                    padding: '4px 10px',
                    fontSize: '11px',
                    borderRadius: '6px',
                    border: '1px solid var(--border)',
                    background: isSelected ? 'var(--bg-tertiary)' : 'var(--bg-secondary)',
                    borderColor: isSelected ? color : 'var(--border)',
                    color: isSelected ? color : 'var(--text-secondary)',
                    cursor: 'pointer',
                    fontWeight: isSelected ? 600 : 500,
                    transition: 'all var(--transition-fast)'
                  }}
                >
                  {label}
                </button>
              )
            })}
          </div>
        </div>

        {/* Search Bar */}
        <div style={{ position: 'relative', marginBottom: '12px' }}>
          <input
            type="text"
            placeholder="🔎 Search codebase tools and terminal utilities..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              background: 'var(--bg-secondary)',
              border: '1px solid var(--border)',
              borderRadius: '8px',
              color: 'var(--text-primary)',
              fontSize: '12.5px',
              fontFamily: 'var(--font-sans)',
              boxSizing: 'border-box',
              outline: 'none',
              transition: 'border-color var(--transition-fast)'
            }}
            onFocus={(e) => e.currentTarget.style.borderColor = 'var(--accent-blue)'}
            onBlur={(e) => e.currentTarget.style.borderColor = 'var(--border)'}
          />
          {searchQuery && (
            <button 
              onClick={() => setSearchQuery('')}
              style={{ position: 'absolute', right: '12px', top: '50%', transform: 'translateY(-50%)', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', fontSize: '13px' }}
            >
              ✕
            </button>
          )}
        </div>

        {/* Tool Cards Container */}
        {filteredTools.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '36px', background: 'var(--bg-secondary)', border: '1px dashed var(--border)', borderRadius: '10px', color: 'var(--text-muted)', fontSize: '12px' }}>
            No tools found matching your search or active filter tag.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            {filteredTools.map((tool) => {
              const meta = getToolMeta(tool.name)
              const riskColor = meta.risk === 'safe' ? 'var(--accent-green)' : meta.risk === 'moderate' ? '#d97706' : 'var(--accent-red)'
              const riskLabel = meta.risk === 'safe' ? 'Read-only / Safe' : meta.risk === 'moderate' ? 'Write / Modify' : 'High Risk / Exec'
              
              return (
                <div 
                  key={tool.name}
                  style={{ 
                    display: 'flex', 
                    alignItems: 'center', 
                    justifyContent: 'space-between',
                    gap: '16px', 
                    padding: '12px 16px', 
                    background: 'var(--bg-secondary)', 
                    borderRadius: '10px', 
                    border: '1px solid var(--border)',
                    boxShadow: '0 1px 2px rgba(0,0,0,0.02)',
                    transition: 'all 0.18s ease',
                    opacity: tool.enabled ? 1 : 0.65
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = 'rgba(255,255,255,0.06)'
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.08)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.boxShadow = '0 1px 2px rgba(0,0,0,0.02)'
                  }}
                >
                  
                  {/* Left Column: Switch + Tool Info */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '14px', flex: 1, minWidth: 0 }}>
                    
                    {/* Glossmorphic Toggle Switch */}
                    <button 
                      onClick={() => toggleTool(tool.name)} 
                      title={tool.enabled ? `Deactivate ${meta.label}` : `Activate ${meta.label}`} 
                      style={{ 
                        width: '38px', 
                        height: '20px', 
                        borderRadius: '12px', 
                        background: tool.enabled ? 'var(--accent-blue)' : 'var(--bg-tertiary)', 
                        border: '1.5px solid var(--border)', 
                        cursor: 'pointer', 
                        position: 'relative',
                        padding: 0,
                        transition: 'background 0.2s ease, border-color 0.2s ease',
                        flexShrink: 0
                      }}
                    >
                      <div style={{ 
                        width: '14px', 
                        height: '14px', 
                        borderRadius: '50%', 
                        background: 'white', 
                        position: 'absolute', 
                        top: '1.5px', 
                        left: tool.enabled ? '19.5px' : '1.5px', 
                        transition: 'left 0.2s cubic-bezier(0.25, 0.8, 0.25, 1)', 
                        boxShadow: '0 1px 3px rgba(0,0,0,0.3)' 
                      }} />
                    </button>

                    {/* Meta icon and labels */}
                    <div style={{ minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap', marginBottom: '2px' }}>
                        <span style={{ fontSize: '15px' }} role="img" aria-label={meta.label}>{meta.icon}</span>
                        <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{meta.label}</span>
                        <span style={{ fontSize: '10.5px', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>({tool.name})</span>
                        <span style={{ 
                          fontSize: '9px', 
                          padding: '1px 6px', 
                          background: `${riskColor}12`, 
                          color: riskColor, 
                          borderRadius: '4px', 
                          fontWeight: 700,
                          border: `1px solid ${riskColor}22`
                        }}>
                          {riskLabel}
                        </span>
                      </div>
                      <div style={{ fontSize: '11px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '380px' }}>
                        {meta.description}
                      </div>
                    </div>
                  </div>

                  {/* Right Column: High-fidelity Button Group */}
                  <div style={{ display: 'flex', gap: '4px', flexShrink: 0 }}>
                    
                    {/* Always Ask Button */}
                    <button
                      onClick={() => setToolPermission(tool.name, 'always-ask')}
                      disabled={!tool.enabled}
                      style={{
                        padding: '6px 12px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-sans)',
                        cursor: tool.enabled ? 'pointer' : 'default',
                        borderRadius: '6px 0 0 6px',
                        border: '1px solid var(--border)',
                        borderRight: 'none',
                        transition: 'all 0.16s ease',
                        background: tool.permission === 'always-ask' ? 'rgba(217, 119, 6, 0.12)' : 'var(--bg-secondary)',
                        color: tool.permission === 'always-ask' ? '#d97706' : 'var(--text-secondary)',
                        borderColor: tool.permission === 'always-ask' ? '#d97706' : 'var(--border)'
                      }}
                      onMouseEnter={(e) => {
                        if (tool.enabled && tool.permission !== 'always-ask') {
                          e.currentTarget.style.color = '#d97706'
                          e.currentTarget.style.background = 'rgba(217, 119, 6, 0.03)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (tool.enabled && tool.permission !== 'always-ask') {
                          e.currentTarget.style.color = 'var(--text-secondary)'
                          e.currentTarget.style.background = 'var(--bg-secondary)'
                        }
                      }}
                    >
                      ❓ Ask
                    </button>

                    {/* Always Allow Button */}
                    <button
                      onClick={() => setToolPermission(tool.name, 'always-allow')}
                      disabled={!tool.enabled}
                      style={{
                        padding: '6px 12px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-sans)',
                        cursor: tool.enabled ? 'pointer' : 'default',
                        borderRadius: '0',
                        border: '1px solid var(--border)',
                        borderLeft: 'none',
                        borderRight: 'none',
                        transition: 'all 0.16s ease',
                        background: tool.permission === 'always-allow' ? 'rgba(5, 150, 105, 0.12)' : 'var(--bg-secondary)',
                        color: tool.permission === 'always-allow' ? 'var(--accent-green)' : 'var(--text-secondary)',
                        borderColor: tool.permission === 'always-allow' ? 'var(--accent-green)' : 'var(--border)'
                      }}
                      onMouseEnter={(e) => {
                        if (tool.enabled && tool.permission !== 'always-allow') {
                          e.currentTarget.style.color = 'var(--accent-green)'
                          e.currentTarget.style.background = 'rgba(5, 150, 105, 0.03)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (tool.enabled && tool.permission !== 'always-allow') {
                          e.currentTarget.style.color = 'var(--text-secondary)'
                          e.currentTarget.style.background = 'var(--bg-secondary)'
                        }
                      }}
                    >
                      ✓ Allow
                    </button>

                    {/* Always Deny Button */}
                    <button
                      onClick={() => setToolPermission(tool.name, 'always-deny')}
                      disabled={!tool.enabled}
                      style={{
                        padding: '6px 12px',
                        fontSize: '11.5px',
                        fontWeight: 600,
                        fontFamily: 'var(--font-sans)',
                        cursor: tool.enabled ? 'pointer' : 'default',
                        borderRadius: '0 6px 6px 0',
                        border: '1px solid var(--border)',
                        borderLeft: 'none',
                        transition: 'all 0.16s ease',
                        background: tool.permission === 'always-deny' ? 'rgba(220, 38, 38, 0.12)' : 'var(--bg-secondary)',
                        color: tool.permission === 'always-deny' ? 'var(--accent-red)' : 'var(--text-secondary)',
                        borderColor: tool.permission === 'always-deny' ? 'var(--accent-red)' : 'var(--border)'
                      }}
                      onMouseEnter={(e) => {
                        if (tool.enabled && tool.permission !== 'always-deny') {
                          e.currentTarget.style.color = 'var(--accent-red)'
                          e.currentTarget.style.background = 'rgba(220, 38, 38, 0.03)'
                        }
                      }}
                      onMouseLeave={(e) => {
                        if (tool.enabled && tool.permission !== 'always-deny') {
                          e.currentTarget.style.color = 'var(--text-secondary)'
                          e.currentTarget.style.background = 'var(--bg-secondary)'
                        }
                      }}
                    >
                      ✕ Deny
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Override Banner */}
      <div style={{ 
        padding: '12px 14px', 
        background: 'var(--bg-secondary)', 
        borderRadius: '10px', 
        border: '1.5px solid var(--border)', 
        fontSize: '11.5px', 
        color: 'var(--text-muted)', 
        lineHeight: 1.5,
        display: 'flex',
        alignItems: 'flex-start',
        gap: '10px'
      }}>
        <span style={{ fontSize: '14px', marginTop: '-1px' }}>💡</span>
        <div>
          <strong style={{ color: 'var(--text-secondary)', fontWeight: 600 }}>Override Behavior:</strong> Fine-grained overrides set here will always bypass the Global Permission Mode selection. For example, if you are in <strong>Manual Security</strong> mode but have set <strong>Web Search</strong> to <strong>✓ Allow</strong>, the search tool will execute automatically without bothering you.
        </div>
      </div>
      
    </div>
  )
}
