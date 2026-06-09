import { BrowserWindow } from 'electron'
import { existsSync, writeFileSync, mkdirSync, readFileSync, lstatSync, rmSync } from 'fs'
import { dirname } from 'path'
import { IPC, ComposerTaskStatus, ComposerState, AgentNodeStatus, Message, ProviderConfig } from '@shared/types'
import { listApiConfigs } from '../db/apiConfigs'
import { ProviderFactory } from '../providers/ProviderFactory'
import { ToolExecutor } from '../agent/ToolExecutor'
import { Disposable } from '@shared/lifecycle'
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions'
import { getService } from '@shared/instantiation/instantiationService'
import { IComposerService } from '@shared/services'

export class ComposerService extends Disposable implements IComposerService {
  private stagedFiles = new Map<string, string>() // filePath -> proposedContent
  private stagedDeletions = new Set<string>() // filePath -> deleted state
  private activeWorkspacePath = ''
  
  private task: ComposerTaskStatus = {
    goal: '',
    state: 'idle',
    nodes: [
      { id: 'architect', label: 'Architect', status: 'idle', logs: [] },
      { id: 'coder', label: 'Coder', status: 'idle', logs: [] },
      { id: 'tester', label: 'Tester', status: 'idle', logs: [] },
      { id: 'reviewer', label: 'Reviewer', status: 'idle', logs: [] }
    ],
    stagedFiles: []
  }

  private timeoutIds: NodeJS.Timeout[] = []
  private abortController: AbortController | null = null
  private backupFiles = new Map<string, string | null>() // filePath -> original content (null if it didn't exist)
  private lastStreamNodeId: string | null = null

  constructor() {
    super()
  }

  public static getInstance(): ComposerService {
    return getService(IComposerService) as ComposerService
  }

  private broadcastStatus(): void {
    const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
    if (window) {
      window.webContents.send(IPC.COMPOSER_STATUS, this.task)
    }
  }

  private addLog(nodeId: 'architect' | 'coder' | 'tester' | 'reviewer', log: string): void {
    const node = this.task.nodes.find((n) => n.id === nodeId)
    if (node) {
      node.logs.push(`[${new Date().toLocaleTimeString()}] ${log}`)
      this.broadcastStatus()
    }
  }

  private streamLog(nodeId: 'architect' | 'coder' | 'tester' | 'reviewer', text: string): void {
    const node = this.task.nodes.find((n) => n.id === nodeId)
    if (node) {
      if (this.lastStreamNodeId === nodeId && node.logs.length > 0) {
        node.logs[node.logs.length - 1] += text
      } else {
        node.logs.push(`[${new Date().toLocaleTimeString()}] ${text}`)
        this.lastStreamNodeId = nodeId
      }
      this.broadcastStatus()
    }
  }

  private resetStreamLog(): void {
    this.lastStreamNodeId = null
  }

  private setNodeStatus(nodeId: 'architect' | 'coder' | 'tester' | 'reviewer', status: AgentNodeStatus): void {
    const node = this.task.nodes.find((n) => n.id === nodeId)
    if (node) {
      node.status = status
      this.broadcastStatus()
    }
  }

  private setTaskState(state: ComposerState): void {
    this.task.state = state
    this.broadcastStatus()
  }

  public isStagingActive(): boolean {
    return this.task.state !== 'idle' && this.task.state !== 'completed' && this.task.state !== 'failed' && this.task.state !== 'cancelled'
  }

  public getStagedContent(filePath: string): string | undefined {
    const cleanPath = filePath.replace(/\\/g, '/')
    if (this.stagedDeletions.has(cleanPath)) {
      return undefined
    }
    return this.stagedFiles.get(cleanPath)
  }

  public isStagedDeleted(filePath: string): boolean {
    const cleanPath = filePath.replace(/\\/g, '/')
    return this.stagedDeletions.has(cleanPath)
  }

  public stageWrite(filePath: string, content: string): void {
    const cleanPath = filePath.replace(/\\/g, '/')
    this.stagedDeletions.delete(cleanPath)
    this.stagedFiles.set(cleanPath, content)

    const existing = this.task.stagedFiles.find((f) => f.path === cleanPath)
    const isNew = !existsSync(cleanPath)
    if (existing) {
      existing.status = isNew ? 'created' : 'modified'
    } else {
      this.task.stagedFiles.push({ path: cleanPath, status: isNew ? 'created' : 'modified' })
    }
    this.broadcastStatus()
  }

  public stageDelete(filePath: string): void {
    const cleanPath = filePath.replace(/\\/g, '/')
    this.stagedFiles.delete(cleanPath)
    this.stagedDeletions.add(cleanPath)

    const existing = this.task.stagedFiles.find((f) => f.path === cleanPath)
    if (existing) {
      existing.status = 'deleted'
    } else {
      this.task.stagedFiles.push({ path: cleanPath, status: 'deleted' })
    }
    this.broadcastStatus()
  }

  public getStagedFileContent(filePath: string): { original: string; proposed: string } {
    const cleanPath = filePath.replace(/\\/g, '/')
    let original = ''
    try {
      if (existsSync(cleanPath)) {
        original = readFileSync(cleanPath, 'utf8')
      }
    } catch {
      // Ignore unreadable original content; proposed content can still be shown.
    }
    const proposed = this.stagedFiles.get(cleanPath) || ''
    return { original, proposed }
  }

  private applyStagedFilesToDisk(): void {
    this.backupFiles.clear()
    for (const [filePath, content] of this.stagedFiles.entries()) {
      const cleanPath = filePath.replace(/\\/g, '/')
      if (existsSync(cleanPath)) {
        this.backupFiles.set(cleanPath, readFileSync(cleanPath, 'utf8'))
      } else {
        this.backupFiles.set(cleanPath, null)
      }

      const parentDir = dirname(cleanPath)
      if (!existsSync(parentDir)) {
        mkdirSync(parentDir, { recursive: true })
      }
      writeFileSync(cleanPath, content, 'utf8')
    }

    for (const filePath of this.stagedDeletions) {
      const cleanPath = filePath.replace(/\\/g, '/')
      if (existsSync(cleanPath)) {
        this.backupFiles.set(cleanPath, readFileSync(cleanPath, 'utf8'))
        try {
          const stats = lstatSync(cleanPath)
          if (stats.isDirectory()) {
            rmSync(cleanPath, { recursive: true, force: true })
          } else {
            rmSync(cleanPath, { force: true })
          }
        } catch {
          // Best-effort rollback data is already captured; continue applying the rest.
        }
      } else {
        this.backupFiles.set(cleanPath, null)
      }
    }
  }

  private restoreFilesFromBackup(): void {
    for (const [filePath, originalContent] of this.backupFiles.entries()) {
      const cleanPath = filePath.replace(/\\/g, '/')
      if (originalContent === null) {
        try {
          if (existsSync(cleanPath)) {
            const stats = lstatSync(cleanPath)
            if (stats.isDirectory()) {
              rmSync(cleanPath, { recursive: true, force: true })
            } else {
              rmSync(cleanPath, { force: true })
            }
          }
        } catch {
          // Best-effort cleanup during rollback.
        }
      } else {
        try {
          const parentDir = dirname(cleanPath)
          if (!existsSync(parentDir)) {
            mkdirSync(parentDir, { recursive: true })
          }
          writeFileSync(cleanPath, originalContent, 'utf8')
        } catch {
          // Best-effort restore during rollback.
        }
      }
    }
    this.backupFiles.clear()
  }

  private async runAgentLoop(
    nodeId: 'architect' | 'coder' | 'tester' | 'reviewer',
    systemPrompt: string,
    allowedTools: string[],
    config: ProviderConfig,
    model: string,
    signal: AbortSignal
  ): Promise<string> {
    const provider = ProviderFactory.create(config)
    const messages: Message[] = [
      {
        id: 'composer_init',
        sessionId: 'composer_temp',
        role: 'user',
        content: `Start your task as ${nodeId}.`,
        createdAt: new Date().toISOString()
      }
    ]

    const MAX_STEPS = 10
    let step = 0
    let lastResponse = ''

    const toolExecutor = new ToolExecutor()
    toolExecutor.setWorkspacePath(this.activeWorkspacePath)

    this.addLog(nodeId, `Swarm node ${nodeId} activated. Running LLM loop...`)

    while (step < MAX_STEPS) {
      if (signal.aborted) {
        throw new Error('Task aborted by user.')
      }
      step++

      this.resetStreamLog()

      const availableTools = toolExecutor.getAvailableTools()
        .filter((t) => allowedTools.includes(t.name))

      const response = await provider.sendMessage(messages, {
        model,
        stream: true,
        systemPrompt,
        tools: availableTools.map((t) => ({
          name: t.name,
          description: t.description,
          inputSchema: t.inputSchema
        })),
        onChunk: (chunk: string) => {
          if (signal.aborted) return
          this.streamLog(nodeId, chunk)
        },
        signal
      })

      lastResponse = response.content
      this.broadcastStatus()

      messages.push({
        id: `assistant_${step}`,
        sessionId: 'composer_temp',
        role: 'assistant',
        content: response.content,
        toolCalls: response.toolCalls,
        createdAt: new Date().toISOString()
      })

      if (response.toolCalls && response.toolCalls.length > 0) {
        for (const tc of response.toolCalls) {
          if (signal.aborted) throw new Error('Task aborted by user.')

          this.addLog(nodeId, `Tool call: ${tc.toolName}`)
          
          const result = await toolExecutor.executeTool(tc.toolName, tc.input, signal)

          this.addLog(
            nodeId,
            `Tool result: ${result.output.substring(0, 300)}${result.output.length > 300 ? '...' : ''}`
          )

          messages.push({
            id: `tool_${step}_${tc.id}`,
            sessionId: 'composer_temp',
            role: 'tool',
            content: result.output,
            toolName: tc.toolName,
            toolCallId: tc.id,
            createdAt: new Date().toISOString()
          })
        }
      } else {
        break
      }
    }

    return lastResponse
  }

  public async startComposerTask(goal: string, workspacePath: string): Promise<void> {
    this.cancelActiveTask()
    this.stagedFiles.clear()
    this.stagedDeletions.clear()
    this.activeWorkspacePath = workspacePath.replace(/\\/g, '/')

    this.task = {
      goal,
      state: 'planning',
      nodes: [
        { id: 'architect', label: 'Architect', status: 'running', logs: [] },
        { id: 'coder', label: 'Coder', status: 'idle', logs: [] },
        { id: 'tester', label: 'Tester', status: 'idle', logs: [] },
        { id: 'reviewer', label: 'Reviewer', status: 'idle', logs: [] }
      ],
      stagedFiles: []
    }

    this.broadcastStatus()

    const abortController = new AbortController()
    this.abortController = abortController
    const signal = abortController.signal

    try {
      // Load AI Config
      const activeConfigs = listApiConfigs().filter((c) => c.isActive)
      const config = activeConfigs.find(c => c.apiKey || c.provider === 'ollama' || c.provider === 'custom') || activeConfigs[0]
      if (!config) {
        this.addLog('architect', 'Error: No active AI provider configuration found. Please add an API key in settings.')
        this.setTaskState('failed')
        return
      }
      const model = config.defaultModel || 'gpt-4o'

      // Step 1: Architect Plan
      const architectSystemPrompt = `You are the Architect agent in a collaborative multi-agent swarm. Your job is to analyze the codebase and design an implementation plan for the user's goal.
Your goal: "${goal}"
First, use tools like GlobTool, ListDirTool, FileReadTool, GrepTool, or SymbolQueryTool to inspect the workspace and understand the codebase.
Then, analyze how to implement the goal.
Finally, write down a clear plan and list the files that need to be created, modified, or deleted. Keep it concise.
Your final response MUST end with a JSON block enclosed in \`\`\`json and \`\`\` in the following format:
{
  "plan": "Description of the plan...",
  "files": [
    { "path": "relative/path/to/file1.ts", "action": "modify" },
    { "path": "relative/path/to/file2.ts", "action": "create" }
  ]
}`
      
      const architectAllowedTools = ['ListDirTool', 'FileReadTool', 'GlobTool', 'GrepTool', 'SymbolQueryTool', 'GitTool']
      const planResult = await this.runAgentLoop('architect', architectSystemPrompt, architectAllowedTools, config, model, signal)
      this.setNodeStatus('architect', 'completed')

      // Transition to Coder
      this.setTaskState('coding')
      this.setNodeStatus('coder', 'running')

      // Parse planResult for structured files list
      let filesToEdit: { path: string; action: 'create' | 'modify' | 'delete' }[] = []
      try {
        const jsonMatch = planResult.match(/```json\s*([\s\S]*?)\s*```/)
        if (jsonMatch && jsonMatch[1]) {
          const parsed = JSON.parse(jsonMatch[1].trim())
          if (parsed && Array.isArray(parsed.files)) {
            filesToEdit = parsed.files
          }
        }
      } catch (err) {
        console.warn('[ComposerService] Failed to parse files list from architect plan:', err)
      }

      // Step 2: Coder Implementation
      if (filesToEdit.length > 0) {
        this.addLog('coder', `Starting parallel coding loops for ${filesToEdit.length} files...`)
        const codingPromises = filesToEdit.map(async (fileEntry) => {
          const relativePath = fileEntry.path
          const action = fileEntry.action
          this.addLog('coder', `Spawning parallel Coder agent for file: ${relativePath} (${action})`)
          
          const fileCoderSystemPrompt = `You are a specialized Coder agent in a collaborative multi-agent swarm. Your job is to implement changes to a single file to satisfy the user's goal.
User's goal: "${goal}"
Architect's plan:
${planResult}

Your specific target file is: "${relativePath}" (Action: ${action})

Use tools like FileReadTool, FileWriteTool, FileEditTool, FileDeleteTool to read the file and write/edit the code.
Note: All your write, edit and delete operations will be automatically staged in memory for the user to review. You will not write directly to the physical disk.
Implement the code completely and correctly. Do not use placeholders.`

          const coderAllowedTools = ['FileReadTool', 'FileWriteTool', 'FileEditTool', 'MultiFileEditTool', 'FileDeleteTool', 'GlobTool', 'GrepTool']
          await this.runAgentLoop('coder', fileCoderSystemPrompt, coderAllowedTools, config, model, signal)
        })
        await Promise.all(codingPromises)
      } else {
        this.addLog('coder', 'No structured files list found in plan. Running fallback single Coder loop...')
        const coderSystemPrompt = `You are the Coder agent in a collaborative multi-agent swarm. Your job is to implement the changes planned by the Architect to satisfy the user's goal.
User's goal: "${goal}"
Architect's plan:
${planResult}

Use tools like FileReadTool, FileWriteTool, FileEditTool, MultiFileEditTool, FileDeleteTool to read existing files and write/edit the code.
Note: All your write, edit and delete operations will be automatically staged in memory for the user to review. You will not write directly to the physical disk.
Implement the code completely and correctly. Do not use placeholders.`

        const coderAllowedTools = ['FileReadTool', 'FileWriteTool', 'FileEditTool', 'MultiFileEditTool', 'FileDeleteTool', 'GlobTool', 'GrepTool']
        await this.runAgentLoop('coder', coderSystemPrompt, coderAllowedTools, config, model, signal)
      }
      this.setNodeStatus('coder', 'completed')

      // Transition to verification (Tester and Reviewer concurrently)
      this.setTaskState('testing')
      this.setNodeStatus('tester', 'running')
      this.setNodeStatus('reviewer', 'running')

      // Apply staged files to disk temporarily so tests can execute on actual updated code
      this.addLog('tester', 'Temporarily applying staged files to disk for verification...')
      this.applyStagedFilesToDisk()

      try {
        const testerPromise = (async () => {
          this.addLog('tester', 'Tester node activated. Running LLM loop...')
          const testerSystemPrompt = `You are the Tester agent in a collaborative multi-agent swarm. Your job is to run the workspace test suite to verify the correctness of the changes made by the Coder.
User's goal: "${goal}"

Use BashTool or PowerShellTool to run the test suite (e.g. "npm test" or the appropriate test command).
Analyze the test output. If any tests fail, explain what went wrong so we can report the failure.`

          const testerAllowedTools = ['BashTool', 'PowerShellTool', 'FileReadTool']
          await this.runAgentLoop('tester', testerSystemPrompt, testerAllowedTools, config, model, signal)
          this.setNodeStatus('tester', 'completed')
        })()

        const reviewerPromise = (async () => {
          this.addLog('reviewer', 'Reviewer node activated. Running LLM loop...')
          // Prepare staged diff list for reviewer context
          let stagedFilesContent = ''
          for (const f of this.task.stagedFiles) {
            stagedFilesContent += `\n--- File: ${f.path} (Status: ${f.status}) ---\n`
            if (f.status !== 'deleted') {
              stagedFilesContent += this.stagedFiles.get(f.path) || ''
            }
          }

          const reviewerSystemPrompt = `You are the Reviewer agent in a collaborative multi-agent swarm. Your job is to review the staged code changes for quality, correctness, security vulnerabilities, and adherence to design principles.
User's goal: "${goal}"
Staged files and their proposed contents:
${stagedFilesContent}

Perform a detailed audit. If everything looks good, state that the changes are approved. If there are issues, list them clearly.`

          const reviewerAllowedTools = ['FileReadTool', 'GlobTool', 'GrepTool']
          await this.runAgentLoop('reviewer', reviewerSystemPrompt, reviewerAllowedTools, config, model, signal)
          this.setNodeStatus('reviewer', 'completed')
        })()

        await Promise.all([testerPromise, reviewerPromise])
      } finally {
        this.addLog('tester', 'Restoring original files on disk...')
        this.restoreFilesFromBackup()
      }

      // Transition to awaiting_approval
      this.setTaskState('awaiting_approval')
    } catch (err) {
      if (signal.aborted) {
        this.addLog('architect', 'Swarm execution aborted by user.')
        return
      }
      const errMessage = (err as Error).message
      console.error('[ComposerService] Swarm failed:', err)
      
      // Determine which node was running and mark it failed
      const activeNode = this.task.nodes.find(n => n.status === 'running')
      if (activeNode) {
        this.setNodeStatus(activeNode.id, 'failed')
        this.addLog(activeNode.id, `Error: ${errMessage}`)
      }
      this.setTaskState('failed')
    } finally {
      this.abortController = null
    }
  }

  public approveChanges(): void {
    try {
      for (const filePath of this.stagedDeletions) {
        const cleanPath = filePath.replace(/\\/g, '/')
        if (existsSync(cleanPath)) {
          const stats = lstatSync(cleanPath)
          if (stats.isDirectory()) {
            rmSync(cleanPath, { recursive: true, force: true })
          } else {
            rmSync(cleanPath, { force: true })
          }
        }
      }
      for (const [filePath, content] of this.stagedFiles.entries()) {
        const cleanPath = filePath.replace(/\\/g, '/')
        const parentDir = dirname(cleanPath)
        if (!existsSync(parentDir)) {
          mkdirSync(parentDir, { recursive: true })
        }
        writeFileSync(cleanPath, content, 'utf8')
      }
      this.stagedFiles.clear()
      this.stagedDeletions.clear()
      this.setTaskState('completed')
      
      const window = BrowserWindow.getFocusedWindow() || BrowserWindow.getAllWindows().find((w) => !w.isDestroyed())
      if (window) {
        for (const f of this.task.stagedFiles) {
          window.webContents.send(IPC.FS_FILE_MODIFIED, f.path)
        }
      }
    } catch (err) {
      console.error('[ComposerService] Failed to approve and write staged files:', err)
      this.setTaskState('failed')
    }
  }

  public rejectChanges(): void {
    this.stagedFiles.clear()
    this.stagedDeletions.clear()
    this.cancelActiveTask()
    this.setTaskState('cancelled')
  }

  public cancelActiveTask(): void {
    if (this.abortController) {
      this.abortController.abort()
      this.abortController = null
    }
    for (const timeoutId of this.timeoutIds) {
      clearTimeout(timeoutId)
    }
    this.timeoutIds = []
    
    for (const node of this.task.nodes) {
      if (node.status === 'running') {
        node.status = 'idle'
        node.logs.push(`[${new Date().toLocaleTimeString()}] Task aborted by user.`)
      }
    }
  }
}

registerSingleton(IComposerService, ComposerService, InstantiationType.Delayed);
