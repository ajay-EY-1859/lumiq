// ═══════════════════════════════════════════════════════════════════
// Lumiq — Command IPC Handlers
// List, save, delete, and import-folder for custom commands
// ═══════════════════════════════════════════════════════════════════

import { IPC, type CustomCommand } from '@shared/types'
import { deleteCommand, listCommands, saveCommand } from '../db/commands'
import fs from 'node:fs'
import path from 'node:path'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { validatePathWithinWorkspace } from '../security/pathValidation'

export function registerCommandHandlers(): void {
  handleWithTimeout(IPC.COMMAND_LIST, IPC_TIMEOUT.short, () => listCommands())

  handleWithTimeout(
    IPC.COMMAND_SAVE,
    IPC_TIMEOUT.short,
    (_event, cmd: Partial<CustomCommand> & Pick<CustomCommand, 'name' | 'command'>) => {
      if (!cmd.name?.trim() || !cmd.command?.trim()) {
        throw new Error('Command name and command body are required')
      }
      return saveCommand(cmd)
    }
  )

  handleWithTimeout(IPC.COMMAND_DELETE, IPC_TIMEOUT.short, (_event, id: string) => deleteCommand(id))

  handleWithTimeout(IPC.COMMAND_IMPORT_FOLDER, IPC_TIMEOUT.long, async (_event, folderPath: string) => {
    try {
      const validPath = validatePathWithinWorkspace(folderPath)
      let importedCount = 0

      function processDirectory(dir: string): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name)
          if (entry.isDirectory()) {
            processDirectory(fullPath)
          } else if (entry.isFile()) {
            const ext = path.extname(entry.name).toLowerCase()
            if (ext === '.json') {
              try {
                const content = fs.readFileSync(fullPath, 'utf-8')
                const config = JSON.parse(content)
                if (config.name && config.command) {
                  saveCommand({
                    name: config.name,
                    description: config.description || '',
                    command: config.command,
                    type: config.type || 'shell',
                    args: config.args || []
                  })
                  importedCount++
                }
              } catch { /* skip invalid json */ }
            } else if (ext === '.md') {
              try {
                const content = fs.readFileSync(fullPath, 'utf-8')
                const match = content.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/)
                if (match) {
                  const frontmatter = match[1]
                  const body = match[2].trim()

                  let name = ''
                  let description = ''
                  let type: 'shell' | 'prompt' = 'prompt'

                  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
                  if (nameMatch) name = nameMatch[1].trim()

                  const descMatch = frontmatter.match(/^description:\s*(.+)$/m)
                  if (descMatch) description = descMatch[1].trim()

                  const typeMatch = frontmatter.match(/^type:\s*(.+)$/m)
                  if (typeMatch) type = typeMatch[1].trim() as 'shell' | 'prompt'

                  if (name && body) {
                    saveCommand({
                      name,
                      description,
                      command: body,
                      type,
                      args: []
                    })
                    importedCount++
                  }
                }
              } catch { /* skip invalid md */ }
            }
          }
        }
      }

      processDirectory(validPath)
      return importedCount
    } catch (error) {
      throw new Error(`Failed to import folder: ${(error as Error).message}`)
    }
  })
}
