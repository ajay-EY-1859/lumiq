// ═══════════════════════════════════════════════════════════════════
// Lumiq — IPC Handler Registration
// Registers all IPC handlers and window control events.
// ═══════════════════════════════════════════════════════════════════

import { ipcMain, BrowserWindow } from 'electron'
import { registerChatHandlers } from './chatHandlers'
import { registerSessionHandlers } from './sessionHandlers'
import { registerProviderHandlers } from './providerHandlers'
import { registerToolHandlers } from './toolHandlers'
import { registerAgentHandlers } from './agentHandlers'
import { registerSettingsHandlers } from './settingsHandlers'
import { registerAuthHandlers } from './authHandlers'
import { registerMcpHandlers } from './mcpHandlers'
import { registerRoutingHandlers } from './routingHandlers'
import { registerSkillHandlers } from './skillHandlers'
import { registerGrpcHandlers } from './grpcHandlers'
import { registerDialogHandlers } from './dialogHandlers'
import { registerFsHandlers } from './fsHandlers'
import { registerTaskHandlers } from './taskHandlers'

export function registerAllHandlers(): void {
  // Register domain-specific handlers
  registerChatHandlers()
  registerSessionHandlers()
  registerProviderHandlers()
  registerToolHandlers()
  registerAgentHandlers()
  registerSettingsHandlers()
  registerAuthHandlers()
  registerMcpHandlers()
  registerRoutingHandlers()
  registerSkillHandlers()
  registerGrpcHandlers()
  registerDialogHandlers()
  registerFsHandlers()
  registerTaskHandlers()

  // ── Window Control Handlers (for custom titlebar) ──
  ipcMain.on('window:minimize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    window?.minimize()
  })

  ipcMain.on('window:maximize', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (window?.isMaximized()) {
      window.unmaximize()
    } else {
      window?.maximize()
    }
  })

  ipcMain.on('window:close', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    window?.close()
  })

  ipcMain.handle('window:is-maximized', (event) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    return window?.isMaximized() ?? false
  })
}
