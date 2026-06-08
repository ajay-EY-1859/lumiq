import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync, readFileSync } from 'fs';

const tempUserDataPath = join(__dirname, 'temp_config_service_test');
const workspacePath = join(__dirname, 'temp_config_workspace').replace(/\\/g, '/');

vi.mock('electron', () => {
  return {
    app: {
      getPath: (name: string) => {
        if (name === 'userData') return tempUserDataPath;
        return '/tmp';
      }
    }
  };
});

import { initDatabase, closeDatabase, getDatabase } from '../../db/database';
import { FileService } from '../FileService';
import { DiskFileSystemProvider } from '../DiskFileSystemProvider';
import { ConfigurationService } from '../ConfigurationService';
import { ConfigurationTarget } from '@shared/configuration/configuration';
import { IFileService } from '@shared/files/files';
import { InstantiationService, setActiveContainer } from '@shared/instantiation/instantiationService';

describe('ConfigurationService', () => {
  let container: InstantiationService;
  let fileService: FileService;
  let configService: ConfigurationService;

  beforeAll(() => {
    if (!existsSync(tempUserDataPath)) {
      mkdirSync(tempUserDataPath, { recursive: true });
    }
    if (!existsSync(workspacePath)) {
      mkdirSync(workspacePath, { recursive: true });
    }

    initDatabase();

    fileService = new FileService();
    const diskProvider = new DiskFileSystemProvider();
    fileService.registerProvider('file', diskProvider);

    const services = new Map<any, any>();
    services.set(IFileService, fileService);
    container = new InstantiationService(services);
    setActiveContainer(container);

    configService = new ConfigurationService(fileService);
  });

  afterAll(() => {
    configService.dispose();
    try {
      closeDatabase();
    } catch {
      // ignore
    }
    try {
      rmSync(tempUserDataPath, { recursive: true, force: true });
      rmSync(workspacePath, { recursive: true, force: true });
    } catch {
      // ignore
    }
  });

  it('should return default values from registry', () => {
    const theme = configService.getValue<string>('theme');
    expect(theme).toBe('system');
    
    const contextLimit = configService.getValue<number>('contextLimit');
    expect(contextLimit).toBe(150);
  });

  it('should support updating User target in SQLite', async () => {
    let fired = false;
    const disposable = configService.onDidChangeConfiguration(e => {
      if (e.affectsConfiguration('theme')) {
        fired = true;
      }
    });

    await configService.updateValue('theme', 'dark', ConfigurationTarget.User);
    
    expect(fired).toBe(true);
    expect(configService.getValue<string>('theme')).toBe('dark');

    // Verify written to database
    const db = getDatabase();
    const row = db.prepare("SELECT value FROM settings WHERE key = 'theme'").get() as { value: string };
    expect(row.value).toBe('dark');

    disposable.dispose();
  });

  it('should support cascading Workspace configuration overrides', async () => {
    // 1. Set workspace path
    await configService.setWorkspacePath(workspacePath);

    // 2. Write workspace configuration file directly
    const lumiqDir = join(workspacePath, '.lumiq');
    if (!existsSync(lumiqDir)) {
      mkdirSync(lumiqDir, { recursive: true });
    }
    const settingsPath = join(lumiqDir, 'settings.json');
    writeFileSync(settingsPath, JSON.stringify({ theme: 'light' }), 'utf8');

    // 3. Load workspace config changes
    await configService.setWorkspacePath(workspacePath);

    // Workspace setting 'light' should override user setting 'dark'
    expect(configService.getValue<string>('theme')).toBe('light');

    // Other settings should fallback to user/default
    expect(configService.getValue<number>('contextLimit')).toBe(150);

    // 4. Update workspace setting via service
    await configService.updateValue('contextLimit', 200, ConfigurationTarget.Workspace);
    expect(configService.getValue<number>('contextLimit')).toBe(200);

    // Check file content
    const updatedContent = JSON.parse(readFileSync(settingsPath, 'utf8'));
    expect(updatedContent.contextLimit).toBe(200);
    expect(updatedContent.theme).toBe('light');
  });

  it('should support in-memory overrides', async () => {
    await configService.updateValue('theme', 'custom-theme', ConfigurationTarget.Memory);
    expect(configService.getValue<string>('theme')).toBe('custom-theme');

    // Clearing/overwriting memory override should revert to workspace override
    await configService.updateValue('theme', undefined, ConfigurationTarget.Memory);
    expect(configService.getValue<string>('theme')).toBe('light');
  });
});
