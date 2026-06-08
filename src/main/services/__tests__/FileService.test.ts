import { describe, it, expect, beforeAll } from 'vitest';
import { FileService } from '../FileService';
import { IFileSystemProvider, FileType, IFileStat, IFileChange } from '@shared/files/files';
import { URI } from '@shared/uri';
import { Emitter, Event } from '@shared/event';
import { InstantiationService, setActiveContainer } from '@shared/instantiation/instantiationService';
import { IDisposable, toDisposable } from '@shared/lifecycle';

class MockFileSystemProvider implements IFileSystemProvider {
  private readonly _onDidChangeFile = new Emitter<readonly IFileChange[]>();
  readonly onDidChangeFile: Event<readonly IFileChange[]> = this._onDidChangeFile.event;

  files = new Map<string, { content: Uint8Array; stat: IFileStat }>();

  watch(_resource: URI, _opts: { recursive: boolean; excludes: string[] }): IDisposable {
    return toDisposable(() => {});
  }

  async stat(resource: URI): Promise<IFileStat> {
    const key = resource.toString();
    const val = this.files.get(key);
    if (!val) throw new Error('File not found');
    return val.stat;
  }

  async mkdir(resource: URI): Promise<void> {
    const key = resource.toString();
    this.files.set(key, {
      content: new Uint8Array(),
      stat: { resource, mtime: 0, ctime: 0, size: 0, isDirectory: true }
    });
  }

  async readdir(_resource: URI): Promise<[string, FileType][]> {
    return [];
  }

  async readFile(resource: URI): Promise<Uint8Array> {
    const key = resource.toString();
    const val = this.files.get(key);
    if (!val) throw new Error('File not found');
    return val.content;
  }

  async writeFile(resource: URI, content: Uint8Array, _opts: { create: boolean; overwrite: boolean }): Promise<void> {
    const key = resource.toString();
    this.files.set(key, {
      content,
      stat: { resource, mtime: Date.now(), ctime: Date.now(), size: content.byteLength, isDirectory: false }
    });
  }

  async delete(resource: URI, _opts: { recursive: boolean }): Promise<void> {
    this.files.delete(resource.toString());
  }

  triggerChange(changes: IFileChange[]) {
    this._onDidChangeFile.fire(changes);
  }
}

describe('FileService', () => {
  beforeAll(() => {
    const container = new InstantiationService();
    setActiveContainer(container);
  });

  it('should register providers and route file operations', async () => {
    const fileService = new FileService();
    const provider = new MockFileSystemProvider();
    
    fileService.registerProvider('inmemory', provider);
    
    const uri = URI.parse('inmemory://test/file.txt');
    
    // Write
    const content = new TextEncoder().encode('Hello world');
    await fileService.writeFile(uri, content);
    
    // Read
    const readBytes = await fileService.readFile(uri);
    const readText = new TextDecoder().decode(readBytes);
    expect(readText).toBe('Hello world');
    
    // Stat
    const stat = await fileService.resolve(uri);
    expect(stat.isDirectory).toBe(false);
    expect(stat.size).toBe(content.byteLength);
    
    // Delete
    await fileService.delete(uri);
    await expect(fileService.resolve(uri)).rejects.toThrow();
  });

  it('should propagate provider file changes events', async () => {
    const fileService = new FileService();
    const provider = new MockFileSystemProvider();
    fileService.registerProvider('inmemory', provider);
    
    let firedEvent: any = null;
    fileService.onDidFilesChange(e => {
      firedEvent = e;
    });

    const changeUri = URI.parse('inmemory://test/changed.txt');
    provider.triggerChange([{ resource: changeUri, type: 0 }]);
    
    expect(firedEvent).not.toBeNull();
    expect(firedEvent.changes[0].resource.toString()).toBe(changeUri.toString());
  });
});
