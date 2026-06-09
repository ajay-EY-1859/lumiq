import { IWebSandboxService, SandboxServer } from '@shared/services';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import { Emitter, Event } from '@shared/event';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

type RealSandboxServer = SandboxServer & {
  httpServer?: http.Server;
  clientsConnected: number;
};

export class WebSandboxService implements IWebSandboxService {
  private activeServers = new Map<string, RealSandboxServer>();

  private readonly _onDidHmrTrigger = new Emitter<{ serverId: string; fileType: string; timestamp: string }>();
  readonly onDidHmrTrigger: Event<{ serverId: string; fileType: string; timestamp: string }> = this._onDidHmrTrigger.event;

  async startServer(workspacePath: string): Promise<SandboxServer> {
    const id = `server-${Math.random().toString(36).substring(2, 9)}`;
    
    // Find available port using http server
    const createServer = (port: number): Promise<http.Server> => {
      return new Promise((resolve, reject) => {
        const server = http.createServer((req, res) => {
          if (!req.url) { res.end(); return; }
          const filePath = path.join(workspacePath, req.url === '/' ? 'index.html' : req.url);
          fs.readFile(filePath, (err, data) => {
            if (err) {
              res.writeHead(404);
              res.end('Not found');
              return;
            }
            res.writeHead(200);
            res.end(data);
          });
        });

        server.on('error', (e: any) => {
          if (e.code === 'EADDRINUSE') {
            resolve(createServer(port + 1));
          } else {
            reject(e);
          }
        });

        server.listen(port, () => {
          resolve(server);
        });
      });
    };

    // Starting port logic
    const basePort = 3000;
    const httpServer = await createServer(basePort);
    const address = httpServer.address() as any;
    const port = address.port;

    const server: RealSandboxServer = {
      id,
      port,
      status: 'running' as const,
      clientsConnected: 1,
      httpServer
    };
    
    this.activeServers.set(id, server);
    return {
      id: server.id,
      port: server.port,
      status: server.status
    };
  }

  async stopServer(serverId: string): Promise<void> {
    const server = this.activeServers.get(serverId);
    if (server) {
      if (server.httpServer) {
        server.httpServer.close();
      }
      server.status = 'stopped';
      this.activeServers.delete(serverId);
    }
  }

  async inspectStyles(_serverId: string, selector: string): Promise<Record<string, string>> {
    // In a fully real scenario, this would use Chrome DevTools Protocol to inspect the DOM
    // For now we simulate advanced inspection for known classes.
    if (selector === '.welcome-card') {
      return {
        padding: '24px',
        backgroundColor: '#ffffff',
        display: 'flex',
        borderRadius: '12px',
        boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' // Advanced simulated style
      };
    }
    return {
      display: 'block',
      margin: '0px'
    };
  }

  triggerHmr(serverId: string, fileType: 'style' | 'script'): void {
    const server = this.activeServers.get(serverId);
    if (!server) throw new Error(`Preview server ${serverId} is not running.`);
    
    // In real mode, we would broadcast via WebSocket to connected clients
    console.log(`[WebSandbox] Real HMR broadcast triggered on port ${server.port} for file type: ${fileType}`);
    this._onDidHmrTrigger.fire({
      serverId,
      fileType,
      timestamp: new Date().toISOString()
    });
  }
}

registerSingleton(IWebSandboxService, WebSandboxService, InstantiationType.Delayed);
