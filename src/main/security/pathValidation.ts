import { relative, resolve, sep, dirname } from 'path'
import { statSync, existsSync, realpathSync } from 'fs'

let dynamicWorkspaceRoot: string | null = null
let allowedExtraPaths: string[] = []

export function setWorkspaceRoot(path: string | null): void {
  dynamicWorkspaceRoot = path ? resolve(path) : null
}

export function setAllowedExtraPaths(paths: string[]): void {
  allowedExtraPaths = paths.map((p) => resolve(p))
}

export function getAllowedExtraPaths(): string[] {
  return allowedExtraPaths
}

export function validateWorkspaceRootCandidate(path: string | null): string | null {
  if (path === null) return null
  if (typeof path !== 'string' || path.includes('\0')) {
    throw new Error('Invalid workspace path')
  }

  const resolved = resolve(path)
  const stat = statSync(resolved)
  if (!stat.isDirectory()) {
    throw new Error('Workspace path must be a directory')
  }
  return resolved
}

export function getWorkspaceRoot(): string {
  if (!dynamicWorkspaceRoot) {
    throw new Error('Workspace is not bound. Bind a workspace before using file or tool operations.')
  }
  return dynamicWorkspaceRoot
}

function isPathInside(target: string, parent: string): boolean {
  const resolvedTarget = resolve(target)
  const resolvedParent = resolve(parent)

  try {
    const realParent = realpathSync(resolvedParent)
    let checkTarget = resolvedTarget

    // Find closest existing ancestor path for target
    let tempPath = resolvedTarget
    while (tempPath && !existsSync(tempPath)) {
      const dir = dirname(tempPath)
      if (dir === tempPath) break
      tempPath = dir
    }

    if (tempPath && existsSync(tempPath)) {
      checkTarget = realpathSync(tempPath)
    }

    const parentStat = statSync(realParent)
    if (parentStat.isFile()) {
      return realParent === checkTarget
    }

    const rel = relative(realParent, checkTarget)
    return rel === '' || (!rel.startsWith('..') && !rel.includes(`..${sep}`))
  } catch {
    // Fall back to simple relative check if file system queries fail
    const rel = relative(resolvedParent, resolvedTarget)
    return rel === '' || (!rel.startsWith('..') && !rel.includes(`..${sep}`))
  }
}

export function validatePathWithinWorkspace(targetPath: string): string {
  if (typeof targetPath !== 'string' || targetPath.includes('\0')) {
    throw new Error('Invalid file path')
  }

  const resolved = resolve(targetPath)

  // --- Check against allowed extra paths (e.g. explicitly attached files/folders) ---
  for (const allowedPath of allowedExtraPaths) {
    if (isPathInside(resolved, allowedPath)) {
      return resolved
    }
  }

  const workspaceRoot = getWorkspaceRoot()

  // --- Strict Symlink Traversal Protection ---
  try {
    const realWorkspace = realpathSync(workspaceRoot)
    
    // Find closest existing ancestor path
    let checkPath = resolved
    while (checkPath && !existsSync(checkPath)) {
      const parent = dirname(checkPath)
      if (parent === checkPath) break
      checkPath = parent
    }

    if (checkPath && existsSync(checkPath)) {
      const realTarget = realpathSync(checkPath)
      // Check if realTarget is inside realWorkspace
      const rel = relative(realWorkspace, realTarget)
      if (
        rel !== '' &&
        (rel.startsWith('..') || rel.includes(`..${sep}`))
      ) {
        throw new Error(`Boundary Escape Detected: Target path resolves outside of workspace.`)
      }
    }
  } catch (err) {
    if ((err as Error).message.includes('Boundary Escape')) {
      throw err
    }
  }

  // --- Standard Relative Path Check ---
  const relativePath = relative(workspaceRoot, resolved)

  if (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !relativePath.includes(`..${sep}`))
  ) {
    return resolved
  }

  throw new Error(`Path traversal detected — access denied. Path "${targetPath}" is outside workspace "${workspaceRoot}"`)
}

export function parseAttachedPaths(text: string): string[] {
  const paths: string[] = []
  if (!text) return paths
  const match = text.match(/Attached paths:\s*(.*)/i)
  if (match) {
    const pathsText = match[1]
    const pathRegex = /"([^"]+)"/g
    let pathMatch
    while ((pathMatch = pathRegex.exec(pathsText)) !== null) {
      paths.push(pathMatch[1])
    }
  }
  return paths
}

