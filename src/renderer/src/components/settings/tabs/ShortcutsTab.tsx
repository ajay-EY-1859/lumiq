// Lumiq — Settings: Shortcuts Tab (Redesigned with Custom Keybinding Support)
import React, { useState, useEffect } from 'react'
import { useSettingsStore } from '@renderer/store/settingsStore'

interface ShortcutItem {
  id: string
  action: string
  defaultKeys: string[]
  description: string
}

const CUSTOMIZABLE_SHORTCUTS: ShortcutItem[] = [
  { id: 'newSession', action: 'New session', defaultKeys: ['Ctrl', 'N'], description: 'Open a fresh chat session' },
  { id: 'toggleSidebar', action: 'Toggle sidebar', defaultKeys: ['Ctrl', 'B'], description: 'Show or hide the chats and explorer sidebar' },
  { id: 'openSettings', action: 'Open settings', defaultKeys: ['Ctrl', ','], description: 'Open the settings dashboard' },
  { id: 'toggleEditor', action: 'Toggle editor', defaultKeys: ['Ctrl', 'Shift', 'E'], description: 'Toggle Monaco code editor visibility' },
  { id: 'focusSearch', action: 'Focus search panel', defaultKeys: ['Ctrl', 'Shift', 'F'], description: 'Focus the search/find in files panel' },
  { id: 'focusGit', action: 'Focus git panel', defaultKeys: ['Ctrl', 'Shift', 'G'], description: 'Focus the source control / git panel' }
]

const STATIC_SHORTCUT_GROUPS = [
  {
    label: 'Chat & Dialogue',
    icon: '💬',
    shortcuts: [
      { action: 'Send message', keys: ['Enter'] },
      { action: 'Insert new line', keys: ['Shift', 'Enter'] },
      { action: 'Cancel / close dialog', keys: ['Escape'] }
    ]
  },
  {
    label: 'Build & Execution',
    icon: '⚡',
    shortcuts: [
      { action: 'Run project', keys: ['F5'] },
      { action: 'Stop active task', keys: ['Shift', 'F5'] },
      { action: 'Run current file', keys: ['Ctrl', 'F5'] },
      { action: 'Build project', keys: ['F6'] },
      { action: 'Compile current file', keys: ['Ctrl', 'F6'] }
    ]
  },
  {
    label: 'Debugging',
    icon: '🐞',
    shortcuts: [
      { action: 'Step over', keys: ['F10'] },
      { action: 'Step into', keys: ['F11'] },
      { action: 'Step out', keys: ['Shift', 'F11'] }
    ]
  }
]

export function ShortcutsTab(): React.JSX.Element {
  const { settings, updateSetting } = useSettingsStore()
  const [recordingActionId, setRecordingActionId] = useState<string | null>(null)

  const keybindings = useMemo(() => settings.keybindings || {}, [settings.keybindings])

  const getKeys = (id: string, defaultKeys: string[]): string[] => {
    return keybindings[id] || defaultKeys
  }

  useEffect(() => {
    if (!recordingActionId) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // If user presses Escape alone, cancel recording
      if (e.key === 'Escape' && !e.ctrlKey && !e.shiftKey && !e.altKey && !e.metaKey) {
        setRecordingActionId(null)
        return
      }

      // Check if it's a modifier key by itself
      if (['Control', 'Shift', 'Alt', 'Meta'].includes(e.key)) {
        return
      }

      // Build keybinding array
      const keys: string[] = []
      if (e.ctrlKey || e.metaKey) keys.push('Ctrl')
      if (e.shiftKey) keys.push('Shift')
      if (e.altKey) keys.push('Alt')

      // Add primary key
      let primaryKey = e.key.toUpperCase()
      if (e.key === ' ') {
        primaryKey = 'Space'
      } else if (e.key === ',') {
        primaryKey = ','
      } else if (e.key === '.') {
        primaryKey = '.'
      } else if (e.key === '/') {
        primaryKey = '/'
      } else if (e.key === ';') {
        primaryKey = ';'
      } else if (e.key === "'") {
        primaryKey = "'"
      } else if (e.key === '[') {
        primaryKey = '['
      } else if (e.key === ']') {
        primaryKey = ']'
      } else if (e.key === '`') {
        primaryKey = '`'
      } else if (e.key === '\\') {
        primaryKey = '\\'
      } else if (e.key === '-') {
        primaryKey = '-'
      } else if (e.key === '=') {
        primaryKey = '='
      }
      keys.push(primaryKey)

      // Save keybinding
      const updated = {
        ...keybindings,
        [recordingActionId]: keys
      }
      
      void updateSetting('keybindings', updated)
      setRecordingActionId(null)
    }

    window.addEventListener('keydown', handleKeyDown, true)
    return () => window.removeEventListener('keydown', handleKeyDown, true)
  }, [recordingActionId, keybindings, updateSetting])

  const handleResetAll = async () => {
    if (confirm('Are you sure you want to reset all keyboard shortcuts to defaults?')) {
      await updateSetting('keybindings', {})
    }
  }

  return (
    <div style={{ maxWidth: '560px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Customizable Shortcuts */}
      <div style={{
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: '14px',
        overflow: 'hidden'
      }}>
        <div style={{
          padding: '14px 18px',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <span style={{ fontSize: '14px' }}>⌨️</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>Custom Shortcuts</span>
          </div>
          {Object.keys(keybindings).length > 0 && (
            <button
              onClick={handleResetAll}
              style={{
                fontSize: '11px',
                fontWeight: 600,
                color: 'var(--accent-red)',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                padding: '2px 6px',
                borderRadius: '4px',
                transition: 'background var(--transition-fast)'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'rgba(239, 68, 68, 0.08)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none' }}
            >
              Reset to Defaults
            </button>
          )}
        </div>
        
        <div style={{ padding: '8px 0' }}>
          {CUSTOMIZABLE_SHORTCUTS.map((s, i) => {
            const isRecording = recordingActionId === s.id
            const currentKeys = getKeys(s.id, s.defaultKeys)
            const isCustomized = !!keybindings[s.id]

            return (
              <div
                key={s.id}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '12px 18px',
                  borderBottom: i < CUSTOMIZABLE_SHORTCUTS.length - 1 ? '1px solid var(--border)' : 'none',
                  background: isRecording ? 'rgba(59, 130, 246, 0.04)' : 'transparent',
                  transition: 'background var(--transition-fast)'
                }}
              >
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginRight: '16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span style={{ fontSize: '13px', fontWeight: 600, color: 'var(--text-primary)' }}>{s.action}</span>
                    {isCustomized && (
                      <span style={{
                        fontSize: '9px',
                        background: 'rgba(59, 130, 246, 0.1)',
                        color: 'var(--accent-blue)',
                        padding: '1px 5px',
                        borderRadius: '10px',
                        fontWeight: 700
                      }}>
                        Custom
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{s.description}</span>
                </div>
                
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  {isRecording ? (
                    <div style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '11px',
                      color: 'var(--accent-blue)',
                      fontWeight: 600,
                      background: 'rgba(59, 130, 246, 0.08)',
                      padding: '4px 10px',
                      borderRadius: '8px',
                      border: '1px dashed var(--accent-blue)',
                      animation: 'pulse 1.5s infinite'
                    }}>
                      <span>Press keys...</span>
                      <button
                        onClick={(e) => { e.stopPropagation(); setRecordingActionId(null) }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: 'var(--text-muted)',
                          cursor: 'pointer',
                          fontSize: '10px',
                          fontWeight: 700,
                          marginLeft: '4px',
                          padding: '0 2px'
                        }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <>
                      <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                        {currentKeys.map((key, ki) => (
                          <React.Fragment key={key}>
                            {ki > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+</span>}
                            <kbd style={{
                              background: 'var(--bg-tertiary)',
                              border: '1px solid var(--border)',
                              borderBottom: '2px solid var(--border)',
                              borderRadius: '6px',
                              padding: '3px 8px',
                              fontSize: '11px',
                              fontFamily: 'var(--font-mono)',
                              fontWeight: 600,
                              color: 'var(--text-primary)',
                              boxShadow: '0 1px 0 var(--border)'
                            }}>
                              {key}
                            </kbd>
                          </React.Fragment>
                        ))}
                      </div>
                      
                      <button
                        onClick={() => setRecordingActionId(s.id)}
                        title={`Customize shortcut for ${s.action}`}
                        style={{
                          background: 'var(--bg-tertiary)',
                          border: '1px solid var(--border)',
                          borderRadius: '8px',
                          padding: '5px 10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          color: 'var(--text-secondary)',
                          cursor: 'pointer',
                          transition: 'all var(--transition-fast)'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.borderColor = 'var(--text-muted)'
                          e.currentTarget.style.color = 'var(--text-primary)'
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.borderColor = 'var(--border)'
                          e.currentTarget.style.color = 'var(--text-secondary)'
                        }}
                      >
                        Edit
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Static Shortcut Groups */}
      {STATIC_SHORTCUT_GROUPS.map((group) => (
        <div
          key={group.label}
          style={{
            background: 'var(--bg-secondary)',
            border: '1px solid var(--border)',
            borderRadius: '14px',
            overflow: 'hidden'
          }}
        >
          <div style={{
            padding: '12px 18px',
            borderBottom: '1px solid var(--border)',
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
          }}>
            <span style={{ fontSize: '14px' }}>{group.icon}</span>
            <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text-primary)' }}>{group.label}</span>
          </div>
          <div style={{ padding: '8px 0' }}>
            {group.shortcuts.map((s, i) => (
              <div
                key={s.action}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 18px',
                  borderBottom: i < group.shortcuts.length - 1 ? '1px solid var(--border)' : 'none',
                  transition: 'background var(--transition-fast)'
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)' }}
                onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent' }}
              >
                <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.action}</span>
                <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                  {s.keys.map((key, ki) => (
                    <React.Fragment key={key}>
                      {ki > 0 && <span style={{ fontSize: '10px', color: 'var(--text-muted)' }}>+</span>}
                      <kbd style={{
                        background: 'var(--bg-tertiary)',
                        border: '1px solid var(--border)',
                        borderBottom: '2px solid var(--border)',
                        borderRadius: '6px',
                        padding: '3px 8px',
                        fontSize: '11px',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        color: 'var(--text-primary)',
                        boxShadow: '0 1px 0 var(--border)'
                      }}>
                        {key}
                      </kbd>
                    </React.Fragment>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}
