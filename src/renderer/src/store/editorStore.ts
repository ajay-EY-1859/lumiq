import { create } from 'zustand'

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
  reloadTab: (id: string) => Promise<void>
}

export const useEditorStore = create<EditorState>((set, get) => ({
  tabs: [],
  activeTabId: null,

  openFile: async (path, name) => {
    const { tabs } = get()
    const existing = tabs.find(t => t.id === path)
    if (existing) {
      set({ activeTabId: path })
      return
    }

    try {
      const content = await window.electronAPI.fs.readFile(path)
      const newTab: EditorTab = {
        id: path,
        name,
        content,
        originalContent: content,
        isDirty: false
      }
      set({
        tabs: [...tabs, newTab],
        activeTabId: path
      })
    } catch (e) {
      console.error('Failed to read file', e)
    }
  },

  closeTab: (id) => {
    set((state) => {
      const newTabs = state.tabs.filter(t => t.id !== id)
      let newActiveId = state.activeTabId
      if (state.activeTabId === id) {
        newActiveId = newTabs.length > 0 ? newTabs[newTabs.length - 1].id : null
      }
      return { tabs: newTabs, activeTabId: newActiveId }
    })
  },

  setActiveTab: (id) => {
    set({ activeTabId: id })
  },

  updateTabContent: (id, content) => {
    set((state) => ({
      tabs: state.tabs.map(t => 
        t.id === id 
          ? { ...t, content, isDirty: content !== t.originalContent }
          : t
      )
    }))
  },

  saveTab: async (id) => {
    const tab = get().tabs.find(t => t.id === id)
    if (!tab) return

    try {
      await window.electronAPI.fs.writeFile(id, tab.content)
      set((state) => ({
        tabs: state.tabs.map(t =>
          t.id === id
            ? { ...t, originalContent: tab.content, isDirty: false }
            : t
        )
      }))
    } catch (e) {
      console.error('Failed to save file', e)
    }
  },

  reloadTab: async (id) => {
    try {
      const content = await window.electronAPI.fs.readFile(id)
      set((state) => ({
        tabs: state.tabs.map(t =>
          t.id === id
            ? { ...t, content, originalContent: content, isDirty: false }
            : t
        )
      }))
    } catch (e) {
      console.error('Failed to reload file', e)
    }
  }
}))
