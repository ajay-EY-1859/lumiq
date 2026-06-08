import Module from 'module';
import path from 'path';
import { ProxyChannel } from '@shared/extensions/extensions';

// Pending main API responses map
const pendingApiResponses = new Map<string, { resolve: (value: any) => void; reject: (error: Error) => void }>();

// Outgoing call helper to Main process
function callMain(channel: string, method: string, args: any[]): Promise<any> {
  const id = Math.random().toString(36).substring(2, 9);
  return new Promise((resolve, reject) => {
    pendingApiResponses.set(id, { resolve, reject });
    if (process.send) {
      process.send({
        type: 'apiCall',
        id,
        channel,
        method,
        args
      });
    } else {
      reject(new Error('Process IPC channel not available.'));
    }
  });
}

// Disposables collection tracker
class DisposablesTracker {
  private disposables: (() => void)[] = [];
  add(disposeFn: () => void) {
    this.disposables.push(disposeFn);
  }
  disposeAll() {
    for (const disposeFn of this.disposables) {
      try {
        disposeFn();
      } catch (err) {
        console.error('Error in dispose:', err);
      }
    }
    this.disposables = [];
  }
}

const hostDisposables = new DisposablesTracker();

// Registers the mock 'lumiq' module
const commandCallbacks = new Map<string, (...args: any[]) => any>();
const hoverProviders = new Map<string, any>();
const completionProviders = new Map<string, any>();
const chatAgents = new Map<string, any>();

let activeWorkspaceFolders: { uri: string; name: string }[] = [];

const fsService = ProxyChannel.toService<any>('fs', callMain);
const commandsService = ProxyChannel.toService<any>('commands', callMain);
const windowService = ProxyChannel.toService<any>('window', callMain);
const languagesService = ProxyChannel.toService<any>('languages', callMain);
const mcpService = ProxyChannel.toService<any>('mcp', callMain);
const chatService = ProxyChannel.toService<any>('chat', callMain);

// Construct the Mock API
const lumiqAPI = {
  workspace: {
    get workspaceFolders() {
      return activeWorkspaceFolders;
    },
    fs: {
      async readFile(uri: string): Promise<Uint8Array> {
        const dataArray = await fsService.readFile(uri);
        return new Uint8Array(dataArray);
      },
      async writeFile(uri: string, content: Uint8Array): Promise<void> {
        await fsService.writeFile(uri, Array.from(content));
      },
      async delete(uri: string, options?: { recursive?: boolean }): Promise<void> {
        await fsService.delete(uri, options);
      },
      async createDirectory(uri: string): Promise<void> {
        await fsService.createDirectory(uri);
      },
      async readDirectory(uri: string): Promise<[string, number][]> {
        return await fsService.readDirectory(uri);
      },
      async stat(uri: string): Promise<{ size: number; mtime: number; ctime: number; isDirectory: boolean }> {
        return await fsService.stat(uri);
      }
    }
  },
  commands: {
    registerCommand(commandId: string, callback: (...args: any[]) => any) {
      commandCallbacks.set(commandId, callback);
      commandsService.registerCommand(commandId, process.pid!.toString()).catch((err: any) => {
        console.error('Failed to register command in Main process:', err);
      });
      const dispose = () => {
        commandCallbacks.delete(commandId);
      };
      hostDisposables.add(dispose);
      return { dispose };
    },
    async executeCommand(commandId: string, ...args: any[]): Promise<any> {
      return await commandsService.executeCommand(commandId, ...args);
    }
  },
  window: {
    async showInformationMessage(message: string): Promise<void> {
      await windowService.showInformationMessage(message);
    },
    async showErrorMessage(message: string): Promise<void> {
      await windowService.showErrorMessage(message);
    },
    async createTerminal(options: any): Promise<void> {
      await windowService.createTerminal(options);
    }
  },
  languages: {
    registerHoverProvider(selector: string, provider: any) {
      hoverProviders.set(selector, provider);
      languagesService.registerHoverProvider(process.pid!.toString()).catch((err: any) => {
        console.error('Failed to register hover provider in Main process:', err);
      });
      const dispose = () => {
        hoverProviders.delete(selector);
      };
      hostDisposables.add(dispose);
      return { dispose };
    },
    registerCompletionItemProvider(selector: string, provider: any) {
      completionProviders.set(selector, provider);
      languagesService.registerCompletionItemProvider(process.pid!.toString()).catch((err: any) => {
        console.error('Failed to register completion provider in Main process:', err);
      });
      const dispose = () => {
        completionProviders.delete(selector);
      };
      hostDisposables.add(dispose);
      return { dispose };
    }
  },
  mcp: {
    async registerMcpServer(config: any): Promise<void> {
      await mcpService.registerMcpServer(config);
    }
  },
  chat: {
    registerChatAgent(agentId: string, callback: any) {
      chatAgents.set(agentId, callback);
      chatService.registerChatAgent(agentId, process.pid!.toString()).catch((err: any) => {
        console.error('Failed to register chat agent in Main process:', err);
      });
      const dispose = () => {
        chatAgents.delete(agentId);
      };
      hostDisposables.add(dispose);
      return { dispose };
    }
  }
};

// Set up the Node require interceptor
const originalRequire = Module.prototype.require;
Module.prototype.require = function (this: any, id: string) {
  if (id === 'lumiq') {
    return lumiqAPI;
  }
  return originalRequire.apply(this, [id]);
};

// Activated extensions register
const activatedExtensions = new Map<string, any>();

// Handle messages from the Main process
process.on('message', async (msg: any) => {
  if (msg.type === 'apiResponse') {
    const pending = pendingApiResponses.get(msg.id);
    if (pending) {
      pendingApiResponses.delete(msg.id);
      if (msg.error) {
        pending.reject(new Error(msg.error));
      } else {
        pending.resolve(msg.result);
      }
    }
  } else if (msg.type === 'request') {
    const { id, method, args } = msg;
    try {
      let result: any;
      if (method === 'activateExtension') {
        const ext = args[0];
        const extMainPath = path.isAbsolute(ext.main) ? ext.main : path.join(ext.extensionPath, ext.main);
        
        if (ext.workspaceFolders) {
          activeWorkspaceFolders = ext.workspaceFolders;
        }

        console.log(`[ExtensionHost] Activating extension ${ext.id} from ${extMainPath}`);
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        const moduleExports = require(extMainPath);
        if (moduleExports && typeof moduleExports.activate === 'function') {
          const context = {
            subscriptions: [],
            extensionPath: ext.extensionPath
          };
          const activationResult = await moduleExports.activate(context);
          activatedExtensions.set(ext.id, { exports: activationResult, context });
        }
      } else if (method === 'executeCommand') {
        const [commandId, ...cmdArgs] = args;
        const callback = commandCallbacks.get(commandId);
        if (callback) {
          result = await callback(...cmdArgs);
        } else {
          throw new Error(`Command ${commandId} callback not found in ExtensionHost.`);
        }
      } else if (method === 'provideHover') {
        const [filePath, line, column] = args;
        const provider = Array.from(hoverProviders.values())[0];
        if (provider && typeof provider.provideHover === 'function') {
          result = await provider.provideHover({ uri: filePath }, { line, column });
        }
      } else if (method === 'provideCompletions') {
        const [filePath, line, column] = args;
        const provider = Array.from(completionProviders.values())[0];
        if (provider && typeof provider.provideCompletionItems === 'function') {
          result = await provider.provideCompletionItems({ uri: filePath }, { line, column });
        }
      } else if (method === 'callChatAgent') {
        const [agentId, request] = args;
        const callback = chatAgents.get(agentId);
        if (callback) {
          result = await callback(request);
        }
      } else {
        throw new Error(`Unknown extension host request method: ${method}`);
      }

      if (process.send) {
        process.send({
          type: 'response',
          id,
          result
        });
      }
    } catch (err) {
      if (process.send) {
        process.send({
          type: 'response',
          id,
          error: (err as Error).message
        });
      }
    }
  }
});

// Graceful cleanup on shutdown
process.on('SIGTERM', () => {
  hostDisposables.disposeAll();
  process.exit(0);
});
