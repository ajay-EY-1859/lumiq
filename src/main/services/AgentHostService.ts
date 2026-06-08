import { IAgentHostService, AgentHostSession } from '@shared/services';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import * as fs from 'fs';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as os from 'os';

const execAsync = promisify(exec);

type AgentSandboxConfig = {
  cpuLimit?: number;
  memoryLimit?: number;
  allowedCommands?: string[];
  blockedCommands?: string[];
  allowedPaths?: string[];
  network?: boolean;
}

type StoredAgentHostSession = AgentHostSession & {
  cpuLimit?: number;
  memoryLimit?: number;
  currentMemory?: number;
  sandboxConfig: AgentSandboxConfig;
}

export class AgentHostService implements IAgentHostService {
  private sessions = new Map<string, StoredAgentHostSession>();
  private checkpoints = new Map<string, { sessionId: string; state: string }>();

  async spawnHost(workspacePath: string, sandboxConfig: AgentSandboxConfig = {}): Promise<AgentHostSession> {
    const sessionId = Math.random().toString(36).substring(2, 9);
    const resolvedWorkspace = path.resolve(workspacePath);
    
    // Setup virtual workspace directory inside the workspace
    const lumiqDir = path.join(resolvedWorkspace, '.lumiq');
    if (!fs.existsSync(lumiqDir)) {
      fs.mkdirSync(lumiqDir, { recursive: true });
    }

    const logPath = path.join(lumiqDir, 'agent_logs.jsonl');
    const initLog = { 
      jsonrpc: '2.0',
      method: 'spawn',
      params: { workspacePath: resolvedWorkspace, sandboxConfig },
      timestamp: new Date().toISOString()
    };
    fs.writeFileSync(logPath, JSON.stringify(initLog) + '\n', 'utf8');

    const session = {
      id: sessionId,
      workspacePath: resolvedWorkspace,
      status: 'running' as const,
      logs: ['Agent host spawned successfully'],
      cpuLimit: sandboxConfig?.cpuLimit,
      memoryLimit: sandboxConfig?.memoryLimit,
      currentMemory: 50, // Mock current memory usage in MB
      sandboxConfig
    };
    this.sessions.set(sessionId, session);
    return session;
  }

  async runCommandInSandbox(sessionId: string, command: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Agent session ${sessionId} not found`);
    if (session.status === 'terminated') throw new Error(`Agent session ${sessionId} is terminated`);

    // Verify blocked command/network actions
    const commandName = this.getCommandName(command);
    const blockedCommands = new Set([
      'rm',
      'chmod',
      ...session.sandboxConfig.blockedCommands || []
    ]);
    if (blockedCommands.has(commandName)) {
      throw new Error(`Sandbox violation: command '${command}' is blocked by security policy.`);
    }
    const allowedCommands = session.sandboxConfig.allowedCommands;
    if (allowedCommands && allowedCommands.length > 0 && !allowedCommands.includes(commandName)) {
      throw new Error(`Sandbox violation: command '${commandName}' is not in the allowed command list.`);
    }
    if (session.sandboxConfig.network === false && ['curl', 'wget', 'ssh', 'scp'].includes(commandName)) {
      throw new Error(`Sandbox violation: network command '${commandName}' is blocked by policy.`);
    }
    this.assertCommandPathsInsideSandbox(session, command);

    // Verify CPU/Memory limits
    const approxMem = process.memoryUsage().rss / (1024 * 1024);
    if (session.currentMemory === 50) session.currentMemory = approxMem; // Update mock to real if untouched

    if (session.memoryLimit && session.currentMemory && session.currentMemory > session.memoryLimit) {
      throw new Error(`Resource limit exceeded: memory usage (${session.currentMemory}MB) exceeds configured cap (${session.memoryLimit}MB).`);
    }

    const logPath = path.join(session.workspacePath, '.lumiq', 'agent_logs.jsonl');
    const entry = {
      jsonrpc: '2.0',
      method: 'executeCommand',
      params: { command },
      timestamp: new Date().toISOString()
    };
    fs.appendFileSync(logPath, JSON.stringify(entry) + '\n', 'utf8');
    
    try {
      const { stdout, stderr } = await execAsync(command, { cwd: session.workspacePath, timeout: 5000 });
      const output = stdout || stderr || `Command '${command}' executed successfully.`;
      session.logs.push(`Executed: ${command}`);
      return output;
    } catch (err: any) {
      session.logs.push(`Failed to execute: ${command}`);
      return err.stdout || err.stderr || err.message;
    }
  }

  setMockMemoryUsage(sessionId: string, memoryMb: number): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.currentMemory = memoryMb;
    }
  }

  async checkpointHost(sessionId: string): Promise<string> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Agent session ${sessionId} not found`);

    const checkpointId = `chk-${Math.random().toString(36).substring(2, 9)}`;
    const state = JSON.stringify({
      status: session.status,
      logCount: session.logs.length,
      timestamp: new Date().toISOString(),
      currentMemory: session.currentMemory
    });

    this.checkpoints.set(checkpointId, { sessionId, state });

    const logPath = path.join(session.workspacePath, '.lumiq', 'agent_logs.jsonl');
    const logEntry = {
      jsonrpc: '2.0',
      method: 'checkpoint',
      params: { checkpointId },
      timestamp: new Date().toISOString()
    };
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n', 'utf8');

    session.logs.push(`Checkpoint ${checkpointId} created`);
    session.status = 'checkpointed';
    return checkpointId;
  }

  async restoreHost(sessionId: string, checkpointId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) throw new Error(`Agent session ${sessionId} not found`);

    const cp = this.checkpoints.get(checkpointId);
    if (!cp || cp.sessionId !== sessionId) {
      throw new Error(`Checkpoint ${checkpointId} not found or mismatch`);
    }

    session.status = 'running';
    const logPath = path.join(session.workspacePath, '.lumiq', 'agent_logs.jsonl');
    const logEntry = {
      jsonrpc: '2.0',
      method: 'restore',
      params: { checkpointId },
      timestamp: new Date().toISOString()
    };
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n', 'utf8');
    session.logs.push(`Restored to checkpoint ${checkpointId}`);
  }

  async terminateHost(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    session.status = 'terminated';
    const logPath = path.join(session.workspacePath, '.lumiq', 'agent_logs.jsonl');
    const logEntry = {
      jsonrpc: '2.0',
      method: 'terminate',
      params: {},
      timestamp: new Date().toISOString()
    };
    fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n', 'utf8');
    session.logs.push('Agent host terminated');
  }

  getSession(sessionId: string): AgentHostSession | undefined {
    return this.sessions.get(sessionId);
  }

  private getCommandName(command: string): string {
    const first = command.trim().split(/\s+/)[0] || '';
    return path.basename(first).toLowerCase();
  }

  private assertCommandPathsInsideSandbox(session: StoredAgentHostSession, command: string): void {
    const allowedRoots = (session.sandboxConfig.allowedPaths?.length ? session.sandboxConfig.allowedPaths : [session.workspacePath])
      .map(root => path.resolve(root));
    const pathLikeArgs = command.match(/(?:^|\s)(?:"([^"]+)"|'([^']+)'|([A-Za-z]:[^\s]+|\.{1,2}[\\/][^\s]+|[\\/][^\s]+))/g) || [];

    for (const rawArg of pathLikeArgs) {
      const arg = rawArg.trim().replace(/^['"]|['"]$/g, '');
      const resolved = path.resolve(session.workspacePath, arg);
      const insideAllowedRoot = allowedRoots.some(root => {
        const relativePath = path.relative(root, resolved);
        return relativePath === '' || (!relativePath.startsWith('..') && !path.isAbsolute(relativePath));
      });
      if (!insideAllowedRoot) {
        throw new Error(`Sandbox violation: path '${arg}' is outside allowed workspace paths.`);
      }
    }
  }
}

registerSingleton(IAgentHostService, AgentHostService, InstantiationType.Delayed);
