import { IMcpResourceScannerService, McpResource } from '@shared/services';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';

export interface IMcpResourceProvider {
  scan(): Promise<McpResource[]>;
  read(uri: string): Promise<string>;
}

export class McpResourceScannerService implements IMcpResourceScannerService {
  private mockResources = new Map<string, McpResource[]>([
    [
      'postgres-mcp',
      [
        { uri: 'postgres://schema/public', name: 'public schema', description: 'Default public database schema tables', mimeType: 'application/json' },
        { uri: 'postgres://tables/users', name: 'users table', description: 'Table containing user records and metadata', mimeType: 'application/json' }
      ]
    ],
    [
      'sqlite-explorer',
      [
        { uri: 'sqlite://schema/main', name: 'main schema', description: 'SQLite main db schema', mimeType: 'application/json' }
      ]
    ]
  ]);

  private providers = new Map<string, IMcpResourceProvider[]>();

  registerResourceProvider(serverId: string, provider: IMcpResourceProvider): void {
    const list = this.providers.get(serverId) || [];
    list.push(provider);
    this.providers.set(serverId, list);
  }

  async scanResources(serverId: string): Promise<McpResource[]> {
    const statics = this.mockResources.get(serverId) || [];
    const dynamics: McpResource[] = [];
    const provs = this.providers.get(serverId) || [];
    for (const p of provs) {
      try {
        const resList = await p.scan();
        dynamics.push(...resList);
      } catch (err) {
        console.error(`[McpResourceScanner] Dynamic provider scan error:`, err);
      }
    }
    return [...statics, ...dynamics];
  }

  async getResourceContent(serverId: string, resourceUri: string): Promise<string> {
    const provs = this.providers.get(serverId) || [];
    for (const p of provs) {
      try {
        const resList = await p.scan();
        if (resList.some(r => r.uri === resourceUri)) {
          return await p.read(resourceUri);
        }
      } catch {
        // ignore and try next
      }
    }

    const list = this.mockResources.get(serverId) || [];
    const found = list.find(r => r.uri === resourceUri);
    if (!found) {
      throw new Error(`Resource ${resourceUri} not found on server ${serverId}`);
    }
    return JSON.stringify({
      uri: found.uri,
      name: found.name,
      columns: found.uri.includes('users') ? ['id', 'email', 'name', 'created_at'] : ['table_name', 'column_name']
    });
  }
}

registerSingleton(IMcpResourceScannerService, McpResourceScannerService, InstantiationType.Delayed);
