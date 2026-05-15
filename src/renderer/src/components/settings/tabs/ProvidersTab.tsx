// Lumiq — Settings: Providers Tab
// Contains: ProvidersTab, ProviderSetupPanel, ModelSelector, ConnectedAccountsSection, OAuthAccountCard
import React, { useState, useEffect } from 'react'
import { useProviderStore } from '@renderer/store/providerStore'
import { Button } from '@renderer/components/ui/Button'
import { Input } from '@renderer/components/ui/Input'
import { showToast } from '@renderer/components/ui/Toast'
import type { ProviderConfig, ProviderType } from '@shared/types'
import { PROVIDER_MODELS, PROVIDER_CONSOLE_URLS } from '@shared/types'
import styles from '../SettingsPage.module.css'

const PROVIDER_INFO: { id: ProviderType; name: string; emoji: string; needsKey: boolean }[] = [
  { id: 'anthropic', name: 'Anthropic', emoji: '🟣', needsKey: true },
  { id: 'openai', name: 'OpenAI', emoji: '🟢', needsKey: true },
  { id: 'gemini', name: 'Google Gemini', emoji: '🔵', needsKey: true },
  { id: 'ollama', name: 'Ollama (Local)', emoji: '🦙', needsKey: false },
  { id: 'deepseek', name: 'DeepSeek', emoji: '🔮', needsKey: true },
  { id: 'bedrock', name: 'AWS Bedrock', emoji: '🟠', needsKey: true },
  { id: 'github', name: 'GitHub Models', emoji: '⚫', needsKey: true },
  { id: 'openrouter', name: 'OpenRouter', emoji: '🌐', needsKey: true },
  { id: 'groq', name: 'Groq', emoji: '⚡', needsKey: true },
  { id: 'custom', name: 'Custom', emoji: '🔌', needsKey: true }
]

// ── OAuth Types ──
type OAuthSetupStatus = { isConfigured: boolean; clientId?: string | null }
type OAuthStatusState = { isLoggedIn: boolean; email?: string; expiresAt?: number; error?: string }

// ── Main Providers Tab ──
export function ProvidersTab(): React.JSX.Element {
  const { providers, loadProviders, saveProvider, deleteProvider, testProvider } = useProviderStore()
  const [testing, setTesting] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<ProviderType | null>(null)
  useEffect(() => { loadProviders() }, [loadProviders])

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const configuredProviders = PROVIDER_INFO.filter((info) => { const existing = providers.find((p) => p.provider === info.id) as any; return info.id === 'bedrock' ? existing?.hasAwsKeys : existing?.hasApiKey })
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unconfiguredProviders = PROVIDER_INFO.filter((info) => { const existing = providers.find((p) => p.provider === info.id) as any; const hasCredentials = info.id === 'bedrock' ? existing?.hasAwsKeys : existing?.hasApiKey; return !hasCredentials })

  const handleTest = async (pid: string): Promise<void> => { setTesting(pid); const r = await testProvider(pid); setTesting(null); r.success ? showToast('success', 'Connected!', `${pid} working.`) : showToast('error', 'Failed', r.error) }
  const handleDelete = async (pid: string): Promise<void> => { if (!confirm(`Delete the ${pid} API key? This cannot be undone.`)) return; await deleteProvider(pid); if (selectedProvider === pid) setSelectedProvider(null); showToast('info', 'API Key Deleted', `${pid} configuration removed.`) }
  const handleSaveComplete = (): void => { setSelectedProvider(null) }

  const activeInfo = selectedProvider ? PROVIDER_INFO.find((p) => p.id === selectedProvider) : null
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const activeExisting = selectedProvider ? providers.find((p) => p.provider === selectedProvider) as any : null

  return (
    <div className={styles.pickerSection}>
      <ConnectedAccountsSection onProviderChanged={loadProviders} />
      <div>
        <div className={styles.pickerSectionTitle}>Your Providers</div>
        {configuredProviders.length === 0 ? (
          <div className={styles.noConfiguredNote}>No providers configured yet. Pick one below to get started.</div>
        ) : (
          <div className={styles.configuredList}>
            {configuredProviders.map((info) => {
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const existing = providers.find((p) => p.provider === info.id) as any
              const isActive = selectedProvider === info.id
              return (
                <div key={info.id} className={`${styles.configuredRow} ${isActive ? styles.configuredRowActive : ''}`} onClick={() => setSelectedProvider(isActive ? null : info.id)} role="button" tabIndex={0} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') setSelectedProvider(isActive ? null : info.id) }}>
                  <span className={styles.configuredRowEmoji}>{info.emoji}</span>
                  <div className={styles.configuredRowInfo}><div className={styles.configuredRowName}>{info.name}</div><div className={styles.configuredRowModel}>{existing?.defaultModel || 'default'}</div></div>
                  <span className={styles.configuredRowBadge}>Active</span>
                  <span className={styles.configuredRowChevron}>›</span>
                </div>
              )
            })}
          </div>
        )}
      </div>
      {activeInfo && configuredProviders.some((p) => p.id === selectedProvider) && (
        <ProviderSetupPanel key={selectedProvider} info={activeInfo} existing={activeExisting} onSave={saveProvider} onTest={() => handleTest(activeInfo.id)} onDelete={() => handleDelete(activeInfo.id)} onClose={() => setSelectedProvider(null)} onSaveComplete={handleSaveComplete} isTesting={testing === activeInfo.id} isAlreadyConfigured />
      )}
      {unconfiguredProviders.length > 0 && (
        <div>
          <div className={styles.pickerSectionTitle}>Add a Provider</div>
          <div className={styles.pickerGrid}>
            {unconfiguredProviders.map((info) => (
              <button key={info.id} className={`${styles.pickerTile} ${selectedProvider === info.id ? styles.pickerTileSelected : ''}`} onClick={() => setSelectedProvider(selectedProvider === info.id ? null : info.id)} title={`Setup ${info.name}`}>
                <span className={styles.pickerTileEmoji}>{info.emoji}</span>
                <span className={styles.pickerTileName}>{info.name}</span>
              </button>
            ))}
          </div>
        </div>
      )}
      {activeInfo && unconfiguredProviders.some((p) => p.id === selectedProvider) && (
        <ProviderSetupPanel key={selectedProvider} info={activeInfo} existing={activeExisting} onSave={saveProvider} onTest={() => handleTest(activeInfo.id)} onDelete={() => handleDelete(activeInfo.id)} onClose={() => setSelectedProvider(null)} onSaveComplete={handleSaveComplete} isTesting={testing === activeInfo.id} isAlreadyConfigured={false} />
      )}
    </div>
  )
}

// ── Provider Setup Panel ──
function ProviderSetupPanel({ info, existing, onSave, onTest, onDelete, onClose, onSaveComplete, isTesting, isAlreadyConfigured }: {
  info: { id: ProviderType; name: string; emoji: string; needsKey: boolean }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  existing?: any
  onSave: (config: Omit<ProviderConfig, 'id'> & Partial<Pick<ProviderConfig, 'id'>>) => Promise<void>
  onTest: () => void; onDelete: () => void; onClose: () => void; onSaveComplete: () => void
  isTesting: boolean; isAlreadyConfigured: boolean
}): React.JSX.Element {
  const [apiKey, setApiKey] = useState('')
  const [awsAccessKeyId, setAwsAccessKeyId] = useState('')
  const [awsSecretAccessKey, setAwsSecretAccessKey] = useState('')
  const [awsRegion, setAwsRegion] = useState(existing?.awsRegion || 'us-east-1')
  const [baseUrl, setBaseUrl] = useState(existing?.baseUrl || '')
  const [defaultModel, setDefaultModel] = useState(existing?.defaultModel || PROVIDER_MODELS[info.id]?.[0]?.id || '')
  const [authMethod, setAuthMethod] = useState<ProviderConfig['authMethod']>(existing?.authMethod || 'apikey')
  const consoleUrl = PROVIDER_CONSOLE_URLS[info.id]
  const supportsOAuth = info.id === 'gemini' || info.id === 'github'
  const isBedrock = info.id === 'bedrock'
  const isLocalProvider = info.id === 'ollama' || info.id === 'custom'

  useEffect(() => { setAuthMethod(existing?.authMethod || 'apikey'); setDefaultModel(existing?.defaultModel || PROVIDER_MODELS[info.id]?.[0]?.id || ''); setAwsRegion(existing?.awsRegion || 'us-east-1'); setBaseUrl(existing?.baseUrl || '') }, [existing, info.id])

  const handleSave = async (): Promise<void> => {
    await onSave({ provider: info.id, apiKey: apiKey || undefined, awsAccessKeyId: awsAccessKeyId || undefined, awsSecretAccessKey: awsSecretAccessKey || undefined, awsRegion: awsRegion || undefined, baseUrl: baseUrl || undefined, defaultModel, isActive: true, authMethod })
    setApiKey(''); setAwsAccessKeyId(''); setAwsSecretAccessKey('')
    showToast('success', 'Saved', `${info.name} configured successfully!`); onSaveComplete()
  }

  return (
    <div className={styles.setupPanel}>
      <div className={styles.setupPanelHeader}>
        <span className={styles.setupPanelEmoji}>{info.emoji}</span>
        <span className={styles.setupPanelTitle}>{isAlreadyConfigured ? `Manage ${info.name}` : `Setup ${info.name}`}</span>
        <button className={styles.setupPanelClose} onClick={onClose} title="Close" aria-label="Close setup panel">✕</button>
      </div>
      <div className={styles.setupPanelBody}>
        {consoleUrl && !isAlreadyConfigured && (
          <div className={styles.setupPanelHint}>Get your {isBedrock ? 'credentials' : 'API key'} from{' '}
            <button type="button" onClick={() => window.electronAPI.shell.openExternal(consoleUrl.url)} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline', fontSize: '11px', padding: 0, fontFamily: 'inherit' }}>{consoleUrl.label} →</button>
          </div>
        )}
        {isBedrock && (<>
          <Input label="AWS Access Key ID" placeholder={isAlreadyConfigured ? 'Enter new Access Key to update...' : 'AKIA...'} value={awsAccessKeyId} onChange={(e) => setAwsAccessKeyId(e.target.value)} />
          <Input label="AWS Secret Access Key" type="password" placeholder={isAlreadyConfigured ? 'Enter new Secret Key to update...' : 'Secret key...'} value={awsSecretAccessKey} onChange={(e) => setAwsSecretAccessKey(e.target.value)} />
          <Input label="AWS Region" placeholder="us-east-1" value={awsRegion} onChange={(e) => setAwsRegion(e.target.value)} />
        </>)}
        {isLocalProvider && <Input label="Base URL" placeholder={info.id === 'ollama' ? 'http://localhost:11434' : 'https://your-endpoint.com/v1'} value={baseUrl} onChange={(e) => setBaseUrl(e.target.value)} />}
        {supportsOAuth && (
          <div className={styles.authMethodContainer}>
            <label className={styles.authMethodLabel}>Auth method</label>
            <select aria-label="Select authentication method" value={authMethod} onChange={(e) => setAuthMethod(e.target.value as ProviderConfig['authMethod'])} className={styles.select}>
              <option value="apikey">API Key</option><option value="oauth">OAuth</option>
            </select>
            {authMethod === 'oauth' && <div className={styles.oauthWarning}>OAuth requires a connected login session in the Interactive Login section above.</div>}
          </div>
        )}
        {info.needsKey && authMethod !== 'oauth' && !isBedrock && (
          <Input label="API Key" type="password" placeholder={isAlreadyConfigured ? 'Enter new key to update...' : 'Paste your API key here...'} value={apiKey} onChange={(e) => setApiKey(e.target.value)} />
        )}
        <ModelSelector providerId={info.id} value={defaultModel} onChange={setDefaultModel} />
        <div className={styles.setupPanelDivider} />
        <div className={styles.setupPanelActions}>
          {isAlreadyConfigured && <Button variant="danger" size="sm" onClick={onDelete} title="Delete credentials">🗑️ Remove</Button>}
          {consoleUrl && <Button variant="outline" size="sm" onClick={() => window.electronAPI.shell.openExternal(consoleUrl.url)} title={`Open ${consoleUrl.label}`}>🌐 Get {isBedrock ? 'Credentials' : 'API Key'}</Button>}
          <Button variant="outline" size="sm" onClick={onTest} isLoading={isTesting} title="Test connection">🔗 Test</Button>
          <Button size="sm" onClick={handleSave} title="Save and connect">{isAlreadyConfigured ? '💾 Update' : '🚀 Connect'}</Button>
        </div>
      </div>
    </div>
  )
}

// ── Model Selector ──
function ModelSelector({ providerId, value, onChange }: { providerId: ProviderType; value: string; onChange: (v: string) => void }): React.JSX.Element {
  const staticModels = PROVIDER_MODELS[providerId] || []
  const [remoteModels, setRemoteModels] = useState<{ id: string; label: string }[]>([])
  const [isFetchingModels, setIsFetchingModels] = useState(false)
  const shouldDefaultCustom = providerId === 'bedrock' || providerId === 'custom' || (Boolean(value) && !staticModels.some((m) => m.id === value))
  const [useCustom, setUseCustom] = useState<boolean>(shouldDefaultCustom)
  const [customModel, setCustomModel] = useState(value)
  const isBedrock = providerId === 'bedrock'

  useEffect(() => { setCustomModel(value) }, [value])
  useEffect(() => {
    let mounted = true
    const fetchModels = async (): Promise<void> => {
      setIsFetchingModels(true)
      try { const models = await window.electronAPI.provider.models(providerId); if (!mounted) return; setRemoteModels(models.map((id) => ({ id, label: staticModels.find((m) => m.id === id)?.label || id }))) }
      catch { if (mounted) setRemoteModels([]) }
      finally { if (mounted) setIsFetchingModels(false) }
    }
    fetchModels()
    return () => { mounted = false }
  }, [providerId, staticModels])

  const availableModels = remoteModels.length > 0 ? remoteModels : staticModels
  const hasModelList = availableModels.length > 0
  const isKnownModel = availableModels.some((m) => m.id === value)

  useEffect(() => { if (!value && !useCustom && availableModels.length > 0) onChange(availableModels[0].id) }, [availableModels, useCustom, value, onChange])

  const commitCustomModel = (rawValue: string): void => {
    const trimmed = rawValue.trim()
    if (trimmed) { onChange(trimmed); setCustomModel(trimmed); return }
    if (hasModelList) { const fallback = availableModels[0]?.id || ''; onChange(fallback); setCustomModel(fallback) } else { onChange('') }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '8px' }}>
        <label style={{ fontSize: '13px', fontWeight: 500, color: 'var(--text-secondary)', display: 'block' }}>Default Model</label>
        <button type="button" onClick={useCustom ? () => { setUseCustom(false); if (!availableModels.some((m) => m.id === value)) onChange(availableModels[0]?.id || '') } : () => { setUseCustom(true); setCustomModel(value) }}
          disabled={!hasModelList && useCustom} title={useCustom ? 'Select from predefined models' : 'Enter a custom model ID'}
          style={{ padding: '4px 8px', background: useCustom ? 'rgba(37,99,235,0.1)' : 'var(--bg-tertiary)', border: `1px solid ${useCustom ? 'var(--accent-blue)' : 'var(--border)'}`, borderRadius: '6px', color: useCustom ? 'var(--accent-blue)' : 'var(--text-secondary)', cursor: !hasModelList && useCustom ? 'default' : 'pointer', fontSize: '11px', fontFamily: 'var(--font-sans)', fontWeight: 600, opacity: !hasModelList && useCustom ? 0.7 : 1 }}>
          {useCustom ? 'Custom ID' : 'Use Custom ID'}
        </button>
      </div>
      {useCustom || !hasModelList ? (<>
        <input type="text" value={customModel} onChange={(e) => setCustomModel(e.target.value)} onBlur={() => commitCustomModel(customModel)} onKeyDown={(e) => { if (e.key === 'Enter') { commitCustomModel(customModel); e.currentTarget.blur() } }}
          placeholder={isBedrock ? 'anthropic.claude-sonnet-4-20250514-v1:0' : 'Enter model ID...'}
          style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-mono)', boxSizing: 'border-box' }} />
        {isFetchingModels && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Fetching available models…</span>}
        {isBedrock && <span style={{ fontSize: '11px', color: 'var(--text-muted)', lineHeight: 1.4 }}>Copy the model ID from{' '}<button type="button" onClick={() => window.electronAPI.shell.openExternal('https://console.aws.amazon.com/bedrock/')} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline', fontSize: '11px', padding: 0, fontFamily: 'inherit' }}>AWS Bedrock</button>.</span>}
      </>) : (<>
        <select value={isKnownModel ? value : availableModels[0]?.id || ''} onChange={(e) => onChange(e.target.value)} style={{ width: '100%', padding: '8px 12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '8px', color: 'var(--text-primary)', fontSize: '13px', fontFamily: 'var(--font-sans)' }}>
          {availableModels.map((m) => <option key={m.id} value={m.id}>{m.label}</option>)}
        </select>
        {isFetchingModels && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>Refreshing model list…</span>}
      </>)}
    </div>
  )
}

// ── Connected Accounts Section ──
function ConnectedAccountsSection({ onProviderChanged }: { onProviderChanged: () => Promise<void> }): React.JSX.Element {
  return (
    <div style={{ padding: '14px', background: 'var(--bg-secondary)', border: '1px solid var(--border)', borderRadius: '12px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
      <div>
        <h3 style={{ fontSize: '14px', fontWeight: 700, margin: '0 0 4px 0' }}>Interactive Login Sessions</h3>
        <p style={{ fontSize: '12px', color: 'var(--text-muted)', margin: 0 }}>Connect browser-based accounts using OAuth. Tokens are stored encrypted on this machine.</p>
      </div>
      <OAuthAccountCard name="Google" badge="Gemini OAuth" setupUrl="https://console.cloud.google.com/apis/credentials" setupHelp="Create an OAuth Client ID for a Desktop app, then paste the client ID and secret." statusLoader={() => window.electronAPI.auth.googleStatus()} setupLoader={() => window.electronAPI.auth.googleGetSetup()} login={() => window.electronAPI.auth.googleLogin()} logout={() => window.electronAPI.auth.googleLogout()} saveSetup={(config) => window.electronAPI.auth.googleSetup(config)} onProviderChanged={onProviderChanged} clientIdPlaceholder="xxx.apps.googleusercontent.com" clientSecretPlaceholder="GOCSPX-xxx" />
      <OAuthAccountCard name="GitHub" badge="GitHub Models" setupUrl="https://github.com/settings/developers" setupHelp="Create an OAuth App. Set Authorization callback URL to http://127.0.0.1/callback." statusLoader={() => window.electronAPI.auth.githubStatus()} setupLoader={() => window.electronAPI.auth.githubGetSetup()} login={() => window.electronAPI.auth.githubLogin()} logout={() => window.electronAPI.auth.githubLogout()} saveSetup={(config) => window.electronAPI.auth.githubSetup(config)} onProviderChanged={onProviderChanged} clientIdPlaceholder="GitHub OAuth App Client ID" clientSecretPlaceholder="GitHub OAuth App Client Secret" />
    </div>
  )
}

// ── OAuth Account Card ──
function OAuthAccountCard({ name, badge, setupUrl, setupHelp, statusLoader, setupLoader, login, logout, saveSetup, onProviderChanged, clientIdPlaceholder, clientSecretPlaceholder }: {
  name: string; badge: string; setupUrl: string; setupHelp: string
  statusLoader: () => Promise<OAuthStatusState>; setupLoader: () => Promise<OAuthSetupStatus>
  login: () => Promise<OAuthStatusState>; logout: () => Promise<{ isLoggedIn: boolean }>
  saveSetup: (config: { clientId: string; clientSecret: string }) => Promise<{ success: boolean }>
  onProviderChanged: () => Promise<void>; clientIdPlaceholder: string; clientSecretPlaceholder: string
}): React.JSX.Element {
  const [oauthStatus, setOauthStatus] = useState<OAuthStatusState>({ isLoggedIn: false })
  const [setupStatus, setSetupStatus] = useState<OAuthSetupStatus>({ isConfigured: false })
  const [showSetup, setShowSetup] = useState(false)
  const [clientId, setClientId] = useState('')
  const [clientSecret, setClientSecret] = useState('')
  const [isLoggingIn, setIsLoggingIn] = useState(false)

  useEffect(() => { statusLoader().then(setOauthStatus); setupLoader().then(setSetupStatus) }, [setupLoader, statusLoader])

  const handleLogin = async (): Promise<void> => {
    setIsLoggingIn(true)
    try { const result = await login(); setOauthStatus(result); if (result.isLoggedIn) { await onProviderChanged(); showToast('success', 'Signed In', `${name} connected as ${result.email || 'unknown'}.`) } else if (result.error) { showToast('error', 'Login Failed', result.error) } }
    catch { showToast('error', 'Login Failed', `Could not sign in with ${name}.`) }
    setIsLoggingIn(false)
  }

  const handleLogout = async (): Promise<void> => { await logout(); setOauthStatus({ isLoggedIn: false }); await onProviderChanged(); showToast('info', 'Signed Out', `${name} account disconnected.`) }

  const handleSaveSetup = async (): Promise<void> => {
    if (!clientId.trim() || !clientSecret.trim()) { showToast('error', 'Required', 'Both Client ID and Client Secret are required.'); return }
    await saveSetup({ clientId: clientId.trim(), clientSecret: clientSecret.trim() })
    setSetupStatus({ isConfigured: true, clientId: `${clientId.trim().substring(0, 8)}...` })
    setShowSetup(false); setClientId(''); setClientSecret('')
    showToast('success', 'OAuth Configured', `You can now sign in with ${name}.`)
  }

  return (
    <div style={{ padding: '12px', background: 'var(--bg-tertiary)', border: '1px solid var(--border)', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
        <span style={{ fontSize: '13px', fontWeight: 700 }}>{name}</span>
        <span style={{ fontSize: '10px', padding: '2px 6px', background: 'rgba(37,99,235,0.12)', color: 'var(--accent-blue)', borderRadius: '6px', fontWeight: 600 }}>{badge}</span>
        {setupStatus.clientId && <span style={{ fontSize: '11px', color: 'var(--text-muted)' }}>{setupStatus.clientId}</span>}
      </div>
      {oauthStatus.isLoggedIn ? (
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '12px', color: 'var(--accent-green)', fontWeight: 600 }}>Signed in as {oauthStatus.email || 'unknown'}</span>
          <Button variant="outline" size="sm" onClick={handleLogout} style={{ marginLeft: 'auto' }}>Sign Out</Button>
        </div>
      ) : (
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
          {setupStatus.isConfigured && <Button size="sm" onClick={handleLogin} isLoading={isLoggingIn}>Sign in with {name}</Button>}
          <Button variant="outline" size="sm" onClick={() => setShowSetup(!showSetup)}>{setupStatus.isConfigured ? 'Edit OAuth Setup' : 'Setup OAuth'}</Button>
        </div>
      )}
      {showSetup && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          <div style={{ fontSize: '11px', color: 'var(--text-muted)', padding: '8px', background: 'var(--bg-secondary)', borderRadius: '6px', lineHeight: 1.5 }}>
            {setupHelp}{' '}<button onClick={() => window.electronAPI.shell.openExternal(setupUrl)} style={{ background: 'none', border: 'none', color: 'var(--accent-blue)', cursor: 'pointer', textDecoration: 'underline', fontSize: '11px', padding: 0, fontFamily: 'inherit' }}>Open setup page</button>
          </div>
          <Input label="Client ID" placeholder={clientIdPlaceholder} value={clientId} onChange={(e) => setClientId(e.target.value)} />
          <Input label="Client Secret" type="password" placeholder={clientSecretPlaceholder} value={clientSecret} onChange={(e) => setClientSecret(e.target.value)} />
          <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
            <Button variant="ghost" size="sm" onClick={() => setShowSetup(false)}>Cancel</Button>
            <Button size="sm" onClick={handleSaveSetup}>Save OAuth Config</Button>
          </div>
        </div>
      )}
    </div>
  )
}
