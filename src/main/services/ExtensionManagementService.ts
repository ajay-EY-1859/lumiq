import { app } from 'electron';
import fs from 'node:fs';
import path from 'node:path';
import { IExtensionDescription, IExtensionManagementService } from '@shared/extensions/extensions';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import { getDatabase } from '../db/database';

export class ExtensionManagementService implements IExtensionManagementService {
  private installedExtensions: IExtensionDescription[] = [];
  private allowlist: Set<string> = new Set();

  constructor() {}

  isAllowed(extensionId: string): boolean {
    if (this.allowlist.size === 0) {
      return true;
    }
    return this.allowlist.has(extensionId);
  }

  setAllowlist(extensionIds: string[]): void {
    this.allowlist = new Set(extensionIds);
  }

  getInstalledExtensions(): IExtensionDescription[] {
    return this.installedExtensions;
  }

  async scanExtensions(): Promise<IExtensionDescription[]> {
    const extensions: IExtensionDescription[] = [];
    const scannedPaths: string[] = [];

    // 1. User extensions directory
    try {
      const userExtPath = path.join(app.getPath('userData'), 'extensions');
      if (!fs.existsSync(userExtPath)) {
        fs.mkdirSync(userExtPath, { recursive: true });
      }
      scannedPaths.push(userExtPath);
    } catch (err) {
      console.error('[ExtensionManagement] Error getting user extensions path:', err);
    }

    // 2. Active workspace extensions directory
    try {
      const db = getDatabase();
      const activeSession = db.prepare("SELECT workspace_path FROM sessions ORDER BY updated_at DESC LIMIT 1").get() as { workspace_path?: string } | undefined;
      if (activeSession?.workspace_path && fs.existsSync(activeSession.workspace_path)) {
        const workspaceDotLumiqExt = path.join(activeSession.workspace_path, '.lumiq', 'extensions');
        if (fs.existsSync(workspaceDotLumiqExt)) {
          scannedPaths.push(workspaceDotLumiqExt);
        }
        const workspaceExt = path.join(activeSession.workspace_path, 'extensions');
        if (fs.existsSync(workspaceExt)) {
          scannedPaths.push(workspaceExt);
        }
      }
    } catch (err) {
      console.error('[ExtensionManagement] Error getting workspace extensions path:', err);
    }

    // Scan each directory
    for (const scanDir of scannedPaths) {
      try {
        const entries = fs.readdirSync(scanDir, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            const extDir = path.join(scanDir, entry.name);
            const packageJsonPath = path.join(extDir, 'package.json');
            if (fs.existsSync(packageJsonPath)) {
              try {
                const rawManifest = fs.readFileSync(packageJsonPath, 'utf8');
                const pkg = JSON.parse(rawManifest);
                if (pkg.name && pkg.version && pkg.main) {
                  const id = `${pkg.publisher || 'local'}.${pkg.name}`;
                  
                  // Skip if already scanned
                  if (extensions.some(e => e.id === id)) {
                    continue;
                  }

                  if (!this.isAllowed(id)) {
                    console.warn(`[ExtensionManagement] Extension ${id} is not allowed by policy.`);
                    continue;
                  }

                  const activationEvents = Array.isArray(pkg.activationEvents) ? pkg.activationEvents : [];

                  extensions.push({
                    id,
                    name: pkg.name,
                    version: pkg.version,
                    publisher: pkg.publisher,
                    description: pkg.description,
                    main: pkg.main,
                    extensionPath: extDir,
                    activationEvents,
                    engines: pkg.engines
                  });
                }
              } catch (err) {
                console.error(`[ExtensionManagement] Failed to parse package.json in ${extDir}:`, err);
              }
            }
          }
        }
      } catch (err) {
        console.error(`[ExtensionManagement] Failed to read extensions directory ${scanDir}:`, err);
      }
    }

    this.installedExtensions = extensions;
    return extensions;
  }
}

registerSingleton(IExtensionManagementService, ExtensionManagementService, InstantiationType.Delayed);
