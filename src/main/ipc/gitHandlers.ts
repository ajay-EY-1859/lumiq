// ═══════════════════════════════════════════════════════════════════
// Lumiq — Git IPC Handlers
// Status, branch, diff, stage, unstage, discard, commit
// ═══════════════════════════════════════════════════════════════════

import { execSync } from 'child_process'
import { IPC } from '@shared/types'
import type { GitFileChange, GitFileStatus, GitStatusResult } from '@shared/types'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'

function git(cmd: string, cwd: string): string {
  return execSync(`git ${cmd}`, {
    cwd,
    encoding: 'utf8',
    stdio: ['pipe', 'pipe', 'pipe'],
    maxBuffer: 10 * 1024 * 1024 // 10 MB
  }).trim()
}

function isGitRepo(cwd: string): boolean {
  try {
    git('rev-parse --is-inside-work-tree', cwd)
    return true
  } catch {
    return false
  }
}

function parseStatusLine(line: string): GitFileChange | null {
  if (line.length < 4) return null

  const x = line[0] // index (staged) status
  const y = line[1] // worktree status
  const file = line.slice(3).replace(/"(.+)"/, '$1') // strip quotes

  let status: GitFileStatus = 'modified'
  let staged = false

  // Staged changes (index column)
  if (x === 'A') { status = 'added'; staged = true }
  else if (x === 'D') { status = 'deleted'; staged = true }
  else if (x === 'M') { status = 'modified'; staged = true }
  else if (x === 'R') { status = 'renamed'; staged = true }

  // Worktree changes (override if unstaged)
  if (y === 'M') { status = 'modified'; staged = false }
  else if (y === 'D') { status = 'deleted'; staged = false }
  else if (y === '?') { status = 'untracked'; staged = false }
  else if (y === 'U' || x === 'U') { status = 'conflicted'; staged = false }

  // Both staged AND unstaged changes — report as unstaged (user sees the work-tree state)
  if (x !== ' ' && x !== '?' && y !== ' ' && y !== '?') {
    staged = false
  }

  return { file, status, staged }
}

export function registerGitHandlers(): void {
  // ── git status ──
  handleWithTimeout(IPC.GIT_STATUS, IPC_TIMEOUT.long, (_event, workspacePath: string): GitStatusResult => {
    if (!isGitRepo(workspacePath)) {
      return { branch: '', ahead: 0, behind: 0, changes: [], isRepo: false }
    }

    // Branch name
    let branch = ''
    try {
      branch = git('rev-parse --abbrev-ref HEAD', workspacePath)
    } catch { /* empty repo or detached HEAD */ }

    // Ahead/behind
    let ahead = 0
    let behind = 0
    try {
      const ab = git('rev-list --left-right --count HEAD...@{u}', workspacePath)
      const [a, b] = ab.split(/\s+/)
      ahead = parseInt(a, 10) || 0
      behind = parseInt(b, 10) || 0
    } catch { /* no upstream */ }

    // Porcelain status
    const changes: GitFileChange[] = []
    try {
      const raw = git('status --porcelain', workspacePath)
      if (raw) {
        for (const line of raw.split('\n')) {
          const change = parseStatusLine(line)
          if (change) changes.push(change)
        }
      }
    } catch { /* ignore */ }

    return { branch, ahead, behind, changes, isRepo: true }
  })

  // ── git branch list ──
  handleWithTimeout(IPC.GIT_BRANCH, IPC_TIMEOUT.short, (_event, workspacePath: string): string[] => {
    if (!isGitRepo(workspacePath)) return []
    try {
      const raw = git('branch --list', workspacePath)
      return raw
        .split('\n')
        .map(b => b.replace(/^\*?\s*/, '').trim())
        .filter(Boolean)
    } catch {
      return []
    }
  })

  // ── git diff for a single file ──
  handleWithTimeout(IPC.GIT_DIFF_FILE, IPC_TIMEOUT.short, (_event, args: { workspacePath: string; file: string; staged: boolean }): string => {
    if (!isGitRepo(args.workspacePath)) return ''
    try {
      const stagedFlag = args.staged ? '--cached' : ''
      return git(`diff ${stagedFlag} -- "${args.file}"`, args.workspacePath)
    } catch {
      return ''
    }
  })

  // ── git stage ──
  handleWithTimeout(IPC.GIT_STAGE, IPC_TIMEOUT.short, (_event, args: { workspacePath: string; files: string[] }): boolean => {
    try {
      const fileArgs = args.files.map(f => `"${f}"`).join(' ')
      git(`add ${fileArgs}`, args.workspacePath)
      return true
    } catch {
      return false
    }
  })

  // ── git unstage ──
  handleWithTimeout(IPC.GIT_UNSTAGE, IPC_TIMEOUT.short, (_event, args: { workspacePath: string; files: string[] }): boolean => {
    try {
      const fileArgs = args.files.map(f => `"${f}"`).join(' ')
      git(`reset HEAD ${fileArgs}`, args.workspacePath)
      return true
    } catch {
      return false
    }
  })

  // ── git discard (checkout/restore) ──
  handleWithTimeout(IPC.GIT_DISCARD, IPC_TIMEOUT.short, (_event, args: { workspacePath: string; files: string[] }): boolean => {
    try {
      const fileArgs = args.files.map(f => `"${f}"`).join(' ')
      git(`checkout -- ${fileArgs}`, args.workspacePath)
      return true
    } catch {
      return false
    }
  })

  // ── git commit ──
  handleWithTimeout(IPC.GIT_COMMIT, IPC_TIMEOUT.long, (_event, args: { workspacePath: string; message: string }): boolean => {
    if (!args.message.trim()) return false
    try {
      git(`commit -m "${args.message.replace(/"/g, '\\"')}"`, args.workspacePath)
      return true
    } catch {
      return false
    }
  })

  // ── git get ignored files ──
  handleWithTimeout(IPC.GIT_IGNORED, IPC_TIMEOUT.long, (_event, workspacePath: string): string[] => {
    if (!isGitRepo(workspacePath)) return []
    try {
      const raw = git('ls-files -i -o --exclude-standard --directory', workspacePath)
      return raw.split('\n').map(l => l.trim()).filter(Boolean)
    } catch {
      return []
    }
  })
}
