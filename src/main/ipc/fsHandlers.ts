import { ipcMain } from 'electron'
import { IPC } from '@shared/types'
import { readdir, stat, readFile, writeFile } from 'fs/promises'
import { join } from 'path'
import { validatePathWithinWorkspace } from '../security/pathValidation'

export function registerFsHandlers(): void {
  ipcMain.handle(IPC.FS_LIST_DIR, async (_event, dirPath: string) => {
    try {
      const safeDir = validatePathWithinWorkspace(dirPath)
      const entries = await readdir(safeDir)
      const result = await Promise.all(
        entries.map(async (name) => {
          const fullPath = join(safeDir, name)
          try {
            const s = await stat(fullPath)
            return { name, isDirectory: s.isDirectory() }
          } catch {
            return { name, isDirectory: false }
          }
        })
      )
      // Sort directories first, then alphabetically
      return result.sort((a, b) => {
        if (a.isDirectory && !b.isDirectory) return -1
        if (!a.isDirectory && b.isDirectory) return 1
        return a.name.localeCompare(b.name)
      })
    } catch (error) {
      console.error(`Failed to list directory: ${dirPath}`, error)
      throw new Error(`Failed to list directory: ${(error as Error).message}`)
    }
  })

  ipcMain.handle(IPC.FS_READ_FILE, async (_event, filePath: string) => {
    try {
      const safePath = validatePathWithinWorkspace(filePath)
      return await readFile(safePath, 'utf-8')
    } catch (error) {
      console.error(`Failed to read file: ${filePath}`, error)
      throw new Error(`Failed to read file: ${(error as Error).message}`)
    }
  })

  ipcMain.handle(IPC.FS_WRITE_FILE, async (_event, data: { filePath: string; content: string }) => {
    try {
      const safePath = validatePathWithinWorkspace(data.filePath)
      await writeFile(safePath, data.content, 'utf-8')
      return true
    } catch (error) {
      console.error(`Failed to write file: ${data.filePath}`, error)
      throw new Error(`Failed to write file: ${(error as Error).message}`)
    }
  })
}
