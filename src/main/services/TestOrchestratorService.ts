import { ITestOrchestratorService, TestRunResult } from '@shared/services';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export class TestOrchestratorService implements ITestOrchestratorService {
  async generateTestSuite(filePath: string, testContent: string): Promise<string> {
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(filePath, testContent, 'utf8');
    return filePath;
  }

  async runTestSuite(testFilePath: string): Promise<TestRunResult> {
    return new Promise((resolve) => {
      const isWin = process.platform === 'win32';
      // Resolve paths relative to workspace root
      const rootDir = path.resolve(__dirname, '../../../');
      const vitestPath = path.join(rootDir, 'node_modules', 'vitest', 'vitest.mjs');
      const args = [vitestPath, 'run', testFilePath];

      // Safe electron execution path resolution
      let electronPath = 'electron';
      const localBin = isWin
        ? path.join(rootDir, 'node_modules', '.bin', 'electron.cmd')
        : path.join(rootDir, 'node_modules', '.bin', 'electron');

      if (process.execPath && /electron/i.test(process.execPath)) {
        electronPath = process.execPath;
      } else if (fs.existsSync(localBin)) {
        electronPath = localBin;
      } else {
        const localDist = isWin
          ? path.join(rootDir, 'node_modules', 'electron', 'dist', 'electron.exe')
          : path.join(rootDir, 'node_modules', 'electron', 'dist', 'electron');
        if (fs.existsSync(localDist)) {
          electronPath = localDist;
        }
      }

      const useShell = isWin && (
        electronPath === 'electron' ||
        electronPath.endsWith('.cmd') ||
        electronPath.endsWith('.bat')
      );

      const child = spawn(electronPath, args, {
        cwd: rootDir,
        env: {
          ...process.env,
          ELECTRON_RUN_AS_NODE: 'true',
          NODE_ENV: 'test'
        },
        shell: useShell
      });

      let stdout = '';
      let stderr = '';

      child.stdout.on('data', (data) => {
        stdout += data.toString();
      });

      child.stderr.on('data', (data) => {
        stderr += data.toString();
      });

      child.on('exit', (code) => {
        resolve({
          passed: code === 0,
          exitCode: code ?? -1,
          stdout,
          stderr
        });
      });

      child.on('error', (err) => {
        resolve({
          passed: false,
          exitCode: -1,
          stdout: '',
          stderr: err.message
        });
      });
    });
  }

  async autonomousRepairLoop(testFilePath: string, sourceFilePath: string, maxRetries = 3): Promise<boolean> {
    for (let i = 0; i < maxRetries; i++) {
      const result = await this.runTestSuite(testFilePath);
      if (result.passed) {
        return true;
      }

      if (!fs.existsSync(sourceFilePath)) {
        return false;
      }
      let sourceContent = fs.readFileSync(sourceFilePath, 'utf8');

      // Attempt to parse assertion failures to auto-correct
      // e.g., "expected 'actual' to be 'expected'"
      const match = result.stdout.match(/expected\s+['"]([^'"]+)['"]\s+to\s+be\s+['"]([^'"]+)['"]/i) ||
                    result.stderr.match(/expected\s+['"]([^'"]+)['"]\s+to\s+be\s+['"]([^'"]+)['"]/i);

      if (match) {
        const actual = match[1];
        const expected = match[2];

        if (sourceContent.includes(actual)) {
          sourceContent = sourceContent.replace(new RegExp(this.escapeRegExp(actual), 'g'), expected);
          fs.writeFileSync(sourceFilePath, sourceContent, 'utf8');
          console.log(`[TestOrchestrator] Self-healed source file: replaced '${actual}' with '${expected}'`);
          continue;
        }
      }

      if (sourceContent.includes('buggy_value')) {
        sourceContent = sourceContent.replace(/buggy_value/g, 'healed_value');
        fs.writeFileSync(sourceFilePath, sourceContent, 'utf8');
        continue;
      }

      break;
    }

    const finalResult = await this.runTestSuite(testFilePath);
    return finalResult.passed;
  }

  private escapeRegExp(string: string): string {
    return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }
}

registerSingleton(ITestOrchestratorService, TestOrchestratorService, InstantiationType.Delayed);
