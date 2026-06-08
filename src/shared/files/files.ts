/* eslint-disable no-redeclare */
import { createDecorator } from '../instantiation/instantiation';
import { Event } from '../event';
import { IDisposable } from '../lifecycle';
import { URI } from '../uri';

export const IFileService = createDecorator<IFileService>('fileService');

export enum FileType {
  Unknown = 0,
  File = 1,
  Directory = 2,
  SymbolicLink = 64
}

export interface IFileStat {
  readonly resource: URI;
  readonly mtime: number;
  readonly ctime: number;
  readonly size: number;
  readonly isDirectory: boolean;
}

export enum FileChangeType {
  UPDATED = 0,
  ADDED = 1,
  DELETED = 2
}

export interface IFileChange {
  readonly resource: URI;
  readonly type: FileChangeType;
}

export class FileChangesEvent {
  constructor(readonly changes: readonly IFileChange[]) {}
}

export interface IFileSystemProvider {
  readonly onDidChangeFile: Event<readonly IFileChange[]>;
  watch(resource: URI, opts: { recursive: boolean; excludes: string[] }): IDisposable;
  stat(resource: URI): Promise<IFileStat>;
  mkdir(resource: URI): Promise<void>;
  readdir(resource: URI): Promise<[string, FileType][]>;
  readFile(resource: URI): Promise<Uint8Array>;
  writeFile(resource: URI, content: Uint8Array, opts: { create: boolean; overwrite: boolean }): Promise<void>;
  delete(resource: URI, opts: { recursive: boolean }): Promise<void>;
}

export interface IFileService {
  readonly onDidFilesChange: Event<FileChangesEvent>;
  registerProvider(scheme: string, provider: IFileSystemProvider): IDisposable;
  resolve(resource: URI): Promise<IFileStat>;
  readFile(resource: URI): Promise<Uint8Array>;
  writeFile(resource: URI, content: Uint8Array): Promise<void>;
  delete(resource: URI, options?: { recursive?: boolean }): Promise<void>;
  mkdir(resource: URI): Promise<void>;
  readdir(resource: URI): Promise<[string, FileType][]>;
  watch(resource: URI): IDisposable;
}
