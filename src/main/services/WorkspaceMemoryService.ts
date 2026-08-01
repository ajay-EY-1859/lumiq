// ═══════════════════════════════════════════════════════════════════
// Lumiq — Workspace Memory Service
// ═══════════════════════════════════════════════════════════════════

import { createMemory, getWorkspaceMemories, WorkspaceMemory } from '../db/workspaceMemory'

export class WorkspaceMemoryService {
  private static instance: WorkspaceMemoryService

  public static getInstance(): WorkspaceMemoryService {
    if (!WorkspaceMemoryService.instance) {
      WorkspaceMemoryService.instance = new WorkspaceMemoryService()
    }
    return WorkspaceMemoryService.instance
  }

  /**
   * Adds an episodic memory of user edits or debug solutions to the DB.
   */
  public addMemory(
    workspacePath: string,
    sessionId: string | null,
    activityType: 'debugging' | 'refactoring' | 'error_recovery' | 'override',
    summary: string,
    contextDetails?: Record<string, any>
  ): void {
    try {
      createMemory(workspacePath, sessionId, activityType, summary, contextDetails)
      console.log(`[WorkspaceMemoryService] Logged new memory: ${activityType} - ${summary.slice(0, 60)}...`)
    } catch (err) {
      console.error('[WorkspaceMemoryService] Failed to log memory:', err)
    }
  }

  /**
   * Searches memories matching keywords in the user query, and constructs
   * a RAG-style prompt context block.
   */
  public getRelevantMemoriesSegment(workspacePath: string, query: string): string {
    try {
      const memories = getWorkspaceMemories(workspacePath, 100)
      if (memories.length === 0) {
        return ''
      }

      // Keyword tokenization & stop words removal
      const queryWords = query
        .toLowerCase()
        .replace(/[^\w\s]/g, '')
        .split(/\s+/)
        .filter(w => w.length > 2 && !['how', 'the', 'and', 'for', 'you', 'are', 'was', 'were', 'that', 'this'].includes(w))

      if (queryWords.length === 0) {
        // Return 2 most recent memories if query is short
        return this.formatMemories(memories.slice(0, 2))
      }

      // Rank memories based on overlap counts
      const ranked = memories
        .map(mem => {
          let score = 0
          const textToSearch = `${mem.activityType} ${mem.summary} ${mem.contextDetails}`.toLowerCase()
          for (const word of queryWords) {
            if (textToSearch.includes(word)) {
              score += 1
            }
          }
          return { mem, score }
        })
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score || b.mem.createdAt.localeCompare(a.mem.createdAt))
        .map(item => item.mem)

      const topMatches = ranked.slice(0, 3)
      if (topMatches.length === 0) {
        // Fallback to 1 most recent memory if no match
        return this.formatMemories(memories.slice(0, 1))
      }

      return this.formatMemories(topMatches)
    } catch (err) {
      console.error('[WorkspaceMemoryService] Failed to query memories:', err)
      return ''
    }
  }

  private formatMemories(memories: WorkspaceMemory[]): string {
    if (memories.length === 0) return ''
    
    let segment = '\n\n═══════════════════════════════════════════════════════════════════\n'
    segment += '💡 HISTORICAL WORKSPACE EPISODIC MEMORIES (RELEVANT PAST RESOLUTIONS)\n'
    segment += '═══════════════════════════════════════════════════════════════════\n'
    
    for (const mem of memories) {
      segment += `• [${mem.activityType.toUpperCase()} - ${new Date(mem.createdAt).toLocaleDateString()}]\n`
      segment += `  Summary: ${mem.summary}\n`
      try {
        const details = JSON.parse(mem.contextDetails)
        if (details.filePath) segment += `  Target File: ${details.filePath}\n`
        if (details.command) segment += `  Command Run: ${details.command}\n`
        if (details.errorMessage) segment += `  Error Encountered: ${details.errorMessage}\n`
      } catch {
        // Ignore JSON parsing errors
      }
      segment += '\n'
    }
    
    segment += 'Please align any new modifications or debugging plans with these past decisions.\n'
    return segment
  }
}

export const workspaceMemoryService = WorkspaceMemoryService.getInstance()
