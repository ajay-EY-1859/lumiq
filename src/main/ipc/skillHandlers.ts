import { IPC, type CustomSkill } from '@shared/types'
import { deleteSkill, listSkills, saveSkill } from '../db/skills'
import fs from 'node:fs'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { validatePathWithinWorkspace } from '../security/pathValidation'

export function registerSkillHandlers(): void {
  handleWithTimeout(IPC.SKILL_LIST, IPC_TIMEOUT.short, () => listSkills())
  handleWithTimeout(
    IPC.SKILL_SAVE,
    IPC_TIMEOUT.short,
    (_event, skill: Partial<CustomSkill> & Pick<CustomSkill, 'name' | 'promptTemplate'>) => {
      if (!skill.name?.trim() || !skill.promptTemplate?.trim()) {
        throw new Error('Skill name and prompt template are required')
      }
      return saveSkill(skill)
    }
  )
  handleWithTimeout(IPC.SKILL_DELETE, IPC_TIMEOUT.short, (_event, id: string) => deleteSkill(id))

  handleWithTimeout(IPC.SKILL_IMPORT, IPC_TIMEOUT.short, async (_event, filePath: string) => {
    try {
      const content = fs.readFileSync(validatePathWithinWorkspace(filePath), 'utf-8')
      const config = JSON.parse(content)
      
      // Basic validation
      if (!config.name || !config.promptTemplate) {
        throw new Error('Invalid Skill config: must contain name and promptTemplate fields')
      }
      
      const skill: Partial<CustomSkill> & Pick<CustomSkill, 'name' | 'promptTemplate'> = {
        name: config.name,
        description: config.description || '',
        promptTemplate: config.promptTemplate,
        allowedTools: config.allowedTools || []
      }
      
      return saveSkill(skill)
    } catch (error) {
      throw new Error(`Failed to import skill: ${(error as Error).message}`)
    }
  })

  handleWithTimeout(IPC.SKILL_IMPORT_FOLDER, IPC_TIMEOUT.long, async (_event, folderPath: string) => {
    try {
      const validPath = validatePathWithinWorkspace(folderPath)
      let importedCount = 0

      function processDirectory(dir: string) {
        const entries = fs.readdirSync(dir, { withFileTypes: true })
        for (const entry of entries) {
          const fullPath = require('path').join(dir, entry.name)
          if (entry.isDirectory()) {
            // Recursive scan for skills inside subfolders (e.g., SKILL.md inside subfolders)
            processDirectory(fullPath)
          } else if (entry.isFile()) {
            const ext = require('path').extname(entry.name).toLowerCase()
            if (ext === '.json') {
              try {
                const content = fs.readFileSync(fullPath, 'utf-8')
                const config = JSON.parse(content)
                if (config.name && config.promptTemplate) {
                  saveSkill({
                    name: config.name,
                    description: config.description || '',
                    promptTemplate: config.promptTemplate,
                    allowedTools: config.allowedTools || []
                  })
                  importedCount++
                }
              } catch { /* ignore invalid JSON */ }
            } else if (ext === '.md') {
              try {
                const content = fs.readFileSync(fullPath, 'utf-8')
                // Parse simple YAML frontmatter (--- ... ---)
                const match = content.match(/^---\s*([\s\S]*?)\s*---\s*([\s\S]*)$/)
                if (match) {
                  const frontmatter = match[1]
                  const promptTemplate = match[2].trim()
                  
                  let name = ''
                  let description = ''
                  
                  const nameMatch = frontmatter.match(/^name:\s*(.+)$/m)
                  if (nameMatch) name = nameMatch[1].trim()
                  
                  const descMatch = frontmatter.match(/^description:\s*(.+)$/m)
                  if (descMatch) description = descMatch[1].trim()
                  
                  if (name && promptTemplate) {
                    saveSkill({
                      name,
                      description,
                      promptTemplate,
                      allowedTools: []
                    })
                    importedCount++
                  }
                }
              } catch { /* ignore invalid MD */ }
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
