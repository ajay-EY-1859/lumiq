// Lumiq — Settings: Skills Tab
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

  const load = async (): Promise<void> => setSkills(await window.electronAPI.skill.list() as CustomSkill[])
  useEffect(() => { load() }, [])

  const save = async (): Promise<void> => {
    await window.electronAPI.skill.save({
      name,
      description,
      promptTemplate,
      allowedTools: allowedTools.split(',').map((tool) => tool.trim()).filter(Boolean)
    })
    setName('')
    setDescription('')
    setPromptTemplate('')
    setAllowedTools('')
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
    } catch (e) {
      showToast('error', 'Import Failed', (e as Error).message)
    }
  }

  const handleImportFolder = async (): Promise<void> => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({
        properties: ['openDirectory']
      })
      if (!result.canceled && result.filePaths.length > 0) {
        const count = await window.electronAPI.skill.importFolder(result.filePaths[0])
        showToast('success', 'Imported', `Successfully imported ${count} skills from folder.`)
        await load()
      }
    } catch (e) {
      showToast('error', 'Folder Import Failed', (e as Error).message)
    }
  }

  return (
    <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="explain" />
      <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Explain selected code" />
      <textarea value={promptTemplate} onChange={(e) => setPromptTemplate(e.target.value)} placeholder="Prompt template. Use {{input}} for the current message." style={{ minHeight: '110px', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }} />
      <Input label="Allowed Tools" value={allowedTools} onChange={(e) => setAllowedTools(e.target.value)} placeholder="FileReadTool,GrepTool" />
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div style={{ display: 'flex', gap: '8px' }}>
          <Button variant="outline" size="sm" onClick={handleImport}>📥 Import File</Button>
          <Button variant="outline" size="sm" onClick={handleImportFolder}>📂 Import Folder</Button>
        </div>
        <Button size="sm" onClick={save}>Save Skill</Button>
      </div>
      {skills.map((skill) => (
        <div key={skill.id} style={{ padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}><strong>/{skill.name}</strong><div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{skill.description}</div></div>
          <Button variant="danger" size="sm" onClick={() => window.electronAPI.skill.delete(skill.id).then(load)}>Delete</Button>
        </div>
      ))}
    </div>
  )
}
