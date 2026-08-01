import { clipboard, app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { IPC } from '../../shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { getWorkspaceRoot } from '../security/pathValidation'

export function registerClipboardHandlers(): void {
  handleWithTimeout(IPC.CLIPBOARD_WRITE_TEXT, IPC_TIMEOUT.short, async (_event, text: string) => {
    clipboard.writeText(text)
  })

  handleWithTimeout(IPC.CLIPBOARD_READ_TEXT, IPC_TIMEOUT.short, async () => {
    return clipboard.readText()
  })

  handleWithTimeout(IPC.CLIPBOARD_SAVE_IMAGE, IPC_TIMEOUT.short, async () => {
    const img = clipboard.readImage()
    if (img.isEmpty()) return null

    try {
      let attachmentsDir: string
      try {
        const workspaceRoot = getWorkspaceRoot()
        attachmentsDir = join(workspaceRoot, '.lumiq', 'pasted_images')
      } catch {
        attachmentsDir = join(app.getPath('temp'), 'lumiq_pasted_images')
      }

      if (!existsSync(attachmentsDir)) {
        mkdirSync(attachmentsDir, { recursive: true })
      }
      
      const fileName = `pasted_image_${Date.now()}.png`
      const filePath = join(attachmentsDir, fileName)
      writeFileSync(filePath, img.toPNG())
      return filePath
    } catch (err) {
      console.error('Failed to save clipboard image:', err)
      return null
    }
  })
}
