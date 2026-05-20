// Lumiq — Settings: Plugins & Extensions Tab
import React, { useState } from 'react'
import { Button } from '@renderer/components/ui/Button'
import { showToast } from '@renderer/components/ui/Toast'

// Mock marketplace data
const MOCK_MARKETPLACE = [
  { id: 'plugin-react', name: 'React Expert', type: 'Skill Pack', author: 'Lumiq Team', description: 'Advanced skills and commands for Next.js and React 19 development.' },
  { id: 'plugin-docker', name: 'Docker Toolkit', type: 'MCP Server', author: 'Community', description: 'MCP server to manage containers, networks, and volumes directly from chat.' },
  { id: 'plugin-aws', name: 'AWS Helper', type: 'Commands', author: 'CloudGen', description: 'Collection of slash commands for common AWS CLI operations.' },
  { id: 'plugin-python', name: 'Python Data Science', type: 'Skill Pack', author: 'Lumiq Team', description: 'Contextual skills for Pandas, NumPy, and PyTorch.' }
]

export function PluginsTab(): React.JSX.Element {
  const [view, setView] = useState<'installed' | 'marketplace'>('installed')
  const [installed, setInstalled] = useState<string[]>([]) // mock installed ids

  const handleImport = async (): Promise<void> => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({
        properties: ['openDirectory']
      })
      if (!result.canceled && result.filePaths.length > 0) {
        // Here we would call a backend function to process a plugin folder
        showToast('success', 'Plugin Imported', `Imported plugin from ${result.filePaths[0]}`)
      }
    } catch (e) {
      showToast('error', 'Import Failed', (e as Error).message)
    }
  }

  const handleInstall = (id: string) => {
    setInstalled([...installed, id])
    showToast('success', 'Plugin Installed', 'The plugin has been added to your workspace.')
  }

  const handleUninstall = (id: string) => {
    setInstalled(installed.filter(i => i !== id))
    showToast('info', 'Plugin Removed', 'The plugin has been removed.')
  }

  return (
    <div style={{ maxWidth: '800px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
      
      {/* Tab Navigation */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '16px' }}>
        <button 
          onClick={() => setView('installed')}
          style={{ 
            padding: '8px 4px', 
            background: 'none', 
            border: 'none', 
            borderBottom: view === 'installed' ? '2px solid var(--accent-blue)' : '2px solid transparent',
            color: view === 'installed' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: view === 'installed' ? 600 : 400,
            cursor: 'pointer'
          }}
        >
          Installed
        </button>
        <button 
          onClick={() => setView('marketplace')}
          style={{ 
            padding: '8px 4px', 
            background: 'none', 
            border: 'none', 
            borderBottom: view === 'marketplace' ? '2px solid var(--accent-blue)' : '2px solid transparent',
            color: view === 'marketplace' ? 'var(--text-primary)' : 'var(--text-secondary)',
            fontWeight: view === 'marketplace' ? 600 : 400,
            cursor: 'pointer'
          }}
        >
          Marketplace 🌐
        </button>
      </div>

      {view === 'installed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>Manage your installed plugins and extensions.</div>
            <Button size="sm" onClick={handleImport}>📂 Import Local Plugin</Button>
          </div>
          
          {installed.length === 0 ? (
            <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
              No plugins installed. Visit the Marketplace to find extensions.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {MOCK_MARKETPLACE.filter(p => installed.includes(p.id)).map(plugin => (
                <div key={plugin.id} style={{ padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                      <strong style={{ fontSize: '15px' }}>{plugin.name}</strong>
                      <span style={{ fontSize: '11px', background: 'var(--bg-tertiary)', padding: '2px 6px', borderRadius: '4px', color: 'var(--text-secondary)' }}>{plugin.type}</span>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: '4px' }}>{plugin.description}</div>
                  </div>
                  <Button variant="danger" size="sm" onClick={() => handleUninstall(plugin.id)}>Uninstall</Button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {view === 'marketplace' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ color: 'var(--text-secondary)', fontSize: '14px' }}>
            Discover and install community plugins. Plugins can include Skills, Commands, and MCP Servers.
          </div>
          
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
            {MOCK_MARKETPLACE.map(plugin => {
              const isInstalled = installed.includes(plugin.id)
              return (
                <div key={plugin.id} style={{ padding: '16px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                      <strong style={{ fontSize: '16px', color: 'var(--text-primary)' }}>{plugin.name}</strong>
                      <span style={{ fontSize: '11px', background: 'var(--accent-blue)', color: 'white', padding: '2px 8px', borderRadius: '10px', opacity: 0.9 }}>{plugin.type}</span>
                    </div>
                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>By {plugin.author}</div>
                  </div>
                  <div style={{ fontSize: '13px', color: 'var(--text-secondary)', flex: 1 }}>{plugin.description}</div>
                  <div>
                    {isInstalled ? (
                      <Button variant="outline" size="sm" style={{ width: '100%', opacity: 0.5 }} disabled>Installed</Button>
                    ) : (
                      <Button size="sm" style={{ width: '100%' }} onClick={() => handleInstall(plugin.id)}>⬇️ Install</Button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      )}

    </div>
  )
}
