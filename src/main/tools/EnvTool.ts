// ═══════════════════════════════════════════════════════════════════
// Lumiq — EnvTool
// Read environment variables (safe subset only)
// ═══════════════════════════════════════════════════════════════════

import type { Tool } from './Tool'

// Blocked environment variable patterns (security)
const BLOCKED_PATTERNS = [
  /^.*_KEY$/i,
  /^.*_SECRET$/i,
  /^.*_TOKEN$/i,
  /^.*_PASSWORD$/i,
  /^.*_CREDENTIAL/i,
  /^AWS_/i,
  /^AZURE_/i,
  /^GCP_/i,
  /^GITHUB_/i,
  /^GITLAB_/i,
  /^OPENAI_/i,
  /^ANTHROPIC_/i,
  /^STRIPE_/i,
  /^TWILIO_/i,
  /^SLACK_/i,
  /^SENDGRID_/i,
  /^DATABASE_URL/i,
  /^REDIS_URL/i,
  /^MONGO_URL/i
]

// Allowed variables (whitelist)
const ALLOWED_VARS = new Set([
  'PATH',
  'HOME',
  'USER',
  'SHELL',
  'LANG',
  'LC_ALL',
  'NODE_ENV',
  'NPM_CONFIG_PREFIX',
  'PYTHON_PATH',
  'GOPATH',
  'JAVA_HOME',
  'RUST_HOME',
  'CARGO_HOME',
  'KUBECONFIG',
  'DOCKER_HOST',
  'TERM',
  'EDITOR',
  'VISUAL',
  'TMPDIR',
  'TEMP',
  'TMP',
  'CI',
  'CI_BUILD_ID',
  'VERSION',
  'BUILD_NUMBER',
  'ENVIRONMENT',
  'APP_ENV',
  'WORKSPACE',
  'WORKSPACE_PATH'
])

export class EnvTool implements Tool {
  name = 'EnvTool'
  description = 'Read environment variables (safe subset only)'
  requiresApproval = true
  isReadOnly = true
  inputSchema = {
    type: 'object',
    properties: {
      action: {
        type: 'string',
        enum: ['read', 'list'],
        description: 'Action: read specific var or list all safe vars'
      },
      name: {
        type: 'string',
        description: 'Variable name (required for action: "read")'
      }
    }
  }

  async execute(input: Record<string, unknown>): Promise<string> {
    const action = (input.action as string) || 'list'
    const name = input.name as string | undefined

    if (!['read', 'list'].includes(action)) {
      return `[ERROR] Invalid action: ${action}. Use "read" or "list"`
    }

    if (action === 'read') {
      return this.readVariable(name)
    } else {
      return this.listVariables()
    }
  }

  private readVariable(name: string | undefined): string {
    if (!name) {
      return '[ERROR] "name" is required for action: "read"'
    }

    // Check if blocked
    if (this.isBlocked(name)) {
      return `[ERROR] Environment variable is blocked for security: ${name}`
    }

    const value = process.env[name]

    if (value === undefined) {
      return `[OK] Environment variable not set: ${name}`
    }

    // For sensitive-looking variables, warn even if allowed
    if (/password|secret|token|key|credential/i.test(name)) {
      return `[WARNING] Variable appears to contain sensitive data: ${name}
Value: [REDACTED]

If you need this value, ensure it's not a credential. If it is, use a secure secrets manager instead.`
    }

    // Limit output size
    if (value.length > 50000) {
      return `[OK] ${name}=${value.substring(0, 50000)}...\n\n[truncated: ${value.length - 50000} characters]`
    }

    return `[OK] ${name}=${value}`
  }

  private listVariables(): string {
    const env = process.env
    const safe: Record<string, string> = {}

    for (const [key, value] of Object.entries(env)) {
      if (!this.isBlocked(key) && value) {
        safe[key] = value
      }
    }

    if (Object.keys(safe).length === 0) {
      return '[OK] No safe environment variables found'
    }

    let output = '[SAFE ENVIRONMENT VARIABLES]\n\n'
    const sortedKeys = Object.keys(safe).sort()

    for (const key of sortedKeys) {
      const value = safe[key]
      if (value.length > 100) {
        output += `${key}=${value.substring(0, 100)}...\n`
      } else {
        output += `${key}=${value}\n`
      }
    }

    output += `\nTotal: ${sortedKeys.length} variables`
    return output
  }

  private isBlocked(name: string): boolean {
    // Check blocklist first
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(name)) {
        return true
      }
    }

    // If allowlist is defined, only allow those
    if (ALLOWED_VARS.size > 0) {
      return !ALLOWED_VARS.has(name) && !this.isCommonPublicVar(name)
    }

    return false
  }

  private isCommonPublicVar(name: string): boolean {
    // Variables that are generally safe to read
    const commonVars = [
      /^PATH$/i,
      /^LANG/i,
      /^LC_/i,
      /^TERM/i,
      /^EDITOR/i,
      /^SHELL/i,
      /^HOME/i,
      /^USER/i,
      /^LOGNAME/i,
      /^HOSTNAME/i,
      /^OSTYPE/i,
      /^MACHTYPE/i,
      /^TMP/i,
      /^TEMP/i,
      /^PWD/i,
      /^OLDPWD/i,
      /^SHLVL/i,
      /^_$/i,
      /^LESS/i,
      /^GREP_/i,
      /^COLORTERM/i,
      /^XDG_/i
    ]

    return commonVars.some(pattern => pattern.test(name))
  }
}
