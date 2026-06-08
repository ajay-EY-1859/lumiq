import { IConfigurationService, ConfigurationTarget, IConfigurationChangeEvent } from '@shared/configuration/configuration';
import { Registry } from '@shared/configuration/configurationRegistry';
import { IFileService } from '@shared/files/files';
import { URI } from '@shared/uri';
import { Disposable, IDisposable } from '@shared/lifecycle';
import { Emitter, Event } from '@shared/event';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import { getDatabase } from '../db/database';
import * as path from 'path';

export class ConfigurationChangeEvent implements IConfigurationChangeEvent {
  constructor(private readonly changedKeys: Set<string>) {}

  affectsConfiguration(key: string): boolean {
    return this.changedKeys.has(key);
  }
}

export class ConfigurationService extends Disposable implements IConfigurationService {
  private readonly _onDidChangeConfiguration = this._register(new Emitter<IConfigurationChangeEvent>());
  readonly onDidChangeConfiguration: Event<IConfigurationChangeEvent> = this._onDidChangeConfiguration.event;

  private workspacePath: string | null = null;
  private workspaceWatcher: IDisposable | null = null;

  // Layered configurations
  private defaults: Record<string, any> = {};
  private userConfig: Record<string, any> = {};
  private workspaceConfig: Record<string, any> = {};
  private memoryConfig: Record<string, any> = {};

  // Merged state
  private mergedConfig: Record<string, any> = {};

  constructor(
    @IFileService private readonly fileService: IFileService
  ) {
    super();
    this.defaults = Registry.configuration.getDefaults();
    this.loadUserConfig();
    this.rebuildConfig();
  }

  private loadUserConfig(): void {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT key, value FROM settings').all() as { key: string; value: string }[];
      
      const config: Record<string, any> = {};
      for (const row of rows) {
        const schema = Registry.configuration.getProperty(row.key);
        if (schema) {
          config[row.key] = this.parseValue(row.value, schema.type);
        } else {
          // If not registered in schema, keep as string or try parsing
          config[row.key] = row.value;
        }
      }
      this.userConfig = config;
    } catch (err) {
      console.error('[ConfigurationService] Failed to load user config from DB:', err);
    }
  }

  private parseValue(val: string, type: 'string' | 'boolean' | 'number' | 'object'): any {
    if (type === 'boolean') {
      return val === 'true';
    }
    if (type === 'number') {
      return parseFloat(val);
    }
    if (type === 'object') {
      try {
        return JSON.parse(val);
      } catch {
        return [];
      }
    }
    return val;
  }

  private rebuildConfig(): void {
    const oldConfig = this.mergedConfig;
    this.mergedConfig = {
      ...this.defaults,
      ...this.userConfig,
      ...this.workspaceConfig,
      ...this.memoryConfig
    };

    // Find changed keys
    const changedKeys = new Set<string>();
    const allKeys = new Set([...Object.keys(oldConfig), ...Object.keys(this.mergedConfig)]);
    for (const key of allKeys) {
      if (JSON.stringify(oldConfig[key]) !== JSON.stringify(this.mergedConfig[key])) {
        changedKeys.add(key);
      }
    }

    if (changedKeys.size > 0) {
      this._onDidChangeConfiguration.fire(new ConfigurationChangeEvent(changedKeys));
    }
  }

  getValue<T>(key: string): T {
    return this.mergedConfig[key] as T;
  }

  async updateValue(key: string, value: any, target: ConfigurationTarget = ConfigurationTarget.User): Promise<void> {
    const schema = Registry.configuration.getProperty(key);
    if (value !== undefined && schema) {
      let valType: string = typeof value;
      if (Array.isArray(value)) {
        valType = 'object';
      }
      if (schema.type === 'number') {
        if (typeof value !== 'number' || isNaN(value)) {
          throw new Error(`Invalid type for setting '${key}': Expected number, got ${valType}`);
        }
      } else if (valType !== schema.type) {
        throw new Error(`Invalid type for setting '${key}': Expected ${schema.type}, got ${valType}`);
      }
    }

    if (value === undefined) {
      if (target === ConfigurationTarget.Memory) {
        delete this.memoryConfig[key];
      } else if (target === ConfigurationTarget.User) {
        delete this.userConfig[key];
        try {
          const db = getDatabase();
          db.prepare('DELETE FROM settings WHERE key = ?').run(key);
        } catch (err) {
          console.error(`[ConfigurationService] Failed to delete user setting ${key} from DB:`, err);
        }
      } else if (target === ConfigurationTarget.Workspace) {
        if (!this.workspacePath) {
          throw new Error('Cannot write workspace settings: No active workspace.');
        }
        delete this.workspaceConfig[key];
        await this.saveWorkspaceConfigFile();
      }
      this.rebuildConfig();
      return;
    }

    // Normalize value for internal representation
    let normalizedValue = value;
    if (schema) {
      if (schema.type === 'number') normalizedValue = Number(value);
      if (schema.type === 'boolean') normalizedValue = !!value;
    }

    if (target === ConfigurationTarget.Memory) {
      this.memoryConfig[key] = normalizedValue;
    } else if (target === ConfigurationTarget.User) {
      this.userConfig[key] = normalizedValue;
      
      // Save to SQLite DB
      try {
        const db = getDatabase();
        const dbValue = schema && schema.type === 'object' ? JSON.stringify(normalizedValue) : String(normalizedValue);
        db.prepare('INSERT OR REPLACE INTO settings (key, value) VALUES (?, ?)').run(key, dbValue);
      } catch (err) {
        console.error(`[ConfigurationService] Failed to save user setting ${key} to DB:`, err);
      }
    } else if (target === ConfigurationTarget.Workspace) {
      if (!this.workspacePath) {
        throw new Error('Cannot write workspace settings: No active workspace.');
      }
      this.workspaceConfig[key] = normalizedValue;
      await this.saveWorkspaceConfigFile();
    }

    this.rebuildConfig();
  }

  async setWorkspacePath(pathStr: string | null): Promise<void> {
    if (this.workspaceWatcher) {
      this.workspaceWatcher.dispose();
      this.workspaceWatcher = null;
    }

    this.workspacePath = pathStr;
    this.workspaceConfig = {};

    if (pathStr) {
      const settingsUri = URI.file(path.join(pathStr, '.lumiq', 'settings.json'));
      await this.loadWorkspaceConfigFile(settingsUri);

      // Start watching the settings file
      try {
        this.workspaceWatcher = this.fileService.watch(settingsUri);
        this._register(this.fileService.onDidFilesChange(e => {
          for (const change of e.changes) {
            if (change.resource.toString() === settingsUri.toString()) {
              void this.loadWorkspaceConfigFile(settingsUri).then(() => this.rebuildConfig());
            }
          }
        }));
      } catch {
        // Watched resource may not exist yet, which is fine.
      }
    }

    this.rebuildConfig();
  }

  private async loadWorkspaceConfigFile(uri: URI): Promise<void> {
    try {
      const exists = await this.fileService.resolve(uri).then(() => true).catch(() => false);
      if (exists) {
        const contentBytes = await this.fileService.readFile(uri);
        const contentStr = new TextDecoder().decode(contentBytes);
        this.workspaceConfig = JSON.parse(contentStr);
      } else {
        this.workspaceConfig = {};
      }
    } catch {
      this.workspaceConfig = {};
    }
  }

  private async saveWorkspaceConfigFile(): Promise<void> {
    if (!this.workspacePath) return;
    const settingsUri = URI.file(path.join(this.workspacePath, '.lumiq', 'settings.json'));
    const parentUri = URI.file(path.join(this.workspacePath, '.lumiq'));

    try {
      await this.fileService.mkdir(parentUri);
      const contentStr = JSON.stringify(this.workspaceConfig, null, 2);
      const contentBytes = new TextEncoder().encode(contentStr);
      await this.fileService.writeFile(settingsUri, contentBytes);
    } catch (err) {
      console.error('[ConfigurationService] Failed to save workspace settings:', err);
    }
  }

  override dispose(): void {
    if (this.workspaceWatcher) {
      this.workspaceWatcher.dispose();
    }
    super.dispose();
  }
}

registerSingleton(IConfigurationService, ConfigurationService, InstantiationType.Delayed);
