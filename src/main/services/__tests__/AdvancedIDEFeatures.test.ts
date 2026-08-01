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

vi.mock('@electron-toolkit/utils', () => {
  return {
    is: {
      dev: true
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
import { IpcFrameworkService } from '../IpcFrameworkService';
import { TestOrchestratorService } from '../TestOrchestratorService';
import { DatabaseExplorerService } from '../DatabaseExplorerService';
import { DeploymentService } from '../DeploymentService';
import { ArchitectWikiService } from '../ArchitectWikiService';
// import { ConfigurationService } from '../ConfigurationService';

describe('Advanced IDE Features & Advancements (Milestones 19 - 30)', () => {
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

    it('should allow AI to manage settings and database entities via Environment Tools', async () => {
      // Import the classes dynamically to avoid static module loading order issues with mocked electron
      const { ToolExecutor } = await import('../../agent/ToolExecutor');
      await import('../ConfigurationService');

      const executor = new ToolExecutor();
      executor.setPermissionMode('AUTO'); // bypass approval dialogs

      // 1. Test GetEnvironmentTool (settings)
      const settingsRes = await executor.executeTool('GetEnvironmentTool', { resource: 'settings' });
      expect(settingsRes.isError).toBe(false);
      expect(settingsRes.output).toContain('appSettings');
      expect(settingsRes.output).toContain('permissionMode');

      // 2. Test GetEnvironmentTool (all)
      const allRes = await executor.executeTool('GetEnvironmentTool', { resource: 'all' });
      expect(allRes.isError).toBe(false);
      expect(allRes.output).toContain('skills');
      expect(allRes.output).toContain('commands');

      // 3. Test UpdateEnvironmentTool (settings)
      const updateSettingsRes = await executor.executeTool('UpdateEnvironmentTool', {
        resource: 'settings',
        action: 'save',
        data: JSON.stringify({ key: 'theme', value: 'dark' })
      });
      expect(updateSettingsRes.isError).toBe(false);
      expect(updateSettingsRes.output).toContain('Updated setting "theme"');

      // 4. Test UpdateEnvironmentTool (skill - save)
      const saveSkillRes = await executor.executeTool('UpdateEnvironmentTool', {
        resource: 'skill',
        action: 'save',
        data: JSON.stringify({
          name: 'test-env-skill',
          description: 'A test skill created via UpdateEnvironmentTool',
          promptTemplate: 'Inject this prompt instruction.'
        })
      });
      expect(saveSkillRes.isError).toBe(false);
      expect(saveSkillRes.output).toContain('Custom skill saved successfully');

      // 5. Test GetEnvironmentTool (skills - verify saved)
      const listSkillsRes = await executor.executeTool('GetEnvironmentTool', { resource: 'skills' });
      expect(listSkillsRes.isError).toBe(false);
      expect(listSkillsRes.output).toContain('test-env-skill');

      const skillsArray = JSON.parse(listSkillsRes.output);
      const testSkill = skillsArray.find((s: any) => s.name === 'test-env-skill');
      expect(testSkill).toBeDefined();

      // 6. Test UpdateEnvironmentTool (skill - delete)
      const deleteSkillRes = await executor.executeTool('UpdateEnvironmentTool', {
        resource: 'skill',
        action: 'delete',
        data: JSON.stringify(testSkill.id)
      });
      expect(deleteSkillRes.isError).toBe(false);
      expect(deleteSkillRes.output).toContain('deleted successfully');

      // 7. Test UpdateEnvironmentTool (agent - save)
      const saveAgentRes = await executor.executeTool('UpdateEnvironmentTool', {
        resource: 'agent',
        action: 'save',
        data: JSON.stringify({
          name: 'test-env-agent',
          description: 'A test agent created via UpdateEnvironmentTool',
          systemPrompt: 'You are a specialized helper agent.'
        })
      });
      expect(saveAgentRes.isError).toBe(false);
      expect(saveAgentRes.output).toContain('Custom agent saved successfully');

      // 8. Test GetEnvironmentTool (agents - verify saved)
      const listAgentsRes = await executor.executeTool('GetEnvironmentTool', { resource: 'agents' });
      expect(listAgentsRes.isError).toBe(false);
      expect(listAgentsRes.output).toContain('test-env-agent');

      const agentsArray = JSON.parse(listAgentsRes.output);
      const testAgent = agentsArray.find((a: any) => a.name === 'test-env-agent');
      expect(testAgent).toBeDefined();

      // 9. Test UpdateEnvironmentTool (agent - delete)
      const deleteAgentRes = await executor.executeTool('UpdateEnvironmentTool', {
        resource: 'agent',
        action: 'delete',
        data: JSON.stringify(testAgent.id)
      });
      expect(deleteAgentRes.isError).toBe(false);
      expect(deleteAgentRes.output).toContain('deleted successfully');
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

  describe('Milestone 26: IPC Framework & Multi-Process Architecture', () => {
    const ipcService = new IpcFrameworkService();

    it('should register and retrieve named channels correctly', async () => {
      ipcService.registerChannel('mock-service', {
        call: async (command, arg) => `Echo: ${command} with ${arg}`
      });
      const channel = ipcService.getChannel('mock-service');
      const res = await channel.call('greet', 'World');
      expect(res).toBe('Echo: greet with World');
    });
  });

  describe('Milestone 27: Autonomous Test Case Generation & TDD Orchestrator', () => {
    const orchestrator = new TestOrchestratorService();

    it('should run a test suite and execute an autonomous self-healing loop', async () => {
      const srcFile = join(testWorkspacePath, 'math_utils.ts');
      const testFile = join(testWorkspacePath, 'math_utils.test.ts');

      writeFileSync(srcFile, `export const VALUE = 'buggy_value';`, 'utf8');

      writeFileSync(testFile, `
import { describe, it, expect } from 'vitest';
import { VALUE } from './math_utils';

describe('Math Utils', () => {
  it('should equal healed_value', () => {
    expect(VALUE).toBe('healed_value');
  });
});
      `, 'utf8');

      const healed = await orchestrator.autonomousRepairLoop(testFile, srcFile, 2);
      expect(healed).toBe(true);

      const healedContent = readFileSync(srcFile, 'utf8');
      expect(healedContent).toContain('healed_value');
    }, 20000);
  });

  describe('Milestone 28: Universal Database Schema Explorer & SQL Agent', () => {
    const dbExplorer = new DatabaseExplorerService();

    it('should inspect database tables and run raw queries', async () => {
      const tables = await dbExplorer.getTables();
      expect(tables.length).toBeGreaterThan(0);
      expect(tables.some(t => t.name === 'sessions')).toBe(true);

      const columns = await dbExplorer.getTableSchema('sessions');
      expect(columns.some(c => c.name === 'id')).toBe(true);
      expect(columns.some(c => c.name === 'title')).toBe(true);

      const rows = await dbExplorer.executeQuery('SELECT COUNT(*) as count FROM sessions');
      expect(rows[0].count).toBeDefined();
    });

    it('should generate schemas and insert mock data', async () => {
      const prismaSchema = await dbExplorer.generateSchemaDeclaration('prisma');
      expect(prismaSchema).toContain('model Sessions');

      const drizzleSchema = await dbExplorer.generateSchemaDeclaration('drizzle');
      expect(drizzleSchema).toContain('export const sessions');

      const mockRows = await dbExplorer.generateMockData('sessions', 1);
      expect(mockRows.length).toBe(1);
      expect(mockRows[0].title).toBeDefined();

      const verifyQuery = await dbExplorer.executeQuery(`SELECT * FROM sessions WHERE title = '${mockRows[0].title}'`);
      expect(verifyQuery.length).toBeGreaterThan(0);
    });
  });

  describe('Milestone 29: Zero-Config Cloud Deployment & Infrastructure-as-Code (IaC)', () => {
    const deploymentService = new DeploymentService();

    it('should generate a valid Dockerfile and yml configuration', async () => {
      const dockerRes = await deploymentService.generateIaC(testWorkspacePath, 'docker');
      expect(existsSync(dockerRes.filePath)).toBe(true);
      expect(dockerRes.content).toContain('FROM node');

      const slsRes = await deploymentService.generateIaC(testWorkspacePath, 'serverless');
      expect(existsSync(slsRes.filePath)).toBe(true);
      expect(slsRes.content).toContain('provider:');
    });

    it('should verify workspace compile build and return logs', async () => {
      writeFileSync(join(testWorkspacePath, 'package.json'), JSON.stringify({
        name: 'test-app',
        scripts: {
          build: "echo 'build success'"
        }
      }), 'utf8');

      const check = await deploymentService.verifyPreDeployBuild(testWorkspacePath);
      expect(check.success).toBe(true);
      expect(check.log).toContain('build success');
    });
  });

  describe('Milestone 30: Codebase Architect Wiki & Mermaid Diagrammer', () => {
    const wikiService = new ArchitectWikiService();

    it('should analyze workspace imports, generate diagrams and write wikis', async () => {
      const fileA = join(testWorkspacePath, 'componentA.ts');
      const fileB = join(testWorkspacePath, 'componentB.ts');

      writeFileSync(fileA, `import { funcB } from './componentB';\nexport const funcA = () => {};`, 'utf8');
      writeFileSync(fileB, `export const funcB = () => {};`, 'utf8');

      const { importsMap } = await wikiService.analyzeCodebase(testWorkspacePath);
      expect(importsMap['componentA.ts']).toContain('./componentB');

      const diagram = await wikiService.generateMermaidDiagram(testWorkspacePath);
      expect(diagram).toContain('componentA_ts');
      expect(diagram).toContain('componentB_ts');

      const wikiFile = await wikiService.writeWikiFile(testWorkspacePath);
      expect(existsSync(wikiFile)).toBe(true);
      expect(readFileSync(wikiFile, 'utf8')).toContain('Codebase Architecture Wiki');
    });
  });
});
