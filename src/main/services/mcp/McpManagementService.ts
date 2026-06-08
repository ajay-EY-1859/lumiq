import { IMcpManagementService } from '@shared/services';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import { mcpServerManager } from './McpServerManager';
import { getMcpServer } from '../../db/mcpServers';

export class McpManagementService implements IMcpManagementService {
  private allowedServers = new Set<string>(['brave-search', 'postgres-mcp', 'sqlite-explorer']);
  private approvedTools = new Map<string, Set<string>>([
    ['brave-search', new Set(['brave_web_search', 'brave_local_search'])],
    ['sqlite-explorer', new Set(['sqlite_list_tables'])]
  ]);

  // Restart tracking for auto-recovery loops
  private serverCrashesCount = new Map<string, number>();
  private intentionalStops = new Set<string>();

  constructor() {
    mcpServerManager.on('status-change', (change) => {
      if (change.status === 'stopped' || change.status === 'error') {
        if (this.intentionalStops.has(change.serverId)) {
          this.intentionalStops.delete(change.serverId);
        } else {
          // Unexpected exit / crash!
          this.handleServerCrash(change.serverId);
        }
      }
    });
  }

  async startServer(id: string): Promise<void> {
    if (!this.isServerAllowed(id)) {
      throw new Error(`MCP Server ${id} is not approved or allowed by security policy.`);
    }

    const crashes = this.serverCrashesCount.get(id) || 0;
    if (crashes >= 3) {
      throw new Error(`MCP Server ${id} crashed too many times and has been blocked from starting.`);
    }

    // Reset crash count after 5 seconds of healthy running
    setTimeout(() => {
      if (this.getServerStatus(id) === 'running') {
        this.serverCrashesCount.set(id, 0);
      }
    }, 5000);

    this.intentionalStops.delete(id);
    await mcpServerManager.start(id);
  }

  async stopServer(id: string): Promise<void> {
    this.intentionalStops.add(id);
    mcpServerManager.stop(id);
  }

  async restartServer(id: string): Promise<void> {
    this.stopServer(id);
    await new Promise(r => setTimeout(r, 100));
    try {
      if (!getMcpServer(id)) return;
    } catch {
      return;
    }
    await this.startServer(id);
  }

  getServerStatus(id: string): 'running' | 'starting' | 'stopped' | 'error' {
    const list = mcpServerManager.list();
    const server = list.find(s => s.id === id);
    if (!server) return 'stopped';
    if (server.status === 'running') return 'running';
    if (server.status === 'starting') return 'starting';
    if (server.status === 'error') return 'error';
    return 'stopped';
  }

  isServerAllowed(id: string): boolean {
    const server = getMcpServer(id);
    if (!server) return false;
    return this.allowedServers.has(id) || !!server.approved;
  }

  setServerAllowed(id: string, allowed: boolean): void {
    if (allowed) {
      this.allowedServers.add(id);
    } else {
      this.allowedServers.delete(id);
      void this.stopServer(id);
    }
  }

  isToolApproved(serverId: string, toolName: string): boolean {
    if (!this.isServerAllowed(serverId)) return false;
    const tools = this.approvedTools.get(serverId);
    return tools === undefined || tools.has(toolName);
  }

  handleServerCrash(serverId: string): void {
    const crashes = this.serverCrashesCount.get(serverId) || 0;
    this.serverCrashesCount.set(serverId, crashes + 1);

    if (crashes < 2) {
      console.warn(`[McpManagement] Server ${serverId} crashed unexpectedly. Triggering auto-recovery restart...`);
      void this.restartServer(serverId).catch(err => {
        console.error(`[McpManagement] Auto-recovery for ${serverId} failed:`, err);
      });
    } else {
      console.error(`[McpManagement] Server ${serverId} reached crash limit. Auto-restart disabled.`);
    }
  }
}

registerSingleton(IMcpManagementService, McpManagementService, InstantiationType.Delayed);
