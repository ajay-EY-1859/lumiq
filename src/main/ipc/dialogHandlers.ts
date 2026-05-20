import { dialog, BrowserWindow, OpenDialogOptions } from 'electron'
import { IPC } from '../../shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

export function registerDialogHandlers(): void {
  handleWithTimeout(IPC.DIALOG_SHOW_OPEN, IPC_TIMEOUT.long, async (event, options: OpenDialogOptions) => {
    const window = BrowserWindow.fromWebContents(event.sender)
    if (!window) return { canceled: true, filePaths: [] }
    
    return await dialog.showOpenDialog(window, options)
  })
}
