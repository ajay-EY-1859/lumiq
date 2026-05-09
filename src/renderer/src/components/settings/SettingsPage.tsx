// Lumiq — Settings Page
import React, { useState, useEffect } from 'react'
import { useSettingsStore } from '@renderer/store/settingsStore'
import { useProviderStore } from '@renderer/store/providerStore'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { showToast } from '@renderer/components/ui/Toast'
import type { ProviderConfig, ProviderType, ThemeMode, FontSize, ToolPermission } from '@shared/types'
import { PROVIDER_MODELS, PROVIDER_CONSOLE_URLS } from '@shared/types'

type SettingsTab = 'providers' | 'appearance' | 'tools' | 'shortcuts'

interface SettingsPageProps {
  onNavigate?: (page: 'chat' | 'settings' | 'agents') => void
}

export function SettingsPage({ onNavigate }: SettingsPageProps): React.JSX.Element {
  const [activeTab, setActiveTab] = useState<SettingsTab>('providers')
  const tabs: { id: SettingsTab; label: string; emoji: string }[] = [
    { id: 'providers', label: 'API Providers', emoji: '🔑' },
    { id: 'appearance', label: 'Appearance', emoji: '🎨' },
    { id: 'tools', label: 'Tools', emoji: '🔧' },
    { id: 'shortcuts', label: 'Shortcuts', emoji: '⌨️' }
  ]

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 0', borderBottom: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
          {onNavigate && (
            <button id="btn-settings-back" onClick={() => onNavigate('chat')} title="Back to Chat" aria-label="Back to Chat"
              style={{ background: 'none', border: '1px solid var(--border)', cursor: 'pointer', fontSize: '14px', color: 'var(--text-secondary)', display: 'flex', alignItems: 'center', gap: '6px', padding: '6px 12px', borderRadius: '8px', fontFamily: 'var(--font-sans)', fontWeight: 500, transition: 'all var(--transition-fast)' }}
              onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--accent-blue)'; e.currentTarget.style.borderColor = 'var(--accent-blue)' }}
              onMouseLeave={(e) => { e.currentTarget.style.background = 'none'; e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.borderColor = 'var(--border)' }}
            >← Back</button>
          )}
          <h1 style={{ fontSize: '20px', fontWeight: 700 }}>⚙️ Settings</h1>
        </div>
        <div style={{ display: 'flex', gap: '0' }}>
          {tabs.map((tab) => (
            <button key={tab.id} onClick={() => setActiveTab(tab.id)} title={tab.label} style={{
              padding: '8px 16px', background: 'none', border: 'none',
              borderBottom: `2px solid ${activeTab === tab.id ? 'var(--accent-blue)' : 'transparent'}`,
              color: activeTab === tab.id ? 'var(--accent-blue)' : 'var(--text-secondary)',
              fontSize: '13px', fontWeight: 500, cursor: 'pointer', display: 'flex',
              alignItems: 'center', gap: '6px', fontFamily: 'var(--font-sans)'
            }}>
              <span>{tab.emoji}</span>{tab.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{ flex: 1, overflow: 'auto', padding: '24px' }}>
        {activeTab === 'providers' && <ProvidersTab />}
        {activeTab === 'appearance' && <AppearanceTab />}
        {activeTab === 'tools' && <ToolsTab />}
        {activeTab === 'shortcuts' && <ShortcutsTab />}
      </div>
    </div>
  )
}

// ── Providers Tab ──────────────────────────────────────────────────

function ProvidersTab(): React.JSX.Element {
  const { providers, loadProviders, saveProvider, deleteProvider, testProvider } = useProviderStore()
  const [testing, setTesting] = useState<string | null>(null)
  useEffect(() => { loadProviders() }, [loadProviders])

  const providerInfo: { id: ProviderType; name: string; emoji: string; needsKey: boolean }[] = [
    { id: 'anthropic', name: 'Anthropic', emoji: '🟣', needsKey: true },
    { id: 'openai', name: 'OpenAI', emoji: '🟢', needsKey: true },
    { id: 'gemini', name: 'Google Gemini', emoji: '🔵', needsKey: true },
    { id: 'ollama', name: 'Ollama (Local)', emoji: '🦙', needsKey: false },
    { id: 'deepseek', name: 'DeepSeek', emoji: '🔮', needsKey: true },
    { id: 'bedrock', name: 'AWS Bedrock', emoji: '🟠', needsKey: true },
    { id: 'custom', name: 'Custom', emoji: '⚡', needsKey: true }
  ]

  const handleTest = async (pid: string): Promise<void> => {
    setTesting(pid)
    const r = await testProvider(pid)
    setTesting(null)
    r.success ? showToast('success', 'Connected!', `${pid} working.`) : showToast('error', 'Failed', r.error)
  }

  const handleDelete = async (pid: string): Promise<void> => {
    if (!confirm(`Delete the ${pid} API key? This cannot be undone.`)) return
    await deleteProvider(pid)
    showToast('info', 'API Key Deleted', `${pid} configuration removed.`)
  }

  const openConsole = (pid: ProviderType): void => {
    const info = PROVIDER_CONSOLE_URLS[pid]
    if (info) window.electronAPI.shell.openExternal(info.url)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', maxWidth: '600px' }}>
      <span style={{ fontSize: '14px', color: 'var(--text-muted)' }}>
        Configure your AI provider API keys below. Keys are stored securely on your machine.
      </span>
      {providerInfo.map((info) => (
        <ProviderCard key={info.id} info={info}
          existing={providers.find((p) => p.provider === info.id)}
          onSave={saveProvider} onTest={() => handleTest(info.id)}
          onDelete={() => handleDelete(info.id)} onOpenConsole={() => openConsole(info.id)}
          isTesting={testing === info.id} />
      ))}
    </div>
  )
}

// ── Provider Card ──────────────────────────────────────────────────

function ProviderCard({ info, existing, onSave, onTest, onDelete, onOpenConsole, isTesting }: {
  info: { id: ProviderType; name: string; emoji: string; needsKey: boolean }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existing?: any
  onSave: (config: Omit<ProviderConfig, 'id'> & Partial<Pick<ProviderConfig, 'id'>>) => Promise<void>
  onTest: () => void
  onDelete: () => void
  onOpenConsole: () => void
  isTesting: boolean
}): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl || '')
  const [defaultModel, setDefaultModel] = useState(existing?.defaultModel || PROVIDER_MODELS[info.id]?.[0]?.id || '')
  const [isEditing, setIsEditing] = useState(false)
  const [showKey, setShowKey] = useState(false)
  const isConfigured = existing?.hasApiKey && !isEditing
  const consoleUrl = PROVIDER_CONSOLE_URLS[info.id]
  const isGemini = info.id === 'gemini'

  return (
    <div style={{ padding: '16px', background: 'var(--bg-secondary)', border: `1px solid ${isConfigured ? 'rgba(22,163,74,0.3)' : 'var(--border)'}`, borderRadius: '12px', transition: 'border-color var(--transition-fast)' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '12px' }}>
        <span style={{ fontSize: '20px' }}>{info.emoji}</span>
        <span style={{ fontWeight: 600, fontSize: '14px' }}>{info.name}</span>
        {existing?.hasApiKey && <span style={{ fontSize: '10px', padding: '2px 8px', background: 'rgba(22,163,74,0.1)', color: 'var(--accent-green)', borderRadius: '10px', fontWeight: 600 }}>● Configured</span>}
      </div>

      {/* Google Sign-In Section (Gemini only) */}
      {isGemini && <GeminiOAuthSection />}

      {/* Configured State */}
      {isConfigured && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '8px 12px', background: 'var(--bg-tertiary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
            <span style={{ fontSize: '13px', fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)', flex: 1 }}>
              {showKey ? 'sk-••••••••••••••••••••••' : '••••••••••••••••••••'}
            </span>
            <button onClick={() => setShowKey(!showKey)} title={showKey ? 'Hide' : 'Show (masked)'} style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '14px', padding: '2px 6px', borderRadius: '4px' }}
              onMouseEnter={(e) => { e.currentTarget.style.color = 'var(--text-primary)' }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'var(--text-muted)' }}>
              {showKey ? '🙈' : '👁️'}
            </button>
          </div>
          <ModelSelector providerId={info.id} value={defaultModel} onChange={(v) => { setDefaultModel(v); onSave({ provider: info.id, defaultModel: v, isActive: true }) }} />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <Button variant="outline" size="sm" onClick={onTest} isLoading={isTesting} title="Test connection">🔗 Test</Button>
            <Button variant="outline" size="sm" onClick={() => setIsEditing(true)} title="Edit API key">✏️ Edit Key</Button>
            <Button variant="danger" size="sm" onClick={onDelete} title="Delete API key">🗑️ Delete</Button>
          </div>
        </div>
      )}

      {/* Edit / New Key State */}
      {!isConfigured && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
          {info.needsKey && <Input label="API Key" type="password" placeholder={existing?.hasApiKey ? 'Enter new key to update...' : 'Enter API key...'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />}
          {(info.id === 'ollama' || info.id === 'custom') && <Input label="Base URL" placeholder="http://localhost:11434" value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />}
          <ModelSelector providerId={info.id} value={defaultModel} onChange={setDefaultModel} />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            {isEditing && <Button variant="ghost" size="sm" onClick={() => { setIsEditing(false); setApiKey('') }}>Cancel</Button>}
            {consoleUrl && <Button variant="outline" size="sm" onClick={onOpenConsole} title={`Open ${consoleUrl.label}`}>🌐 Get API Key</Button>}
            <Button variant="outline" size="sm" onClick={onTest} isLoading={isTesting} title="Test">🔗 Test</Button>
            <Button size="sm" onClick={async () => { await onSave({ provider: info.id, apiKey: apiKey || undefined, baseUrl: baseUrl || undefined, defaultModel, isActive: true, authMethod: 'apikey' }); setApiKey(''); setIsEditing(false); showToast('success', 'Saved', `${info.name} saved.`) }} title="Save">💾 Save</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Model Selector ──────────────────────────────────────────────────

function ModelSelector({ providerId, value, onChange }: { providerId: ProviderType; value: string; onChange: (v: string) => void }): React.JSX.Element {
  return (
    <div>
      <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', marginBottom: '4px', display: 'block' }}>Default Model</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
        {PROVIDER_MODELS[providerId]?.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
      </select>
    </div>
  )
}

// ── Google OAuth Section (Gemini only) ─────────────────────────────

function GeminiOAuthSection(): React.JSX.Element {
  const [oauthStatus, setOauthStatus] = useState<{ isLoggedIn: boolean; email?: string }>({ isLoggedIn: false })
  const [setupStatus, setSetupStatus] = useState<{ isConfigured: boolean }>({ isConfigured: false })
  const [showSetup, setShowSetup] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  useEffect(() => {
    window.electronAPI.auth.googleStatus().then(setOauthStatus)
    window.electronAPI.auth.googleGetSetup().then(setSetupStatus)
  }, [])

  const handleGoogleLogin = async (): Promise<void> => {
    setIsLoggingIn(true)
    try {
      const result = await window.electronAPI.auth.googleLogin()
      setOauthStatus(result)
      if (result.isLoggedIn) {
        showToast('success', 'Signed In!', `Logged in as ${result.email}`)
      } else if ((result as { error?: string }).error) {
        showToast('error', 'Login Failed', (result as { error?: string }).error)
      }
    } catch {
      showToast('error', 'Login Failed', 'Could not sign in with Google')
    }
    setIsLoggingIn(false)
  }

  const handleGoogleLogout = async (): Promise<void> => {
    await window.electronAPI.auth.googleLogout()
    setOauthStatus({ isLoggedIn: false })
    showToast('info', 'Signed Out', 'Google account disconnected')
  }

  const handleSaveSetup = async (): Promise<void> => {
    if (!clientId.trim() || !clientSecret.trim()) {
      showToast('error', 'Required', 'Both Client ID and Client Secret are required'); return
    }
    await window.electronAPI.auth.googleSetup({ clientId: clientId.trim(), clientSecret: clientSecret.trim() })
    setSetupStatus({ isConfigured: true })
    setShowSetup(false)
    setClientId(''); setClientSecret('')
    showToast('success', 'OAuth Configured', 'You can now Sign in with Google!')
  }

  return (
    <div style={{ marginBottom: '12px', padding: '12px', background: 'rgba(37,99,235,0.05)', border: '1px solid rgba(37,99,235,0.2)', borderRadius: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '8px' }}>
        <span style={{ fontSize: '14px', fontWeight: 600 }}>🔐 Google Sign-In (OAuth)</span>
        <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(37,99,235,0.15)', color: 'var(--accent-blue)', borderRadius: '6px', fontWeight: 500 }}>Optional</span>
      </div>
      <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: '0 0 10px 0' }}>
        Sign in with Google instead of using an API key. Requires a Google Cloud OAuth Client ID.
      </p>

      {/* Logged In State */}
      {oauthStatus.isLoggedIn && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '12px', color: 'var(--accent-green)', fontWeight: 500 }}>✓ Signed in as {oauthStatus.email}</span>
          <Button variant="outline" size="sm" onClick={handleGoogleLogout} style={{ marginLeft: 'auto' }}>Sign Out</Button>
        </div>
      )}

      {/* Not Logged In */}
      {!oauthStatus.isLoggedIn && setupStatus.isConfigured && (
        <Button size="sm" onClick={handleGoogleLogin} isLoading={isLoggingIn}>
          <span style={{ fontSize: '14px' }}>G</span> Sign in with Google
        </Button>
      )}

      {/* Setup Required */}
      {!oauthStatus.isLoggedIn && !setupStatus.isConfigured && !showSetup && (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <Button variant="outline" size="sm" onClick={() => setShowSetup(true)}>⚙️ Setup OAuth</Button>
          <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>One-time setup required</span>
        </div>
      )}

      {/* Setup Form */}
      {showSetup && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '8px', background: 'var(--bg-tertiary)', borderRadius: '6px' }}>
            <strong>How to get OAuth credentials:</strong><br />
            1. Go to <button onClick={() => window.electronAPI.shell.openExternal('https://console.cloud.google.com/apis/credentials')} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline', fontSize: '11px', padding: 0, fontFamily: 'inherit' }}>Google Cloud Console → Credentials</button><br />
            2. Create OAuth Client ID (Desktop App type)<br />
            3. Copy the Client ID and Client Secret below
          </div>
          <Input label="Client ID" placeholder="xxx.apps.googleusercontent.com" value={clientId} onChange={(e) => setClientId(e.target.value)} />
          <Input label="Client Secret" type="password" placeholder="GOCSPX-xxx" value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={() => setShowSetup(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveSetup}>Save OAuth Config</Button>
          </div>
        </div>
      )}
    </div>
  )
}

// ── Appearance Tab ──────────────────────────────────────────────────

function AppearanceTab(): React.JSX.Element {
  const { settings, setTheme, setFontSize } = useSettingsStore()
  const themes: { id: ThemeMode; label: string; emoji: string }[] = [
    { id: 'light', label: 'Light', emoji: '☀️' }, { id: 'dark', label: 'Dark', emoji: '🌙' }, { id: 'system', label: 'System', emoji: '💻' }
  ]
  return (
    <div style={{ maxWidth: '400px', display: 'flex', flexDirection: 'column', gap: '24px' }}>
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Theme</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {themes.map((t) => (
            <button key={t.id} onClick={() => setTheme(t.id)} title={`Switch to ${t.label} theme`} style={{
              flex: 1, padding: '12px', background: settings.theme === t.id ? 'rgba(37,99,235,0.1)' : 'var(--bg-secondary)',
              border: `2px solid ${settings.theme === t.id ? 'var(--accent-blue)' : 'var(--border)'}`,
              borderRadius: '10px', cursor: 'pointer', textAlign: 'center', fontFamily: 'var(--font-sans)'
            }}>
              <div style={{ fontSize: '20px', marginBottom: '4px' }}>{t.emoji}</div>
              <div style={{ fontSize: '12px', fontWeight: 500, color: 'var(--text-primary)' }}>{t.label}</div>
            </button>
          ))}
        </div>
      </div>
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 600, marginBottom: '10px' }}>Font Size</h3>
        <div style={{ display: 'flex', gap: '8px' }}>
          {(['12', '14', '16'] as FontSize[]).map((s) => (
            <button key={s} onClick={() => setFontSize(s)} title={`Set font size to ${s}px`} style={{
              padding: '8px 20px', background: settings.fontSize === s ? 'var(--accent-blue)' : 'var(--bg-secondary)',
              color: settings.fontSize === s ? 'white' : 'var(--text-primary)',
              border: `1px solid ${settings.fontSize === s ? 'var(--accent-blue)' : 'var(--border)'}`,
              borderRadius: '8px', cursor: 'pointer', fontSize: `${s}px`, fontFamily: 'var(--font-sans)', fontWeight: 500
            }}>{s}px</button>
          ))}
        </div>
      </div>
    </div>
  )
}

// ── Tools Tab ──────────────────────────────────────────────────────

function ToolsTab(): React.JSX.Element {
  const { toolSettings, loadToolSettings, updateToolSettings } = useSettingsStore()
  useEffect(() => { loadToolSettings() }, [loadToolSettings])
  const toggle = (name: string): void => { updateToolSettings(toolSettings.map((t) => t.name === name ? { ...t, enabled: !t.enabled } : t)) }
  const setPerm = (name: string, p: string): void => { updateToolSettings(toolSettings.map((t) => t.name === name ? { ...t, permission: p as ToolPermission } : t)) }
  return (
    <div style={{ maxWidth: '600px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      {toolSettings.map((tool) => (
        <div key={tool.name} style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 12px', background: 'var(--bg-secondary)', borderRadius: '8px', border: '1px solid var(--border)' }}>
          <button onClick={() => toggle(tool.name)} title={tool.enabled ? `Disable ${tool.name}` : `Enable ${tool.name}`} style={{ width: '36px', height: '20px', borderRadius: '10px', background: tool.enabled ? 'var(--accent-blue)' : 'var(--bg-tertiary)', border: 'none', cursor: 'pointer', position: 'relative' }}>
            <div style={{ width: '16px', height: '16px', borderRadius: '50%', background: 'white', position: 'absolute', top: '2px', left: tool.enabled ? '18px' : '2px', transition: 'left var(--transition-fast)', boxShadow: '0 1px 2px rgba(0,0,0,0.2)' }} />
          </button>
          <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, fontFamily: 'var(--font-mono)' }}>{tool.name}</span>
          <select value={tool.permission} onChange={(e) => setPerm(tool.name, e.target.value)} title={`Permission for ${tool.name}`} style={{ padding: '4px 8px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '6px', fontSize: '11px', color: 'var(--text-secondary)', fontFamily: 'var(--font-sans)' }}>
            <option value="always-ask">Always Ask</option><option value="always-allow">Always Allow</option><option value="always-deny">Always Deny</option>
          </select>
        </div>
      ))}
    </div>
  )
}

// ── Shortcuts Tab ──────────────────────────────────────────────────

function ShortcutsTab(): React.JSX.Element {
  const shortcuts = [
    { keys: 'Ctrl+N', action: 'New session' }, { keys: 'Enter', action: 'Send message' },
    { keys: 'Shift+Enter', action: 'New line' }, { keys: 'Ctrl+B', action: 'Toggle sidebar' },
    { keys: 'Ctrl+,', action: 'Settings' }, { keys: 'Escape', action: 'Cancel / close' }, { keys: 'Ctrl+Q', action: 'Quit' }
  ]
  return (
    <div style={{ maxWidth: '400px' }}>
      {shortcuts.map((s) => (
        <div key={s.keys} style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0', borderBottom: '1px solid var(--border)' }}>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>{s.action}</span>
          <kbd style={{ background: 'var(--bg-tertiary)', padding: '2px 8px', borderRadius: '4px', fontSize: '12px', fontFamily: 'var(--font-mono)', border: '1px solid var(--border)' }}>{s.keys}</kbd>
        </div>
      ))}
    </div>
  )
}
