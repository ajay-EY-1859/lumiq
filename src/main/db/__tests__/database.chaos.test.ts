import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { join } from 'path'
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs'

const tempUserDataPath = join(__dirname, 'temp_db_chaos_test')

// Mock electron app getPath before importing database module
vi.mock('electron', () => {
  return {
    app: {
      getPath: (name: string) => {
        if (name === 'userData') {
          return tempUserDataPath
        }
        return '/tmp'
      }
    }
  }
})

import { initDatabase, closeDatabase } from '../database'

describe('Database Chaos - Self-Healing & Redundant Backup Recovery', () => {
  beforeAll(() => {
    if (!existsSync(tempUserDataPath)) {
      mkdirSync(tempUserDataPath, { recursive: true })
    }
  })

  afterAll(() => {
    try {
      closeDatabase()
    } catch {}
    try {
      rmSync(tempUserDataPath, { recursive: true, force: true })
    } catch {}
  })

  it('should run integrity check, detect byte corruption, and recover from backup', () => {
    // 1. Initial healthy initialization
    const db = initDatabase()
    expect(db).toBeDefined()
    expect(db.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }])

    // Let's insert some mock config to verify it persists after restore
    db.prepare(`
      INSERT OR REPLACE INTO settings (key, value) VALUES ('test_key', 'healthy_value')
    `).run()

    closeDatabase()

    // Verify primary DB and backup both exist
    const dbPath = join(tempUserDataPath, 'lumiq.db')
    const backupPath = join(tempUserDataPath, 'lumiq.db.backup')
    expect(existsSync(dbPath)).toBe(true)
    expect(existsSync(backupPath)).toBe(true)

    // 2. CORRUPT: Byte-flipping corruption fuzzer
    // Open primary DB file and overwrite critical database bytes with zeroes
    const buffer = readFileSync(dbPath)
    // Flip bytes in the SQLite header and body (SQLite header is first 100 bytes)
    for (let i = 0; i < 500; i++) {
      buffer[i] = 0 // completely zero out sqlite metadata
    }
    writeFileSync(dbPath, buffer)

    // 3. Re-initialize DB
    // This should trigger integrity/boot failure, quarantine as .corrupt, and restore from .backup!
    const healedDb = initDatabase()
    expect(healedDb).toBeDefined()

    // Verify integrity is OK now (restored from backup!)
    expect(healedDb.pragma('integrity_check')).toEqual([{ integrity_check: 'ok' }])

    // Verify settings table exists and our data is restored
    const testSetting = healedDb.prepare("SELECT value FROM settings WHERE key = 'test_key'").get() as { value: string }
    expect(testSetting).toBeDefined()
    expect(testSetting.value).toBe('healthy_value')

    // Verify quarantined .corrupt file exists
    const corruptPath = join(tempUserDataPath, 'lumiq.db.corrupt')
    expect(existsSync(corruptPath)).toBe(true)
  })
})
