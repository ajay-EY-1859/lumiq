import { relative, resolve, sep } from 'path'

let dynamicWorkspaceRoot: string | null = null

export function setWorkspaceRoot(path: string | null): void {
  dynamicWorkspaceRoot = path ? resolve(path) : null
}

export function getWorkspaceRoot(): string {
  if (!dynamicWorkspaceRoot) {
    throw new Error('Workspace is not bound. Bind a workspace before using file or tool operations.')
  }
  return dynamicWorkspaceRoot
}

export function validatePathWithinWorkspace(targetPath: string): string {
  if (typeof targetPath !== 'string' || targetPath.includes('\0')) {
    throw new Error('Invalid file path')
  }

  const resolved = resolve(targetPath)
  const workspaceRoot = getWorkspaceRoot()
  const relativePath = relative(workspaceRoot, resolved)

  if (
    relativePath === '' ||
    (!relativePath.startsWith('..') && !relativePath.includes(`..${sep}`))
  ) {
    return resolved
  }

  throw new Error(`Path traversal detected — access denied. Path "${targetPath}" is outside workspace "${workspaceRoot}"`)
}
