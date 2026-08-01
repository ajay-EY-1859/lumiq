import { IIpcFrameworkService, IChannel, IServerChannel } from '@shared/services';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';

export interface IMessageSender {
  send(msg: any): void;
  on(event: string, listener: (msg: any) => void): void;
}

export class IPCServer {
  private channels = new Map<string, IServerChannel>();
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

  registerChannel(channelName: string, channel: IServerChannel): void {
    this.channels.set(channelName, channel);
  }

  rejectAllPending(err: Error): void {
    for (const pending of this.pendingRequests.values()) {
      pending.reject(err);
    }
    this.pendingRequests.clear();
  }

  addConnection(connection: IMessageSender): void {
    connection.on('message', async (msg: any) => {
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'apiCall') {
        const { id, channel, method, args } = msg;
        try {
          const chan = this.channels.get(channel);
          if (!chan) {
            throw new Error(`Channel '${channel}' not found.`);
          }
          const result = await chan.call(method, args);
          connection.send({ type: 'apiResponse', id, result });
        } catch (err: any) {
          connection.send({ type: 'apiResponse', id, error: err.message });
        }
      } else if (msg.type === 'response') {
        const { id, result, error } = msg;
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(result);
          }
        }
      }
    });
  }

  getChannel(_channelName: string, connection: IMessageSender): IChannel {
    return {
      call: async (command: string, arg?: any): Promise<any> => {
        const id = Math.random().toString(36).substring(2, 9);
        return new Promise((resolve, reject) => {
          this.pendingRequests.set(id, { resolve, reject });
          connection.send({
            type: 'request',
            id,
            method: command,
            args: Array.isArray(arg) ? arg : [arg]
          });
        });
      }
    };
  }
}

export class IPCClient {
  private channels = new Map<string, IServerChannel>();
  private pendingRequests = new Map<string, { resolve: (val: any) => void; reject: (err: any) => void }>();

  constructor(private connection: IMessageSender) {
    this.connection.on('message', async (msg: any) => {
      if (!msg || typeof msg !== 'object') return;

      if (msg.type === 'request') {
        const { id, method, args } = msg;
        try {
          let result: any;
          let handled = false;
          for (const chan of this.channels.values()) {
            try {
              result = await chan.call(method, args);
              handled = true;
              break;
            } catch {
              // try next
            }
          }
          if (!handled) {
            throw new Error(`Method '${method}' not handled by any registered channel.`);
          }
          this.connection.send({ type: 'response', id, result });
        } catch (err: any) {
          this.connection.send({ type: 'response', id, error: err.message });
        }
      } else if (msg.type === 'apiResponse') {
        const { id, result, error } = msg;
        const pending = this.pendingRequests.get(id);
        if (pending) {
          this.pendingRequests.delete(id);
          if (error) {
            pending.reject(new Error(error));
          } else {
            pending.resolve(result);
          }
        }
      }
    });
  }

  registerChannel(channelName: string, channel: IServerChannel): void {
    this.channels.set(channelName, channel);
  }

  rejectAllPending(err: Error): void {
    for (const pending of this.pendingRequests.values()) {
      pending.reject(err);
    }
    this.pendingRequests.clear();
  }

  getChannel(channelName: string): IChannel {
    return {
      call: async (command: string, arg?: any): Promise<any> => {
        const id = Math.random().toString(36).substring(2, 9);
        return new Promise((resolve, reject) => {
          this.pendingRequests.set(id, { resolve, reject });
          this.connection.send({
            type: 'apiCall',
            id,
            channel: channelName,
            method: command,
            args: Array.isArray(arg) ? arg : [arg]
          });
        });
      }
    };
  }
}

export class IpcFrameworkService implements IIpcFrameworkService {
  private channels = new Map<string, IServerChannel>();

  registerChannel(channelName: string, channel: IServerChannel): void {
    if (this.channels.has(channelName)) {
      throw new Error(`Channel '${channelName}' is already registered.`);
    }
    this.channels.set(channelName, channel);
  }

  getChannel(channelName: string): IChannel {
    return {
      call: async (command: string, arg?: any): Promise<any> => {
        const channel = this.channels.get(channelName);
        if (!channel) {
          throw new Error(`Channel '${channelName}' not found.`);
        }
        return await channel.call(command, arg);
      }
    };
  }
}

registerSingleton(IIpcFrameworkService, IpcFrameworkService, InstantiationType.Delayed);
