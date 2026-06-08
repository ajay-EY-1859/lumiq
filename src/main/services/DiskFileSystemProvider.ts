import { Emitter, Event } from '@shared/event';
import { IFileSystemProvider, IFileChange, FileChangeType, FileType, IFileStat } from '@shared/files/files';
import { URI } from '@shared/uri';
import { IDisposable, toDisposable } from '@shared/lifecycle';
import * as fs from 'fs';
import chokidar from 'chokidar';

export class DiskFileSystemProvider implements IFileSystemProvider {
  private readonly _onDidChangeFile = new Emitter<readonly IFileChange[]>();
  readonly onDidChangeFile: Event<readonly IFileChange[]> = this._onDidChangeFile.event;

  watch(resource: URI, opts: { recursive: boolean; excludes: string[] }): IDisposable {
    const watcher = chokidar.watch(resource.fsPath, {
      ignoreInitial: true,
      depth: opts.recursive ? undefined : 0,
      ignored: opts.excludes
    });

    watcher.on('add', (filePath) => {
      this._onDidChangeFile.fire([{ resource: URI.file(filePath), type: FileChangeType.ADDED }]);
    });
    watcher.on('change', (filePath) => {
      this._onDidChangeFile.fire([{ resource: URI.file(filePath), type: FileChangeType.UPDATED }]);
    });
    watcher.on('unlink', (filePath) => {
      this._onDidChangeFile.fire([{ resource: URI.file(filePath), type: FileChangeType.DELETED }]);
    });

    return toDisposable(() => {
      watcher.close();
    });
  }

  async stat(resource: URI): Promise<IFileStat> {
    const stats = await fs.promises.stat(resource.fsPath);
    return {
      resource,
      mtime: stats.mtimeMs,
      ctime: stats.ctimeMs,
      size: stats.size,
      isDirectory: stats.isDirectory()
    };
  }

  async mkdir(resource: URI): Promise<void> {
    await fs.promises.mkdir(resource.fsPath, { recursive: true });
  }

  async readdir(resource: URI): Promise<[string, FileType][]> {
    const entries = await fs.promises.readdir(resource.fsPath, { withFileTypes: true });
    return entries.map(e => {
      let type = FileType.Unknown;
      if (e.isFile()) type = FileType.File;
      else if (e.isDirectory()) type = FileType.Directory;
      else if (e.isSymbolicLink()) type = FileType.SymbolicLink;
      return [e.name, type];
    });
  }

  async readFile(resource: URI): Promise<Uint8Array> {
    return await fs.promises.readFile(resource.fsPath);
  }

  async writeFile(resource: URI, content: Uint8Array, opts: { create: boolean; overwrite: boolean }): Promise<void> {
    const exists = fs.existsSync(resource.fsPath);
    if (!opts.create && !exists) {
      throw new Error(`File does not exist: ${resource.fsPath}`);
    }
    if (!opts.overwrite && exists) {
      throw new Error(`File already exists: ${resource.fsPath}`);
    }
    const tempPath = resource.fsPath + '.tmp';
    await fs.promises.writeFile(tempPath, content);
    try {
      await fs.promises.rename(tempPath, resource.fsPath);
    } catch (err) {
      if (fs.existsSync(tempPath)) {
        try {
          await fs.promises.unlink(tempPath);
        } catch {
          // ignore
        }
      }
      throw err;
    }
  }

  async delete(resource: URI, opts: { recursive: boolean }): Promise<void> {
    await fs.promises.rm(resource.fsPath, { recursive: opts.recursive, force: true });
  }
}
