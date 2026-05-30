// ═══════════════════════════════════════════════════════════════════
// Lumiq — Search Store (Find in Files)
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type {
  SearchMatch,
  SearchResponse,
  SemanticIndexStatus,
  SemanticSearchMatch,
  SemanticSearchResponse
} from '@shared/types'

interface SearchState {
  mode: 'text' | 'semantic'
  query: string
  isRegex: boolean
  caseSensitive: boolean
  includePattern: string
  excludePattern: string

  results: SearchMatch[]
  totalMatches: number
  truncated: boolean
  elapsed: number
  isSearching: boolean
  error: string | null

  semanticResults: SemanticSearchMatch[]
  semanticTotalMatches: number
  semanticElapsed: number
  semanticStatus: SemanticIndexStatus | null
  isSemanticSearching: boolean
  isIndexing: boolean
  semanticError: string | null

  setMode: (mode: 'text' | 'semantic') => void
  setQuery: (q: string) => void
  setIsRegex: (v: boolean) => void
  setCaseSensitive: (v: boolean) => void
  setIncludePattern: (v: string) => void
  setExcludePattern: (v: string) => void
  search: (workspacePath: string) => Promise<void>
  semanticSearch: (workspacePath: string) => Promise<void>
  loadSemanticStatus: (workspacePath: string) => Promise<void>
  indexWorkspace: (workspacePath: string, force?: boolean) => Promise<void>
  clearResults: () => void
}

export const useSearchStore = create<SearchState>((set, get) => ({
  mode: 'text',
  query: '',
  isRegex: false,
  caseSensitive: false,
  includePattern: '',
  excludePattern: '',

  results: [],
  totalMatches: 0,
  truncated: false,
  elapsed: 0,
  isSearching: false,
  error: null,

  semanticResults: [],
  semanticTotalMatches: 0,
  semanticElapsed: 0,
  semanticStatus: null,
  isSemanticSearching: false,
  isIndexing: false,
  semanticError: null,

  setMode: (mode) => set({ mode }),
  setQuery: (q) => set({ query: q }),
  setIsRegex: (v) => set({ isRegex: v }),
  setCaseSensitive: (v) => set({ caseSensitive: v }),
  setIncludePattern: (v) => set({ includePattern: v }),
  setExcludePattern: (v) => set({ excludePattern: v }),

  search: async (workspacePath) => {
    const { query, isRegex, caseSensitive, includePattern, excludePattern } = get()
    if (!query.trim()) {
      set({ results: [], totalMatches: 0, truncated: false, elapsed: 0 })
      return
    }

    set({ isSearching: true, error: null })
    try {
      const response: SearchResponse = await window.electronAPI.search.files({
        query,
        workspacePath,
        isRegex,
        caseSensitive,
        includePattern: includePattern || undefined,
        excludePattern: excludePattern || undefined
      })
      set({
        results: response.matches,
        totalMatches: response.totalMatches,
        truncated: response.truncated,
        elapsed: response.elapsed,
        isSearching: false
      })
    } catch (err) {
      set({
        results: [],
        totalMatches: 0,
        isSearching: false,
        error: (err as Error).message
      })
    }
  },

  semanticSearch: async (workspacePath) => {
    const { query } = get()
    if (!query.trim()) {
      set({ semanticResults: [], semanticTotalMatches: 0, semanticElapsed: 0 })
      return
    }

    set({ isSemanticSearching: true, semanticError: null })
    try {
      const response: SemanticSearchResponse = await window.electronAPI.semantic.search({
        query,
        workspacePath,
        topK: 8
      })
      set({
        semanticResults: response.matches,
        semanticTotalMatches: response.totalMatches,
        semanticElapsed: response.elapsed,
        isSemanticSearching: false
      })
    } catch (err) {
      set({
        semanticResults: [],
        semanticTotalMatches: 0,
        isSemanticSearching: false,
        semanticError: (err as Error).message
      })
    }
  },

  loadSemanticStatus: async (workspacePath) => {
    try {
      const status = await window.electronAPI.semantic.status(workspacePath)
      set({
        semanticStatus: status,
        isIndexing: status.state === 'indexing',
        semanticError: status.state === 'error' ? status.lastError || 'Semantic index failed' : null
      })
    } catch (err) {
      set({ semanticError: (err as Error).message })
    }
  },

  indexWorkspace: async (workspacePath, force = false) => {
    set({ isIndexing: true, semanticError: null })
    try {
      const status = await window.electronAPI.semantic.index(workspacePath, force)
      set({
        semanticStatus: status,
        isIndexing: status.state === 'indexing',
        semanticError: status.state === 'error' ? status.lastError || 'Semantic index failed' : null
      })
    } catch (err) {
      set({
        isIndexing: false,
        semanticError: (err as Error).message
      })
    }
  },

  clearResults: () =>
    set({
      results: [],
      totalMatches: 0,
      truncated: false,
      elapsed: 0,
      error: null,
      semanticResults: [],
      semanticTotalMatches: 0,
      semanticElapsed: 0,
      semanticError: null
    })
}))
