// ═══════════════════════════════════════════════════════════════════
// Lumiq — Codebase Indexer
// Scans, chunks, and indexes workspace codebase files semantically.
// ═══════════════════════════════════════════════════════════════════

import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/database'
import { embeddingManager } from './EmbeddingManager'
import type { SemanticIndexStatus } from '@shared/types'

// Allowed file extensions for code indexing
const ALLOWED_EXTENSIONS = new Set([
  '.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java', '.cpp', '.c', '.h', '.hpp',
  '.cs', '.swift', '.rb', '.php', '.html', '.css', '.md', '.json', '.yaml', '.yml'
])

// Directories to ignore
const IGNORED_DIRECTORIES = new Set([
  'node_modules', '.git', '.github', 'dist', 'out', 'build', '.next', '.vite', 'coverage', 'temp'
])

export class CodebaseIndexer {
  private static instance: CodebaseIndexer
  private isCurrentlyIndexing = false
  private currentStatus: SemanticIndexStatus | null = null

  private constructor() {}

  public static getInstance(): CodebaseIndexer {
    if (!CodebaseIndexer.instance) {
      CodebaseIndexer.instance = new CodebaseIndexer()
    }
    return CodebaseIndexer.instance
  }

  /**
   * Starts scanning and indexing the workspace in the background.
   */
  public async indexWorkspace(workspacePath: string, force = false): Promise<SemanticIndexStatus> {
    if (this.isCurrentlyIndexing) {
      console.warn(`[CodebaseIndexer] Already indexing workspace: ${workspacePath}`)
      return this.getStatus(workspacePath)
    }

    this.isCurrentlyIndexing = true
    this.currentStatus = {
      workspacePath,
      state: 'indexing',
      filesScanned: 0,
      filesIndexed: 0,
      chunksStored: this.countChunks(workspacePath)
    }
    this.startIndexing(workspacePath, force)
    return this.getStatus(workspacePath)
  }

  /**
   * Synchronously runs a complete index pass. Exposed for tests and background jobs.
   */
  public async indexWorkspaceNow(workspacePath: string, force = false): Promise<SemanticIndexStatus> {
    if (this.isCurrentlyIndexing) {
      return this.getStatus(workspacePath)
    }

    this.isCurrentlyIndexing = true
    return this.runIndexPass(workspacePath, force)
  }

  private async runIndexPass(workspacePath: string, force: boolean): Promise<SemanticIndexStatus> {
    this.currentStatus = {
      workspacePath,
      state: 'indexing',
      filesScanned: 0,
      filesIndexed: 0,
      chunksStored: this.countChunks(workspacePath)
    }

    console.log(`[CodebaseIndexer] Starting semantic indexing for workspace: ${workspacePath}`)

    try {
      const files: string[] = []
      this.scanFiles(workspacePath, files)
      this.currentStatus.filesScanned = files.length

      console.log(`[CodebaseIndexer] Discovered ${files.length} code files in workspace.`)

      for (const file of files) {
        try {
          const chunksAdded = await this.indexFile(workspacePath, file, force)
          if (chunksAdded > 0) {
            this.currentStatus.filesIndexed++
            this.currentStatus.chunksStored = this.countChunks(workspacePath)
          }
        } catch (fileErr) {
          console.error(`[CodebaseIndexer] Failed to index file "${file}":`, fileErr)
        }
      }

      this.currentStatus = {
        ...this.currentStatus,
        state: 'ready',
        chunksStored: this.countChunks(workspacePath),
        lastIndexedAt: new Date().toISOString(),
        lastError: undefined
      }
      console.log(`[CodebaseIndexer] Completed semantic workspace indexing for: ${workspacePath}`)
    } catch (err) {
      console.error('[CodebaseIndexer] Error indexing workspace:', err)
      this.currentStatus = {
        workspacePath,
        state: 'error',
        filesScanned: this.currentStatus?.filesScanned ?? 0,
        filesIndexed: this.currentStatus?.filesIndexed ?? 0,
        chunksStored: this.countChunks(workspacePath),
        lastError: (err as Error).message
      }
    } finally {
      this.isCurrentlyIndexing = false
    }

    return this.getStatus(workspacePath)
  }

  public getStatus(workspacePath: string): SemanticIndexStatus {
    if (this.currentStatus?.workspacePath === workspacePath && this.currentStatus.state === 'indexing') {
      return { ...this.currentStatus }
    }

    const chunksStored = this.countChunks(workspacePath)
    const lastIndexedAt = this.getLastIndexedAt(workspacePath)

    return {
      workspacePath,
      state: this.currentStatus?.workspacePath === workspacePath && this.currentStatus.state === 'error'
        ? 'error'
        : chunksStored > 0
          ? 'ready'
          : 'idle',
      filesScanned: this.currentStatus?.workspacePath === workspacePath ? this.currentStatus.filesScanned : 0,
      filesIndexed: this.currentStatus?.workspacePath === workspacePath ? this.currentStatus.filesIndexed : 0,
      chunksStored,
      lastIndexedAt,
      lastError: this.currentStatus?.workspacePath === workspacePath ? this.currentStatus.lastError : undefined
    }
  }

  private startIndexing(workspacePath: string, force: boolean): void {
    setTimeout(() => {
      void this.runIndexPass(workspacePath, force)
    }, 100)
  }

  /**
   * Recursively scans directories to collect allowed code files.
   */
  private scanFiles(dir: string, fileList: string[]): void {
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true })
      for (const entry of entries) {
        const fullPath = path.join(dir, entry.name)

        if (entry.isDirectory()) {
          if (!IGNORED_DIRECTORIES.has(entry.name)) {
            this.scanFiles(fullPath, fileList)
          }
        } else if (entry.isFile()) {
          const ext = path.extname(entry.name).toLowerCase()
          if (ALLOWED_EXTENSIONS.has(ext)) {
            fileList.push(fullPath)
          }
        }
      }
    } catch (err) {
      console.error(`[CodebaseIndexer] Failed to scan dir "${dir}":`, err)
    }
  }

  /**
   * Chunks a single file, computes embeddings, and stores them in SQLite.
   */
  private async indexFile(workspacePath: string, filePath: string, force: boolean): Promise<number> {
    const db = getDatabase()

    // 1. Read stats and check if file has changed
    const relativePath = path.relative(workspacePath, filePath).replace(/\\/g, '/')
    const stat = fs.statSync(filePath)
    const existing = db.prepare(`
      SELECT file_mtime_ms as fileMtimeMs, file_size as fileSize
      FROM codebase_embeddings
      WHERE workspace_path = ? AND file_path = ?
      LIMIT 1
    `).get(workspacePath, relativePath) as { fileMtimeMs: number | null; fileSize: number | null } | undefined

    if (
      !force &&
      existing &&
      existing.fileMtimeMs !== null &&
      Math.abs(existing.fileMtimeMs - stat.mtimeMs) < 1 &&
      existing.fileSize === stat.size
    ) {
      return 0
    }

    db.prepare('DELETE FROM codebase_embeddings WHERE workspace_path = ? AND file_path = ?').run(
      workspacePath,
      relativePath
    )

    const content = fs.readFileSync(filePath, 'utf-8')
    if (!content.trim()) return 0

    // 2. Semantic Chunking: Split by double newlines (functions, blocks) with max size constraints
    const chunks = this.chunkText(content, 1000, 200) // Chunk size ~1000 chars, overlap 200 chars
    if (chunks.length === 0) return 0

    // 3. Generate embeddings and save to SQLite
    const insertStmt = db.prepare(`
      INSERT INTO codebase_embeddings (
        id, workspace_path, file_path, chunk_index, content, embedding, file_mtime_ms, file_size, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `)

    for (let i = 0; i < chunks.length; i++) {
      const chunkText = chunks[i]!
      const embedding = await embeddingManager.getEmbedding(chunkText)

      // Serialize embedding float array to buffer for efficient SQLite BLOB storage
      const buffer = Buffer.from(new Float32Array(embedding).buffer)

      insertStmt.run(
        uuidv4(),
        workspacePath,
        relativePath,
        i,
        chunkText,
        buffer,
        stat.mtimeMs,
        stat.size,
        new Date().toISOString()
      )
    }

    return chunks.length
  }

  /**
   * Smart character-based sliding window chunking.
   */
  private chunkText(text: string, chunkSize = 1000, overlap = 200): string[] {
    const chunks: string[] = []
    let start = 0

    while (start < text.length) {
      let end = start + chunkSize

      // Try to align end to newline/paragraph boundary for higher semantics
      if (end < text.length) {
        const nextNewline = text.indexOf('\n\n', end - 100)
        if (nextNewline !== -1 && nextNewline < end + 100) {
          end = nextNewline + 2
        } else {
          const singleNewline = text.indexOf('\n', end - 50)
          if (singleNewline !== -1 && singleNewline < end + 50) {
            end = singleNewline + 1
          }
        }
      }

      chunks.push(text.substring(start, end).trim())
      start = end - overlap
      if (start < 0) start = 0
      
      // Infinite loop guard
      if (end >= text.length) break
    }

    return chunks.filter((c) => c.length > 20)
  }

  private countChunks(workspacePath: string): number {
    try {
      const db = getDatabase()
      const row = db.prepare(`
        SELECT COUNT(*) as count FROM codebase_embeddings WHERE workspace_path = ?
      `).get(workspacePath) as { count: number }
      return row.count
    } catch {
      return 0
    }
  }

  private getLastIndexedAt(workspacePath: string): string | undefined {
    try {
      const db = getDatabase()
      const row = db.prepare(`
        SELECT MAX(updated_at) as lastIndexedAt FROM codebase_embeddings WHERE workspace_path = ?
      `).get(workspacePath) as { lastIndexedAt: string | null }
      return row.lastIndexedAt || undefined
    } catch {
      return undefined
    }
  }
}

export const codebaseIndexer = CodebaseIndexer.getInstance()
