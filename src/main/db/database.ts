// ═══════════════════════════════════════════════════════════════════
// Lumiq — SQLite Database Setup & Migrations
// All database operations run in the MAIN process only.
// The renderer process NEVER has direct DB access.
// ═══════════════════════════════════════════════════════════════════

import Database from 'better-sqlite3'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, mkdirSync } from 'fs'
import { DEFAULT_TOOL_SETTINGS } from '../tools/defaultToolSettings'

let db: Database.Database | null = null

/**
 * Gets the database file path in the app's userData directory.
 * On Windows: %APPDATA%/lumiq/lumiq.db
 * On macOS: ~/Library/Application Support/lumiq/lumiq.db
 * On Linux: ~/.config/lumiq/lumiq.db
 */
function getDbPath(): string {
  const userDataPath = app.getPath('userData')
  if (!existsSync(userDataPath)) {
    mkdirSync(userDataPath, { recursive: true })
  }
  return join(userDataPath, 'lumiq.db')
}

/**
 * Initializes the SQLite database connection and runs migrations.
 * Uses WAL mode for better concurrent read performance.
 *
 * SECURITY:
 * - Database file has restrictive permissions
 * - Prepared statements used everywhere (SQL injection prevention)
 * - Foreign keys enforced
 */
export function initDatabase(): Database.Database {
  if (db) return db

  const dbPath = getDbPath()
  db = new Database(dbPath)

  // Performance & safety settings
  db.pragma('journal_mode = WAL') // Write-Ahead Logging for performance
  db.pragma('foreign_keys = ON') // Enforce foreign key constraints
  db.pragma('synchronous = NORMAL') // Good balance of safety & speed
  db.pragma('cache_size = -64000') // 64MB cache
  db.pragma('busy_timeout = 5000') // Wait 5s on locked DB

  // Run migrations
  runMigrations(db)

  return db
}

/**
 * Returns the active database instance.
 * Throws if called before initDatabase().
 */
export function getDatabase(): Database.Database {
  if (!db) {
    throw new Error('Database not initialized. Call initDatabase() first.')
  }
  return db
}

/**
 * Closes the database connection gracefully.
 * Should be called during app shutdown.
 */
export function closeDatabase(): void {
  if (db) {
    db.close()
    db = null
  }
}

/**
 * Runs database migrations in order.
 * Each migration is idempotent (uses IF NOT EXISTS).
 */
function runMigrations(database: Database.Database): void {
  // Wrap all migrations in a transaction for atomicity
  const migrate = database.transaction(() => {
    // ── Migration 1: Core tables ──────────────────────────────────
    database.exec(`
      CREATE TABLE IF NOT EXISTS sessions (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL DEFAULT 'New Session',
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        agent_id TEXT,
        workspace_path TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS messages (
        id TEXT PRIMARY KEY,
        session_id TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('user','assistant','system','tool')),
        content TEXT NOT NULL,
        tool_name TEXT,
        tool_input TEXT,
        tool_result TEXT,
        tokens_used INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS api_configs (
        id TEXT PRIMARY KEY,
        provider TEXT NOT NULL UNIQUE,
        api_key_encrypted TEXT,
        base_url TEXT,
        default_model TEXT NOT NULL,
        is_active INTEGER DEFAULT 1,
        aws_access_key_encrypted TEXT,
        aws_secret_key_encrypted TEXT,
        aws_session_token TEXT,
        aws_region TEXT DEFAULT 'us-east-1',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS agents (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        description TEXT,
        system_prompt TEXT NOT NULL,
        provider TEXT,
        model TEXT,
        tools TEXT DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS settings (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL
      );
    `)

    // ── Migration 2: Indexes ──────────────────────────────────────
    database.exec(`
      CREATE INDEX IF NOT EXISTS idx_messages_session
        ON messages(session_id, created_at);

      CREATE INDEX IF NOT EXISTS idx_sessions_updated
        ON sessions(updated_at DESC);

      CREATE INDEX IF NOT EXISTS idx_sessions_title
        ON sessions(title);
    `)

    // ── Migration 3: session_todos table ─────────────────────────
    database.exec(`
      CREATE TABLE IF NOT EXISTS session_todos (
        session_id TEXT PRIMARY KEY,
        todos TEXT NOT NULL DEFAULT '[]',
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (session_id) REFERENCES sessions(id) ON DELETE CASCADE
      );
    `)

    // ── Migration 4: Add auth_method to api_configs ───────────────
    // Needed for OAuth-based provider authentication
    try {
      database.exec(`ALTER TABLE api_configs ADD COLUMN auth_method TEXT DEFAULT 'apikey'`)
    } catch {
      // Column already exists — ignore
    }

    // ── Migration 5: v2 MVP tables ────────────────────────────────
    database.exec(`
      CREATE TABLE IF NOT EXISTS mcp_servers (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        command TEXT NOT NULL,
        args TEXT NOT NULL DEFAULT '[]',
        env TEXT NOT NULL DEFAULT '{}',
        active INTEGER DEFAULT 1,
        approved INTEGER DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'stopped',
        last_error TEXT,
        tools_count INTEGER DEFAULT 0,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS agent_routes (
        id TEXT PRIMARY KEY,
        task_name TEXT UNIQUE NOT NULL,
        provider TEXT NOT NULL,
        model TEXT NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS skills (
        id TEXT PRIMARY KEY,
        name TEXT UNIQUE NOT NULL,
        description TEXT NOT NULL DEFAULT '',
        prompt_template TEXT NOT NULL,
        allowed_tools TEXT NOT NULL DEFAULT '[]',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS oauth_tokens (
        provider TEXT PRIMARY KEY,
        access_token_encrypted TEXT NOT NULL,
        refresh_token_encrypted TEXT,
        expires_at INTEGER NOT NULL,
        token_type TEXT DEFAULT 'Bearer',
        scope TEXT,
        email TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS oauth_config (
        provider TEXT PRIMARY KEY,
        client_id_encrypted TEXT NOT NULL,
        client_secret_encrypted TEXT NOT NULL
      );

      CREATE INDEX IF NOT EXISTS idx_mcp_servers_name ON mcp_servers(name);
      CREATE INDEX IF NOT EXISTS idx_agent_routes_task ON agent_routes(task_name);
      CREATE INDEX IF NOT EXISTS idx_skills_name ON skills(name);
    `)

    // ── Migration 6: Add workspace_path to sessions ───────────────
    try {
      database.exec(`ALTER TABLE sessions ADD COLUMN workspace_path TEXT`)
    } catch {
      // Column already exists — ignore
    }

    // ── Migration 8: Add tool_call_id to messages ──────────────────
    // Required for Bedrock provider to map tool results back to tool calls
    try {
      database.exec(`ALTER TABLE messages ADD COLUMN tool_call_id TEXT`)
    } catch {
      // Column already exists — ignore
    }

    // ── Migration 9: Add tool_calls JSON to messages ──────────────────
    // Persists assistant toolCalls array so history can be replayed correctly
    try {
      database.exec(`ALTER TABLE messages ADD COLUMN tool_calls TEXT`)
    } catch {
      // Column already exists — ignore
    }

    // ── Migration 7: Default settings ─────────────────────────────
    const insertSetting = database.prepare(`
      INSERT OR IGNORE INTO settings (key, value) VALUES (?, ?)
    `)

    insertSetting.run('theme', 'system')
    insertSetting.run('fontSize', '14')
    insertSetting.run('defaultProvider', 'anthropic')
    insertSetting.run('defaultModel', 'claude-sonnet-4-20250514')
    insertSetting.run('sidebarVisible', 'true')
    insertSetting.run('autoSave', 'true')
    insertSetting.run('contextLimit', '150')

    insertSetting.run('permissionMode', 'MANUAL')
    insertSetting.run('firecrawlApiKey', '')

    // Default tool settings
    insertSetting.run('toolSettings', JSON.stringify(DEFAULT_TOOL_SETTINGS))
  })

  migrate()
}
