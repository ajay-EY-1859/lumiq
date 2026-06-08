import { IFileService, IFileSystemProvider, IFileStat, FileChangesEvent, FileType } from '@shared/files/files';
import { URI } from '@shared/uri';
import { Disposable, toDisposable } from '@shared/lifecycle';
import { Emitter, Event } from '@shared/event';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import { IDisposable } from '@shared/lifecycle';

export class FileService extends Disposable implements IFileService {
  private readonly _onDidFilesChange = this._register(new Emitter<FileChangesEvent>());
  readonly onDidFilesChange: Event<FileChangesEvent> = this._onDidFilesChange.event;

  private readonly providers = new Map<string, IFileSystemProvider>();

  registerProvider(scheme: string, provider: IFileSystemProvider): IDisposable {
    if (this.providers.has(scheme)) {
      throw new Error(`A provider for scheme ${scheme} is already registered.`);
    }
    this.providers.set(scheme, provider);
    const listener = provider.onDidChangeFile(changes => {
      this._onDidFilesChange.fire(new FileChangesEvent(changes));
    });
    return toDisposable(() => {
      listener.dispose();
      this.providers.delete(scheme);
    });
  }

  private getProvider(scheme: string): IFileSystemProvider {
    const provider = this.providers.get(scheme);
    if (!provider) {
      throw new Error(`No file system provider registered for scheme ${scheme}`);
    }
    return provider;
  }

  async resolve(resource: URI): Promise<IFileStat> {
    return this.getProvider(resource.scheme).stat(resource);
  }

  async readFile(resource: URI): Promise<Uint8Array> {
    return this.getProvider(resource.scheme).readFile(resource);
  }

  async writeFile(resource: URI, content: Uint8Array): Promise<void> {
    const provider = this.getProvider(resource.scheme);
    let exists = true;
    try {
      await provider.stat(resource);
    } catch {
      exists = false;
    }
    await provider.writeFile(resource, content, { create: !exists, overwrite: true });
  }

  async delete(resource: URI, options?: { recursive?: boolean }): Promise<void> {
    await this.getProvider(resource.scheme).delete(resource, { recursive: !!options?.recursive });
  }

  async mkdir(resource: URI): Promise<void> {
    await this.getProvider(resource.scheme).mkdir(resource);
  }

  async readdir(resource: URI): Promise<[string, FileType][]> {
    return this.getProvider(resource.scheme).readdir(resource);
  }

  watch(resource: URI): IDisposable {
    return this.getProvider(resource.scheme).watch(resource, { recursive: true, excludes: [] });
  }
}

registerSingleton(IFileService, FileService, InstantiationType.Delayed);
