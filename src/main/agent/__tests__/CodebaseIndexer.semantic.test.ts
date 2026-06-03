import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { join } from 'path'
import { mkdirSync, rmSync, writeFileSync } from 'fs'

const tempWorkspacePath = join(__dirname, 'temp_codebase_indexer_workspace')

const dbState = vi.hoisted(() => ({
  embeddings: [] as Array<{
    id: string
    workspacePath: string
    filePath: string
    chunkIndex: number
    content: string
    embedding: Buffer
    fileMtimeMs: number
    fileSize: number
    updatedAt: string
  }>
}))

vi.mock('electron', () => ({
  app: {
    getPath: () => '/tmp'
  }
}))

vi.mock('../../db/database', () => ({
  initDatabase: vi.fn(),
  closeDatabase: vi.fn(),
  getDatabase: vi.fn(() => ({
    prepare: (sql: string) => {
      const normalized = sql.replace(/\s+/g, ' ').trim()

      if (normalized.startsWith('SELECT COUNT(*) as count FROM codebase_embeddings')) {
        return {
          get: (workspacePath: string) => ({
            count: dbState.embeddings.filter(row => row.workspacePath === workspacePath).length
          })
        }
      }

      if (normalized.startsWith('SELECT MAX(updated_at) as lastIndexedAt FROM codebase_embeddings')) {
        return {
          get: (workspacePath: string) => {
            const dates = dbState.embeddings
              .filter(row => row.workspacePath === workspacePath)
              .map(row => row.updatedAt)
              .sort()
            return { lastIndexedAt: dates.at(-1) ?? null }
          }
        }
      }

      if (normalized.startsWith('SELECT file_mtime_ms as fileMtimeMs')) {
        return {
          get: (workspacePath: string, filePath: string) => {
            const row = dbState.embeddings.find(item => item.workspacePath === workspacePath && item.filePath === filePath)
            return row ? { fileMtimeMs: row.fileMtimeMs, fileSize: row.fileSize } : undefined
          }
        }
      }

      if (normalized.startsWith('DELETE FROM codebase_embeddings')) {
        return {
          run: (workspacePath: string, filePath: string) => {
            dbState.embeddings = dbState.embeddings.filter(row => row.workspacePath !== workspacePath || row.filePath !== filePath)
            return { changes: 1 }
          }
        }
      }

      if (normalized.startsWith('INSERT INTO codebase_embeddings')) {
        return {
          run: (
            id: string,
            workspacePath: string,
            filePath: string,
            chunkIndex: number,
            content: string,
            embedding: Buffer,
            fileMtimeMs: number,
            fileSize: number,
            updatedAt: string
          ) => {
            dbState.embeddings.push({ id, workspacePath, filePath, chunkIndex, content, embedding, fileMtimeMs, fileSize, updatedAt })
            return { changes: 1 }
          }
        }
      }

      if (normalized.startsWith('SELECT file_path as filePath, chunk_index as chunkIndex')) {
        return {
          all: (workspacePath: string) => dbState.embeddings
            .filter(row => row.workspacePath === workspacePath)
            .map(row => ({
              filePath: row.filePath,
              chunkIndex: row.chunkIndex,
              content: row.content,
              embedding: row.embedding
            }))
        }
      }

      if (normalized.startsWith('SELECT file_path as filePath FROM codebase_embeddings')) {
        return {
          all: () => dbState.embeddings.map(row => ({ filePath: row.filePath }))
        }
      }

      throw new Error(`Unhandled SQL in test mock: ${normalized}`)
    }
  }))
}))

vi.mock('../EmbeddingManager', () => {
  const normalize = (vector: number[]): number[] => {
    const magnitude = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0))
    return magnitude === 0 ? vector : vector.map(value => value / magnitude)
  }

  const vectorForText = (text: string): number[] => {
    const lower = text.toLowerCase()
    return normalize([
      lower.includes('oauth') || lower.includes('token') ? 1 : 0,
      lower.includes('retry') || lower.includes('backoff') ? 1 : 0,
      lower.includes('database') || lower.includes('sqlite') ? 1 : 0,
      lower.includes('render') || lower.includes('component') ? 1 : 0
    ])
  }

  return {
    embeddingManager: {
      getEmbedding: vi.fn(async (text: string) => vectorForText(text)),
      cosineSimilarity: vi.fn((vecA: number[], vecB: number[]) =>
        vecA.length === vecB.length ? vecA.reduce((sum, value, index) => sum + value * vecB[index]!, 0) : 0
      )
    }
  }
})

import { getDatabase } from '../../db/database'
import { codebaseIndexer } from '../CodebaseIndexer'
import { ragQueryEngine } from '../RAGQueryEngine'

describe('CodebaseIndexer semantic indexing', () => {
  beforeEach(() => {
    rmSync(tempWorkspacePath, { recursive: true, force: true })
    mkdirSync(tempWorkspacePath, { recursive: true })
    dbState.embeddings = []
  })

  afterEach(() => {
    rmSync(tempWorkspacePath, { recursive: true, force: true })
  })

  it('indexes supported files and skips ignored directories', async () => {
    writeFileSync(join(tempWorkspacePath, 'auth.ts'), 'export function refreshOAuthToken() {\n  return "oauth token expiration"\n}\n')
    mkdirSync(join(tempWorkspacePath, 'node_modules'), { recursive: true })
    writeFileSync(join(tempWorkspacePath, 'node_modules', 'ignored.ts'), 'oauth token should not be indexed')

    const status = await codebaseIndexer.indexWorkspaceNow(tempWorkspacePath, true)
    const rows = getDatabase().prepare('SELECT file_path as filePath FROM codebase_embeddings').all() as Array<{ filePath: string }>

    expect(status.state).toBe('ready')
    expect(status.filesScanned).toBe(1)
    expect(status.filesIndexed).toBe(1)
    expect(status.chunksStored).toBeGreaterThan(0)
    expect(rows.map(row => row.filePath)).toEqual(['auth.ts'])
  })

  it('skips .asar directories and weird package-like names', async () => {
    writeFileSync(join(tempWorkspacePath, 'auth.ts'), 'export function refreshOAuthToken() { return "oauth token" }\n')
    mkdirSync(join(tempWorkspacePath, 'foo.asar'), { recursive: true })
    writeFileSync(join(tempWorkspacePath, 'foo.asar', 'ignored.ts'), 'export const ignored = true\n')
    mkdirSync(join(tempWorkspacePath, '..foo.asar'), { recursive: true })
    writeFileSync(join(tempWorkspacePath, '..foo.asar', 'ignored2.ts'), 'export const ignored2 = true\n')

    const status = await codebaseIndexer.indexWorkspaceNow(tempWorkspacePath, true)
    const rows = getDatabase().prepare('SELECT file_path as filePath FROM codebase_embeddings').all() as Array<{ filePath: string }>

    expect(status.state).toBe('ready')
    expect(rows.map(row => row.filePath)).toEqual(['auth.ts'])
  })

  it('skips unchanged files and reindexes changed files', async () => {
    const target = join(tempWorkspacePath, 'retry.ts')
    writeFileSync(target, 'export const retryPolicy = "retry with backoff"\n')

    await codebaseIndexer.indexWorkspaceNow(tempWorkspacePath, true)
    const skipped = await codebaseIndexer.indexWorkspaceNow(tempWorkspacePath, false)
    expect(skipped.filesIndexed).toBe(0)

    await new Promise(resolve => setTimeout(resolve, 20))
    writeFileSync(target, 'export const retryPolicy = "retry with exponential backoff"\n')
    const changed = await codebaseIndexer.indexWorkspaceNow(tempWorkspacePath, false)

    expect(changed.filesIndexed).toBe(1)
    expect(changed.chunksStored).toBeGreaterThan(0)
  })

  it('returns sorted semantic matches above the relevance threshold', async () => {
    writeFileSync(join(tempWorkspacePath, 'auth.ts'), 'export function refreshOAuthToken() {\n  return "oauth token expiration"\n}\n')
    writeFileSync(join(tempWorkspacePath, 'database.ts'), 'export const database = "sqlite database connection"\n')

    await codebaseIndexer.indexWorkspaceNow(tempWorkspacePath, true)
    const matches = await ragQueryEngine.search(tempWorkspacePath, 'OAuth token expiration', 4)

    expect(matches.length).toBeGreaterThan(0)
    expect(matches[0]?.filePath).toBe('auth.ts')
    expect(matches[0]?.score).toBeGreaterThan(0.15)
  })
})
