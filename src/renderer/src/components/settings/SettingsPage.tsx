// Lumiq — Settings Page (Shell)
// All tabs are split into separate components under ./tabs/
import React, { useState } from 'react'
import { ProvidersTab } from './tabs/ProvidersTab'
import { AppearanceTab } from './tabs/AppearanceTab'
import { ToolsTab } from './tabs/ToolsTab'
import { PermissionsTab } from './tabs/PermissionsTab'
import { McpServersTab } from './tabs/McpServersTab'
import { RoutingTab } from './tabs/RoutingTab'
import { SkillsTab } from './tabs/SkillsTab'
import { DeveloperServerTab } from './tabs/DeveloperServerTab'
import { ShortcutsTab } from './tabs/ShortcutsTab'
import { CommandsTab } from './tabs/CommandsTab'
import { PluginsTab } from './tabs/PluginsTab'
import styles from './SettingsPage.module.css'
import { AnalyticsTab } from './tabs/AnalyticsTab'

type SettingsTab = 'providers' | 'appearance' | 'tools' | 'permissions' | 'mcp' | 'routing' | 'skills' | 'commands' | 'plugins' | 'developer' | 'shortcuts' | 'analytics'

interface SettingsPageProps {
  onNavigate?: (page: 'chat' | 'settings' | 'agents') => void
}

export function SettingsPage({ onNavigate }: SettingsPageProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers')
  const tabs: { id: SettingsTab; label: string; emoji: string }[] = [
    { id: 'providers', label: 'API Providers', emoji: '🔑' },
    { id: 'appearance', label: 'Appearance', emoji: '🎨' },
    { id: 'tools', label: 'Tools', emoji: '🔧' },
    { id: 'permissions', label: 'Permissions', emoji: '🛡️' },
    { id: 'mcp', label: 'MCP Servers', emoji: '🧩' },
    { id: 'routing', label: 'Agent Routing', emoji: '🧭' },
    { id: 'skills', label: 'Skills', emoji: '📘' },
    { id: 'commands', label: 'Commands', emoji: '⚡' },
    { id: 'plugins', label: 'Plugins', emoji: '📦' },
    { id: 'developer', label: 'Developer Server', emoji: '🖥️' },
    { id: 'shortcuts', label: 'Shortcuts', emoji: '⌨️' },
    { id: 'analytics', label: 'Analytics & Costs', emoji: '📊' }
  ]

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <div className={styles.headerTop}>
          {onNavigate && (
            <button id="btn-settings-back" onClick={() => onNavigate('chat')} title="Back to Chat" aria-label="Back to Chat"
              className={styles.backButton}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'var(--accent-blue)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >← Back</button>
          )}
          <h1 className={styles.title}>⚙️ Settings</h1>
        </div>
        <div className={styles.tabContainer}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} title={tab.label} className={`${styles.tab} ${activeTab === tab.id ? styles.active : ''}`}>
              <span>{tab.emoji}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>
      <div className={styles.content}>
        {activeTab === 'providers' && <ProvidersTab />}
        {activeTab === 'appearance' && <AppearanceTab />}
        {activeTab === 'tools' && <ToolsTab />}
        {activeTab === 'permissions' && <PermissionsTab />}
        {activeTab === 'mcp' && <McpServersTab />}
        { activeTab === 'routing' && <RoutingTab /> }
        { activeTab === 'skills' && <SkillsTab /> }
        { activeTab === 'commands' && <CommandsTab /> }
        { activeTab === 'plugins' && <PluginsTab /> }
        { activeTab === 'developer' && <DeveloperServerTab /> }
        {activeTab === 'shortcuts' && <ShortcutsTab />}
        {activeTab === 'analytics' && <AnalyticsTab />}
      </div>
    </div>
  )
}
