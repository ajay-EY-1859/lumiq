/* eslint-disable no-redeclare */
import { createDecorator } from '../instantiation/instantiation';

export interface IExtensionDescription {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly publisher?: string;
  readonly description?: string;
  readonly main: string;
  readonly extensionPath: string;
  readonly activationEvents?: string[];
  readonly engines?: {
    readonly vscode?: string;
    readonly lumiq?: string;
  };
}

export const IExtensionManagementService = createDecorator<IExtensionManagementService>('extensionManagementService');
export interface IExtensionManagementService {
  scanExtensions(): Promise<IExtensionDescription[]>;
  getInstalledExtensions(): IExtensionDescription[];
  isAllowed(extensionId: string): boolean;
  setAllowlist(extensionIds: string[]): void;
}

export const IExtensionService = createDecorator<IExtensionService>('extensionService');
export interface IExtensionService {
  startExtensionHost(): Promise<void>;
  stopExtensionHost(): void;
  activateExtension(extensionId: string): Promise<void>;
  executeCommand(commandId: string, ...args: any[]): Promise<any>;
  hasCommand(commandId: string): boolean;
  provideHover(filePath: string, line: number, column: number): Promise<string | null>;
  provideCompletions(filePath: string, line: number, column: number): Promise<any[]>;
  callChatAgent(agentId: string, request: any, response: any): Promise<void>;
}

// IPC protocol message types
export interface IExtHostRequest {
  type: 'request';
  id: string;
  method: string;
  args: any[];
}

export interface IExtHostResponse {
  type: 'response';
  id: string;
  result?: any;
  error?: string;
}

export interface IMainRequest {
  type: 'apiCall';
  id: string;
  channel: string;
  method: string;
  args: any[];
}

export interface IMainResponse {
  type: 'apiResponse';
  id: string;
  result?: any;
  error?: string;
}

export type IExtHostMessage = IExtHostRequest | IExtHostResponse | IMainRequest | IMainResponse;

export class ProxyChannel {
  static toService<T>(
    channelName: string,
    sendRequestFn: (channel: string, method: string, args: any[]) => Promise<any>
  ): T {
    return new Proxy({}, {
      get: (_target, property) => {
        if (typeof property !== 'string') return undefined;
        return (...args: any[]) => {
          return sendRequestFn(channelName, property, args);
        };
      }
    }) as T;
  }
}
