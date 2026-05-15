import { ipcMain, dialog, BrowserWindow } from 'electron'
import { IPC } from '../../shared/types'

export function registerDialogHandlers(): void {
  ipcMain.handle(IPC.DIALOG_SHOW_OPEN, async (event, options) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { canceled: true, filePaths: [] }
    
    return await dialog.showOpenDialog(window, options)
  })
}
