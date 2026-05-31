// ═══════════════════════════════════════════════════════════════════
// Lumiq — Electron Main Process Entry Point
// Creates the BrowserWindow, initializes database, registers IPC.
// ═══════════════════════════════════════════════════════════════════

import dns from 'dns'
// Prioritize IPv4 over IPv6. Instantly resolves Windows/DNS latency and proxy timeouts.
dns.setDefaultResultOrder('ipv4first')

import { app, shell, BrowserWindow, Menu, session } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import { initDatabase, closeDatabase } from './db/database'
import { registerAllHandlers } from './ipc'
import { mcpServerManager } from './services/mcp/McpServerManager'
import { developerGrpcServer } from './services/grpc/DeveloperGrpcServer'
import { agentLoop } from './agent/AgentLoop'
import type { ToolSettings } from '@shared/types'
import type { PermissionMode } from './security/permissions'
import { mergeToolSettings } from './tools/defaultToolSettings'

let mainWindow: BrowserWindow | null = null

const STRICT_CSP = [
  "default-src 'self'",
  `script-src 'self'${is.dev ? " 'unsafe-inline' 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' http://localhost:* ws://localhost:*",
  "worker-src 'self' blob:",
  "object-src 'none'",
  "base-uri 'none'",
  "form-action 'none'",
  "frame-src 'none'"
].join('; ')

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    show: false,
    frame: false, // Frameless for custom titlebar
    titleBarStyle: 'hidden',
    autoHideMenuBar: true,
    backgroundColor: '#0F172A',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true,
      contextIsolation: true,
      nodeIntegration: false, // SECURITY: Never enable this
      nodeIntegrationInWorker: false,
      nodeIntegrationInSubFrames: false,
      webviewTag: false,
      allowRunningInsecureContent: false,
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // SECURITY: Open external links in the default browser, not in-app
  mainWindow.webContents.setWindowOpenHandler((details) => {
    try {
      const url = new URL(details.url)
      if (url.protocol === 'https:' || url.protocol === 'http:') {
        shell.openExternal(url.toString())
      }
    } catch {
      // Ignore malformed URLs.
    }
    return { action: 'deny' }
  })

  // Keep streaming performant even when window is in background
  mainWindow.webContents.setBackgroundThrottling(false)

  // Load renderer
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// ─── Application Menu ──────────────────────────────────────────────
function createMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New Session',
          accelerator: 'CmdOrCtrl+N',
          click: (): void => {
            mainWindow?.webContents.send('menu:new-session')
          }
        },
        { type: 'separator' },
        {
          label: 'Settings',
          accelerator: 'CmdOrCtrl+,',
          click: (): void => {
            mainWindow?.webContents.send('menu:settings')
          }
        },
        { type: 'separator' },
        { role: 'quit' }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        { role: 'undo' },
        { role: 'redo' },
        { type: 'separator' },
        { role: 'cut' },
        { role: 'copy' },
        { role: 'paste' },
        { role: 'selectAll' }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Toggle Sidebar',
          accelerator: 'CmdOrCtrl+B',
          click: (): void => {
            mainWindow?.webContents.send('menu:toggle-sidebar')
          }
        },
        { type: 'separator' },
        { role: 'toggleDevTools' },
        { type: 'separator' },
        { role: 'resetZoom' },
        { role: 'zoomIn' },
        { role: 'zoomOut' },
        { type: 'separator' },
        { role: 'togglefullscreen' }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About Lumiq',
          click: (): void => {
            mainWindow?.webContents.send('menu:about')
          }
        }
      ]
    }
  ]

  const menu = Menu.buildFromTemplate(template)
  Menu.setApplicationMenu(menu)
}

// ─── App Lifecycle ─────────────────────────────────────────────────
app.whenReady().then(() => {
  // Set app user model id for Windows
  electronApp.setAppUserModelId('com.lumiq.desktop')

  // Watch for shortcuts on dev
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // Initialize database
  const db = initDatabase()

  // Auto-discover local Ollama instance on startup (Offline-First Mode)
  import('./providers/OllamaAutoDiscovery').then(({ OllamaAutoDiscovery }) => {
    OllamaAutoDiscovery.discover()
  }).catch(err => {
    console.error('[OllamaAutoDiscovery] Failed to import auto-discovery service:', err)
  })
  const toolSettings = db.prepare("SELECT value FROM settings WHERE key = 'toolSettings'").get() as { value: string } | undefined
  if (toolSettings?.value) {
    try {
      const mergedToolSettings = mergeToolSettings(JSON.parse(toolSettings.value) as ToolSettings[])
      agentLoop.getToolExecutor().updateToolSettings(mergedToolSettings)
    } catch {
      // Ignore malformed settings and keep the executor defaults.
    }
  }
  const permissionMode = db.prepare("SELECT value FROM settings WHERE key = 'permissionMode'").get() as { value: string } | undefined
  agentLoop.getToolExecutor().setPermissionMode((permissionMode?.value as PermissionMode) || 'MANUAL')

  const contextLimitRow = db.prepare("SELECT value FROM settings WHERE key = 'contextLimit'").get() as { value: string } | undefined
  const startupContextLimit = Math.max(10, Math.min(500, parseInt(contextLimitRow?.value || '150', 10)))
  agentLoop.setContextLimit(startupContextLimit)

  // Register all IPC handlers
  registerAllHandlers()

  const defaultSession = session.defaultSession
  defaultSession.setPermissionRequestHandler((_webContents, _permission, callback) => {
    callback(false)
  })
  defaultSession.setPermissionCheckHandler(() => false)
  defaultSession.webRequest.onHeadersReceived((details, callback) => {
    callback({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [STRICT_CSP],
        'X-Content-Type-Options': ['nosniff'],
        'Referrer-Policy': ['no-referrer']
      }
    })
  })

  // Create window and menu
  createMenu()
  createWindow()

  app.on('activate', () => {
    // macOS: re-create window when dock icon is clicked
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Graceful shutdown
app.on('window-all-closed', () => {
  mcpServerManager.stopAll()
  developerGrpcServer.stop()
  closeDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// SECURITY: Prevent navigation in the main app window
app.on('web-contents-created', (_, contents) => {
  contents.on('will-attach-webview', (event) => {
    event.preventDefault()
  })

  contents.on('will-navigate', (event) => {
    event.preventDefault()
  })
})
