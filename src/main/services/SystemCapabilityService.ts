import { exec } from 'child_process';
import { getDatabase } from '../db/database';
import { Disposable } from '@shared/lifecycle';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import { ISystemCapabilityService, Capability } from '@shared/services';

export class SystemCapabilityService extends Disposable implements ISystemCapabilityService {
  private isScanning = false;

  /**
   * Retrieves all currently cached capabilities from the database.
   */
  public getCapabilities(): Capability[] {
    try {
      const db = getDatabase();
      const rows = db.prepare('SELECT tool_name as toolName, is_installed as isInstalled, version, install_path as installPath, last_checked as lastChecked FROM system_capabilities').all() as any[];
      return rows.map((row) => ({
        toolName: row.toolName,
        isInstalled: row.isInstalled === 1,
        version: row.version,
        installPath: row.installPath,
        lastChecked: row.lastChecked,
      }));
    } catch (err) {
      console.error('[SystemCapabilityService] Failed to load capabilities from database:', err);
      return [];
    }
  }

  /**
   * Performs an asynchronous, non-blocking scan of the host environment capabilities.
   * Runs in the background and caches the results in the database.
   */
  public async scan(): Promise<Capability[]> {
    if (this.isScanning) {
      return this.getCapabilities();
    }
    this.isScanning = true;

    const toolsToCheck = [
      { name: 'node', cmd: 'node -v' },
      { name: 'npm', cmd: 'npm -v' },
      { name: 'python', cmd: 'python --version' },
      { name: 'pip', cmd: 'pip --version' },
      { name: 'rustc', cmd: 'rustc --version' },
      { name: 'cargo', cmd: 'cargo --version' },
      { name: 'go', cmd: 'go version' },
      { name: 'java', cmd: 'java -version' },
      { name: 'javac', cmd: 'javac -version' },
      { name: 'git', cmd: 'git --version' },
      { name: 'docker', cmd: 'docker --version' }
    ];

    console.log('[SystemCapabilityService] Starting environment capabilities scan...');
    const results: Capability[] = [];

    // Execute checks sequentially with a slight yield (20ms) to avoid CPU spikes on startup
    for (const tool of toolsToCheck) {
      try {
        const capability = await this.checkTool(tool.name, tool.cmd);
        results.push(capability);
      } catch {
        results.push({
          toolName: tool.name,
          isInstalled: false,
          version: null,
          installPath: null
        });
      }
      // Yield to the event loop
      await new Promise((resolve) => setTimeout(resolve, 20));
    }

    // Save results to database
    try {
      const db = getDatabase();
      const insertStmt = db.prepare(`
        INSERT INTO system_capabilities (tool_name, is_installed, version, install_path, last_checked)
        VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
        ON CONFLICT(tool_name) DO UPDATE SET
          is_installed = excluded.is_installed,
          version = excluded.version,
          install_path = excluded.install_path,
          last_checked = CURRENT_TIMESTAMP
      `);

      const transaction = db.transaction((caps: Capability[]) => {
        for (const cap of caps) {
          insertStmt.run(
            cap.toolName,
            cap.isInstalled ? 1 : 0,
            cap.version,
            cap.installPath
          );
        }
      });

      transaction(results);
      console.log('[SystemCapabilityService] Environment capabilities scan complete and cached in DB.');
    } catch (err) {
      console.error('[SystemCapabilityService] Failed to cache scan results in database:', err);
    }

    this.isScanning = false;
    return results;
  }

  /**
   * Generates actionable recommendations based on files found in the active workspace.
   * Compares workspace languages against missing system toolchains.
   */
  public getRecommendations(workspaceFiles: string[]): string[] {
    const caps = this.getCapabilities();
    const capMap = new Map(caps.map((c) => [c.toolName, c.isInstalled]));
    const recommendations: string[] = [];

    const hasExt = (exts: string[]) => {
      return workspaceFiles.some((f) => {
        const ext = f.split('.').pop()?.toLowerCase();
        return ext ? exts.includes(ext) : false;
      });
    };

    // 1. Python check
    if (hasExt(['py']) && !capMap.get('python')) {
      recommendations.push(
        'We detected Python files in your workspace, but Python is not installed or configured in your system PATH. We highly recommend installing Python (https://python.org) to enable full execution, diagnostics, and debugging capabilities.'
      );
    }

    // 2. Node/JS check
    if (hasExt(['js', 'jsx', 'ts', 'tsx', 'json']) && !capMap.get('node')) {
      recommendations.push(
        'We detected JavaScript/TypeScript files in your workspace, but Node.js was not found. Please install Node.js (https://nodejs.org) to run scripts, build your project, and activate high-precision autocomplete ghost-text.'
      );
    }

    // 3. Rust check
    if (hasExt(['rs', 'toml']) && !capMap.get('rustc')) {
      recommendations.push(
        'We detected Rust files in your workspace, but Rust/Cargo are not installed. We recommend installing Rust via rustup (https://rustup.rs) to enable complete diagnostics, dependency building, and static analysis.'
      );
    }

    // 4. Go check
    if (hasExt(['go']) && !capMap.get('go')) {
      recommendations.push(
        'We detected Go files in your workspace, but the Go compiler was not found. We recommend installing Go (https://go.dev) to build, run tests, and browse complete definitions.'
      );
    }

    // 5. Java check
    if (hasExt(['java', 'kt', 'gradle', 'xml']) && !capMap.get('javac')) {
      recommendations.push(
        'We detected Java/Kotlin files in your workspace, but a Java Compiler (JDK) was not found. We recommend installing a JDK (e.g. OpenJDK) to compile your code and activate full language capabilities.'
      );
    }

    // 6. Git check
    if (!capMap.get('git')) {
      recommendations.push(
        'Git is not installed or configured. We highly recommend installing Git (https://git-scm.com) to enable source control, branch diff reviews, and versioning inside Lumiq.'
      );
    }

    return recommendations;
  }

  /**
   * Helper to execute a CLI command with short timeout to check if a tool exists.
   */
  private checkTool(name: string, checkCmd: string): Promise<Capability> {
    return new Promise((resolve) => {
      exec(checkCmd, { timeout: 1500, windowsHide: true }, (err, stdout, stderr) => {
        if (err) {
          resolve({
            toolName: name,
            isInstalled: false,
            version: null,
            installPath: null
          });
          return;
        }

        // Clean up version string
        const output = (stdout || stderr || '').trim();
        let version: string | null = null;

        if (name === 'node' || name === 'npm') {
          version = output.startsWith('v') ? output : 'v' + output;
        } else if (name === 'python') {
          version = output.replace('Python ', '');
        } else if (name === 'go') {
          const match = output.match(/go(\d+\.\d+\.\d+)/)
          version = match ? match[1] : output;
        } else if (name === 'git') {
          const match = output.match(/git version (\d+\.\d+\.\d+)/)
          version = match ? match[1] : output;
        } else if (name === 'rustc' || name === 'cargo') {
          const parts = output.split(' ');
          version = parts[1] || output;
        } else {
          version = output.split('\n')[0]?.trim() || 'Installed';
        }

        // Fetch command location where possible
        const whereCmd = process.platform === 'win32' ? `where ${name}` : `which ${name}`;
        exec(whereCmd, { timeout: 1000, windowsHide: true }, (pathErr, pathStdout) => {
          const installPath = !pathErr && pathStdout ? pathStdout.split('\n')[0]?.trim() : null;
          resolve({
            toolName: name,
            isInstalled: true,
            version: version || 'Installed',
            installPath
          });
        });
      });
    });
  }
}

// Register as an eager singleton so it is instantiated immediately during container boot
registerSingleton(ISystemCapabilityService, SystemCapabilityService, InstantiationType.Eager);
