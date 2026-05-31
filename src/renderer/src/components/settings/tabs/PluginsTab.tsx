import React, { useEffect, useMemo, useState } from 'react'
import type { InstalledPlugin, PluginMarketplaceItem, PluginCategory } from '@shared/types'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { showToast } from '@renderer/components/ui/Toast'

const CATEGORY_LABELS: Record<PluginCategory, string> = {
  skill: 'Skill Pack',
  command: 'Commands',
  mcp: 'MCP Server',
  bundle: 'Bundle'
}

export function PluginsTab(): React.JSX.Element {
  const [view, setView] = useState<'installed' | 'marketplace'>('marketplace')
  const [marketplace, setMarketplace] = useState<PluginMarketplaceItem[]>([])
  const [installed, setInstalled] = useState<InstalledPlugin[]>([])
  const [query, setQuery] = useState('')
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = async (): Promise<void> => {
    const [marketplaceItems, installedItems] = await Promise.all([
      window.electronAPI.plugin.marketplace(),
      window.electronAPI.plugin.installed()
    ])
    setMarketplace(marketplaceItems)
    setInstalled(installedItems)
  }

  useEffect(() => {
    load().catch((error: Error) => showToast('error', 'Plugins Failed', error.message))
  }, [])

  const filteredMarketplace = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return marketplace
    return marketplace.filter((plugin) =>
      [plugin.name, plugin.author, plugin.description, CATEGORY_LABELS[plugin.category]]
        .some((value) => value.toLowerCase().includes(q))
    )
  }, [marketplace, query])

  const handleImport = async (): Promise<void> => {
    try {
      const result = await window.electronAPI.dialog.showOpenDialog({ properties: ['openDirectory'] })
      if (result.canceled || result.filePaths.length === 0) return
      const plugin = await window.electronAPI.plugin.import(result.filePaths[0])
      showToast('success', 'Plugin Imported', `${plugin.name} was installed.`)
      await load()
      setView('installed')
    } catch (error) {
      showToast('error', 'Import Failed', (error as Error).message)
    }
  }

  const handleInstall = async (id: string): Promise<void> => {
    setBusyId(id)
    try {
      const plugin = await window.electronAPI.plugin.install(id)
      showToast('success', 'Plugin Installed', `${plugin.name} was installed.`)
      await load()
    } catch (error) {
      showToast('error', 'Install Failed', (error as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  const handleUninstall = async (id: string): Promise<void> => {
    setBusyId(id)
    try {
      await window.electronAPI.plugin.uninstall(id)
      showToast('info', 'Plugin Removed', 'The plugin resources were removed.')
      await load()
    } catch (error) {
      showToast('error', 'Uninstall Failed', (error as Error).message)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div style={{ maxWidth: '900px', display: 'flex', flexDirection: 'column', gap: '18px' }}>
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', gap: '16px' }}>
        <TabButton active={view === 'marketplace'} onClick={() => setView('marketplace')}>Marketplace</TabButton>
        <TabButton active={view === 'installed'} onClick={() => setView('installed')}>Installed</TabButton>
      </div>

      <div style={{ display: 'flex', gap: '12px', alignItems: 'center', justifyContent: 'space-between' }}>
        <Input
          placeholder="Search plugins, MCP servers, commands, skills..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          style={{ maxWidth: '420px' }}
        />
        <Button size="sm" variant="outline" onClick={handleImport}>Import Local Plugin</Button>
      </div>

      {view === 'marketplace' && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '12px' }}>
          {filteredMarketplace.map((plugin) => (
            <PluginCard
              key={plugin.id}
              title={plugin.name}
              badge={CATEGORY_LABELS[plugin.category]}
              byline={`By ${plugin.author} · v${plugin.version}`}
              description={plugin.description}
              footer={resourceSummary(plugin)}
              action={
                plugin.installed
                  ? <Button variant="outline" size="sm" disabled>Installed</Button>
                  : <Button size="sm" disabled={busyId === plugin.id} onClick={() => void handleInstall(plugin.id)}>Install</Button>
              }
            />
          ))}
          {filteredMarketplace.length === 0 && <EmptyState text="No marketplace plugins match your search." />}
        </div>
      )}

      {view === 'installed' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {installed.length === 0 ? (
            <EmptyState text="No plugins installed. Install one from Marketplace or import a local plugin folder." />
          ) : (
            installed.map((plugin) => (
              <PluginCard
                key={plugin.id}
                title={plugin.name}
                badge={CATEGORY_LABELS[plugin.category]}
                byline={`${plugin.source === 'local' ? 'Local plugin' : 'Marketplace'} · v${plugin.version}`}
                description={plugin.description}
                footer={`${plugin.resources.length} resource${plugin.resources.length === 1 ? '' : 's'} installed`}
                action={
                  <Button
                    variant="danger"
                    size="sm"
                    disabled={busyId === plugin.id}
                    onClick={() => void handleUninstall(plugin.id)}
                  >
                    Uninstall
                  </Button>
                }
              />
            ))
          )}
        </div>
      )}
    </div>
  )
}

function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }): React.JSX.Element {
  return (
    <button
      type="button"
      onClick={props.onClick}
      style={{
        padding: '8px 2px',
        background: 'none',
        border: 'none',
        borderBottom: props.active ? '2px solid var(--accent-blue)' : '2px solid transparent',
        color: props.active ? 'var(--text-primary)' : 'var(--text-secondary)',
        fontWeight: props.active ? 700 : 500,
        cursor: 'pointer'
      }}
    >
      {props.children}
    </button>
  )
}

function PluginCard(props: {
  title: string
  badge: string
  byline: string
  description: string
  footer: string
  action: React.ReactNode
}): React.JSX.Element {
  return (
    <div style={{ padding: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '8px', display: 'flex', flexDirection: 'column', gap: '10px', minHeight: '170px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'flex-start' }}>
        <div>
          <div style={{ fontSize: '15px', fontWeight: 700, color: 'var(--text-primary)' }}>{props.title}</div>
          <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '3px' }}>{props.byline}</div>
        </div>
        <span style={{ fontSize: '11px', color: 'var(--text-secondary)', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '4px', padding: '2px 6px', whiteSpace: 'nowrap' }}>{props.badge}</span>
      </div>
      <div style={{ fontSize: '13px', color: 'var(--text-secondary)', lineHeight: 1.45, flex: 1 }}>{props.description}</div>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center' }}>
        <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>{props.footer}</span>
        {props.action}
      </div>
    </div>
  )
}

function EmptyState(props: { text: string }): React.JSX.Element {
  return (
    <div style={{ padding: '34px', textAlign: 'center', color: 'var(--text-muted)', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px dashed var(--border)' }}>
      {props.text}
    </div>
  )
}

function resourceSummary(plugin: PluginMarketplaceItem): string {
  const resources = [
    plugin.resources.skills?.length ? `${plugin.resources.skills.length} skill${plugin.resources.skills.length === 1 ? '' : 's'}` : '',
    plugin.resources.commands?.length ? `${plugin.resources.commands.length} command${plugin.resources.commands.length === 1 ? '' : 's'}` : '',
    plugin.resources.mcpServers?.length ? `${plugin.resources.mcpServers.length} MCP server${plugin.resources.mcpServers.length === 1 ? '' : 's'}` : ''
  ].filter(Boolean)
  return resources.join(' · ')
}
