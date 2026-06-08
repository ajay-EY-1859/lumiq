/* eslint-disable no-redeclare */
import { createDecorator } from '../instantiation/instantiation';
import { Event } from '../event';

export const IConfigurationService = createDecorator<IConfigurationService>('configurationService');

export enum ConfigurationTarget {
  Default = 1,
  User = 2,
  Workspace = 3,
  Memory = 4
}

export interface IConfigurationChangeEvent {
  affectsConfiguration(key: string): boolean;
}

export interface IConfigurationService {
  readonly onDidChangeConfiguration: Event<IConfigurationChangeEvent>;
  getValue<T>(key: string): T;
  updateValue(key: string, value: any, target?: ConfigurationTarget): Promise<void>;
  setWorkspacePath(path: string | null): Promise<void>;
}
