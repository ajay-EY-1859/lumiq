// Lumiq — Root Application Component
import React, { useState, useEffect, useCallback, useRef } from 'react'
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
import { useSearchStore } from './store/searchStore'
import { useEditorStore } from './store/editorStore'

type Page = 'chat' | 'settings' | 'agents'
type BottomPanel = 'tasks' | 'search' | 'git' | 'semantic'

// ── Resizable divider between editor and chat ─────────────────────────
function ResizeDivider({ onDrag }: { onDrag: (dx: number) => void }): React.JSX.Element {
  const dragging = useRef(false)
  const lastX = useRef(0)

  const onMouseDown = (e: React.MouseEvent) => {
    dragging.current = true
    lastX.current = e.clientX
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  useEffect(() => {
    const onMove = (e: MouseEvent) => {
      if (!dragging.current) return
      onDrag(e.clientX - lastX.current)
      lastX.current = e.clientX
    }
    const onUp = () => {
      dragging.current = false
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => { window.removeEventListener('mousemove', onMove); window.removeEventListener('mouseup', onUp) }
  }, [onDrag])

  return (
    <div
      onMouseDown={onMouseDown}
      style={{
        width: '5px', flexShrink: 0, cursor: 'col-resize',
        background: 'transparent', position: 'relative', zIndex: 10,
        transition: 'background 0.15s',
      }}
      onMouseEnter={(e) => e.currentTarget.style.background = 'var(--accent-blue)'}
      onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
      title="Drag to resize"
    />
  )
}

export default function App(): React.JSX.Element {
  const [currentPage, setCurrentPage] = useState<Page>('chat')
  const [sidebarVisible, setSidebarVisible] = useState(true)
  const [bottomPanel, setBottomPanel] = useState<BottomPanel>('tasks')
  // Editor panel width in px — default 420, min 280, max 900
  const [editorWidth, setEditorWidth] = useState(420)
  const [editorVisible, setEditorVisible] = useState(true)
  const { loadSettings, loadWorkspaceSettings } = useSettingsStore()
  const { loadSessions, activeSessionId, sessions } = useSessionStore()
  const { loadProviders } = useProviderStore()
  const searchMode = useSearchStore(s => s.mode)
  const editorTabs = useEditorStore(s => s.tabs)

  useEffect(() => {
    loadSettings(); loadSessions(); loadProviders()
  }, [loadSettings, loadSessions, loadProviders])

  useEffect(() => {
    const activeSession = sessions.find(s => s.id === activeSessionId)
    loadWorkspaceSettings(activeSession?.workspacePath || null)
  }, [activeSessionId, sessions, loadWorkspaceSettings])

  useEffect(() => {
    const cleanupNewSession = window.electronAPI.onMenuNewSession(() => setCurrentPage('chat'))
    const cleanupSettings = window.electronAPI.onMenuSettings(() => setCurrentPage('settings'))
    const cleanupSidebar = window.electronAPI.onMenuToggleSidebar(() => setSidebarVisible((v) => !v))
    return () => { cleanupNewSession(); cleanupSettings(); cleanupSidebar() }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent): void => {
      if (e.ctrlKey || e.metaKey) {
        if (e.key === 'b') { e.preventDefault(); setSidebarVisible((v) => !v) }
        if (e.key === ',') { e.preventDefault(); setCurrentPage('settings') }
        if (e.shiftKey && e.key === 'E') { e.preventDefault(); setEditorVisible((v) => !v) }
        if (e.shiftKey && e.key === 'F') { e.preventDefault(); setBottomPanel('search') }
        if (e.shiftKey && e.key === 'G') { e.preventDefault(); setBottomPanel('git') }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  const handleNavigate = useCallback((page: Page) => setCurrentPage(page), [])

  const handleEditorResize = useCallback((dx: number) => {
    setEditorWidth((w) => Math.max(280, Math.min(900, w + dx)))
  }, [])

  return (
    <ErrorBoundary>
      <div className="h-screen flex flex-col overflow-hidden text-[var(--text-primary)] font-sans" style={{ background: 'var(--app-bg)' }}>
        <TitleBar />
        <div className="flex-1 flex overflow-hidden">
          <Sidebar isVisible={sidebarVisible} onNavigate={handleNavigate} currentPage={currentPage} />
          <main className="flex-1 flex flex-col overflow-hidden relative bg-[var(--bg-primary)] rounded-tl-2xl border-t border-l border-[var(--border)] shadow-2xl m-2 ml-0 transition-all duration-300 backdrop-blur-xl">
            {currentPage === 'chat' && (
              <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>

                {/* ── Editor column ── */}
                {editorVisible && (
                  <>
                    <div style={{
                      width: editorWidth, minWidth: 280, maxWidth: 900,
                      display: 'flex', flexDirection: 'column', overflow: 'hidden',
                      borderRight: '1px solid var(--border)',
                      background: 'var(--bg-secondary)',
                      flexShrink: 0,
                    }}>
                      {/* Editor toggle bar */}
                      <div style={{
                        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                        padding: '0 8px', height: '28px', flexShrink: 0,
                        borderBottom: '1px solid var(--border)',
                        background: 'var(--bg-secondary)',
                      }}>
                        <span style={{ fontSize: '10px', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                          Editor {editorTabs.length > 0 ? `· ${editorTabs.length} tab${editorTabs.length > 1 ? 's' : ''}` : ''}
                        </span>
                        <button
                          onClick={() => setEditorVisible(false)}
                          title="Hide editor (Ctrl+Shift+E)"
                          style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '13px', padding: '2px 5px', borderRadius: '3px', lineHeight: 1 }}
                          onMouseEnter={(e) => e.currentTarget.style.color = 'var(--text-primary)'}
                          onMouseLeave={(e) => e.currentTarget.style.color = 'var(--text-muted)'}
                        >✕</button>
                      </div>

                      {/* Monaco editor — takes all remaining height */}
                      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                        <EditorPane />
                      </div>

                      {/* Bottom panel tabs */}
                      <div style={{ display: 'flex', borderTop: '1px solid var(--border)', background: 'var(--bg-primary)', flexShrink: 0 }}>
                        {(['tasks', 'search', 'git', 'semantic'] as BottomPanel[]).map(tab => {
                          const isActive =
                            bottomPanel === tab ||
                            (tab === 'search' && bottomPanel === 'search' && searchMode === 'text') ||
                            (tab === 'semantic' && bottomPanel === 'search' && searchMode === 'semantic')
                          return (
                            <button key={tab}
                              onClick={() => {
                                if (tab === 'semantic') { setBottomPanel('search'); useSearchStore.getState().setMode('semantic') }
                                else { setBottomPanel(tab); if (tab === 'search') useSearchStore.getState().setMode('text') }
                              }}
                              style={{
                                flex: 1, padding: '5px 0', fontSize: '10px', fontWeight: isActive ? 700 : 500,
                                color: isActive ? 'var(--accent-blue)' : 'var(--text-muted)',
                                background: 'none', border: 'none',
                                borderBottom: isActive ? '2px solid var(--accent-blue)' : '2px solid transparent',
                                cursor: 'pointer', textTransform: 'uppercase', letterSpacing: '0.5px',
                              }}>
                              {tab === 'tasks' ? '⚡ Tasks' : tab === 'search' ? '🔍 Search' : tab === 'git' ? '⎇ Git' : '🧠 Semantic'}
                            </button>
                          )
                        })}
                      </div>

                      {/* Bottom panel content — fixed height */}
                      <div style={{ height: '200px', overflow: 'hidden', flexShrink: 0, borderTop: '1px solid var(--border)' }}>
                        {bottomPanel === 'tasks' && <TaskPanel />}
                        {bottomPanel === 'search' && <SearchPanel />}
                        {bottomPanel === 'git' && <GitPanel />}
                      </div>
                    </div>

                    {/* Drag handle */}
                    <ResizeDivider onDrag={handleEditorResize} />
                  </>
                )}

                {/* Show editor button when hidden */}
                {!editorVisible && (
                  <button
                    onClick={() => setEditorVisible(true)}
                    title="Show editor (Ctrl+Shift+E)"
                    style={{
                      width: '22px', flexShrink: 0, background: 'var(--bg-secondary)',
                      border: 'none', borderRight: '1px solid var(--border)',
                      cursor: 'pointer', color: 'var(--text-muted)', fontSize: '10px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      writingMode: 'vertical-rl', letterSpacing: '0.05em',
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.background = 'var(--bg-tertiary)'; e.currentTarget.style.color = 'var(--accent-blue)' }}
                    onMouseLeave={(e) => { e.currentTarget.style.background = 'var(--bg-secondary)'; e.currentTarget.style.color = 'var(--text-muted)' }}
                  >▶ EDITOR</button>
                )}

                {/* ── Chat column ── */}
                <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', minWidth: 0 }}>
                  <ChatPage />
                </div>
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
