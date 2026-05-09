// Lumiq — Root Application Component
import React, { useState, useEffect, useCallback } from 'react'
import { TitleBar } from './components/layout/TitleBar'
import { Sidebar } from './components/sidebar/Sidebar'
import { ChatPage } from './components/chat/ChatPage'
import { SettingsPage } from './components/settings/SettingsPage'
import { AgentBuilderPage } from './components/agents/AgentBuilderPage'
import { ToastContainer } from './components/ui/Toast'
import { useSettingsStore } from './store/settingsStore'
import { useSessionStore } from './store/sessionStore'
import { useProviderStore } from './store/providerStore'

type Page = 'chat' | 'settings' | 'agents'

export default function App(): React.JSX.Element {
  const [currentPage, setCurrentPage] = useState<Page>('chat')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const { loadSettings } = useSettingsStore()
  const { loadSessions } = useSessionStore()
  const { loadProviders } = useProviderStore()

  // Initialize app data
  useEffect(() => {
    loadSettings()
    loadSessions()
    loadProviders()
  }, [loadSettings, loadSessions, loadProviders])

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
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleNavigate = useCallback((page: Page) => setCurrentPage(page), [])

  return (
    <div style={{ height: '100vh', display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      <TitleBar />
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        <Sidebar isVisible={sidebarVisible} onNavigate={handleNavigate} currentPage={currentPage} />
        <main style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative' }}>
          {currentPage === 'chat' && <ChatPage />}
          {currentPage === 'settings' && <SettingsPage onNavigate={handleNavigate} />}
          {currentPage === 'agents' && <AgentBuilderPage onNavigate={handleNavigate} />}
        </main>
      </div>
      <ToastContainer />
    </div>
  )
}
