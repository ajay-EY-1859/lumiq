// ═══════════════════════════════════════════════════════════════════
// Lumiq — Search Store (Find in Files)
// ═══════════════════════════════════════════════════════════════════

import { create } from 'zustand'
import type { SearchMatch, SearchResponse } from '@shared/types'

interface SearchState {
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

  setQuery: (q: string) => void
  setIsRegex: (v: boolean) => void
  setCaseSensitive: (v: boolean) => void
  setIncludePattern: (v: string) => void
  setExcludePattern: (v: string) => void
  search: (workspacePath: string) => Promise<void>
  clearResults: () => void
}

export const useSearchStore = create<SearchState>((set, get) => ({
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

  clearResults: () =>
    set({ results: [], totalMatches: 0, truncated: false, elapsed: 0, error: null })
}))
