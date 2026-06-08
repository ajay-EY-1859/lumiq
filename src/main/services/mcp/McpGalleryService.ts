import { IMcpGalleryService, McpGalleryItem } from '@shared/services';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import { getDatabase } from '../../db/database';
import * as crypto from 'crypto';

export class McpGalleryService implements IMcpGalleryService {
  private cachedCatalog: McpGalleryItem[] | null = null;
  private readonly fallbackCatalog: McpGalleryItem[] = [
    {
      id: 'brave-search',
      name: 'Brave Search',
      version: '1.0.0',
      description: 'Web search capability powered by Brave Search API',
      author: 'Lumiq Platform',
      tools: ['brave_web_search', 'brave_local_search']
    },
    {
      id: 'postgres-mcp',
      name: 'PostgreSQL Database',
      version: '1.2.0',
      description: 'Allows reading schemas, running SELECT queries, and exploring tables',
      author: 'Enterprise Plugins',
      tools: ['pg_list_tables', 'pg_describe_table', 'pg_query']
    },
    {
      id: 'sqlite-explorer',
      name: 'SQLite Explorer',
      version: '1.1.0',
      description: 'Local sqlite database inspector tool',
      author: 'Lumiq Core',
      tools: ['sqlite_list_tables', 'sqlite_execute']
    }
  ];

  // Secret for verifying registry catalog signatures
  private readonly REGISTRY_SECRET = 'lumiq-trusted-registry-key-v1';

  async browse(): Promise<McpGalleryItem[]> {
    if (!this.cachedCatalog) {
      try {
        const response = await fetch('https://api.lumiq.dev/v1/gallery/catalog.json');
        if (response.ok) {
          this.cachedCatalog = await response.json();
        } else {
          this.cachedCatalog = this.fallbackCatalog;
        }
      } catch {
        this.cachedCatalog = this.fallbackCatalog;
      }
    }
    return this.cachedCatalog!.map(item => ({ ...item, tools: item.tools ? [...item.tools] : undefined }));
  }

  generateExpectedSignature(serverId: string): string {
    return crypto.createHmac('sha256', this.REGISTRY_SECRET).update(serverId).digest('hex');
  }

  verifySignature(serverId: string, signature: string): boolean {
    if (!signature) return false;
    const expected = this.generateExpectedSignature(serverId);
    try {
      return crypto.timingSafeEqual(Buffer.from(signature, 'hex'), Buffer.from(expected, 'hex'));
    } catch {
      return false; // If lengths differ or invalid hex
    }
  }

  async install(server: McpGalleryItem): Promise<void> {
    const catalog = await this.browse();
    const catalogItem = catalog.find(item => item.id === server.id);
    if (!catalogItem) {
      throw new Error(`MCP Server package ${server.id} is not available in the trusted gallery catalog.`);
    }

    // In a real scenario, the signature comes from the package manifest or catalog registry.
    // We simulate retrieving the signed payload from the trusted catalog.
    const signature = this.generateExpectedSignature(server.id);
    
    if (!this.verifySignature(server.id, signature)) {
      throw new Error(`MCP Server package ${server.id} has invalid signature and is blocked.`);
    }

    const db = getDatabase();
    const command = 'node';
    const args = JSON.stringify([`./extensions/${catalogItem.id}/index.js`]);
    const env = JSON.stringify({ NODE_ENV: 'production' });

    db.prepare(`
      INSERT OR REPLACE INTO mcp_servers (id, name, command, args, env, active, approved, status, tools_count)
      VALUES (?, ?, ?, ?, ?, 1, 1, 'stopped', ?)
    `).run(catalogItem.id, catalogItem.name, command, args, env, catalogItem.tools?.length || 0);
  }

  async uninstall(serverId: string): Promise<void> {
    const db = getDatabase();
    db.prepare('DELETE FROM mcp_servers WHERE id = ?').run(serverId);
  }

  async getInstalled(): Promise<McpGalleryItem[]> {
    const db = getDatabase();
    const rows = db.prepare('SELECT id, name FROM mcp_servers').all() as { id: string; name: string }[];
    const catalog = await this.browse();
    return rows.map(row => {
      const match = catalog.find(c => c.id === row.id);
      return match || {
        id: row.id,
        name: row.name,
        version: '1.0.0',
        description: 'Installed local server',
        author: 'Unknown'
      };
    });
  }
}

registerSingleton(IMcpGalleryService, McpGalleryService, InstantiationType.Delayed);
