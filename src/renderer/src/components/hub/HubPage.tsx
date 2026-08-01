// ═══════════════════════════════════════════════════════════════════
// Lumiq — Hub Page (Milestones 26-30 Control Center)
// ═══════════════════════════════════════════════════════════════════

import React, { useState } from 'react'
import { DatabaseConsole } from './DatabaseConsole'
import { TestCenter } from './TestCenter'
import { DeployPortal } from './DeployPortal'
import { ArchitectWiki } from './ArchitectWiki'
import { CollaborationRoom } from './CollaborationRoom'

interface HubPageProps {
  onNavigate: (page: 'chat' | 'settings' | 'agents' | 'composer' | 'hub') => void
}

type SubView = 'dashboard' | 'database' | 'testing' | 'deploy' | 'wiki' | 'collaboration'

export function HubPage({ onNavigate }: HubPageProps): React.JSX.Element {
  const [subView, setSubView] = useState<SubView>('dashboard')

  const tools = [
    {
      id: 'database' as const,
      name: 'Database Explorer',
      description: 'Inspect schemas, run raw SQL queries, generate mock datasets, and compile Prisma/Drizzle schemas.',
      icon: '🗄️',
      gradient: 'from-blue-600/20 to-indigo-600/20 border-blue-500/30 text-blue-400 hover:border-blue-400/60',
      badge: 'SQLite'
    },
    {
      id: 'testing' as const,
      name: 'TDD Test Center',
      description: 'Execute Vitest runner, inspect pass/fail metrics, and launch TDD autonomous code healing repair loops.',
      icon: '🧪',
      gradient: 'from-emerald-600/20 to-teal-600/20 border-emerald-500/30 text-emerald-400 hover:border-emerald-400/60',
      badge: 'Vitest + TDD'
    },
    {
      id: 'deploy' as const,
      name: 'Cloud Deployment',
      description: 'Generate Docker/Serverless IaC configs, validate pre-deploy builds, and execute simulated cloud deploys.',
      icon: '🚀',
      gradient: 'from-orange-600/20 to-rose-600/20 border-orange-500/30 text-orange-400 hover:border-orange-400/60',
      badge: 'IaC & Build'
    },
    {
      id: 'wiki' as const,
      name: 'Architect Wiki',
      description: 'Explore visual module dependency graphs, generate ARCHITECTURE.md, and onboard developers.',
      icon: '🏛️',
      gradient: 'from-purple-600/20 to-pink-600/20 border-purple-500/30 text-purple-400 hover:border-purple-400/60',
      badge: 'Mermaid.js'
    },
    {
      id: 'collaboration' as const,
      name: 'Collaboration Hub',
      description: 'Establish secure P2P TeamSpaces, configure encrypted passcodes, track active presence, and review logs.',
      icon: '🤝',
      gradient: 'from-pink-600/20 to-rose-600/20 border-pink-500/30 text-pink-400 hover:border-pink-400/60',
      badge: 'P2P + CRDT'
    }
  ]

  if (subView === 'database') {
    return <DatabaseConsole onBack={() => setSubView('dashboard')} />
  }

  if (subView === 'testing') {
    return <TestCenter onBack={() => setSubView('dashboard')} />
  }

  if (subView === 'deploy') {
    return <DeployPortal onBack={() => setSubView('dashboard')} />
  }

  if (subView === 'wiki') {
    return <ArchitectWiki onBack={() => setSubView('dashboard')} />
  }

  if (subView === 'collaboration') {
    return <CollaborationRoom onBack={() => setSubView('dashboard')} />
  }

  return (
    <div className="flex-1 h-full overflow-y-auto bg-[var(--bg-primary)] p-6 custom-scrollbar flex flex-col">
      {/* Header */}
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight text-white bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-purple-400">
            Lumiq Developer Hub
          </h1>
          <p className="text-sm text-[var(--text-muted)] mt-1">
            Access advanced platform tools, database explorers, automated testing, and architecture diagrammers.
          </p>
        </div>
        <button
          onClick={() => onNavigate('chat')}
          className="py-2 px-4 rounded-lg bg-white/5 border border-[var(--border)] text-xs font-semibold text-[var(--text-primary)] hover:bg-white/10 transition-colors"
        >
          ← Back to Editor
        </button>
      </div>

      {/* Grid Menu */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 flex-1 max-w-5xl">
        {tools.map((tool) => (
          <div
            key={tool.id}
            onClick={() => setSubView(tool.id)}
            className={`group rounded-2xl border bg-gradient-to-br ${tool.gradient} p-6 flex flex-col justify-between cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-2xl hover:shadow-indigo-500/10 backdrop-blur-md relative overflow-hidden`}
          >
            {/* Glossy overlay */}
            <div className="absolute inset-0 bg-white/[0.02] opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none" />
            
            <div>
              {/* Icon & Badge */}
              <div className="flex items-center justify-between mb-4">
                <span className="text-4xl filter drop-shadow-[0_4px_10px_rgba(255,255,255,0.15)] group-hover:scale-110 transition-transform duration-300">
                  {tool.icon}
                </span>
                <span className="px-2.5 py-1 rounded-full bg-white/10 border border-white/5 text-[10px] font-bold tracking-wide uppercase text-white/80">
                  {tool.badge}
                </span>
              </div>

              {/* Text */}
              <h2 className="text-xl font-bold text-white mb-2 group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-white/70 transition-colors">
                {tool.name}
              </h2>
              <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
                {tool.description}
              </p>
            </div>

            {/* Launch link */}
            <div className="mt-6 flex items-center text-xs font-bold gap-1 text-[var(--text-primary)] opacity-80 group-hover:opacity-100 transition-opacity">
              Launch Console <span className="transform group-hover:translate-x-1 transition-transform">➔</span>
            </div>
          </div>
        ))}
      </div>

      {/* Footer statistics */}
      <div className="mt-8 border-t border-[var(--border)] pt-4 flex items-center justify-between text-xs text-[var(--text-muted)]">
        <div>Offline Mode: Active</div>
        <div>Lumiq Service Platform v1.1</div>
      </div>
    </div>
  )
}
