// Lumiq — Settings: Commands Tab
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

  const load = async (): Promise<void> => {
    if (window.electronAPI?.command?.list) {
      setCommands(await window.electronAPI.command.list() as CustomCommand[])
    }
  }
  useEffect(() => { load() }, [])

  const save = async (): Promise<void> => {
    try {
      await window.electronAPI.command.save({
        name,
        description,
        command,
        type
      })
      setName('')
      setDescription('')
      setCommand('')
      setType('shell')
      await load()
      showToast('success', 'Saved', 'Command saved successfully.')
    } catch (e) {
      showToast('error', 'Save Failed', (e as Error).message)
    }
  }

  const handleImportFolder = async (): Promise<void> => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({
        properties: ['openDirectory']
      })
      if (!result.canceled && result.filePaths.length > 0) {
        const count = await window.electronAPI.command.importFolder(result.filePaths[0])
        showToast('success', 'Imported', `Successfully imported ${count} commands from folder.`)
        await load()
      }
    } catch (e) {
      showToast('error', 'Folder Import Failed', (e as Error).message)
    }
  }

  return (
    <div style={{ maxWidth: '720px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <Input label="Name" value={name} onChange={(e) => setName(e.target.value)} placeholder="status" />
      <Input label="Description" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Check system status" />
      
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        <label style={{ fontSize: '13px', color: 'var(--text-secondary)', fontWeight: 500 }}>Type:</label>
        <select 
          value={type} 
          onChange={(e) => setType(e.target.value as 'shell' | 'prompt')}
          style={{ padding: '6px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '6px', color: 'var(--text-primary)' }}
        >
          <option value="shell">Shell Command</option>
          <option value="prompt">Prompt Injection</option>
        </select>
      </div>

      <textarea 
        value={command} 
        onChange={(e) => setCommand(e.target.value)} 
        placeholder={type === 'shell' ? "npm run build" : "Prompt template..."} 
        style={{ minHeight: '110px', padding: '10px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontFamily: 'var(--font-sans)' }} 
      />
      
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <Button variant="outline" size="sm" onClick={handleImportFolder}>📂 Import Folder</Button>
        <Button size="sm" onClick={save}>Save Command</Button>
      </div>
      
      {commands.map((cmd) => (
        <div key={cmd.id} style={{ padding: '10px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', gap: '10px' }}>
          <div style={{ flex: 1 }}>
            <strong>/{cmd.name}</strong> <span style={{ fontSize: '11px', padding: '2px 6px', background: 'var(--bg-tertiary)', borderRadius: '4px', marginLeft: '6px', color: 'var(--text-secondary)' }}>{cmd.type}</span>
            <div style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{cmd.description || cmd.command}</div>
          </div>
          <Button variant="danger" size="sm" onClick={() => window.electronAPI.command.delete(cmd.id).then(load)}>Delete</Button>
        </div>
      ))}
    </div>
  )
}
