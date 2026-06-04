import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync, readFileSync } from 'fs'

const tempUserDataPath = join(__dirname, 'temp_composer_service_test')
const workspacePath = join(__dirname, 'temp_composer_workspace').replace(/\\/g, '/')

vi.mock('electron', () => {
  const BrowserWindow = {
    getFocusedWindow: () => null,
    getAllWindows: () => []
  }
  const app = {
    getPath: (name: string) => {
      if (name === 'userData') {
        return tempUserDataPath
      }
      return '/tmp'
    }
  }
  return {
    app,
    BrowserWindow,
    default: {
      app,
      BrowserWindow
    }
  }
})

vi.mock('../../auth/devMode', () => {
  return {
    isDeveloperMode: () => false
  }
})


import { ComposerService } from '../ComposerService'

describe('ComposerService Orchestration & Staging Diffs', () => {
  beforeAll(() => {
    if (!existsSync(tempUserDataPath)) {
      mkdirSync(tempUserDataPath, { recursive: true })
    }
    if (!existsSync(workspacePath)) {
      mkdirSync(workspacePath, { recursive: true })
    }
  })

  afterAll(() => {
    try {
      rmSync(tempUserDataPath, { recursive: true, force: true })
      rmSync(workspacePath, { recursive: true, force: true })
    } catch {}
  })

  it('should initialize and start task in planning state', async () => {
    const service = ComposerService.getInstance()
    await service.startComposerTask('Build string utilities', workspacePath)

    const diffInfo = service.getStagedFileContent('non_existent_file.ts')
    expect(diffInfo.original).toBe('')
    expect(diffInfo.proposed).toBe('')

    // Cancel task immediately
    service.cancelActiveTask()
  })

  it('should stage files and allow retrieving diffs', async () => {
    const service = ComposerService.getInstance()
    const filePath = join(workspacePath, 'test_file.ts').replace(/\\/g, '/')

    // Simulate Coder staging a file write
    await service.startComposerTask('Task', workspacePath)
    
    // Set mock staged file manually in internal state
    const stagedFilesMap = (service as any).stagedFiles
    stagedFilesMap.set(filePath, 'console.log("Proposed!");')

    const diff = service.getStagedFileContent(filePath)
    expect(diff.original).toBe('')
    expect(diff.proposed).toBe('console.log("Proposed!");')

    service.cancelActiveTask()
  })

  it('should commit changes to disk on approve', async () => {
    const service = ComposerService.getInstance()
    const filePath = join(workspacePath, 'test_write.ts').replace(/\\/g, '/')

    await service.startComposerTask('Task', workspacePath)

    // Simulate coder staging a file
    const stagedFilesMap = (service as any).stagedFiles
    stagedFilesMap.set(filePath, 'const app = "lumiq";')
    ;(service as any).task.stagedFiles.push({ path: filePath, status: 'created' })

    // Approve & Commit
    service.approveChanges()

    expect(existsSync(filePath)).toBe(true)
    const savedContent = readFileSync(filePath, 'utf8')
    expect(savedContent).toBe('const app = "lumiq";')

    // Clean up created file
    try {
      rmSync(filePath, { force: true })
    } catch {}
  })

  it('should clear staging on reject', async () => {
    const service = ComposerService.getInstance()
    const filePath = join(workspacePath, 'test_reject.ts').replace(/\\/g, '/')

    await service.startComposerTask('Task', workspacePath)

    const stagedFilesMap = (service as any).stagedFiles
    stagedFilesMap.set(filePath, 'console.log("Not saved");')

    // Reject & Abort
    service.rejectChanges()

    expect(existsSync(filePath)).toBe(false)
    expect(stagedFilesMap.size).toBe(0)
  })
})
