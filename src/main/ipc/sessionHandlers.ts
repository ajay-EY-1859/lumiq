// ═══════════════════════════════════════════════════════════════════
// Lumiq — Session IPC Handlers
// Handles session CRUD operations
// ═══════════════════════════════════════════════════════════════════

import { IPC } from '@shared/types'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import {
  createSession,
  listSessions,
  deleteSession,
  updateSessionTitle,
  getSession,
  updateSessionWorkspace
} from '../db/sessions'
import { getSessionMessages, clearSessionMessages, compactSessionMessages, deleteMessagesFrom } from '../db/messages'
import { setWorkspaceRoot, setAllowedExtraPaths, validateWorkspaceRootCandidate, parseAttachedPaths } from '../security/pathValidation'
import { handleWithTimeout, IPC_TIMEOUT } from './handleWithTimeout'
import { CodeIntelligenceService } from '../services/CodeIntelligenceService'

function setupWorkspaceRunner(workspacePath: string): void {
  try {
    const lumiqDir = join(workspacePath, '.lumiq')
    if (!existsSync(lumiqDir)) {
      mkdirSync(lumiqDir, { recursive: true })
    }
    const runnerPath = join(lumiqDir, 'c-cpp-runner.js')
    
    const runnerCode = `const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const args = process.argv.slice(2);
if (args.length < 2) {
  console.error('Usage: node c-cpp-runner.js <compiler> <source_file>');
  process.exit(1);
}

const compiler = args[0];
const sourceFile = args[1];

if (!fs.existsSync(sourceFile)) {
  console.error(\`Source file not found: \${sourceFile}\`);
  process.exit(1);
}

const ext = path.extname(sourceFile);
const parsed = path.parse(sourceFile);
const isWindows = process.platform === 'win32';
const outputName = parsed.name + (isWindows ? '.exe' : '');
const outputPath = path.join(parsed.dir, outputName);

console.log(\`[Lumiq] Compiling \${parsed.base} using \${compiler}...\`);

const compileProcess = spawn(compiler, [sourceFile, '-o', outputPath], {
  stdio: 'inherit'
});

compileProcess.on('close', (code) => {
  if (code !== 0) {
    console.error(\`\\n[Lumiq] Compilation failed with exit code \${code}\`);
    process.exit(code);
  }

  console.log(\`\\n[Lumiq] Compilation successful. Running \${outputName}...\\n\`);

  // Spawn the compiled executable
  const runProcess = spawn(outputPath, [], {
    stdio: 'inherit'
  });

  runProcess.on('close', (runCode) => {
    process.exit(runCode);
  });
});
`
    writeFileSync(runnerPath, runnerCode, 'utf8')
    console.log(`[Lumiq] C/C++ Workspace Runner written to ${runnerPath}`)
  } catch (err) {
    console.error('[Lumiq] Failed to setup C/C++ workspace runner:', err)
  }
}

export function registerSessionHandlers(): void {
  // ── List all sessions ──
  handleWithTimeout(IPC.SESSION_LIST, IPC_TIMEOUT.short, () => {
    return listSessions()
  })

  // ── Load session (returns messages) ──
  handleWithTimeout(IPC.SESSION_LOAD, IPC_TIMEOUT.short, (_event, sessionId: string) => {
    const session = getSession(sessionId)
    if (!session) throw new Error(`Session "${sessionId}" not found`)
    
    // Authorize this session's workspace for file operations
    setWorkspaceRoot(session.workspacePath || null)
    if (session.workspacePath) {
      setupWorkspaceRunner(session.workspacePath)
    }

    // Trigger background code intelligence indexing & watching with a 2-second delay to ensure instant app loading
    setTimeout(() => {
      void CodeIntelligenceService.getInstance().setWorkspace(session.workspacePath || null)
    }, 2000)

    const messages = getSessionMessages(sessionId)

    // Extract all attached paths from the session history
    const attachedPathsSet = new Set<string>()


    for (const msg of messages) {
      if (msg.content) {
        parseAttachedPaths(msg.content).forEach((p) => attachedPathsSet.add(p))
      }
    }
    setAllowedExtraPaths(Array.from(attachedPathsSet))

    return { session, messages }
  })

  // ── Create new session ──
  handleWithTimeout(
    IPC.SESSION_CREATE,
    IPC_TIMEOUT.short,
    (_event, data: { provider: string; model: string; agentId?: string }) => {
      return createSession(data.provider, data.model, data.agentId)
    }
  )

  // ── Delete session ──
  handleWithTimeout(IPC.SESSION_DELETE, IPC_TIMEOUT.short, (_event, sessionId: string) => {
    return deleteSession(sessionId)
  })

  // ── Rename session ──
  handleWithTimeout(
    IPC.SESSION_RENAME,
    IPC_TIMEOUT.short,
    (_event, data: { sessionId: string; title: string }) => {
      updateSessionTitle(data.sessionId, data.title)
    }
  )

  // ── Set Workspace ──
  handleWithTimeout(
    IPC.SESSION_SET_WORKSPACE,
    IPC_TIMEOUT.short,
    (_event, data: { sessionId: string; workspacePath: string | null }) => {
      const workspacePath = validateWorkspaceRootCandidate(data.workspacePath)
      updateSessionWorkspace(data.sessionId, workspacePath)
      // Immediately authorize the new workspace
      setWorkspaceRoot(workspacePath)
      if (workspacePath) {
        setupWorkspaceRunner(workspacePath)
      }
      // Immediately trigger background code intelligence indexing & watching
      void CodeIntelligenceService.getInstance().setWorkspace(workspacePath)
    }
  )

  // ── Export session ──
  handleWithTimeout(
    IPC.SESSION_EXPORT,
    IPC_TIMEOUT.short,
    (_event, data: { sessionId: string; format: 'json' | 'markdown' }) => {
      const session = getSession(data.sessionId)
      if (!session) throw new Error(`Session "${data.sessionId}" not found`)
      const messages = getSessionMessages(data.sessionId)

      if (data.format === 'json') {
        return JSON.stringify({ session, messages }, null, 2)
      }

      // Markdown format
      let md = `# ${session.title}\n\n`
      md += `**Provider:** ${session.provider} | **Model:** ${session.model}\n`
      md += `**Created:** ${session.createdAt}\n\n---\n\n`

      for (const msg of messages) {
        const role = msg.role === 'user' ? '👤 User' : msg.role === 'assistant' ? '🤖 Assistant' : `🔧 ${msg.toolName || 'Tool'}`
        md += `### ${role}\n\n${msg.content}\n\n---\n\n`
      }

      return md
    }
  )

  // ── Clear session messages ──
  handleWithTimeout(IPC.SESSION_CLEAR_MESSAGES, IPC_TIMEOUT.short, (_event, sessionId: string) => {
    return clearSessionMessages(sessionId)
  })

  // ── Compact session messages ──
  handleWithTimeout(
    IPC.SESSION_COMPACT_MESSAGES,
    IPC_TIMEOUT.short,
    (_event, data: { sessionId: string; keepCount?: number }) => {
      return compactSessionMessages(data.sessionId, data.keepCount || 10)
    }
  )

  // ── Delete messages from a specific message ID ──
  handleWithTimeout(
    IPC.SESSION_DELETE_MESSAGES_FROM,
    IPC_TIMEOUT.short,
    (_event, data: { sessionId: string; messageId: string }) => {
      return deleteMessagesFrom(data.sessionId, data.messageId)
    }
  )
}
