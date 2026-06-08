import { fork } from 'child_process';
import path from 'path';
import fs from 'node:fs';
import { BrowserWindow } from 'electron';
import { IExtensionService, IExtensionManagementService, IExtHostMessage } from '@shared/extensions/extensions';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import { IFileService } from '@shared/files/files';
import { URI } from '@shared/uri';
import { saveMcpServer } from '../db/mcpServers';
import { mcpServerManager } from './mcp/McpServerManager';
import { agentLoop } from '../agent/AgentLoop';
import { getDatabase } from '../db/database';

export class ExtensionService implements IExtensionService {
  private hostProcess: any = null;
  private pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();
  
  // Extension State
  private activatedExtensions = new Set<string>(); // extensionId
  private registeredCommands = new Map<string, string>(); // commandId -> extensionId
  private lazyCommands = new Map<string, string>(); // commandId -> extensionId
  private activeHoverProviders = new Set<string>(); // extensionId
  private activeCompletionProviders = new Set<string>(); // extensionId
  private activeChatAgents = new Map<string, string>(); // agentId -> extensionId

  // Crash Loop Prevention
  private crashTimes: number[] = [];

  // Dynamic dispatch channels map
  private readonly apiChannels = new Map<string, any>();

  constructor(
    @IExtensionManagementService private readonly extensionManagementService: IExtensionManagementService,
    @IFileService private readonly fileService: IFileService
  ) {
    this.setupApiChannels();
  }

  private setupApiChannels(): void {
    this.apiChannels.set('fs', {
      readFile: async (uriStr: string) => {
        const data = await this.fileService.readFile(URI.parse(uriStr));
        return Array.from(data);
      },
      writeFile: async (uriStr: string, contentArray: number[]) => {
        await this.fileService.writeFile(URI.parse(uriStr), new Uint8Array(contentArray));
      },
      delete: async (uriStr: string, options?: any) => {
        await this.fileService.delete(URI.parse(uriStr), options);
      },
      createDirectory: async (uriStr: string) => {
        await this.fileService.mkdir(URI.parse(uriStr));
      },
      readDirectory: async (uriStr: string) => {
        return await this.fileService.readdir(URI.parse(uriStr));
      },
      stat: async (uriStr: string) => {
        const stat = await this.fileService.resolve(URI.parse(uriStr));
        return {
          size: stat.size,
          mtime: stat.mtime,
          ctime: stat.ctime,
          isDirectory: stat.isDirectory
        };
      }
    });

    this.apiChannels.set('commands', {
      registerCommand: async (commandId: string, extId: string) => {
        this.registeredCommands.set(commandId, extId);
      },
      executeCommand: async (commandId: string, ...args: any[]) => {
        return await this.executeCommand(commandId, ...args);
      }
    });

    this.apiChannels.set('window', {
      showInformationMessage: async (message: string) => {
        console.log(`[ExtensionHost Window Message] ${message}`);
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('extension:show-message', { type: 'info', message });
        }
      },
      showErrorMessage: async (message: string) => {
        console.error(`[ExtensionHost Window Error] ${message}`);
        for (const win of BrowserWindow.getAllWindows()) {
          win.webContents.send('extension:show-message', { type: 'error', message });
        }
      },
      createTerminal: async (options: any) => {
        console.log(`[ExtensionHost Terminal Request] Options:`, options);
      }
    });

    this.apiChannels.set('languages', {
      registerHoverProvider: async (extId: string) => {
        this.activeHoverProviders.add(extId);
      },
      registerCompletionItemProvider: async (extId: string) => {
        this.activeCompletionProviders.add(extId);
      }
    });

    this.apiChannels.set('mcp', {
      registerMcpServer: async (serverConfig: any) => {
        saveMcpServer({
          id: serverConfig.name,
          name: serverConfig.name,
          command: serverConfig.command,
          args: serverConfig.args || [],
          env: serverConfig.env || {},
          active: true,
          approved: true,
          status: 'stopped'
        });
        await mcpServerManager.start(serverConfig.name);
        agentLoop.getToolExecutor().refreshMcpTools();
      }
    });

    this.apiChannels.set('chat', {
      registerChatAgent: async (agentId: string, extId: string) => {
        this.activeChatAgents.set(agentId, extId);
      }
    });
  }

  async startExtensionHost(): Promise<void> {
    if (this.hostProcess) {
      return;
    }

    const hostPath = path.join(__dirname, 'extensionHostMain.js');
    console.log('[ExtensionService] Spawning extension host process from:', hostPath);

    this.hostProcess = fork(hostPath, [], {
      stdio: ['ipc', 'pipe', 'pipe'],
      env: { ...process.env }
    });

    this.hostProcess.stdout?.on('data', (data: Buffer) => {
      console.log(`[ExtensionHost stdout] ${data.toString().trim()}`);
    });

    this.hostProcess.stderr?.on('data', (data: Buffer) => {
      console.error(`[ExtensionHost stderr] ${data.toString().trim()}`);
    });

    this.hostProcess.on('message', (msg: IExtHostMessage) => {
      this.handleIncomingMessage(msg);
    });

    this.hostProcess.on('exit', (code: number, signal: string) => {
      console.warn(`[ExtensionService] Extension host process exited with code ${code}, signal ${signal}`);
      this.hostProcess = null;
      this.cleanupPendingRequests();

      // If it crashed, attempt crash recovery
      if (code !== 0 && code !== null) {
        this.handleExtensionHostCrash();
      }
    });

    // Scan all installed extensions and register lazy triggers or activate eager ones
    const extensions = await this.extensionManagementService.scanExtensions();
    for (const ext of extensions) {
      const isLazy = ext.activationEvents && ext.activationEvents.length > 0 && !ext.activationEvents.includes('*') && !ext.activationEvents.includes('onStartup');
      if (isLazy) {
        for (const trigger of ext.activationEvents!) {
          if (trigger.startsWith('onCommand:')) {
            const commandId = trigger.slice('onCommand:'.length);
            this.lazyCommands.set(commandId, ext.id);
            this.registeredCommands.set(commandId, ext.id);
          }
        }
      } else {
        await this.activateExtension(ext.id);
      }
    }
  }

  private handleExtensionHostCrash(): void {
    const now = Date.now();
    this.crashTimes = this.crashTimes.filter(t => now - t < 60000);
    this.crashTimes.push(now);

    if (this.crashTimes.length > 3) {
      console.error('[ExtensionService] Extension host has crashed more than 3 times in 60s. Disabling auto-restart.');
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('extension:show-message', {
          type: 'error',
          message: 'Extension host crashed repeatedly and has been disabled.'
        });
      }
      return;
    }

    console.warn('[ExtensionService] Crashed extension host restarting automatically...');
    for (const win of BrowserWindow.getAllWindows()) {
      win.webContents.send('extension:show-message', {
        type: 'info',
        message: 'Extension host crashed. Restarting...'
      });
    }

    this.activatedExtensions.clear();
    this.registeredCommands.clear();
    this.lazyCommands.clear();
    this.activeHoverProviders.clear();
    this.activeCompletionProviders.clear();
    this.activeChatAgents.clear();

    void this.startExtensionHost();
  }

  stopExtensionHost(): void {
    if (this.hostProcess) {
      this.hostProcess.kill();
      this.hostProcess = null;
    }
    this.cleanup();
  }

  private cleanupPendingRequests(): void {
    for (const pending of this.pendingRequests.values()) {
      pending.reject(new Error('Extension host terminated.'));
    }
    this.pendingRequests.clear();
  }

  private cleanup(): void {
    this.cleanupPendingRequests();
    this.activatedExtensions.clear();
    this.registeredCommands.clear();
    this.lazyCommands.clear();
    this.activeHoverProviders.clear();
    this.activeCompletionProviders.clear();
    this.activeChatAgents.clear();
  }

  async activateExtension(extensionId: string): Promise<void> {
    if (this.activatedExtensions.has(extensionId)) {
      return;
    }

    const extensions = this.extensionManagementService.getInstalledExtensions();
    const ext = extensions.find(e => e.id === extensionId);
    if (!ext) {
      throw new Error(`Extension ${extensionId} not found.`);
    }

    if (!this.hostProcess) {
      await this.startExtensionHost();
    }

    const workspaceFolders: { uri: string; name: string }[] = [];
    try {
      const db = getDatabase();
      const activeSession = db.prepare("SELECT workspace_path FROM sessions ORDER BY updated_at DESC LIMIT 1").get() as { workspace_path?: string } | undefined;
      if (activeSession?.workspace_path && fs.existsSync(activeSession.workspace_path)) {
        workspaceFolders.push({
          uri: URI.file(activeSession.workspace_path).toString(),
          name: path.basename(activeSession.workspace_path)
        });
      }
    } catch {
      // ignore
    }

    this.activatedExtensions.add(extensionId);
    await this.sendRequest('activateExtension', [{ ...ext, workspaceFolders }]);
  }

  private async ensureExtensionActivatedForCommand(commandId: string): Promise<void> {
    const extId = this.lazyCommands.get(commandId);
    if (extId && !this.activatedExtensions.has(extId)) {
      await this.activateExtension(extId);
      await new Promise(r => setTimeout(r, 50));
    }
  }

  hasCommand(commandId: string): boolean {
    return this.registeredCommands.has(commandId);
  }

  async executeCommand(commandId: string, ...args: any[]): Promise<any> {
    await this.ensureExtensionActivatedForCommand(commandId);

    const extId = this.registeredCommands.get(commandId);
    if (!extId) {
      throw new Error(`Command ${commandId} not found.`);
    }
    return this.sendRequest('executeCommand', [commandId, ...args]);
  }

  async provideHover(filePath: string, line: number, column: number): Promise<string | null> {
    for (const ext of this.extensionManagementService.getInstalledExtensions()) {
      if (ext.activationEvents?.includes(`onLanguage:${path.extname(filePath).slice(1)}`)) {
        await this.activateExtension(ext.id);
      }
    }

    if (this.activeHoverProviders.size === 0) return null;
    return this.sendRequest('provideHover', [filePath, line, column]);
  }

  async provideCompletions(filePath: string, line: number, column: number): Promise<any[]> {
    for (const ext of this.extensionManagementService.getInstalledExtensions()) {
      if (ext.activationEvents?.includes(`onLanguage:${path.extname(filePath).slice(1)}`)) {
        await this.activateExtension(ext.id);
      }
    }

    if (this.activeCompletionProviders.size === 0) return [];
    return this.sendRequest('provideCompletions', [filePath, line, column]);
  }

  async callChatAgent(agentId: string, request: any, response: any): Promise<void> {
    const extId = this.activeChatAgents.get(agentId);
    if (!extId) {
      throw new Error(`Chat agent ${agentId} not registered.`);
    }
    const result = await this.sendRequest('callChatAgent', [agentId, request]);
    if (result && typeof result === 'string') {
      response.write(result);
    }
  }

  private sendRequest(method: string, args: any[]): Promise<any> {
    if (!this.hostProcess) {
      return Promise.reject(new Error('Extension host is not running.'));
    }

    const id = Math.random().toString(36).substring(2, 9);
    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });
      this.hostProcess.send({
        type: 'request',
        id,
        method,
        args
      });
    });
  }

  private async handleIncomingMessage(msg: IExtHostMessage): Promise<void> {
    if (msg.type === 'response' || msg.type === 'apiResponse') {
      const pending = this.pendingRequests.get(msg.id);
      if (pending) {
        this.pendingRequests.delete(msg.id);
        if (msg.error) {
          pending.reject(new Error(msg.error));
        } else {
          pending.resolve(msg.result);
        }
      }
    } else if (msg.type === 'apiCall') {
      const { id, channel, method, args } = msg;
      try {
        let result: any;
        const handler = this.apiChannels.get(channel);
        if (handler && typeof handler[method] === 'function') {
          result = await handler[method](...args);
        } else {
          throw new Error(`Method ${method} on channel ${channel} not supported.`);
        }

        this.hostProcess.send({
          type: 'apiResponse',
          id,
          result
        });
      } catch (err) {
        this.hostProcess.send({
          type: 'apiResponse',
          id,
          error: (err as Error).message
        });
      }
    }
  }
}

registerSingleton(IExtensionService, ExtensionService, InstantiationType.Delayed);
