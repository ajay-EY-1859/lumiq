import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';

const tempUserDataPath = join(__dirname, 'temp_advanced_user_data');
const testWorkspacePath = join(__dirname, 'temp_advanced_workspace').replace(/\\/g, '/');

vi.mock('electron', () => {
  const app = {
    isPackaged: false,
    getPath: (name: string) => {
      if (name === 'userData') return tempUserDataPath;
      return '/tmp';
    }
  };
  const BrowserWindow = {
    getFocusedWindow: () => null,
    getAllWindows: () => []
  };
  const dialog = {
    showMessageBox: () => Promise.resolve({ response: 0 })
  };
  return {
    app,
    BrowserWindow,
    dialog,
    default: {
      app,
      BrowserWindow,
      dialog
    }
  };
});

import { initDatabase, closeDatabase, getDatabase } from '../../db/database';
import { McpGalleryService } from '../mcp/McpGalleryService';
import { McpManagementService } from '../mcp/McpManagementService';
import { McpResourceScannerService } from '../mcp/McpResourceScannerService';
import { McpAuthenticationBridge } from '../mcp/McpAuthenticationBridge';
import { AgentHostService } from '../AgentHostService';
import { SessionsProvidersService } from '../SessionsProvidersService';
import { ChangesetManager } from '../ChangesetManager';
import { CustomizationHarnessService } from '../CustomizationHarnessService';
import { SkillsService } from '../SkillsService';
import { CodeSmellSweeperService } from '../CodeSmellSweeperService';
import { VisualCanvasService } from '../VisualCanvasService';
import { PerformanceProfilerService } from '../PerformanceProfilerService';
import { WebSandboxService } from '../WebSandboxService';

describe('Advanced IDE Features & Advancements (Milestones 19 - 25)', () => {
  beforeAll(() => {
    if (existsSync(tempUserDataPath)) {
      rmSync(tempUserDataPath, { recursive: true, force: true });
    }
    mkdirSync(tempUserDataPath, { recursive: true });

    if (existsSync(testWorkspacePath)) {
      rmSync(testWorkspacePath, { recursive: true, force: true });
    }
    mkdirSync(testWorkspacePath, { recursive: true });
    initDatabase();
  });

  afterAll(() => {
    try {
      closeDatabase();
    } catch {
      // ignore
    }
    try {
      if (existsSync(tempUserDataPath)) {
        rmSync(tempUserDataPath, { recursive: true, force: true });
      }
      if (existsSync(testWorkspacePath)) {
        rmSync(testWorkspacePath, { recursive: true, force: true });
      }
    } catch {
      // ignore
    }
  });

  describe('Milestone 19: MCP Gallery & Lifecycle Advancements', () => {
    const galleryService = new McpGalleryService();
    const managementService = new McpManagementService();
    const scannerService = new McpResourceScannerService();

    it('should browse and search MCP gallery items', async () => {
      const items = await galleryService.browse();
      expect(items.length).toBeGreaterThan(0);
      expect(items.find(i => i.id === 'brave-search')).toBeDefined();
    });

    it('should block installation of MCP servers outside the trusted catalog', async () => {
      const server = {
        id: 'unauthorized-mcp',
        name: 'Malicious Server',
        version: '1.0.0',
        description: 'Bypasses security signature',
        author: 'Attacker',
        tools: ['attack_host']
      };
      await expect(galleryService.install(server)).rejects.toThrow('not available in the trusted gallery catalog');
    });

    it('should install and uninstall approved MCP servers to/from database', async () => {
      const server = {
        id: 'brave-search',
        name: 'Caller Supplied Name Must Be Ignored',
        version: '1.0.0',
        description: 'Web search capability',
        author: 'Lumiq Platform',
        tools: ['brave_web_search', 'brave_local_search']
      };
      await galleryService.install(server);

      const db = getDatabase();
      const row = db.prepare('SELECT name, command, tools_count FROM mcp_servers WHERE id = ?').get(server.id) as any;
      expect(row).toBeDefined();
      expect(row.name).toBe('Brave Search');

      const installed = await galleryService.getInstalled();
      expect(installed.some(i => i.id === server.id)).toBe(true);

      // Verify tool gating checks
      expect(managementService.isToolApproved(server.id, 'brave_web_search')).toBe(true);
      expect(managementService.isToolApproved(server.id, 'unapproved_tool')).toBe(false);

      await galleryService.uninstall(server.id);
    });

    it('should reject package ids that are not in the trusted gallery catalog', async () => {
      await expect(galleryService.install({
        id: 'unknown-but-signed-looking',
        name: 'Unknown',
        version: '1.0.0',
        description: 'Not catalogued',
        author: 'Unknown'
      })).rejects.toThrow('not available in the trusted gallery catalog');
    });

    it('should track server crash recovery limits', async () => {
      // Re-install server to pass security allowance check
      await galleryService.install({
        id: 'brave-search',
        name: 'Brave Search',
        version: '1.0.0',
        description: 'Web search capability',
        author: 'Lumiq Platform',
        tools: ['brave_web_search']
      });

      // Trigger multiple simulated server crashes
      managementService.handleServerCrash('brave-search');
      managementService.handleServerCrash('brave-search');
      managementService.handleServerCrash('brave-search');

      // 4th boot should be blocked
      await expect(managementService.startServer('brave-search')).rejects.toThrow('crashed too many times and has been blocked');

      // Cleanup
      await galleryService.uninstall('brave-search');
    });

    it('should support dynamic mcp resource providers registration', async () => {
      scannerService.registerResourceProvider('brave-search', {
        scan: async () => [{ uri: 'brave://history', name: 'search history', mimeType: 'application/json' }],
        read: async () => JSON.stringify({ count: 12, latest: 'lumiq ide' })
      });

      const resources = await scannerService.scanResources('brave-search');
      expect(resources.length).toBe(1);
      expect(resources[0].name).toBe('search history');

      const content = await scannerService.getResourceContent('brave-search', 'brave://history');
      expect(content).toContain('lumiq ide');
    });

    it('should automatically refresh expired OAuth2 tokens via bridge', () => {
      // Save an expired token
      const pastExpires = Math.floor(Date.now() / 1000) - 10;
      McpAuthenticationBridge.saveAuthToken('github-mcp', 'expired_token', pastExpires, 'refresh_token_123');

      const token = McpAuthenticationBridge.getAuthToken('github-mcp');
      expect(token).toBeDefined();
      expect(token).not.toBe('expired_token');
      expect(token?.startsWith('refreshed_token_')).toBe(true);

      const stored = getDatabase().prepare('SELECT access_token_encrypted, refresh_token_encrypted FROM oauth_tokens WHERE provider = ?').get('github-mcp') as any;
      expect(stored.access_token_encrypted).not.toBe(token);
      expect(stored.refresh_token_encrypted).not.toBe('refresh_token_123');
    });
  });

  describe('Milestone 20: Agent Host Protocol & Session Advancements', () => {
    const hostService = new AgentHostService();
    const providersService = new SessionsProvidersService();
    const changesetManager = new ChangesetManager();

    it('should spawn sandboxed agent host and enforce CPU/Memory cap checks', async () => {
      const session = await hostService.spawnHost(testWorkspacePath, { cpuLimit: 2, memoryLimit: 128 });
      expect(session.id).toBeDefined();

      // Ensure JSON-RPC logging format in JSONL log file
      const logFile = join(testWorkspacePath, '.lumiq/agent_logs.jsonl');
      const firstLine = JSON.parse(readFileSync(logFile, 'utf8').split('\n')[0]);
      expect(firstLine.jsonrpc).toBe('2.0');
      expect(firstLine.method).toBe('spawn');

      // Command execution in sandbox
      const out = await hostService.runCommandInSandbox(session.id, 'node -e "console.log(\'ls -la\')"');
      expect(out).toContain('ls -la');

      // Blocked commands checking
      await expect(hostService.runCommandInSandbox(session.id, 'rm -rf /usr/bin')).rejects.toThrow('Sandbox violation');
      await expect(hostService.runCommandInSandbox(session.id, 'cat ../../outside.txt')).rejects.toThrow('outside allowed workspace paths');

      // Memory cap violation check
      hostService.setMockMemoryUsage(session.id, 256); // exceeds 128 limit
      await expect(hostService.runCommandInSandbox(session.id, 'ls')).rejects.toThrow('Resource limit exceeded');

      await hostService.terminateHost(session.id);
    });

    it('should broadcast session creation events via Emitter', async () => {
      let fired = false;
      providersService.onDidSessionCreate((session) => {
        expect(session.provider).toBe('local-chat');
        fired = true;
      });

      await providersService.createSession('local-chat', testWorkspacePath);
      expect(fired).toBe(true);
    });

    it('should generate unified diff style changeset merge previews', () => {
      changesetManager.createChangeset('session-2', 'Feature Edit');
      changesetManager.addFileChange('session-2', 'src/main.ts', 'console.log("main content");');

      const preview = changesetManager.generateMergePreview('session-2');
      expect(preview).toContain('diff --git a/src/main.ts b/src/main.ts');
      expect(preview).toContain('--- a/src/main.ts');
      expect(preview).toContain('+++ b/src/main.ts');
      expect(preview).toContain('+console.log("main content");');
      expect(preview).not.toContain('-// Old file code');
    });
  });

  describe('Milestone 21: AI Customizations & Skills Advancements', () => {
    const harnessService = new CustomizationHarnessService();
    const skillsService = new SkillsService();

    it('should validate customization prompt templates length and safety rules', () => {
      // Destructive statement validation
      expect(() => harnessService.setCustomization('local-lumiq', {
        id: 'bad-instr',
        type: 'instruction',
        content: 'DROP TABLE settings;'
      })).toThrow('destructive database statements');

      // Length validation
      expect(() => harnessService.setCustomization('local-lumiq', {
        id: 'short-prompt',
        type: 'prompt',
        content: 'hey'
      })).toThrow('too short');
    });

    it('should parse complex YAML tags array list formats', async () => {
      const skillContent = `---
name: multi-tag-skill
description: Parses multi-line tags list format
tags:
  - git
  - sync
  - deploy
---
# Prompt content
Execute commands.
`;
      writeFileSync(join(testWorkspacePath, 'multi-tag.agent.md'), skillContent, 'utf8');

      const skills = await skillsService.discoverSkills(testWorkspacePath);
      const match = skills.find(s => s.name === 'multi-tag-skill');
      expect(match).toBeDefined();
      expect(match?.tags).toContain('git');
      expect(match?.tags).toContain('sync');
      expect(match?.tags).toContain('deploy');

      writeFileSync(join(testWorkspacePath, 'team.instructions.md'), `---
name: team instructions
description: Workspace instructions
---
Prefer small focused changes.
`, 'utf8');
      const skillsWithInstructions = await skillsService.discoverSkills(testWorkspacePath);
      expect(skillsWithInstructions.find(s => s.name === 'team instructions')).toBeDefined();
    });
  });

  describe('Milestone 22: Advanced Semantic Sweeper & AST Scanner', () => {
    const sweeperService = new CodeSmellSweeperService();

    it('should scan for circular imports, high cognitive complexity, and listener leaks', async () => {
      // 1. Setup Circular Imports: File A imports File B, File B imports File A
      const fileAContent = `
import { classB } from './classB';
export class classA {}
      `.trim();
      const fileBContent = `
import { classA } from './classA';
export class classB {}
      `.trim();
      writeFileSync(join(testWorkspacePath, 'classA.ts'), fileAContent, 'utf8');
      writeFileSync(join(testWorkspacePath, 'classB.ts'), fileBContent, 'utf8');

      // 2. Setup cognitive complexity file (> 10 control flow keywords)
      const complexFileContent = `
export class Complex {
  evaluate(x: number, y: number, z: number) {
    if (x > 1) {
      if (y > 2 && z < 3) {
        for (let i = 0; i < 10; i++) {
          while (z > 0) {
            if (x === i || y === z) {
              return x ? y : z;
            }
          }
        }
      }
    }
    return 0;
  }
}
      `.trim();
      writeFileSync(join(testWorkspacePath, 'complex.ts'), complexFileContent, 'utf8');

      // 3. Setup event listener leak: .on() called twice, but no .off()
      const leakContent = `
import { EventEmitter } from 'events';
export class EventLeak {
  private emitter = new EventEmitter();
  setup() {
    this.emitter.on('data', () => {});
    this.emitter.on('error', () => {});
    // No off() or dispose() calls

    // Unassigned timer leak
    setTimeout(() => {}, 1000);
  }
}
      `.trim();
      writeFileSync(join(testWorkspacePath, 'leak.ts'), leakContent, 'utf8');

      const findings = await sweeperService.sweep(testWorkspacePath);
      
      const circular = findings.find(f => f.ruleId === 'CIRCULAR_IMPORT');
      const complexity = findings.find(f => f.ruleId === 'HIGH_COMPLEXITY');
      const listener = findings.find(f => f.ruleId === 'LISTENER_LEAK');
      const timerLeak = findings.find(f => f.ruleId === 'TIMER_LEAK');

      expect(circular).toBeDefined();
      expect(circular?.message).toContain('classA.ts -> classB.ts -> classA.ts');

      expect(complexity).toBeDefined();
      expect(complexity?.message).toContain('Cognitive/Cyclomatic complexity score is too high');

      expect(listener).toBeDefined();
      expect(listener?.message).toContain('event subscription imbalance');

      expect(timerLeak).toBeDefined();
      expect(timerLeak?.message).toContain('Unassigned timer (setTimeout/setInterval)');
    });
  });

  describe('Milestone 23: Advanced Visual Canvas Mode', () => {
    const canvasService = new VisualCanvasService();

    it('should map click coordinates to Monaco Range objects', async () => {
      const coordInfo = canvasService.mapClickToCode('canvas-1', 120, 80);
      expect(coordInfo.range).toBeDefined();
      expect(coordInfo.range?.startLineNumber).toBe(5);
      expect(coordInfo.range?.endLineNumber).toBe(7);
      expect(coordInfo.range?.endColumn).toBe(80);
    });
  });

  describe('Milestone 24: Advanced Live Telemetry & CPU Profiling', () => {
    const profilerService = new PerformanceProfilerService();

    it('should take CDP mock heap memory snapshots and serialize to performance.jsonl', () => {
      const db = getDatabase();
      db.prepare(`
        INSERT OR REPLACE INTO sessions (id, title, provider, model, workspace_path)
        VALUES ('test-cdp-session', 'CdpSession', 'openai', 'gpt-4o', ?)
      `).run(testWorkspacePath);

      const snapshot = profilerService.takeHeapSnapshot();
      expect(snapshot.nodesCount).toBe(15430);
      expect(snapshot.totalJsHeapSize).toBe(84000000);

      const perfLogFile = join(testWorkspacePath, '.lumiq/performance.jsonl');
      expect(existsSync(perfLogFile)).toBe(true);

      const logs = readFileSync(perfLogFile, 'utf8').trim().split('\n');
      const snapshotLog = JSON.parse(logs[logs.length - 1]);
      expect(snapshotLog.type).toBe('heap_snapshot');
      expect(snapshotLog.snapshot.nodesCount).toBe(15430);

      const stats = profilerService.getMemoryUsageSnapshot();
      expect(stats.jsHeapLimit).toBe(2147483648);
    });
  });

  describe('Milestone 25: Advanced Isolated Web Sandbox', () => {
    const sandboxService = new WebSandboxService();

    it('should broadcast HMR style sheet changes events', async () => {
      const server = await sandboxService.startServer(testWorkspacePath);
      expect(server.status).toBe('running');
      const secondServer = await sandboxService.startServer(testWorkspacePath);
      expect(secondServer.port).not.toBe(server.port);

      let hmrFired = false;
      sandboxService.onDidHmrTrigger((event) => {
        expect(event.serverId).toBe(server.id);
        expect(event.fileType).toBe('style');
        hmrFired = true;
      });

      sandboxService.triggerHmr(server.id, 'style');
      expect(hmrFired).toBe(true);

      await sandboxService.stopServer(server.id);
      await sandboxService.stopServer(secondServer.id);
    });
  });
});
