// ═══════════════════════════════════════════════════════════════════
// Lumiq — Permission Modes
// MANUAL   — every tool requires approval dialog
// LIMITED  — read-only tools auto-approve, write tools ask
// EXTENDED — read-only + safe shell commands auto-approve,
//            only destructive writes ask
// AUTO     — all tools auto-approve (power users / trusted sessions)
// ═══════════════════════════════════════════════════════════════════

export type PermissionMode = 'MANUAL' | 'LIMITED' | 'EXTENDED' | 'AUTO'

// Tools that are safe to auto-approve in LIMITED mode
const LIMITED_AUTO_APPROVE = new Set([
  'FileReadTool',
  'GrepTool',
  'GlobTool',
  'WebSearchTool',
  'WebFetchTool',
  'TodoWriteTool',
  'SleepTool'
])

// Tools that are safe to auto-approve in EXTENDED mode
// (everything in LIMITED + write tools that are low-risk)
const EXTENDED_AUTO_APPROVE = new Set([
  ...LIMITED_AUTO_APPROVE,
  'FileWriteTool',
  'FileEditTool',
  'BashTool',
  'PowerShellTool'
])

export interface PermissionDecision {
  autoApprove: boolean
  reason: string
}

export function evaluatePermission(
  toolName: string,
  mode: PermissionMode,
  toolPermission: 'always-ask' | 'always-allow' | 'always-deny'
): PermissionDecision {
  // Per-tool overrides always win
  if (toolPermission === 'always-deny') {
    return { autoApprove: false, reason: 'Tool is denied by settings' }
  }
  if (toolPermission === 'always-allow') {
    return { autoApprove: true, reason: 'Tool is always-allowed by settings' }
  }

  // Mode-based decision
  switch (mode) {
    case 'AUTO':
      return { autoApprove: true, reason: 'AUTO mode: all tools approved' }

    case 'EXTENDED':
      if (EXTENDED_AUTO_APPROVE.has(toolName) || toolName.startsWith('MCP_')) {
        return { autoApprove: true, reason: 'EXTENDED mode: tool auto-approved' }
      }
      return { autoApprove: false, reason: 'EXTENDED mode: unknown tool requires approval' }

    case 'LIMITED':
      if (LIMITED_AUTO_APPROVE.has(toolName)) {
        return { autoApprove: true, reason: 'LIMITED mode: read-only tool auto-approved' }
      }
      return { autoApprove: false, reason: 'LIMITED mode: write tool requires approval' }

    case 'MANUAL':
    default:
      return { autoApprove: false, reason: 'MANUAL mode: approval required' }
  }
}

export const PERMISSION_MODE_INFO: Record<PermissionMode, { label: string; description: string; emoji: string }> = {
  MANUAL: {
    emoji: '🔒',
    label: 'Manual',
    description: 'Every tool call requires your approval. Maximum control.'
  },
  LIMITED: {
    emoji: '⚡',
    label: 'Limited',
    description: 'Read-only tools (search, file read, grep) auto-approve. Write tools still ask.'
  },
  EXTENDED: {
    emoji: '🔧',
    label: 'Extended',
    description: 'Read-only tools and common write tools (file edit, bash) auto-approve. For power users who trust the agent.'
  },
  AUTO: {
    emoji: '🚀',
    label: 'Auto',
    description: 'All tools auto-approve. For trusted sessions and power users.'
  }
}
