import { IPC } from '@shared/types'
import { readdir, stat, readFile, writeFile, rename, rm, mkdir } from 'fs/promises'
import { join } from 'path'
import { validatePathWithinWorkspace } from '../security/pathValidation'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

export function registerFsHandlers(): void {
  handleWithTimeout(IPC.FS_LIST_DIR, IPC_TIMEOUT.short, async (_event, dirPath: string) => {
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

  handleWithTimeout(IPC.FS_READ_FILE, IPC_TIMEOUT.short, async (_event, filePath: string) => {
    try {
      const safePath = validatePathWithinWorkspace(filePath)
      return await readFile(safePath, 'utf-8')
    } catch (error) {
      console.error(`Failed to read file: ${filePath}`, error)
      throw new Error(`Failed to read file: ${(error as Error).message}`)
    }
  })

  handleWithTimeout(IPC.FS_WRITE_FILE, IPC_TIMEOUT.short, async (_event, data: { filePath: string; content: string }) => {
    try {
      const safePath = validatePathWithinWorkspace(data.filePath)
      await writeFile(safePath, data.content, 'utf-8')
      return true
    } catch (error) {
      console.error(`Failed to write file: ${data.filePath}`, error)
      throw new Error(`Failed to write file: ${(error as Error).message}`)
    }
  })

  handleWithTimeout(IPC.FS_RENAME, IPC_TIMEOUT.short, async (_event, data: { oldPath: string; newPath: string }) => {
    try {
      const safeOldPath = validatePathWithinWorkspace(data.oldPath)
      const safeNewPath = validatePathWithinWorkspace(data.newPath)
      await rename(safeOldPath, safeNewPath)
      return true
    } catch (error) {
      console.error(`Failed to rename: ${data.oldPath} -> ${data.newPath}`, error)
      throw new Error(`Failed to rename: ${(error as Error).message}`)
    }
  })

  handleWithTimeout(IPC.FS_DELETE, IPC_TIMEOUT.short, async (_event, targetPath: string) => {
    try {
      const safePath = validatePathWithinWorkspace(targetPath)
      await rm(safePath, { recursive: true, force: true })
      return true
    } catch (error) {
      console.error(`Failed to delete: ${targetPath}`, error)
      throw new Error(`Failed to delete: ${(error as Error).message}`)
    }
  })

  handleWithTimeout(IPC.FS_MKDIR, IPC_TIMEOUT.short, async (_event, dirPath: string) => {
    try {
      const safePath = validatePathWithinWorkspace(dirPath)
      await mkdir(safePath, { recursive: true })
      return true
    } catch (error) {
      console.error(`Failed to create directory: ${dirPath}`, error)
      throw new Error(`Failed to create directory: ${(error as Error).message}`)
    }
  })
}
