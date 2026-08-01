// ═══════════════════════════════════════════════════════════════════
// Lumiq — Codebase Architect Wiki & Mermaid Diagrammer (Milestone 30)
// ═══════════════════════════════════════════════════════════════════

import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { useSessionStore } from '@renderer/store/sessionStore'

interface ArchitectWikiProps {
  onBack: () => void
}

type ParsedNode = { id: string; label: string }
type ParsedLink = { source: string; target: string }

export function ArchitectWiki({ onBack }: ArchitectWikiProps): React.JSX.Element {
  const { activeSessionId, sessions } = useSessionStore()
  const activeSession = sessions.find((s) => s.id === activeSessionId)
  const workspacePath = activeSession?.workspacePath ?? null

  const [indexing, setIndexing] = useState(false)
  const [wikiStats, setWikiStats] = useState<{ filesParsed: number; importsCount: number } | null>(null)
  
  const [mermaidCode, setMermaidCode] = useState('graph TD\n  A["Start"] --> B["Perform scan to discover dependencies"]')
  const [wikiFilePath, setWikiFilePath] = useState<string | null>(null)

  // Scan codebase and extract stats
  const handleAnalyze = useCallback(async () => {
    if (!workspacePath) return
    setIndexing(true)
    try {
      const stats = await window.electronAPI.wiki.analyzeCodebase(workspacePath)
      const mermaid = await window.electronAPI.wiki.generateMermaidDiagram(workspacePath)
      
      let importsCount = 0
      Object.values(stats.importsMap).forEach((list) => {
        importsCount += list.length
      })

      setWikiStats({
        filesParsed: stats.filesParsed,
        importsCount
      })
      setMermaidCode(mermaid)
    } catch (err: any) {
      alert(`Codebase scan failed: ${err.message}`)
    } finally {
      setIndexing(false)
    }
  }, [workspacePath])

  // Write ARCHITECTURE.md
  const handleWriteWiki = async () => {
    if (!workspacePath) return
    setIndexing(true)
    try {
      const path = await window.electronAPI.wiki.writeWikiFile(workspacePath)
      setWikiFilePath(path)
      // Re-trigger scan to reload stats
      await handleAnalyze()
    } catch (err: any) {
      alert(`Failed to write wiki: ${err.message}`)
    } finally {
      setIndexing(false)
    }
  }

  // Parse Mermaid code into node cards & links for native visual drawing
  const graphData = useMemo(() => {
    const nodesMap = new Map<string, string>()
    const links: ParsedLink[] = []
    
    const lines = mermaidCode.split('\n')
    const nodeRegex = /([A-Za-z0-9_]+)\["([^"]+)"\]/g

    for (const line of lines) {
      // Find node definitions: ID["label"]
      let match
      // Reset regex index for safety
      nodeRegex.lastIndex = 0
      while ((match = nodeRegex.exec(line)) !== null) {
        nodesMap.set(match[1], match[2])
      }

      // Find connections: ID1 --> ID2
      const connMatch = line.match(/([A-Za-z0-9_]+)\s*-->\s*([A-Za-z0-9_]+)/)
      if (connMatch) {
        const src = connMatch[1]
        const dest = connMatch[2]
        links.push({ source: src, target: dest })
        
        // Fallback label if not found in brackets
        if (!nodesMap.has(src)) nodesMap.set(src, src)
        if (!nodesMap.has(dest)) nodesMap.set(dest, dest)
      }
    }

    const nodes: ParsedNode[] = Array.from(nodesMap.entries()).map(([id, label]) => ({ id, label }))
    return { nodes, links }
  }, [mermaidCode])

  useEffect(() => {
    if (workspacePath) {
      handleAnalyze()
    }
  }, [workspacePath, handleAnalyze])

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[var(--bg-primary)] p-6 custom-scrollbar flex flex-col">
      {/* Header */}
      <div className="mb-6 flex items-center justify-between shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-2xl">🏛️</span>
            <h1 className="text-2xl font-extrabold text-white">Codebase Architect Wiki</h1>
          </div>
          <p className="text-xs text-[var(--text-muted)] mt-1">
            Analyze dependency layers, generate Mermaid.js charts, and auto-generate project architecture wikis.
          </p>
        </div>
        <button
          onClick={onBack}
          className="py-2 px-4 rounded-lg bg-white/5 border border-[var(--border)] text-xs font-semibold text-white/80 hover:bg-white/10 hover:text-white transition"
        >
          ← Hub Dashboard
        </button>
      </div>

      {!workspacePath ? (
        <div className="flex-1 flex flex-col items-center justify-center p-10 text-center border border-dashed border-[var(--border)] rounded-2xl bg-[var(--bg-secondary)]">
          <span className="text-4xl mb-4">📂</span>
          <h2 className="text-sm font-bold text-white mb-2">No Workspace Folder Bound</h2>
          <p className="text-xs text-[var(--text-muted)] max-w-sm mb-4">
            Connect a local directory in the explorer to generate an architectural dependency wiki.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 flex-1 items-stretch min-h-0 overflow-y-visible">
          
          {/* Left Column: Wiki controls & statistics */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            
            {/* Control Panel */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 flex flex-col gap-4">
              <h2 className="text-sm font-bold text-white">Wiki Document Manager</h2>
              
              <div className="flex flex-col gap-2">
                <button
                  onClick={handleAnalyze}
                  disabled={indexing}
                  className={`w-full py-2 rounded-lg font-bold text-xs text-white border border-transparent transition cursor-pointer ${
                    indexing
                      ? 'bg-purple-800/40 border-purple-500/20 cursor-wait text-purple-300'
                      : 'bg-purple-600/20 border-purple-500/30 text-purple-400 hover:bg-purple-500/30 hover:border-purple-400/50'
                  }`}
                >
                  {indexing ? '⏳ Scanning Codebase...' : '🔍 Scan Module Dependencies'}
                </button>

                <button
                  onClick={handleWriteWiki}
                  disabled={indexing}
                  className="w-full py-2.5 rounded-lg bg-purple-600 text-white font-bold text-xs hover:bg-purple-500 hover:shadow-lg hover:shadow-purple-500/10 transition cursor-pointer"
                >
                  📝 Generate ARCHITECTURE.md
                </button>
              </div>

              {wikiFilePath && (
                <div className="p-2.5 bg-emerald-600/10 border border-emerald-500/20 rounded-lg text-[10px] text-emerald-400 font-mono break-all leading-normal">
                  ✔️ Saved developer wiki to:<br />
                  <span className="font-bold">{wikiFilePath}</span>
                </div>
              )}
            </div>

            {/* Analysis Stats */}
            {wikiStats && (
              <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5">
                <h2 className="text-sm font-bold text-white mb-3">Codebase Stats Summary</h2>
                <div className="flex flex-col gap-2 text-xs text-[var(--text-secondary)]">
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span>Javascript/TypeScript Files</span>
                    <span className="font-mono font-bold text-purple-400">{wikiStats.filesParsed}</span>
                  </div>
                  <div className="flex justify-between py-1.5 border-b border-white/5">
                    <span>Local Imports Scanned</span>
                    <span className="font-mono font-bold text-purple-400">{wikiStats.importsCount}</span>
                  </div>
                  <div className="flex justify-between py-1.5">
                    <span>Architecture Pattern</span>
                    <span className="text-[var(--text-muted)]">Layered DI Platform</span>
                  </div>
                </div>
              </div>
            )}

            {/* Raw code preview */}
            <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 flex flex-col flex-1 min-h-[200px]">
              <h3 className="text-xs font-bold text-[var(--text-muted)] uppercase tracking-wider mb-2">Mermaid.js Flow Code</h3>
              <pre className="flex-1 p-3 bg-black/45 border border-[var(--border)] rounded-lg text-[10px] font-mono text-[var(--text-secondary)] overflow-y-auto custom-scrollbar select-all whitespace-pre-wrap">
                {mermaidCode}
              </pre>
            </div>

          </div>

          {/* Right Column: Visual Diagrammer */}
          <div className="lg:col-span-2 rounded-xl border border-[var(--border)] bg-[var(--bg-secondary)] p-5 flex flex-col min-h-[450px]">
            <h2 className="text-sm font-bold text-white mb-1 shrink-0">Architectural dependency flowchart</h2>
            <p className="text-xs text-[var(--text-muted)] mb-4 shrink-0">
              Visualizes modules (nodes) and import chains (connectors) as parsed from source files in real-time.
            </p>

            {/* Canvas Area */}
            <div className="flex-1 bg-black/45 border border-[var(--border)] rounded-xl relative p-6 overflow-auto custom-scrollbar flex flex-wrap gap-4 items-center justify-center min-h-[350px]">
              
              {/* Nodes layout */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 w-full max-w-2xl relative z-10">
                {graphData.nodes.map((n) => {
                  // Find if it has imports or is imported
                  const isSource = graphData.links.some(l => l.source === n.id)
                  const isTarget = graphData.links.some(l => l.target === n.id)
                  
                  return (
                    <div
                      key={n.id}
                      className={`p-3 rounded-xl border text-center transition-all duration-300 hover:scale-105 backdrop-blur shadow-lg ${
                        isSource && isTarget
                          ? 'bg-purple-600/10 border-purple-500/30 text-purple-300'
                          : isSource
                            ? 'bg-blue-600/10 border-blue-500/30 text-blue-300'
                            : 'bg-pink-600/10 border-pink-500/30 text-pink-300'
                      }`}
                    >
                      <div className="text-[10px] uppercase font-bold text-[var(--text-muted)] tracking-widest font-mono mb-1">
                        {n.id}
                      </div>
                      <div className="text-xs font-semibold text-white truncate" title={n.label}>
                        {n.label}
                      </div>
                    </div>
                  )
                })}

                {graphData.nodes.length === 0 && (
                  <div className="col-span-full text-center py-12 text-xs text-[var(--text-muted)] italic">
                    No module relationships found. Perform a codebase scan to populate the diagram.
                  </div>
                )}
              </div>

              {/* Background connector summary decoration */}
              {graphData.links.length > 0 && (
                <div className="absolute top-3 right-3 py-1 px-2.5 rounded bg-black/60 border border-white/5 text-[10px] font-mono text-[var(--text-muted)] z-20">
                  ⛓️ Connectors: {graphData.links.length} relationships
                </div>
              )}
            </div>

          </div>

        </div>
      )}
    </div>
  )
}
