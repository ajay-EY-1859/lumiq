// ═══════════════════════════════════════════════════════════════════
// Lumiq — Settings Page (Enterprise Dashboard v2)
// Glass navigation · Animated content transitions · Premium cards
// ═══════════════════════════════════════════════════════════════════

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
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6"/>
              </svg>
              Back
            </button>
          )}
          <span className={styles.topBarTitle}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ verticalAlign: 'middle', marginRight: '6px', opacity: 0.5 }}>
              <circle cx="12" cy="12" r="3"/>
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/>
            </svg>
            Settings
          </span>
          <div className={styles.topBarSearch}>
            <span className={styles.topBarSearchIcon}>
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
            </span>
            <input
              className={styles.topBarSearchInput}
              placeholder="Search settings…"
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
            <div style={{
              padding: '24px 12px',
              textAlign: 'center',
              color: 'var(--text-muted)',
              fontSize: '12px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '8px',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ opacity: 0.4 }}>
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              No settings found
            </div>
          )}
        </nav>

        {/* ── Content ── */}
        <main className={styles.content} key={activeTab}>
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
