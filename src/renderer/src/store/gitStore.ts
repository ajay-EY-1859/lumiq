// ═══════════════════════════════════════════════════════════════════
// Lumiq — Git Store (Version Control State)
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type { GitFileChange, GitStatusResult } from '@shared/types'

interface GitState {
  isRepo: boolean
  branch: string
  ahead: number
  behind: number
  changes: GitFileChange[]
  branches: string[]
  isLoading: boolean
  selectedFile: string | null
  diffContent: string
  commitMessage: string

  refresh: (workspacePath: string) => Promise<void>
  loadBranches: (workspacePath: string) => Promise<void>
  selectFile: (file: string | null) => void
  loadDiff: (workspacePath: string, file: string, staged: boolean) => Promise<void>
  stage: (workspacePath: string, files: string[]) => Promise<void>
  unstage: (workspacePath: string, files: string[]) => Promise<void>
  discard: (workspacePath: string, files: string[]) => Promise<void>
  commit: (workspacePath: string) => Promise<boolean>
  setCommitMessage: (msg: string) => void
}

export const useGitStore = create<GitState>((set, get) => ({
  isRepo: false,
  branch: '',
  ahead: 0,
  behind: 0,
  changes: [],
  branches: [],
  isLoading: false,
  selectedFile: null,
  diffContent: '',
  commitMessage: '',

  refresh: async (workspacePath) => {
    set({ isLoading: true })
    try {
      const result: GitStatusResult = await window.electronAPI.git.status(workspacePath)
      set({
        isRepo: result.isRepo,
        branch: result.branch,
        ahead: result.ahead,
        behind: result.behind,
        changes: result.changes,
        isLoading: false
      })
    } catch {
      set({ isRepo: false, isLoading: false })
    }
  },

  loadBranches: async (workspacePath) => {
    try {
      const branches = await window.electronAPI.git.branches(workspacePath)
      set({ branches })
    } catch {
      set({ branches: [] })
    }
  },

  selectFile: (file) => set({ selectedFile: file }),

  loadDiff: async (workspacePath, file, staged) => {
    try {
      const diff = await window.electronAPI.git.diffFile(workspacePath, file, staged)
      set({ diffContent: diff, selectedFile: file })
    } catch {
      set({ diffContent: '' })
    }
  },

  stage: async (workspacePath, files) => {
    await window.electronAPI.git.stage(workspacePath, files)
    await get().refresh(workspacePath)
  },

  unstage: async (workspacePath, files) => {
    await window.electronAPI.git.unstage(workspacePath, files)
    await get().refresh(workspacePath)
  },

  discard: async (workspacePath, files) => {
    await window.electronAPI.git.discard(workspacePath, files)
    await get().refresh(workspacePath)
  },

  commit: async (workspacePath) => {
    const { commitMessage } = get()
    if (!commitMessage.trim()) return false
    const ok = await window.electronAPI.git.commit(workspacePath, commitMessage)
    if (ok) {
      set({ commitMessage: '' })
      await get().refresh(workspacePath)
    }
    return ok
  },

  setCommitMessage: (msg) => set({ commitMessage: msg })
}))
