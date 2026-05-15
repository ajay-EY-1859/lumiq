import { ipcMain } from 'electron'
import { IPC, type CustomSkill } from '@shared/types'
import { deleteSkill, listSkills, saveSkill } from '../db/skills'
import fs from 'node:fs'

export function registerSkillHandlers(): void {
  ipcMain.handle(IPC.SKILL_LIST, () => listSkills())
  ipcMain.handle(
    IPC.SKILL_SAVE,
    (_event, skill: Partial<CustomSkill> & Pick<CustomSkill, 'name' | 'promptTemplate'>) => {
      if (!skill.name?.trim() || !skill.promptTemplate?.trim()) {
        throw new Error('Skill name and prompt template are required')
      }
      return saveSkill(skill)
    }
  )
  ipcMain.handle(IPC.SKILL_DELETE, (_event, id: string) => deleteSkill(id))

  ipcMain.handle(IPC.SKILL_IMPORT, async (_event, filePath: string) => {
    try {
      const content = fs.readFileSync(filePath, 'utf-8')
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
}
