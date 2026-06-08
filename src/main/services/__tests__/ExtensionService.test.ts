import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import { join } from 'path';
import { existsSync, mkdirSync, rmSync, writeFileSync, unlinkSync, readFileSync } from 'fs';
import { execSync } from 'child_process';

const tempUserDataPath = join(__dirname, 'temp_ext_user_data');
const workspacePath = join(__dirname, 'temp_ext_workspace').replace(/\\/g, '/');

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

vi.mock('../../auth/devMode', () => {
  return {
    isDeveloperMode: () => false
  };
});

import { initDatabase, closeDatabase, getDatabase } from '../../db/database';
import { FileService } from '../FileService';
import { DiskFileSystemProvider } from '../DiskFileSystemProvider';
import { ExtensionManagementService } from '../ExtensionManagementService';
import { ExtensionService } from '../ExtensionService';
import { IFileService } from '@shared/files/files';
import { InstantiationService, setActiveContainer } from '@shared/instantiation/instantiationService';
import { ConfigurationService } from '../ConfigurationService';
import { IConfigurationService } from '@shared/configuration/configuration';
import { URI } from '@shared/uri';

describe('ExtensionHost & Plugin Architecture', () => {
  let fileService: FileService;
  let extManagementService: ExtensionManagementService;
  let extService: ExtensionService;
  let configService: ConfigurationService;

  beforeAll(() => {
    // 1. Create clean temp directories
    if (existsSync(tempUserDataPath)) rmSync(tempUserDataPath, { recursive: true, force: true });
    if (existsSync(workspacePath)) rmSync(workspacePath, { recursive: true, force: true });

    mkdirSync(tempUserDataPath, { recursive: true });
    mkdirSync(workspacePath, { recursive: true });

    // 2. Initialize database
    initDatabase();

    // 3. Compile extensionHostMain.ts to extensionHostMain.js for testing
    const hostSrc = join(__dirname, '../extensionHostMain.ts');
    const hostDest = join(__dirname, '../extensionHostMain.js');
    execSync(`npx esbuild "${hostSrc}" --bundle --platform=node --outfile="${hostDest}" --alias:@shared="${join(__dirname, '../../../shared')}"`);

    // 4. Create a mock extension folder inside workspace/extensions (eager extension)
    const extFolder = join(workspacePath, 'extensions/test-ext');
    mkdirSync(extFolder, { recursive: true });

    // Write package.json
    const packageJson = {
      name: 'test-ext',
      version: '1.0.0',
      publisher: 'lumiq-test',
      main: './extension.js'
    };
    writeFileSync(join(extFolder, 'package.json'), JSON.stringify(packageJson, null, 2), 'utf8');

    // Write TS extension logic and compile it
    const extensionTs = `
      import * as lumiq from 'lumiq';

      export function activate(context: any) {
        lumiq.commands.registerCommand('test.hello', (name: string) => {
          return 'Hello, ' + name + '!';
        });

        lumiq.commands.registerCommand('test.readFile', async (relativePath: string) => {
          const folders = lumiq.workspace.workspaceFolders;
          if (folders.length === 0) throw new Error('No workspace folder');
          const fileUri = folders[0].uri + '/' + relativePath;
          const bytes = await lumiq.workspace.fs.readFile(fileUri);
          return Buffer.from(bytes).toString('utf8');
        });

        lumiq.commands.registerCommand('test.writeFile', async (relativePath: string, content: string) => {
          const folders = lumiq.workspace.workspaceFolders;
          if (folders.length === 0) throw new Error('No workspace folder');
          const fileUri = folders[0].uri + '/' + relativePath;
          const bytes = Buffer.from(content, 'utf8');
          await lumiq.workspace.fs.writeFile(fileUri, bytes);
          return true;
        });

        lumiq.commands.registerCommand('test.crash', () => {
          process.exit(1);
        });
      }
    `;
    const extTsPath = join(extFolder, 'extension.ts');
    writeFileSync(extTsPath, extensionTs, 'utf8');
    execSync(`npx esbuild "${extTsPath}" --bundle --platform=node --external:lumiq --outfile="${join(extFolder, 'extension.js')}"`);

    // 4b. Create a lazy mock extension folder
    const lazyExtFolder = join(workspacePath, 'extensions/lazy-ext');
    mkdirSync(lazyExtFolder, { recursive: true });

    const lazyPackageJson = {
      name: 'lazy-ext',
      version: '1.0.0',
      publisher: 'lumiq-test',
      main: './extension.js',
      activationEvents: ['onCommand:lazy.hello']
    };
    writeFileSync(join(lazyExtFolder, 'package.json'), JSON.stringify(lazyPackageJson, null, 2), 'utf8');

    const lazyExtensionTs = `
      import * as lumiq from 'lumiq';

      export function activate(context: any) {
        lumiq.commands.registerCommand('lazy.hello', (name: string) => {
          return 'Lazy hello, ' + name + '!';
        });
      }
    `;
    const lazyExtTsPath = join(lazyExtFolder, 'extension.ts');
    writeFileSync(lazyExtTsPath, lazyExtensionTs, 'utf8');
    execSync(`npx esbuild "${lazyExtTsPath}" --bundle --platform=node --external:lumiq --outfile="${join(lazyExtFolder, 'extension.js')}"`);

    // 5. Initialize services
    fileService = new FileService();
    const diskProvider = new DiskFileSystemProvider();
    fileService.registerProvider('file', diskProvider);

    configService = new ConfigurationService(fileService);

    const services = new Map<any, any>();
    services.set(IFileService, fileService);
    services.set(IConfigurationService, configService);

    const container = new InstantiationService(services);
    setActiveContainer(container);

    extManagementService = new ExtensionManagementService();
    extService = new ExtensionService(extManagementService, fileService);
  });

  afterAll(() => {
    extService.stopExtensionHost();

    try {
      closeDatabase();
    } catch {
      // ignore
    }

    try {
      const hostDest = join(__dirname, '../extensionHostMain.js');
      if (existsSync(hostDest)) unlinkSync(hostDest);
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

  it('should scan and discover extensions in workspace', async () => {
    const db = getDatabase();
    db.prepare("INSERT INTO sessions (id, title, provider, model, workspace_path) VALUES (?, ?, ?, ?, ?)")
      .run('test-session', 'Test', 'anthropic', 'claude-sonnet-4-20250514', workspacePath);

    const extensions = await extManagementService.scanExtensions();
    expect(extensions.length).toBe(2);
    
    const testExt = extensions.find(e => e.id === 'lumiq-test.test-ext');
    const lazyExt = extensions.find(e => e.id === 'lumiq-test.lazy-ext');
    
    expect(testExt).toBeDefined();
    expect(lazyExt).toBeDefined();
    expect(lazyExt?.activationEvents).toContain('onCommand:lazy.hello');
  });

  it('should start extension host, load and execute commands', async () => {
    await extService.startExtensionHost();
    // Wait for asynchronous IPC registration messages to be handled
    await new Promise(resolve => setTimeout(resolve, 150));

    expect(extService.hasCommand('test.hello')).toBe(true);
    expect(extService.hasCommand('test.readFile')).toBe(true);
    expect(extService.hasCommand('test.writeFile')).toBe(true);

    const greetResult = await extService.executeCommand('test.hello', 'Lumiq');
    expect(greetResult).toBe('Hello, Lumiq!');
  });

  it('should allow extension host to perform file operations through IFileService', async () => {
    const dummyFilePath = join(workspacePath, 'dummy.txt');
    writeFileSync(dummyFilePath, 'Initial content', 'utf8');

    const content = await extService.executeCommand('test.readFile', 'dummy.txt');
    expect(content).toBe('Initial content');

    await extService.executeCommand('test.writeFile', 'dummy.txt', 'Modified content');

    const diskContent = readFileSync(dummyFilePath, 'utf8');
    expect(diskContent).toBe('Modified content');
  });

  it('should support case-insensitive URI comparison on Windows', () => {
    const originalPlatform = process.platform;
    try {
      // Force platform to win32 for the test
      Object.defineProperty(process, 'platform', { value: 'win32' });
      const uri1 = URI.file('C:\\Users\\workspace\\dummy.txt');
      const uri2 = URI.file('c:\\users\\workspace\\dummy.txt');
      expect(uri1.isEqual(uri2)).toBe(true);

      // Force platform to linux for the test
      Object.defineProperty(process, 'platform', { value: 'linux' });
      const uri3 = URI.file('/users/workspace/dummy.txt');
      const uri4 = URI.file('/Users/workspace/dummy.txt');
      expect(uri3.isEqual(uri4)).toBe(false);
    } finally {
      Object.defineProperty(process, 'platform', { value: originalPlatform });
    }
  });

  it('should throw validation errors when updating config values inconsistent with schema', async () => {
    // contextLimit is registered as a number schema
    await expect(configService.updateValue('contextLimit', 'not-a-number')).rejects.toThrow();
    await expect(configService.updateValue('contextLimit', true)).rejects.toThrow();
    
    // sidebarVisible is registered as a boolean schema
    await expect(configService.updateValue('sidebarVisible', 'yes')).rejects.toThrow();
    await expect(configService.updateValue('sidebarVisible', 42)).rejects.toThrow();

    // Valid values should succeed
    await configService.updateValue('contextLimit', 200);
    expect(configService.getValue('contextLimit')).toBe(200);
  });

  it('should register lazy commands but not activate the extension until invoked', async () => {
    // Check that lazy.hello is registered in commands but the extension is NOT active
    expect(extService.hasCommand('lazy.hello')).toBe(true);
    
    const activatedSet = (extService as any).activatedExtensions as Set<string>;
    expect(activatedSet.has('lumiq-test.lazy-ext')).toBe(false);

    // Now execute the lazy command
    const lazyResult = await extService.executeCommand('lazy.hello', 'World');
    expect(lazyResult).toBe('Lazy hello, World!');

    // Now the extension should be activated
    expect(activatedSet.has('lumiq-test.lazy-ext')).toBe(true);
  });

  it('should automatically restart the extension host and restore registered commands after a crash', async () => {
    const initialProcess = (extService as any).hostProcess;
    expect(initialProcess).not.toBeNull();
    const initialPid = initialProcess.pid;

    // Simulate crash using the test.crash command
    try {
      await extService.executeCommand('test.crash');
    } catch {
      // It is expected to throw or reject because the process exits
    }

    // Wait for the exit event handler to run and respawn/restart the host process
    await new Promise(resolve => setTimeout(resolve, 300));

    const newProcess = (extService as any).hostProcess;
    expect(newProcess).not.toBeNull();
    expect(newProcess.pid).not.toBe(initialPid);

    // Wait another short bit for the respawned process to finish booting and registering commands
    await new Promise(resolve => setTimeout(resolve, 200));

    // Commands should be restored and executable
    expect(extService.hasCommand('test.hello')).toBe(true);
    const greetResult = await extService.executeCommand('test.hello', 'Post-Crash');
    expect(greetResult).toBe('Hello, Post-Crash!');
  });
});
