// ═══════════════════════════════════════════════════════════════════
// Lumiq — Database Explorer UI Component (Milestone 28)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useCallback } from 'react'

interface DatabaseConsoleProps {
  onBack: () => void
}

type TableInfo = { name: string; type: string }
type ColumnInfo = { name: string; type: string; notnull: boolean; dflt_value: any; pk: boolean }

export function DatabaseConsole({ onBack }: DatabaseConsoleProps): React.JSX.Element {
  const [tables, setTables] = useState<TableInfo[]>([])
  const [activeTable, setActiveTable] = useState<string | null>(null)
  const [schemaColumns, setSchemaColumns] = useState<ColumnInfo[]>([])
  
  const [sqlQuery, setSqlQuery] = useState('SELECT * FROM sessions LIMIT 10;')
  const [queryResults, setQueryResults] = useState<any[] | null>(null)
  const [queryError, setQueryError] = useState<string | null>(null)
  const [querySuccessMsg, setQuerySuccessMsg] = useState<string | null>(null)
  
  const [selectedFormat, setSelectedFormat] = useState<'prisma' | 'drizzle'>('prisma')
  const [generatedSchema, setGeneratedSchema] = useState('')
  const [copiedSchema, setCopiedSchema] = useState(false)

  const [mockCount, setMockCount] = useState(5)
  const [mockTargetTable, setMockTargetTable] = useState('')
  const [mockingStatus, setMockingStatus] = useState<'idle' | 'running' | 'success' | 'error'>('idle')

  // Load tables list
  const loadTables = useCallback(async () => {
    try {
      const data = await window.electronAPI.database.getTables()
      setTables(data)
      if (data.length > 0 && !mockTargetTable) {
        setMockTargetTable(data[0].name)
      }
    } catch (err: any) {
      console.error('Failed to load database tables:', err)
    }
  }, [mockTargetTable])

  useEffect(() => {
    loadTables()
  }, [loadTables])

  // Load columns schema for selected table
  const loadTableSchema = async (tableName: string) => {
    try {
      const data = await window.electronAPI.database.getTableSchema(tableName)
      setSchemaColumns(data)
      setActiveTable(tableName)
      // Auto populate query input for convenience
      setSqlQuery(`SELECT * FROM ${tableName} LIMIT 20;`)
    } catch (err: any) {
      console.error('Failed to load table schema:', err)
    }
  }

  // Execute SQL
  const handleExecuteQuery = async () => {
    setQueryError(null)
    setQueryResults(null)
    setQuerySuccessMsg(null)
    try {
      const results = await window.electronAPI.database.executeQuery(sqlQuery)
      setQueryResults(results)
      setQuerySuccessMsg(`Executed successfully. Found ${results.length} rows/records.`)
      // Reload tables in case query modified master table list
      loadTables()
    } catch (err: any) {
      setQueryError(err.message || 'An error occurred while executing the query.')
    }
  }

  // Compile schema declaration
  const handleGenerateSchema = async () => {
    try {
      const schema = await window.electronAPI.database.generateSchemaDeclaration(selectedFormat)
      setGeneratedSchema(schema)
      setCopiedSchema(false)
    } catch (err: any) {
      alert(`Failed to compile schema: ${err.message}`)
    }
  }

  // Inject mock data
  const handleGenerateMock = async () => {
    if (!mockTargetTable) return
    setMockingStatus('running')
    try {
      const mockResult = await window.electronAPI.database.generateMockData(
        mockTargetTable,
        mockCount
      )
      setMockingStatus('success')
      // Auto run query to show the new data
      setSqlQuery(`SELECT * FROM ${mockTargetTable} ORDER BY rowid DESC LIMIT ${mockCount};`)
      const results = await window.electronAPI.database.executeQuery(
        `SELECT * FROM ${mockTargetTable} ORDER BY rowid DESC LIMIT ${mockCount};`
      )
      setQueryResults(results)
      setQuerySuccessMsg(`Injected ${mockResult.length} mock rows into table '${mockTargetTable}'.`)
      setTimeout(() => setMockingStatus('idle'), 3000)
    } catch (err: any) {
      setMockingStatus('error')
      alert(`Mock injection failed: ${err.message}`)
      setTimeout(() => setMockingStatus('idle'), 3000)
    }
  }

  const handleCopySchema = () => {
    window.electronAPI.clipboard.writeText(generatedSchema)
    setCopiedSchema(true)
    setTimeout(() => setCopiedSchema(false), 2000)
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[var(--bg-primary)] p-6 custom-scrollbar flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🗄️</span>
            <h1 className="text-2xl font-extrabold text-white">Database Explorer Console</h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Browse database tables, execute SQL queries, generate Prisma/Drizzle schemas, and inject test fixtures.
          </p>
        </div>
        <button
          onClick={onBack}
          className="py-2 px-4 rounded-lg bg-white/5 border border-[var(--border)] text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition"
        >
          ← Hub Dashboard
        </button>
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 flex-1 items-start min-h-0 overflow-y-visible">
        
        {/* Left column: Tables List */}
        <div className="lg:col-span-1 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-4 flex flex-col h-fit">
          <h2 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-3">
            Database Tables ({tables.length})
          </h2>
          <div className="flex flex-col gap-1.5 max-h-72 overflow-y-auto custom-scrollbar">
            {tables.map((t) => (
              <button
                key={t.name}
                onClick={() => loadTableSchema(t.name)}
                className={`w-full py-2 px-3 rounded-lg text-left text-xs font-medium transition-colors ${
                  activeTable === t.name
                    ? 'bg-blue-600/20 border border-blue-500/40 text-blue-400 font-bold'
                    : 'bg-black/10 dark:bg-white/5 border border-transparent text-[var(--text-secondary)] hover:bg-white/10 hover:text-white'
                }`}
              >
                📊 {t.name} <span className="float-right text-[10px] text-[var(--text-muted)] font-normal">{t.type}</span>
              </button>
            ))}
            {tables.length === 0 && (
              <div className="text-center py-6 text-xs text-[var(--text-muted)]">No tables found.</div>
            )}
          </div>

          {/* Active Table Schema */}
          {activeTable && (
            <div className="mt-6 border-t border-[var(--border)] pt-4">
              <h3 className="text-xs font-bold text-white mb-2 flex items-center justify-between">
                <span>Schema: {activeTable}</span>
                <span className="text-[10px] text-[var(--text-muted)]">Pragma Table Info</span>
              </h3>
              <div className="max-h-56 overflow-y-auto custom-scrollbar text-[11px] font-mono flex flex-col gap-1">
                {schemaColumns.map((col) => (
                  <div key={col.name} className="flex justify-between py-1 border-b border-white/5 text-[var(--text-secondary)]">
                    <span className={`font-semibold ${col.pk ? 'text-yellow-500' : ''}`}>
                      {col.name} {col.pk ? '🔑' : ''}
                    </span>
                    <span className="text-[var(--text-muted)]">
                      {col.type} {col.notnull ? 'REQ' : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Middle/Right columns: Query runner, mock data, schema compiler */}
        <div className="lg:col-span-3 flex flex-col gap-6">
          
          {/* Query Console */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 flex flex-col">
            <h2 className="text-sm font-bold text-white mb-3 flex items-center justify-between">
              <span>SQL Query Console</span>
              <span className="text-xs font-mono text-[var(--text-muted)]">SQLite mode</span>
            </h2>
            <textarea
              value={sqlQuery}
              onChange={(e) => setSqlQuery(e.target.value)}
              placeholder="Write SQL statements here..."
              rows={4}
              className="w-full font-mono text-sm p-4 rounded-xl bg-black/40 border border-[var(--border)] text-white outline-none focus:border-blue-500/50 resize-none transition"
            />
            <div className="mt-3 flex items-center gap-3 justify-between">
              <span className="text-[10px] text-[var(--text-muted)] font-mono">
                Press Ctrl+Enter to run query
              </span>
              <button
                onClick={handleExecuteQuery}
                className="py-2 px-5 rounded-lg bg-blue-600 text-white font-semibold text-xs hover:bg-blue-500 hover:shadow-lg hover:shadow-blue-500/10 cursor-pointer transition"
              >
                ⚡ Execute SQL Query
              </button>
            </div>

            {/* Success and Error messages */}
            {queryError && (
              <div className="mt-4 p-3 bg-red-600/15 border border-red-500/20 rounded-lg text-xs text-red-400 font-mono">
                ❌ Error: {queryError}
              </div>
            )}

            {querySuccessMsg && (
              <div className="mt-4 p-2 bg-emerald-600/15 border border-emerald-500/20 rounded-lg text-[11px] text-emerald-400 font-mono">
                ✔️ {querySuccessMsg}
              </div>
            )}

            {/* SQL Results Table */}
            {queryResults && queryResults.length > 0 && (
              <div className="mt-4 border border-[var(--border)] rounded-xl overflow-hidden max-h-80 overflow-y-auto custom-scrollbar">
                <table className="w-full text-left border-collapse text-xs font-mono">
                  <thead className="bg-black/35 text-[var(--text-muted)] border-b border-[var(--border)]">
                    <tr>
                      {Object.keys(queryResults[0]).map((header) => (
                        <th key={header} className="p-3 font-semibold border-r border-white/5">
                          {header}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5 bg-black/10">
                    {queryResults.map((row, idx) => (
                      <tr key={idx} className="hover:bg-white/5 transition-colors text-[var(--text-secondary)]">
                        {Object.values(row).map((val: any, cellIdx) => (
                          <td key={cellIdx} className="p-3 border-r border-white/5 truncate max-w-xs" title={String(val)}>
                            {val === null ? <span className="italic text-[var(--text-muted)]">null</span> : String(val)}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Schema Compiler & Mock Injector section side-by-side */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            
            {/* Schema Declaration Compiler */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 flex flex-col">
              <h2 className="text-sm font-bold text-white mb-3">ORM Model Compiler</h2>
              <p className="text-xs text-[var(--text-muted)] mb-4">
                Transpile your SQLite table schemas into TypeScript ORM code declarations.
              </p>
              <div className="flex gap-2 mb-4 shrink-0">
                {(['prisma', 'drizzle'] as const).map((format) => (
                  <button
                    key={format}
                    onClick={() => setSelectedFormat(format)}
                    className={`flex-1 py-1.5 rounded-lg text-xs font-bold capitalize border transition ${
                      selectedFormat === format
                        ? 'bg-indigo-600 border-indigo-500 text-white'
                        : 'bg-black/10 dark:bg-white/5 border-transparent text-[var(--text-muted)] hover:text-white'
                    }`}
                  >
                    {format}
                  </button>
                ))}
              </div>
              <button
                onClick={handleGenerateSchema}
                className="w-full py-2 rounded-lg bg-indigo-600/20 border border-indigo-500/30 text-indigo-400 font-semibold text-xs hover:bg-indigo-500/30 hover:border-indigo-400/50 transition cursor-pointer mb-4"
              >
                ⚙️ Compile Database Schema
              </button>

              {generatedSchema && (
                <div className="flex-1 flex flex-col min-h-0">
                  <div className="flex justify-between items-center bg-black/40 px-3 py-1.5 rounded-t-lg border-t border-x border-[var(--border)]">
                    <span className="text-[10px] text-[var(--text-muted)] font-mono">
                      Generated {selectedFormat === 'prisma' ? 'schema.prisma' : 'schema.ts'}
                    </span>
                    <button
                      onClick={handleCopySchema}
                      className="text-[10px] text-indigo-400 hover:text-indigo-300 font-bold transition"
                    >
                      {copiedSchema ? 'Copied! ✓' : 'Copy Code'}
                    </button>
                  </div>
                  <pre className="p-3 bg-black/40 border border-[var(--border)] rounded-b-lg text-[10px] font-mono text-[var(--text-secondary)] overflow-x-auto max-h-56 select-all custom-scrollbar whitespace-pre-wrap">
                    {generatedSchema}
                  </pre>
                </div>
              )}
            </div>

            {/* Mock Data Generator */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 flex flex-col justify-between h-full">
              <div>
                <h2 className="text-sm font-bold text-white mb-3">Mock Dataset Injector</h2>
                <p className="text-xs text-[var(--text-muted)] mb-4">
                  Inject schema-compliant mock rows into any table in the active database workspace.
                </p>

                {/* Target Selector */}
                <div className="flex flex-col gap-1.5 mb-4">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
                    Target Database Table
                  </label>
                  <select
                    value={mockTargetTable}
                    onChange={(e) => setMockTargetTable(e.target.value)}
                    className="py-2 px-3 bg-black/40 border border-[var(--border)] rounded-lg text-xs text-white outline-none focus:border-blue-500/50"
                  >
                    {tables.map((t) => (
                      <option key={t.name} value={t.name}>
                        {t.name} ({t.type})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Row Count Input */}
                <div className="flex flex-col gap-1.5 mb-4">
                  <label className="text-[10px] font-bold text-[var(--text-muted)] uppercase tracking-wide">
                    Number of Rows (Count)
                  </label>
                  <input
                    type="number"
                    value={mockCount}
                    min={1}
                    max={100}
                    onChange={(e) => setMockCount(parseInt(e.target.value, 10) || 5)}
                    className="py-2 px-3 bg-black/40 border border-[var(--border)] rounded-lg text-xs text-white outline-none focus:border-blue-500/50"
                  />
                </div>
              </div>

              {/* Action Button */}
              <button
                onClick={handleGenerateMock}
                disabled={mockingStatus === 'running'}
                className={`w-full py-3 rounded-lg font-bold text-xs text-white transition duration-200 cursor-pointer ${
                  mockingStatus === 'running'
                    ? 'bg-blue-800 cursor-wait'
                    : mockingStatus === 'success'
                      ? 'bg-emerald-600 hover:bg-emerald-500'
                      : 'bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 shadow-md hover:shadow-indigo-500/10'
                }`}
              >
                {mockingStatus === 'idle' && '🎁 Inject Mock Records'}
                {mockingStatus === 'running' && '⏳ Generating Mock Data...'}
                {mockingStatus === 'success' && '✔️ Records Injected!'}
                {mockingStatus === 'error' && '❌ Generation Failed'}
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  )
}
