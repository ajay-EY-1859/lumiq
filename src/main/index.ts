// ═══════════════════════════════════════════════════════════════════
// Lumiq — Electron Main Process Entry Point
// Creates the BrowserWindow, initializes database, registers IPC.
// ═══════════════════════════════════════════════════════════════════

import { app, shell, BrowserWindow, Menu } from 'electron'
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
      sandbox: false,
      contextIsolation: true,
      nodeIntegration: false, // SECURITY: Never enable this
      webSecurity: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  // SECURITY: Open external links in the default browser, not in-app
  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
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
  contents.on('will-navigate', (event) => {
    event.preventDefault()
  })
})
