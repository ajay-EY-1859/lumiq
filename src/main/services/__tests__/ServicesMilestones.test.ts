import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { DatabaseExplorerService } from '../DatabaseExplorerService';
import { TestOrchestratorService } from '../TestOrchestratorService';
import { DeploymentService } from '../DeploymentService';
import { ArchitectWikiService } from '../ArchitectWikiService';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync } from 'fs';
import * as fs from 'fs';
import * as path from 'path';

const tempUserDataPath = join(__dirname, 'temp_milestone_user_data');

vi.mock('electron', () => {
  const app = {
    isPackaged: false,
    getPath: (name: string) => {
      if (name === 'userData') return tempUserDataPath;
      return '/tmp';
    }
  };
  return {
    app,
    default: {
      app
    }
  };
});

import { initDatabase, closeDatabase } from '../../db/database';

describe('Services Milestones (Milestones 27-30)', () => {
  beforeAll(() => {
    if (existsSync(tempUserDataPath)) {
      rmSync(tempUserDataPath, { recursive: true, force: true });
    }
    mkdirSync(tempUserDataPath, { recursive: true });
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
    } catch {
      // ignore
    }
  });

  describe('DatabaseExplorerService (Milestone 28)', () => {
    it('should query master tables list', async () => {
      const dbExplorer = new DatabaseExplorerService();
      const tables = await dbExplorer.getTables();
      expect(Array.isArray(tables)).toBe(true);
      // SQLite database should contain a settings or sessions table by default
      const tableNames = tables.map(t => t.name);
      expect(tableNames.includes('sessions') || tableNames.includes('settings')).toBe(true);
    });

    it('should query table schema', async () => {
      const dbExplorer = new DatabaseExplorerService();
      const cols = await dbExplorer.getTableSchema('settings');
      expect(Array.isArray(cols)).toBe(true);
      expect(cols.length).toBeGreaterThan(0);
      expect(cols.some(c => c.name === 'key')).toBe(true);
    });

    it('should compile Prisma and Drizzle schemas', async () => {
      const dbExplorer = new DatabaseExplorerService();
      const prismaCode = await dbExplorer.generateSchemaDeclaration('prisma');
      expect(prismaCode).toContain('model');
      expect(prismaCode).toContain('key');

      const drizzleCode = await dbExplorer.generateSchemaDeclaration('drizzle');
      expect(drizzleCode).toContain('sqliteTable');
      expect(drizzleCode).toContain('settings');
    });

    it('should insert mock data and execute SQL query', async () => {
      const dbExplorer = new DatabaseExplorerService();
      const mockResult = await dbExplorer.generateMockData('settings', 1);
      expect(mockResult.length).toBe(1);
      expect(mockResult[0].key).toBeDefined();

      const queryRes = await dbExplorer.executeQuery("SELECT * FROM settings WHERE key LIKE 'key_mock_%' LIMIT 1;");
      expect(queryRes.length).toBe(1);
      expect(queryRes[0].key).toContain('key_mock_');
    });
  });

  describe('TestOrchestratorService (Milestone 27)', () => {
    it('should write a test suite to disk', async () => {
      const testOrch = new TestOrchestratorService();
      const tempPath = path.resolve(__dirname, 'temp_milestone_spec.test.ts');
      const specContent = `
        import { describe, it, expect } from 'vitest';
        describe('temp spec', () => {
          it('passes', () => { expect(1 + 1).toBe(2); });
        });
      `;
      const createdPath = await testOrch.generateTestSuite(tempPath, specContent);
      expect(createdPath).toBe(tempPath);
      expect(fs.existsSync(tempPath)).toBe(true);
      fs.unlinkSync(tempPath);
    });
  });

  describe('DeploymentService (Milestone 29)', () => {
    it('should write container and serverless IaC configurations', async () => {
      const deploy = new DeploymentService();
      const tempWorkspace = path.resolve(__dirname);
      
      const dockerResult = await deploy.generateIaC(tempWorkspace, 'docker');
      expect(dockerResult.filePath).toContain('Dockerfile');
      expect(fs.existsSync(dockerResult.filePath)).toBe(true);
      expect(dockerResult.content).toContain('FROM node');
      fs.unlinkSync(dockerResult.filePath);

      const slsResult = await deploy.generateIaC(tempWorkspace, 'serverless');
      expect(slsResult.filePath).toContain('serverless.yml');
      expect(fs.existsSync(slsResult.filePath)).toBe(true);
      expect(slsResult.content).toContain('service:');
      fs.unlinkSync(slsResult.filePath);
    });
  });

  describe('ArchitectWikiService (Milestone 30)', () => {
    it('should scan workspace imports and generate Mermaid graph', async () => {
      const wiki = new ArchitectWikiService();
      const tempWorkspace = path.resolve(__dirname, '../'); // scan main/services
      const stats = await wiki.analyzeCodebase(tempWorkspace);
      expect(stats.filesParsed).toBeGreaterThan(0);
      
      const mermaid = await wiki.generateMermaidDiagram(tempWorkspace);
      expect(mermaid).toContain('graph TD');
      
      // Should write ARCHITECTURE.md
      const wikiFile = await wiki.writeWikiFile(tempWorkspace);
      expect(fs.existsSync(wikiFile)).toBe(true);
      expect(fs.readFileSync(wikiFile, 'utf8')).toContain('Codebase Architecture Wiki');
      fs.unlinkSync(wikiFile);
    });
  });
});
