// Lumiq — Root Application Component
import React, { useState, useEffect, useCallback } from 'react'
import { TitleBar } from './components/layout/TitleBar'
import { Sidebar } from './components/sidebar/Sidebar'
import { ChatPage } from './components/chat/ChatPage'
import { EditorPane } from './components/editor/EditorPane'
import { TaskPanel } from './components/tasks/TaskPanel'
import { SearchPanel } from './components/search/SearchPanel'
import { GitPanel } from './components/git/GitPanel'
import { SettingsPage } from './components/settings/SettingsPage'
import { AgentBuilderPage } from './components/agents/AgentBuilderPage'
import { ToastContainer } from './components/ui/Toast'
import { ErrorBoundary } from './components/ui/ErrorBoundary'
import { useSettingsStore } from './store/settingsStore'
import { useSessionStore } from './store/sessionStore'
import { useProviderStore } from './store/providerStore'

type Page = 'chat' | 'settings' | 'agents'
type BottomPanel = 'tasks' | 'search' | 'git'

export default function App(): React.JSX.Element {
  const [currentPage, setCurrentPage] = useState<Page>('chat')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>('tasks')
  const { loadSettings, loadWorkspaceSettings } = useSettingsStore()
  const { loadSessions, activeSessionId, sessions } = useSessionStore()
  const { loadProviders } = useProviderStore()

  // Initialize app data
  useEffect(() => {
    loadSettings()
    loadSessions()
    loadProviders()
  }, [loadSettings, loadSessions, loadProviders])

  // Load workspace settings when session changes
  useEffect(() => {
    const activeSession = sessions.find(s => s.id === activeSessionId)
    loadWorkspaceSettings(activeSession?.workspacePath || null)
  }, [activeSessionId, sessions, loadWorkspaceSettings])

  // Menu event listeners
  useEffect(() => {
    const cleanupNewSession = window.electronAPI.onMenuNewSession(() => setCurrentPage('chat'))
    const cleanupSettings = window.electronAPI.onMenuSettings(() => setCurrentPage('settings'))
    const cleanupSidebar = window.electronAPI.onMenuToggleSidebar(() => setSidebarVisible((v) => !v))
    return () => { cleanupNewSession(); cleanupSettings(); cleanupSidebar() }
  }, [])

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b') { e.preventDefault(); setSidebarVisible((v) => !v) }
        if (e.key === ',') { e.preventDefault(); setCurrentPage('settings') }
        if (e.shiftKey && e.key === 'f') { e.preventDefault(); setBottomPanel('search') }
        if (e.shiftKey && e.key === 'g') { e.preventDefault(); setBottomPanel('git') }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleNavigate = useCallback((page: Page) => setCurrentPage(page), [])

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col overflow-hidden text-[var(--text-primary)] font-sans" style={{ background: 'var(--app-bg)' }}>
        <TitleBar />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar isVisible={sidebarVisible} onNavigate={handleNavigate} currentPage={currentPage} />
          <main className="flex-1 flex flex-col overflow-hidden relative bg-[var(--bg-primary)] rounded-tl-2xl border-t border-l border-[var(--border)] shadow-2xl m-2 ml-0 transition-all duration-300 backdrop-blur-xl">
            {currentPage === 'chat' && (
              <div className="flex-1 flex overflow-hidden">
                <div className="flex flex-col overflow-hidden min-w-[300px] border-r border-[var(--border)] bg-[var(--bg-secondary)] backdrop-blur-md">
                  <EditorPane />

                  {/* Bottom panel tabs */}
                  <div style={{ display: 'flex', borderTop: '1px solid var(--border)', borderBottom: '1px solid var(--border)', background: 'var(--bg-primary)', flexShrink: 0 }}>
                    {(['tasks', 'search', 'git'] as BottomPanel[]).map(tab => (
                      <button
                        key={tab}
                        onClick={() => setBottomPanel(tab)}
                        style={{
                          flex: 1,
                          padding: '5px 0',
                          fontSize: '11px',
                          fontWeight: bottomPanel === tab ? 700 : 500,
                          color: bottomPanel === tab ? 'var(--accent-blue)' : 'var(--text-muted)',
                          background: 'none',
                          border: 'none',
                          borderBottom: bottomPanel === tab ? '2px solid var(--accent-blue)' : '2px solid transparent',
                          cursor: 'pointer',
                          textTransform: 'uppercase',
                          letterSpacing: '0.5px',
                          transition: 'all 0.15s'
                        }}
                      >
                        {tab === 'tasks' ? '⚡ Tasks' : tab === 'search' ? '🔍 Search' : '⎇ Git'}
                      </button>
                    ))}
                  </div>

                  {/* Bottom panel content */}
                  <div style={{ flex: 1, overflow: 'hidden', minHeight: '150px' }}>
                    {bottomPanel === 'tasks' && <TaskPanel />}
                    {bottomPanel === 'search' && <SearchPanel />}
                    {bottomPanel === 'git' && <GitPanel />}
                  </div>
                </div>
                <ChatPage />
              </div>
            )}
            {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} />}
            {currentPage === 'agents' && <AgentBuilderPage onNavigate={handleNavigate} />}
          </main>
        </div>
        <ToastContainer />
      </div>
    </ErrorBoundary>
  )
}
