// Lumiq — Settings Page (Modern Redesign)
// Left sidebar navigation + content panel layout
import React, { useState, useMemo } from 'react'
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
import { AnalyticsTab } from './tabs/AnalyticsTab'
import styles from './SettingsPage.module.css'

type SettingsTab =
  | 'providers'
  | 'appearance'
  | 'tools'
  | 'permissions'
  | 'mcp'
  | 'routing'
  | 'skills'
  | 'commands'
  | 'plugins'
  | 'developer'
  | 'shortcuts'
  | 'analytics'

interface NavGroup {
  label: string
  items: NavItem[]
}

interface NavItem {
  id: SettingsTab
  label: string
  icon: string
  subtitle: string
  keywords: string[]
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: 'AI & Models',
    items: [
      {
        id: 'providers',
        label: 'API Providers',
        icon: '🔑',
        subtitle: 'Connect AI model providers',
        keywords: ['api', 'key', 'anthropic', 'openai', 'gemini', 'ollama', 'bedrock', 'groq', 'nvidia', 'model', 'provider']
      },
      {
        id: 'routing',
        label: 'Agent Routing',
        icon: '🧭',
        subtitle: 'Route tasks to specific models',
        keywords: ['route', 'routing', 'task', 'model', 'agent']
      },
      {
        id: 'analytics',
        label: 'Analytics & Costs',
        icon: '📊',
        subtitle: 'Token usage and budget caps',
        keywords: ['cost', 'token', 'budget', 'analytics', 'spending', 'trace']
      }
    ]
  },
  {
    label: 'Extensions',
    items: [
      {
        id: 'mcp',
        label: 'MCP Servers',
        icon: '🧩',
        subtitle: 'Model Context Protocol servers',
        keywords: ['mcp', 'server', 'protocol', 'tool', 'extension']
      },
      {
        id: 'skills',
        label: 'Skills',
        icon: '📘',
        subtitle: 'Custom prompt skills',
        keywords: ['skill', 'prompt', 'template', 'custom']
      },
      {
        id: 'commands',
        label: 'Commands',
        icon: '⚡',
        subtitle: 'Shell and prompt commands',
        keywords: ['command', 'shell', 'script', 'prompt']
      },
      {
        id: 'plugins',
        label: 'Plugins',
        icon: '📦',
        subtitle: 'Install plugin bundles',
        keywords: ['plugin', 'marketplace', 'install', 'bundle']
      }
    ]
  },
  {
    label: 'Security',
    items: [
      {
        id: 'permissions',
        label: 'Permissions',
        icon: '🛡️',
        subtitle: 'Tool access and security modes',
        keywords: ['permission', 'security', 'allow', 'deny', 'tool', 'access']
      },
      {
        id: 'tools',
        label: 'Tools',
        icon: '🔧',
        subtitle: 'Enable or disable agent tools',
        keywords: ['tool', 'enable', 'disable', 'agent']
      }
    ]
  },
  {
    label: 'Preferences',
    items: [
      {
        id: 'appearance',
        label: 'Appearance',
        icon: '🎨',
        subtitle: 'Theme and font size',
        keywords: ['theme', 'dark', 'light', 'font', 'appearance', 'color']
      },
      {
        id: 'shortcuts',
        label: 'Shortcuts',
        icon: '⌨️',
        subtitle: 'Keyboard shortcuts reference',
        keywords: ['shortcut', 'keyboard', 'hotkey', 'keybinding']
      }
    ]
  },
  {
    label: 'Advanced',
    items: [
      {
        id: 'developer',
        label: 'Developer',
        icon: '🖥️',
        subtitle: 'gRPC server and dev settings',
        keywords: ['developer', 'grpc', 'server', 'firecrawl', 'context', 'port']
      }
    ]
  }
]

// Flat list for search
const ALL_ITEMS: NavItem[] = NAV_GROUPS.flatMap((g) => g.items)

interface SettingsPageProps {
  onNavigate?: (page: 'chat' | 'settings' | 'agents') => void
}

export function SettingsPage({ onNavigate }: SettingsPageProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers')
  const [searchQuery, setSearchQuery] = useState('')

  // Filter nav items based on search
  const filteredGroups = useMemo(() => {
    if (!searchQuery.trim()) return NAV_GROUPS
    const q = searchQuery.toLowerCase()
    return NAV_GROUPS.map((group) => ({
      ...group,
      items: group.items.filter(
        (item) =>
          item.label.toLowerCase().includes(q) ||
          item.subtitle.toLowerCase().includes(q) ||
          item.keywords.some((k) => k.includes(q))
      )
    })).filter((group) => group.items.length > 0)
  }, [searchQuery])

  const activeItem = ALL_ITEMS.find((i) => i.id === activeTab)

  return (
    <div className={styles.container}>
      {/* ── Top Bar ── */}
      <div className={styles.topBar}>
        <div className={styles.topBarInner}>
          {onNavigate && (
            <button
              id="btn-settings-back"
              onClick={() => onNavigate('chat')}
              title="Back to Chat"
              aria-label="Back to Chat"
              className={styles.backButton}
            >
              ← Back
            </button>
          )}
          <span className={styles.topBarTitle}>Settings</span>
          <div className={styles.topBarSearch}>
            <span className={styles.topBarSearchIcon}>⌕</span>
            <input
              className={styles.topBarSearchInput}
              placeholder="Search settings..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              aria-label="Search settings"
            />
          </div>
        </div>
      </div>

      {/* ── Body ── */}
      <div className={styles.body}>
        {/* ── Sidebar ── */}
        <nav className={styles.sidebar} aria-label="Settings navigation">
          {filteredGroups.map((group) => (
            <div key={group.label} className={styles.sidebarGroup}>
              <div className={styles.sidebarGroupLabel}>{group.label}</div>
              {group.items.map((item) => (
                <button
                  key={item.id}
                  className={`${styles.navItem} ${activeTab === item.id ? styles.navItemActive : ''}`}
                  onClick={() => {
                    setActiveTab(item.id)
                    setSearchQuery('')
                  }}
                  title={item.subtitle}
                  aria-current={activeTab === item.id ? 'page' : undefined}
                >
                  <span className={styles.navItemIcon}>{item.icon}</span>
                  <span className={styles.navItemLabel}>{item.label}</span>
                </button>
              ))}
            </div>
          ))}
          {filteredGroups.length === 0 && (
            <div style={{ padding: '20px 10px', textAlign: 'center', color: 'var(--text-muted)', fontSize: '12px' }}>
              No settings found
            </div>
          )}
        </nav>

        {/* ── Content ── */}
        <main className={styles.content}>
          {activeItem && (
            <div className={styles.contentHeader}>
              <h1 className={styles.contentTitle}>
                <span className={styles.contentTitleIcon}>{activeItem.icon}</span>
                {activeItem.label}
              </h1>
              <p className={styles.contentSubtitle}>{activeItem.subtitle}</p>
            </div>
          )}

          {activeTab === 'providers' && <ProvidersTab />}
          {activeTab === 'appearance' && <AppearanceTab />}
          {activeTab === 'tools' && <ToolsTab />}
          {activeTab === 'permissions' && <PermissionsTab />}
          {activeTab === 'mcp' && <McpServersTab />}
          {activeTab === 'routing' && <RoutingTab />}
          {activeTab === 'skills' && <SkillsTab />}
          {activeTab === 'commands' && <CommandsTab />}
          {activeTab === 'plugins' && <PluginsTab />}
          {activeTab === 'developer' && <DeveloperServerTab />}
          {activeTab === 'shortcuts' && <ShortcutsTab />}
          {activeTab === 'analytics' && <AnalyticsTab />}
        </main>
      </div>
    </div>
  )
}
