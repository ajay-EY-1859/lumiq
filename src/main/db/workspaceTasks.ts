import { existsSync, readFileSync, readdirSync } from 'fs'
import { join, resolve } from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from './database'
import type { WorkspaceTaskDefinition } from '@shared/types'
import { AutocompleteService } from '../services/AutocompleteService'

type WorkspaceTaskRow = {
  id: string
  workspacePath: string
  name: string
  command: string
  args: string
  source: 'package' | 'custom'
  createdAt: string
  updatedAt: string
}

const ALLOWED_TOOLS = ["npm", "npx", "node", "yarn", "pnpm", "python", "python3", "go", "cargo", "java", "javac", "gcc", "g++", "clang", "clang++", "make", "mingw32-make", "dotnet"]

function isAllowedTool(command: string): boolean {
  if (ALLOWED_TOOLS.includes(command)) return true
  if (command.startsWith('./') || command.startsWith('.\\')) return true
  if (command.endsWith('.sh') || command.endsWith('.bat') || command.endsWith('.cmd')) return true
  return false
}

function mapRow(row: WorkspaceTaskRow): WorkspaceTaskDefinition {
  let args: string[] = []
  try {
    args = JSON.parse(row.args) as string[]
  } catch {
    args = []
  }
  return { ...row, args }
}

export function listWorkspaceTasks(workspacePath: string): WorkspaceTaskDefinition[] {
  const safePath = resolve(workspacePath)
  const rows = getDatabase()
    .prepare(
      `SELECT id, workspace_path as workspacePath, name, command, args, source,
              created_at as createdAt, updated_at as updatedAt
       FROM workspace_tasks
       WHERE workspace_path = ?
       ORDER BY source DESC, name`
     )
    .all(safePath) as WorkspaceTaskRow[]
  return rows.map(mapRow)
}

export function saveWorkspaceTask(
  task: Omit<WorkspaceTaskDefinition, 'id' | 'createdAt' | 'updatedAt'> & {
    id?: string
    createdAt?: string
    updatedAt?: string
  }
): WorkspaceTaskDefinition {
  const workspacePath = resolve(task.workspacePath)
  const id = task.id || uuidv4()

  getDatabase()
    .prepare(
      `INSERT INTO workspace_tasks (id, workspace_path, name, command, args, source, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
       ON CONFLICT(workspace_path, name) DO UPDATE SET
         command = excluded.command,
         args = excluded.args,
         source = CASE
           WHEN workspace_tasks.source = 'custom' AND excluded.source = 'package'
           THEN workspace_tasks.source
           ELSE excluded.source
         END,
         updated_at = CURRENT_TIMESTAMP`
    )
    .run(id, workspacePath, task.name.trim(), task.command.trim(), JSON.stringify(task.args), task.source)

  const saved = listWorkspaceTasks(workspacePath).find((item) => item.name === task.name.trim())
  if (!saved) throw new Error('Failed to save workspace task')
  return saved
}

export function deleteWorkspaceTask(workspacePath: string, name: string): boolean {
  return (
    getDatabase()
      .prepare(`DELETE FROM workspace_tasks WHERE workspace_path = ? AND name = ?`)
      .run(resolve(workspacePath), name).changes > 0
  )
}

export async function syncPackageJsonTasks(workspacePath: string): Promise<WorkspaceTaskDefinition[]> {
  const safePath = resolve(workspacePath)
  
  // 1. Sync package.json (Node/JS/TS)
  const packageJsonPath = join(safePath, 'package.json')
  if (existsSync(packageJsonPath)) {
    try {
      const raw = readFileSync(packageJsonPath, 'utf-8')
      const pkg = JSON.parse(raw) as { scripts?: Record<string, string> }
      const scripts = pkg.scripts || {}

      for (const name of Object.keys(scripts)) {
        saveWorkspaceTask({
          workspacePath: safePath,
          name: `npm:${name}`,
          command: 'npm',
          args: ['run', name],
          source: 'package'
        })
      }
    } catch (err) {
      console.error('[workspaceTasks] Failed to sync package.json scripts:', err)
    }
  }

  // Gather workspace directory contents to auto-detect other languages
  let hasGo = false
  let hasPy = false
  let hasRs = false
  let hasJava = false
  let hasCs = false
  let hasC = false
  let hasCpp = false
  let pythonMainFile = 'main.py'

  try {
    const files = readdirSync(safePath)
    for (const file of files) {
      const ext = file.split('.').pop()?.toLowerCase()
      if (ext === 'go') hasGo = true
      if (ext === 'py') {
        hasPy = true
        if (file === 'main.py' || file === 'app.py' || file === 'run.py') {
          pythonMainFile = file
        }
      }
      if (ext === 'rs' || file === 'Cargo.toml') hasRs = true
      if (ext === 'java') hasJava = true
      if (ext === 'cs' || file.endsWith('.csproj')) hasCs = true
      if (ext === 'c') hasC = true
      if (ext === 'cpp' || ext === 'cc' || ext === 'cxx') hasCpp = true
    }
  } catch (err) {
    console.error('[workspaceTasks] Failed to read directory files for auto-sync:', err)
  }

  // 2. Check Cargo.toml (Rust)
  const cargoTomlPath = join(safePath, 'Cargo.toml')
  if (existsSync(cargoTomlPath) || hasRs) {
    saveWorkspaceTask({
      workspacePath: safePath,
      name: 'cargo:build',
      command: 'cargo',
      args: ['build'],
      source: 'package'
    })
    saveWorkspaceTask({
      workspacePath: safePath,
      name: 'cargo:run',
      command: 'cargo',
      args: ['run'],
      source: 'package'
    })
    saveWorkspaceTask({
      workspacePath: safePath,
      name: 'cargo:test',
      command: 'cargo',
      args: ['test'],
      source: 'package'
    })
  }

  // 3. Check Python
  if (hasPy) {
    saveWorkspaceTask({
      workspacePath: safePath,
      name: 'python:run',
      command: 'python',
      args: [pythonMainFile],
      source: 'package'
    })
  }

  // 4. Check Go
  if (hasGo) {
    saveWorkspaceTask({
      workspacePath: safePath,
      name: 'go:build',
      command: 'go',
      args: ['build'],
      source: 'package'
    })
    saveWorkspaceTask({
      workspacePath: safePath,
      name: 'go:run',
      command: 'go',
      args: ['run', '.'],
      source: 'package'
    })
    saveWorkspaceTask({
      workspacePath: safePath,
      name: 'go:test',
      command: 'go',
      args: ['test', './...'],
      source: 'package'
    })
  }

  // 5. Check Java
  if (hasJava) {
    saveWorkspaceTask({
      workspacePath: safePath,
      name: 'java:compile',
      command: 'javac',
      args: ['*.java'],
      source: 'package'
    })
    saveWorkspaceTask({
      workspacePath: safePath,
      name: 'java:run',
      command: 'java',
      args: ['Main'],
      source: 'package'
    })
  }

  // 6. Check C / C++
  const makefilePath = join(safePath, 'Makefile')
  if (existsSync(makefilePath)) {
    const makeCmd = process.platform === 'win32' ? 'mingw32-make' : 'make'
    saveWorkspaceTask({
      workspacePath: safePath,
      name: 'make:build',
      command: makeCmd,
      args: [],
      source: 'package'
    })
  } else {
    if (hasCpp) {
      saveWorkspaceTask({
        workspacePath: safePath,
        name: 'g++:compile',
        command: 'g++',
        args: ['-o', 'main', '*.cpp'],
        source: 'package'
      })
    }
    if (hasC) {
      saveWorkspaceTask({
        workspacePath: safePath,
        name: 'gcc:compile',
        command: 'gcc',
        args: ['-o', 'main', '*.c'],
        source: 'package'
      })
    }
  }

  // 7. Check C#
  if (hasCs) {
    saveWorkspaceTask({
      workspacePath: safePath,
      name: 'dotnet:build',
      command: 'dotnet',
      args: ['build'],
      source: 'package'
    })
    saveWorkspaceTask({
      workspacePath: safePath,
      name: 'dotnet:run',
      command: 'dotnet',
      args: ['run'],
      source: 'package'
    })
    saveWorkspaceTask({
      workspacePath: safePath,
      name: 'dotnet:test',
      command: 'dotnet',
      args: ['test'],
      source: 'package'
    })
  }

  // 8. Offline Rule-based README.md parser
  const readmePath = join(safePath, 'README.md')
  if (existsSync(readmePath)) {
    try {
      const content = readFileSync(readmePath, 'utf-8')
      const codeBlockRegex = /```(?:[a-zA-Z0-9_-]+)?\n([\s\S]*?)\n```/g
      let match
      while ((match = codeBlockRegex.exec(content)) !== null) {
        const code = match[1]
        const lines = code.split(/\r?\n/).map(line => line.trim())
        for (const line of lines) {
          if (!line || line.startsWith('#') || line.startsWith('//')) continue

          // Remove shell prompt symbols ($ or >) from beginning of line
          const cleanLine = line.replace(/^[$>\s]+/, '').trim()
          if (!cleanLine) continue

          const parts = cleanLine.split(/\s+/)
          const command = parts[0]
          const args = parts.slice(1)

          if (isAllowedTool(command)) {
            let taskName = `readme:${command}`
            if (command === 'npm' && args[0] === 'run') {
              taskName = `readme:npm:${args[1] || 'run'}`
            } else if (command === 'cargo' || command === 'go' || command === 'dotnet') {
              taskName = `readme:${command}:${args[0] || 'run'}`
            } else if (command === 'python' || command === 'python3') {
              taskName = `readme:python:${args[0] || 'run'}`
            } else {
              taskName = `readme:${command}:${args.join(' ') || 'run'}`
            }

            if (taskName.length > 40) {
              taskName = taskName.substring(0, 37) + '...'
            }

            saveWorkspaceTask({
              workspacePath: safePath,
              name: taskName,
              command,
              args,
              source: 'package'
            })
          }
        }
      }
    } catch (err) {
      console.error('[workspaceTasks] Failed to parse README.md tasks offline:', err)
    }
  }

  // 9. AI-assisted target auto-discovery (runs if defaultProvider is active)
  try {
    const db = getDatabase()
    const defaultProviderRow = db.prepare("SELECT value FROM settings WHERE key = 'defaultProvider'").get() as { value: string } | undefined
    const defaultModelRow = db.prepare("SELECT value FROM settings WHERE key = 'defaultModel'").get() as { value: string } | undefined
    
    if (defaultProviderRow?.value && defaultModelRow?.value) {
      const providerName = defaultProviderRow.value
      const modelName = defaultModelRow.value
      
      const config = db.prepare("SELECT api_key_encrypted FROM api_configs WHERE provider = ? AND is_active = 1").get(providerName) as { api_key_encrypted?: string } | undefined
      // Only proceed if it is ollama or has configured active key
      if (providerName === 'ollama' || (config?.api_key_encrypted && config.api_key_encrypted.trim().length > 0)) {
        if (existsSync(readmePath)) {
          const readmeContent = readFileSync(readmePath, 'utf-8')
          const cappedReadme = readmeContent.slice(0, 4000)

          const systemPrompt = `You are a project configuration discovery agent.
Your job is to read the content of a README.md file and extract the exact commands used to build, compile, or run the project.
Output the discovered commands as a valid JSON array of objects. Each object must have:
- "name": a short descriptive name (e.g. "npm:dev", "gcc:compile", "python:run")
- "command": the executable command (e.g. "npm", "gcc", "python")
- "args": an array of arguments (e.g. ["run", "dev"])

Example Output:
[
  {"name": "npm:dev", "command": "npm", "args": ["run", "dev"]},
  {"name": "gcc:compile", "command": "gcc", "args": ["-o", "main", "main.c"]}
]

Do NOT write any explanation or markdown code blocks. Output ONLY the raw JSON array. If no commands are discovered, return an empty array [].`

          const prompt = `Here is the README.md content:\n\n${cappedReadme}\n\nExtract the build, run, or compile commands:`
          const response = await AutocompleteService.predictOneShot(prompt, systemPrompt, providerName, modelName)
          
          const cleanResponse = response.replace(/```json/g, '').replace(/```/g, '').trim()
          if (cleanResponse.startsWith('[') && cleanResponse.endsWith(']')) {
            const discovered = JSON.parse(cleanResponse) as { name: string; command: string; args: string[] }[]
            for (const item of discovered) {
              if (item.name && item.command && Array.isArray(item.args)) {
                if (isAllowedTool(item.command)) {
                  saveWorkspaceTask({
                    workspacePath: safePath,
                    name: `ai:${item.name}`,
                    command: item.command,
                    args: item.args,
                    source: 'package'
                  })
                }
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error('[workspaceTasks] AI task discovery failed or skipped:', err)
  }

  return listWorkspaceTasks(safePath)
}
