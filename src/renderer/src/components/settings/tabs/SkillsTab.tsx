// Lumiq — Settings: Skills Tab (Redesigned)
import React, { useState, useEffect } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { showToast } from '@renderer/components/ui/Toast'
import type { CustomSkill } from '@shared/types'

export function SkillsTab(): React.JSX.Element {
  const [skills, setSkills] = useState<CustomSkill[]>([])
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [promptTemplate, setPromptTemplate] = useState('')
  const [allowedTools, setAllowedTools] = useState('')
  const [isExpanded, setIsExpanded] = useState(false)

  const load = async (): Promise<void> => setSkills(await window.electronAPI.skill.list() as CustomSkill[])
  useEffect(() => { load() }, [])

  const save = async (): Promise<void> => {
    if (!name.trim()) { showToast('error', 'Required', 'Skill name is required.'); return }
    await window.electronAPI.skill.save({
      name,
      description,
      promptTemplate,
      allowedTools: allowedTools.split(',').map((t) => t.trim()).filter(Boolean)
    })
    setName(''); setDescription(''); setPromptTemplate(''); setAllowedTools('')
    setIsExpanded(false)
    showToast('success', 'Saved', 'Skill saved successfully.')
    await load()
  }

  const handleImport = async (): Promise<void> => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({
        properties: ['openFile'],
        filters: [{ name: 'JSON Config', extensions: ['json'] }]
      })
      if (!result.canceled && result.filePaths.length > 0) {
        await window.electronAPI.skill.import(result.filePaths[0])
        showToast('success', 'Imported', 'Skill imported successfully.')
        await load()
      }
    } catch (e) { showToast('error', 'Import Failed', (e as Error).message) }
  }

  const handleImportFolder = async (): Promise<void> => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({ properties: ['openDirectory'] })
      if (!result.canceled && result.filePaths.length > 0) {
        const count = await window.electronAPI.skill.importFolder(result.filePaths[0])
        showToast('success', 'Imported', `Imported ${count} skills from folder.`)
        await load()
      }
    } catch (e) { showToast('error', 'Import Failed', (e as Error).message) }
  }

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
          <span style={{ fontSize: '16px' }}>✨</span>
          <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)', flex: 1, textAlign: 'left' }}>
            Create New Skill
          </span>
          <span style={{ fontSize: '12px', color: 'var(--text-muted)', transform: isExpanded ? 'rotate(180deg)' : 'none', transition: 'transform var(--transition-fast)' }}>▾</span>
        </button>

        {isExpanded && (
          <div style={{ padding: '16px 18px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
              <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="explain" />
              <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explain selected code" />
            </div>
            <div>
              <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block', marginBottom: '4px' }}>
                Prompt Template
              </label>
              <textarea
                value={promptTemplate}
                onChange={(e) => setPromptTemplate(e.target.value)}
                placeholder="Prompt template. Use {{input}} for the current message."
                style={{
                  width: '100%',
                  minHeight: '100px',
                  padding: '10px 12px',
                  background: 'var(--bg-tertiary)',
                  border: '1px solid var(--border)',
                  borderRadius: '8px',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-sans)',
                  fontSize: '13px',
                  resize: 'vertical',
                  outline: 'none',
                  boxSizing: 'border-box'
                }}
              />
            </div>
            <Input label="Allowed Tools (comma-separated)" value={allowedTools} onChange={(e) => setAllowedTools(e.target.value)} placeholder="FileReadTool, GrepTool" />
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: '8px' }}>
                <Button variant="outline" size="sm" onClick={handleImport}>📥 Import File</Button>
                <Button variant="outline" size="sm" onClick={handleImportFolder}>📂 Import Folder</Button>
              </div>
              <Button size="sm" onClick={save}>Save Skill</Button>
            </div>
          </div>
        )}
      </div>

      {/* Skills List */}
      {skills.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em', padding: '0 2px' }}>
            {skills.length} Skill{skills.length !== 1 ? 's' : ''}
          </div>
          {skills.map((skill) => (
            <div
              key={skill.id}
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
              <span style={{ fontSize: '18px', flexShrink: 0 }}>📘</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)', marginBottom: '2px' }}>
                  <code style={{ fontFamily: 'var(--font-mono)', fontSize: '12px', background: 'var(--bg-tertiary)', padding: '1px 6px', borderRadius: '4px' }}>/{skill.name}</code>
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-muted)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {skill.description || 'No description'}
                </div>
              </div>
              <Button variant="danger" size="sm" onClick={() => window.electronAPI.skill.delete(skill.id).then(load)}>Delete</Button>
            </div>
          ))}
        </div>
      )}

      {skills.length === 0 && !isExpanded && (
        <div style={{
          padding: '32px',
          textAlign: 'center',
          background: 'var(--bg-secondary)',
          border: '1px dashed var(--border)',
          borderRadius: '14px',
          color: 'var(--text-muted)',
          fontSize: '13px'
        }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>📘</div>
          <div style={{ fontWeight: 600, marginBottom: '4px', color: 'var(--text-secondary)' }}>No skills yet</div>
          <div>Create a skill or import from a JSON file.</div>
        </div>
      )}
    </div>
  )
}
