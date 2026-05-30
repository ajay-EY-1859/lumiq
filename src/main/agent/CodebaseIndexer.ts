// ═══════════════════════════════════════════════════════════════════
// Lumiq — Codebase Indexer
// Scans, chunks, and indexes workspace codebase files semantically.
// ═══════════════════════════════════════════════════════════════════

import * as fs from 'fs'
import * as path from 'path'
import { v4 as uuidv4 } from 'uuid'
import { getDatabase } from '../db/database'
import { embeddingManager } from './EmbeddingManager'

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

  private constructor() {}

  public static getInstance(): CodebaseIndexer {
    if (!CodebaseIndexer.instance) {
      CodebaseIndexer.instance = new CodebaseIndexer()
    }
    return CodebaseIndexer.instance
  }

  /**
   * Scans and indexes the entire workspace in the background.
   */
  public async indexWorkspace(workspacePath: string): Promise<void> {
    if (this.isCurrentlyIndexing) {
      console.warn(`[CodebaseIndexer] Already indexing workspace: ${workspacePath}`)
      return
    }

    this.isCurrentlyIndexing = true
    console.log(`[CodebaseIndexer] Starting semantic indexing for workspace: ${workspacePath}`)

    // Keep it entirely asynchronous to avoid blocking main thread
    setTimeout(async () => {
      try {
        // 1. Gather all indexable file paths recursively
        const files: string[] = []
        this.scanFiles(workspacePath, files)

        console.log(`[CodebaseIndexer] Discovered ${files.length} code files in workspace.`)

        // 2. Process and index each file
        for (const file of files) {
          try {
            await this.indexFile(workspacePath, file)
          } catch (fileErr) {
            console.error(`[CodebaseIndexer] Failed to index file "${file}":`, fileErr)
          }
        }

        console.log(`[CodebaseIndexer] Completed semantic workspace indexing for: ${workspacePath}`)
      } catch (err) {
        console.error('[CodebaseIndexer] Error indexing workspace:', err)
      } finally {
        this.isCurrentlyIndexing = false
      }
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
  private async indexFile(workspacePath: string, filePath: string): Promise<void> {
    const db = getDatabase()

    // 1. Read stats and check if file has changed
    const relativePath = path.relative(workspacePath, filePath)

    // Check if we already have indexed this file, and if it's up to date
    // (For simplicity, we delete and re-index the file if it exists, or insert new ones)
    db.prepare('DELETE FROM codebase_embeddings WHERE workspace_path = ? AND file_path = ?').run(
      workspacePath,
      relativePath
    )

    const content = fs.readFileSync(filePath, 'utf-8')
    if (!content.trim()) return

    // 2. Semantic Chunking: Split by double newlines (functions, blocks) with max size constraints
    const chunks = this.chunkText(content, 1000, 200) // Chunk size ~1000 chars, overlap 200 chars

    // 3. Generate embeddings and save to SQLite
    const insertStmt = db.prepare(`
      INSERT INTO codebase_embeddings (id, workspace_path, file_path, chunk_index, content, embedding)
      VALUES (?, ?, ?, ?, ?, ?)
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
        buffer
      )
    }
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
}

export const codebaseIndexer = CodebaseIndexer.getInstance()
