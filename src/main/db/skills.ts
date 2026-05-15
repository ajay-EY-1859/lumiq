import { v4 as uuidv4 } from 'uuid'
import type { CustomSkill } from '@shared/types'
import { getDatabase } from './database'

type SkillRow = {
  id: string
  name: string
  description: string
  promptTemplate: string
  allowedTools: string
  createdAt: string
  updatedAt: string
}

function mapRow(row: SkillRow): CustomSkill {
  let allowedTools: string[] = []
  try {
    allowedTools = JSON.parse(row.allowedTools) as string[]
  } catch {
    allowedTools = []
  }
  return { ...row, allowedTools }
}

export function listSkills(): CustomSkill[] {
  const rows = getDatabase()
    .prepare(
      `SELECT id, name, description, prompt_template as promptTemplate,
              allowed_tools as allowedTools, created_at as createdAt, updated_at as updatedAt
       FROM skills
       ORDER BY name`
    )
    .all() as SkillRow[]
  return rows.map(mapRow)
}

export function saveSkill(skill: Partial<CustomSkill> & Pick<CustomSkill, 'name' | 'promptTemplate'>): CustomSkill {
  const id = skill.id || uuidv4()
  getDatabase()
    .prepare(
      `INSERT INTO skills (id, name, description, prompt_template, allowed_tools, updated_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(name) DO UPDATE SET
         description = excluded.description,
         prompt_template = excluded.prompt_template,
         allowed_tools = excluded.allowed_tools,
         updated_at = CURRENT_TIMESTAMP`
    )
    .run(
      id,
      skill.name.trim(),
      skill.description || '',
      skill.promptTemplate,
      JSON.stringify(skill.allowedTools || [])
    )
  const saved = listSkills().find((s) => s.name.toLowerCase() === skill.name.trim().toLowerCase())
  if (!saved) throw new Error('Failed to save skill')
  return saved
}

export function deleteSkill(id: string): boolean {
  return getDatabase().prepare('DELETE FROM skills WHERE id = ?').run(id).changes > 0
}
