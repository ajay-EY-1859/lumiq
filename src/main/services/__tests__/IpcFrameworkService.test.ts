import { describe, it, expect } from 'vitest';
import { IpcFrameworkService, IPCServer, IPCClient, IMessageSender } from '../IpcFrameworkService';
import { ProxyChannel } from '@shared/extensions/extensions';

interface IMockService {
  greet(name: string): Promise<string>;
  add(a: number, b: number): Promise<number>;
}

class MockConnection implements IMessageSender {
  public otherSide?: MockConnection;
  private listeners: ((msg: any) => void)[] = [];

  send(msg: any): void {
    if (this.otherSide) {
      // Defer to simulate async process boundaries
      setTimeout(() => {
        for (const listener of this.otherSide!.listeners) {
          listener(msg);
        }
      }, 0);
    }
  }

  on(event: string, listener: (msg: any) => void): void {
    if (event === 'message') {
      this.listeners.push(listener);
    }
  }
}

describe('IpcFrameworkService (Milestone 26)', () => {
  it('should register and route commands on named channels', async () => {
    const ipcService = new IpcFrameworkService();

    ipcService.registerChannel('calculator', {
      call: async (command: string, arg: any): Promise<any> => {
        if (command === 'add') {
          return arg.a + arg.b;
        }
        throw new Error('Unknown command');
      }
    });

    const clientChannel = ipcService.getChannel('calculator');
    const result = await clientChannel.call('add', { a: 10, b: 5 });
    expect(result).toBe(15);
  });

  it('should generate type-safe proxies via ProxyChannel.toService', async () => {
    const ipcService = new IpcFrameworkService();

    ipcService.registerChannel('greeterService', {
      call: async (command: string, args: any[]): Promise<any> => {
        if (command === 'greet') {
          return `Hello, ${args[0]}`;
        }
        if (command === 'add') {
          return args[0] + args[1];
        }
        throw new Error('Unknown command');
      }
    });

    const clientChannel = ipcService.getChannel('greeterService');
    const proxy = ProxyChannel.toService<IMockService>('greeterService', async (channel, method, args) => {
      expect(channel).toBe('greeterService');
      return clientChannel.call(method, args);
    });

    const greeting = await proxy.greet('Alice');
    expect(greeting).toBe('Hello, Alice');

    const sum = await proxy.add(7, 8);
    expect(sum).toBe(15);
  });

  it('should throw error for non-existent channels', async () => {
    const ipcService = new IpcFrameworkService();
    const clientChannel = ipcService.getChannel('invalid-channel');
    await expect(clientChannel.call('test')).rejects.toThrow(/not found/);
  });

  it('should support bidirectional multi-process communication via IPCServer and IPCClient', async () => {
    const mainConnection = new MockConnection();
    const childConnection = new MockConnection();
    mainConnection.otherSide = childConnection;
    childConnection.otherSide = mainConnection;

    const server = new IPCServer();
    const client = new IPCClient(childConnection);

    server.addConnection(mainConnection);

    // Register Greeter service on the main process (server side)
    const greeterImpl: IMockService = {
      greet: async (name) => `Hello, ${name} from Main`,
      add: async (a, b) => a + b
    };
    server.registerChannel('greeter', ProxyChannel.fromService(greeterImpl));

    // Register a service on the child process (client side) to handle 'executeCommand'
    const commandHandler = {
      executeCommand: async (cmd: string, arg: string) => `Executed ${cmd} with ${arg}`
    };
    client.registerChannel('commands', ProxyChannel.fromService(commandHandler));

    // Make a call from client (child process) to server (main process)
    const clientProxy = ProxyChannel.toService<IMockService>('greeter', async (channel, method, args) => {
      const chan = client.getChannel(channel);
      return chan.call(method, args);
    });

    const greetRes = await clientProxy.greet('Bob');
    expect(greetRes).toBe('Hello, Bob from Main');

    const addRes = await clientProxy.add(12, 13);
    expect(addRes).toBe(25);

    // Make a call from server (main process) to client (child process)
    const serverProxy = server.getChannel('commands', mainConnection);
    const cmdRes = await serverProxy.call('executeCommand', ['testCommand', 'testArg']);
    expect(cmdRes).toBe('Executed testCommand with testArg');
  });
});
