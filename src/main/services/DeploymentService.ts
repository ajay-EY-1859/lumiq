import { IDeploymentService } from '@shared/services';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import * as fs from 'fs';
import * as path from 'path';
import { spawn } from 'child_process';

export class DeploymentService implements IDeploymentService {
  async generateIaC(workspacePath: string, target: 'docker' | 'serverless'): Promise<{ filePath: string; content: string }> {
    const pkgJsonPath = path.join(workspacePath, 'package.json');
    let isNextJs = false;
    let isExpress = false;

    if (fs.existsSync(pkgJsonPath)) {
      try {
        const pkg = JSON.parse(fs.readFileSync(pkgJsonPath, 'utf8'));
        const deps = { ...pkg.dependencies, ...pkg.devDependencies };
        if (deps['next']) isNextJs = true;
        if (deps['express']) isExpress = true;
      } catch {
        // ignore
      }
    }

    let content = '';
    let filePath = '';

    if (target === 'docker') {
      filePath = path.join(workspacePath, 'Dockerfile');
      if (isNextJs) {
        content = `
FROM node:18-alpine AS base
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
`.trim();
      } else if (isExpress) {
        content = `
FROM node:18-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install
COPY . .
EXPOSE 8080
CMD ["node", "src/index.js"]
`.trim();
      } else {
        content = `
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install --omit=dev
COPY . .
CMD ["npm", "run", "start"]
`.trim();
      }
    } else {
      filePath = path.join(workspacePath, 'serverless.yml');
      content = `
service: lumiq-deploy-app
provider:
  name: aws
  runtime: nodejs18
  region: us-east-1
functions:
  api:
    handler: handler.handler
    events:
      - http:
          path: /
          method: any
`.trim();
    }

    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(filePath, content, 'utf8');

    return { filePath, content };
  }

  async verifyPreDeployBuild(workspacePath: string): Promise<{ success: boolean; log: string }> {
    return new Promise((resolve) => {
      const isWin = process.platform === 'win32';
      const pkgPath = path.join(workspacePath, 'package.json');
      let script = 'build';
      if (fs.existsSync(pkgPath)) {
        try {
          const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));
          if (pkg.scripts && !pkg.scripts.build && pkg.scripts.compile) {
            script = 'compile';
          }
        } catch {
          // ignore
        }
      }

      const args = isWin ? ['/c', `npm run ${script}`] : ['-c', `npm run ${script}`];
      const shell = isWin ? 'cmd.exe' : 'sh';

      const child = spawn(shell, args, {
        cwd: workspacePath,
        env: { ...process.env, NODE_ENV: 'production' }
      });

      let log = '';

      child.stdout.on('data', (data) => {
        log += data.toString();
      });

      child.stderr.on('data', (data) => {
        log += data.toString();
      });

      child.on('exit', (code) => {
        resolve({
          success: code === 0,
          log
        });
      });

      child.on('error', (err) => {
        resolve({
          success: false,
          log: `Failed to execute build check: ${err.message}`
        });
      });
    });
  }
}

registerSingleton(IDeploymentService, DeploymentService, InstantiationType.Delayed);
