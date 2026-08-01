import { create } from 'zustand'
import { normalizePath } from '@renderer/utils/paths'

export interface EditorTab {
  id: string // full path
  name: string
  content: string
  originalContent: string
  isDirty: boolean
}

interface EditorState {
  tabs: EditorTab[]
  activeTabId: string | null
  
  openFile: (path: string, name: string) => Promise<void>
  closeTab: (id: string) => void
  setActiveTab: (id: string) => void
  updateTabContent: (id: string, content: string) => void
  saveTab: (id: string) => Promise<void>
  reloadTab: (id: string, force?: boolean) => Promise<void>
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openFile: async (path, name) => {
    const normPath = normalizePath(path)
    const { tabs } = get()
    const existing = tabs.find(t => t.id === normPath)
    if (existing) {
      set({ activeTabId: normPath })
      return
    }

    try {
      const content = await window.electronAPI.fs.readFile(normPath)
      const newTab: EditorTab = {
        id: normPath,
        name,
        content,
        originalContent: content,
        isDirty: false
      }
      set({
        tabs: [...tabs, newTab],
        activeTabId: normPath
      })
    } catch (e) {
      console.error('Failed to read file', e)
    }
  },

  closeTab: (id) => {
    const normId = normalizePath(id)
    set((state) => {
      const newTabs = state.tabs.filter(t => t.id !== normId)
      let newActiveId = state.activeTabId
      if (state.activeTabId === normId) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null
      }
      return { tabs: newTabs, activeTabId: newActiveId }
    })
  },

  setActiveTab: (id) => {
    set({ activeTabId: normalizePath(id) })
  },

  updateTabContent: (id, content) => {
    const normId = normalizePath(id)
    set((state) => ({
      tabs: state.tabs.map(t => 
        t.id === normId 
          ? { ...t, content, isDirty: content !== t.originalContent }
          : t
      )
    }))
  },

  saveTab: async (id) => {
    const normId = normalizePath(id)
    const tab = get().tabs.find(t => t.id === normId)
    if (!tab) return

    const writtenContent = tab.content
    try {
      await window.electronAPI.fs.writeFile(normId, writtenContent)
      set((state) => {
        const currentTab = state.tabs.find(t => t.id === normId)
        if (!currentTab) return state

        const hasUnsavedChanges = currentTab.content !== writtenContent

        return {
          tabs: state.tabs.map(t =>
            t.id === normId
              ? { ...t, originalContent: writtenContent, isDirty: hasUnsavedChanges }
              : t
          )
        }
      })
    } catch (e) {
      console.error('Failed to save file', e)
    }
  },

  reloadTab: async (id, force = false) => {
    const normId = normalizePath(id)
    const tab = get().tabs.find(t => t.id === normId)
    if (!tab) return

    if (tab.isDirty && !force) {
      console.warn(`[editorStore] Skipping reload of ${normId} because it has unsaved changes.`)
      return
    }

    try {
      const content = await window.electronAPI.fs.readFile(normId)
      set((state) => ({
        tabs: state.tabs.map(t =>
          t.id === normId
            ? { ...t, content, originalContent: content, isDirty: false }
            : t
        )
      }))
    } catch (e) {
      console.error('Failed to reload file', e)
    }
  }
}))

