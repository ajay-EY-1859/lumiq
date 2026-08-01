import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync } from 'fs'

const tempUserDataPath = join(__dirname, 'temp_workspace_memory_test')

// Mock electron app path
vi.mock('electron', () => {
  return {
    app: {
      getPath: (name: string) => {
        if (name === 'userData') {
          return tempUserDataPath
        }
        return '/tmp'
      }
    },
    BrowserWindow: {
      getFocusedWindow: () => null,
      getAllWindows: () => []
    }
  }
})

vi.mock('@electron-toolkit/utils', () => {
  return {
    is: {
      dev: true
    }
  }
})

import { initDatabase, closeDatabase } from '../../db/database'
import { workspaceMemoryService } from '../../services/WorkspaceMemoryService'

describe('Workspace Memory Service Tests', () => {
  beforeAll(() => {
    if (!existsSync(tempUserDataPath)) {
      mkdirSync(tempUserDataPath, { recursive: true })
    }
    initDatabase()
  })

  afterAll(() => {
    try {
      closeDatabase()
    } catch {
      // ignore
    }
    try {
      rmSync(tempUserDataPath, { recursive: true, force: true })
    } catch {
      // ignore
    }
  })

  it('should successfully save and query workspace episodic memories', () => {
    const workspace = '/mock/project/root'
    
    // Add memory
    workspaceMemoryService.addMemory(
      workspace,
      'session-mem-1',
      'debugging',
      'Resolved circular dependency in auth providers by refactoring to factory pattern',
      { filePath: 'src/main/providers/ProviderFactory.ts', command: 'npm run build' }
    )

    // Retrieve memories segment
    const segment = workspaceMemoryService.getRelevantMemoriesSegment(workspace, 'circular dependency factory')
    
    expect(segment).toContain('HISTORICAL WORKSPACE EPISODIC MEMORIES')
    expect(segment).toContain('Resolved circular dependency')
    expect(segment).toContain('ProviderFactory.ts')
    expect(segment).toContain('DEBUGGING')
  })

  it('should filter memories by keywords properly', () => {
    const workspace = '/mock/project/root'
    
    workspaceMemoryService.addMemory(
      workspace,
      'session-mem-2',
      'error_recovery',
      'Fixed TS compile error TS2339 in AgentLoop by modifying the options interface',
      { command: 'npm run typecheck' }
    )

    // Keywords should match
    const segmentMatch = workspaceMemoryService.getRelevantMemoriesSegment(workspace, 'AgentLoop compile error options')
    expect(segmentMatch).toContain('Fixed TS compile error TS2339')

    // Short or unrelated keywords should fall back
    const segmentFallback = workspaceMemoryService.getRelevantMemoriesSegment(workspace, 'completely unrelated query')
    expect(segmentFallback).toContain('Fixed TS compile error TS2339') // Falls back to recent memory
  })
})
