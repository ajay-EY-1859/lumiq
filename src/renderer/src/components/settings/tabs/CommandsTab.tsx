// Lumiq — Settings: Commands Tab (Redesigned)
import React, { useState, useEffect } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { showToast } from '@renderer/components/ui/Toast'
import type { CustomCommand } from '@shared/types'

export function CommandsTab(): React.JSX.Element {
  const [commands, setCommands] = useState<CustomCommand[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [command, setCommand] = useState('')
  const [type, setType] = useState<'shell' | 'prompt'>('shell')
  const [isExpanded, setIsExpanded] = useState(false)

  const load = async (): Promise<void> => {
    if (window.electronAPI?.command?.list) {
      setCommands(await window.electronAPI.command.list() as CustomCommand[])
    }
  }
  useEffect(() => { load() }, [])

  const save = async (): Promise<void> => {
    if (!name.trim()) { showToast('error', 'Required', 'Command name is required.'); return }
    try {
      await window.electronAPI.command.save({ name, description, command, type })
      setName(''); setDescription(''); setCommand(''); setType('shell')
      setIsExpanded(false)
      showToast('success', 'Saved', 'Command saved successfully.')
      await load()
    } catch (e) { showToast('error', 'Save Failed', (e as Error).message) }
  }

  const handleImportFolder = async (): Promise<void> => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({ properties: ['openDirectory'] })
      if (!result.canceled && result.filePaths.length > 0) {
        const count = await window.electronAPI.command.importFolder(result.filePaths[0])
        showToast('success', 'Imported', `Imported ${count} commands from folder.`)
        await load()
      }
    } catch (e) { showToast('error', 'Import Failed', (e as Error).message) }
  }

  const TYPE_COLORS = { shell: 'var(--accent-blue)', prompt: '#8b5cf6' }
  const TYPE_LABELS = { shell: '⚡ Shell', prompt: '💬 Prompt' }

  return (
    <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '16px' }}>

      {/* Create Form */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        overflow: 'hidden'
      }}>
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          style={{
            width: '100%',
            padding: '14px 18px',
            background: 'none',
            border: 'none',
            borderBottom: isExpanded ? '1px solid var(--border)' : 'none',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            fontFamily: 'var(--font-sans)',
            transition: 'background var(--transition-fast)'
          }}
          onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)' }}
          onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
        >
          <span style={{ fontSize: '16px' }}>⚡</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>
            Create New Command
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition-fast)' }}>▾</span>
        </button>

        {isExpanded && (
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="status" />
              <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Check system status" />
            </div>

            {/* Type Toggle */}
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '6px' }}>Type</label>
              <div style={{ display: 'flex', gap: '8px' }}>
                {(['shell', 'prompt'] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    style={{
                      padding: '7px 16px',
                      background: type === t ? `${TYPE_COLORS[t]}15` : 'var(--bg-tertiary)',
                      border: `1.5px solid ${type === t ? TYPE_COLORS[t] : 'var(--border)'}`,
                      borderRadius: '8px',
                      color: type === t ? TYPE_COLORS[t] : 'var(--text-secondary)',
                      fontSize: '12px',
                      fontWeight: 600,
                      cursor: 'pointer',
                      fontFamily: 'var(--font-sans)',
                      transition: 'all var(--transition-fast)'
                    }}
                  >
                    {TYPE_LABELS[t]}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                {type === 'shell' ? 'Shell Command' : 'Prompt Template'}
              </label>
              <textarea
                value={command}
                onChange={(e) => setCommand(e.target.value)}
                placeholder={type === 'shell' ? 'npm run build' : 'Prompt template...'}
                style={{
                  width: '100%',
                  minHeight: '90px',
                  padding: '10px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontFamily: type === 'shell' ? 'var(--font-mono)' : 'var(--font-sans)',
                  fontSize: '13px',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <Button variant="outline" size="sm" onClick={handleImportFolder}>📂 Import Folder</Button>
              <Button size="sm" onClick={save}>Save Command</Button>
            </div>
          </div>
        )}
      </div>

      {/* Commands List */}
      {commands.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 2px' }}>
            {commands.length} Command{commands.length !== 1 ? 's' : ''}
          </div>
          {commands.map((cmd) => (
            <div
              key={cmd.id}
              style={{
                padding: '12px 16px',
                background: 'var(--bg-secondary)',
                border: '1px solid var(--border)',
                borderRadius: '12px',
                display: 'flex',
                gap: '12px',
                alignItems: 'center',
                transition: 'border-color var(--transition-fast)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(59,130,246,0.25)' }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border)' }}
            >
              <span style={{ fontSize: '18px', flexShrink: 0 }}>{cmd.type === 'shell' ? '⚡' : '💬'}</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '2px' }}>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: '4px', color: 'var(--text-primary)' }}>/{cmd.name}</code>
                  <span style={{
                    fontSize: '9px',
                    padding: '1px 6px',
                    background: `${TYPE_COLORS[cmd.type]}15`,
                    color: TYPE_COLORS[cmd.type],
                    border: `1px solid ${TYPE_COLORS[cmd.type]}30`,
                    borderRadius: '4px',
                    fontWeight: 700
                  }}>
                    {cmd.type.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {cmd.description || cmd.command}
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={() => window.electronAPI.command.delete(cmd.id).then(load)}>Delete</Button>
            </div>
          ))}
        </div>
      )}

      {commands.length === 0 && !isExpanded && (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          background: 'var(--bg-secondary)',
          border: '1px dashed var(--border)',
          borderRadius: '14px',
          color: 'var(--text-muted)',
          fontSize: '13px'
        }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>⚡</div>
          <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>No commands yet</div>
          <div>Create a command or import from a folder.</div>
        </div>
      )}
    </div>
  )
}
