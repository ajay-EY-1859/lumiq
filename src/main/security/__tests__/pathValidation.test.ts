import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { join, resolve } from 'path'
import { existsSync, mkdirSync, rmSync, writeFileSync } from 'fs'
import {
  setWorkspaceRoot,
  setAllowedExtraPaths,
  getAllowedExtraPaths,
  validatePathWithinWorkspace
} from '../pathValidation'

describe('pathValidation - Extra Allowed Paths (Attachments)', () => {
  const testRoot = join(__dirname, 'temp_path_validation_test')
  const workspaceRoot = join(testRoot, 'workspace')
  const externalDir = join(testRoot, 'external')
  const externalFile = join(testRoot, 'external_file.txt')

  beforeAll(() => {
    if (!existsSync(testRoot)) {
      mkdirSync(testRoot, { recursive: true })
    }
    if (!existsSync(workspaceRoot)) {
      mkdirSync(workspaceRoot, { recursive: true })
    }
    if (!existsSync(externalDir)) {
      mkdirSync(externalDir, { recursive: true })
    }
    writeFileSync(externalFile, 'external content')
    setWorkspaceRoot(workspaceRoot)
  })

  afterAll(() => {
    setWorkspaceRoot(null)
    setAllowedExtraPaths([])
    try {
      rmSync(testRoot, { recursive: true, force: true })
    } catch {}
  })

  it('should validate paths within the workspace successfully by default', () => {
    const insidePath = join(workspaceRoot, 'file.txt')
    const result = validatePathWithinWorkspace(insidePath)
    expect(resolve(result)).toBe(resolve(insidePath))
  })

  it('should throw an error for paths outside the workspace by default', () => {
    const outsidePath = join(externalDir, 'file.txt')
    expect(() => validatePathWithinWorkspace(outsidePath)).toThrow(/outside.*workspace/i)
  })

  it('should allow explicitly attached extra paths even if they are outside the workspace', () => {
    setAllowedExtraPaths([externalDir, externalFile])
    expect(getAllowedExtraPaths()).toContain(resolve(externalDir))
    expect(getAllowedExtraPaths()).toContain(resolve(externalFile))

    // 1. Check exact external file
    const fileResult = validatePathWithinWorkspace(externalFile)
    expect(resolve(fileResult)).toBe(resolve(externalFile))

    // 2. Check file inside external directory (non-existent yet)
    const insideExternalFile = join(externalDir, 'subfolder', 'file.txt')
    const dirResult = validatePathWithinWorkspace(insideExternalFile)
    expect(resolve(dirResult)).toBe(resolve(insideExternalFile))
  })

  it('should still reject paths that are outside the workspace and not in allowed extra paths', () => {
    const unauthorizedPath = join(testRoot, 'unauthorized_file.txt')
    expect(() => validatePathWithinWorkspace(unauthorizedPath)).toThrow()
  })
})
