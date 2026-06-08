import { ICodeSmellSweeperService, SweeperFinding } from '@shared/services';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export class CodeSmellSweeperService implements ICodeSmellSweeperService {
  async sweep(workspacePath: string): Promise<SweeperFinding[]> {
    const findings: SweeperFinding[] = [];
    const filesList: string[] = [];
    const importGraph = new Map<string, string[]>();

    const scanDir = (dir: string) => {
      try {
        if (!fs.existsSync(dir)) return;
        const entries = fs.readdirSync(dir, { withFileTypes: true });
        for (const entry of entries) {
          const fullPath = path.join(dir, entry.name);
          if (entry.isDirectory()) {
            if (entry.name !== 'node_modules' && !entry.name.startsWith('.')) {
              scanDir(fullPath);
            }
          } else if (entry.isFile()) {
            if (entry.name.endsWith('.ts') && !entry.name.endsWith('.d.ts') && !entry.name.includes('.test.')) {
              const normalizedPath = fullPath.replace(/\\/g, '/');
              filesList.push(normalizedPath);
              this.analyzeFile(normalizedPath, findings, importGraph);
            }
          }
        }
      } catch (err) {
        console.error('[CodeSmellSweeper] Directory scan error:', err);
      }
    };

    scanDir(workspacePath);
    this.detectCircularImports(importGraph, findings);
    return findings;
  }

  async proposeSplit(filePath: string): Promise<{ modules: string[]; proposedCode: Record<string, string> }> {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File ${filePath} not found`);
    }
    const name = path.basename(filePath, path.extname(filePath));
    return {
      modules: [`${name}Types.ts`, `${name}Helper.ts`, `${name}Main.ts`],
      proposedCode: {
        [`${name}Types.ts`]: '// Extracted types and interfaces\n',
        [`${name}Helper.ts`]: '// Helper operations and utilities\n',
        [`${name}Main.ts`]: '// Main service logic\n'
      }
    };
  }

  private analyzeFile(filePath: string, findings: SweeperFinding[], importGraph: Map<string, string[]>): void {
    try {
      const content = fs.readFileSync(filePath, 'utf8');
      const sourceFile = ts.createSourceFile(
        filePath,
        content,
        ts.ScriptTarget.Latest,
        true
      );

      const imports: string[] = [];
      let hasEmitter = false;
      let hasRegister = false;
      let hasDispose = false;
      let onCount = 0;
      let offCount = 0;
      let complexityScore = 1;

      const visit = (node: ts.Node) => {
        // Import Declarations
        if (ts.isImportDeclaration(node) && node.moduleSpecifier) {
          if (ts.isStringLiteral(node.moduleSpecifier)) {
            const modPath = node.moduleSpecifier.text;
            if (modPath.startsWith('.')) {
              const importedFile = path.join(path.dirname(filePath), modPath).replace(/\\/g, '/');
              imports.push(importedFile);
            }
          }
        }

        // Complexity (If, For, While, Case, Conditional)
        if (
          ts.isIfStatement(node) ||
          ts.isForStatement(node) ||
          ts.isForInStatement(node) ||
          ts.isForOfStatement(node) ||
          ts.isWhileStatement(node) ||
          ts.isDoStatement(node) ||
          ts.isCaseClause(node) ||
          ts.isConditionalExpression(node)
        ) {
          complexityScore++;
        }
        
        // Logical operators (&&, ||, ??)
        if (ts.isBinaryExpression(node)) {
          if (
            node.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
            node.operatorToken.kind === ts.SyntaxKind.BarBarToken ||
            node.operatorToken.kind === ts.SyntaxKind.QuestionQuestionToken
          ) {
            complexityScore++;
          }
        }

        // Emitter and dispose patterns
        if (ts.isNewExpression(node) && node.expression.getText() === 'EventEmitter') {
          hasEmitter = true;
        } else if (ts.isNewExpression(node) && node.expression.getText() === 'Emitter') {
          hasEmitter = true;
        }

        // Call Expressions: .on(), .off(), dispose(), etc.
        if (ts.isCallExpression(node)) {
          const exprText = node.expression.getText();
          if (exprText.includes('.on') || exprText.includes('.addListener')) {
            onCount++;
          }
          if (exprText.includes('.off') || exprText.includes('.removeListener') || exprText.includes('.dispose')) {
            offCount++;
          }
          if (exprText === 'dispose') {
            hasDispose = true;
          }
          if (exprText.includes('_register') || exprText.includes('.add')) {
            hasRegister = true;
          }
          
          // Timer leaks: setTimeout/setInterval not assigned
          if ((exprText === 'setTimeout' || exprText === 'setInterval') && node.parent) {
             const isAssigned = ts.isVariableDeclaration(node.parent) || 
                                ts.isPropertyAssignment(node.parent) ||
                                ts.isBinaryExpression(node.parent) ||
                                ts.isReturnStatement(node.parent);
             if (!isAssigned && !exprText.includes('_register')) {
                const { line } = sourceFile.getLineAndCharacterOfPosition(node.getStart());
                findings.push({
                  filePath,
                  line: line + 1,
                  ruleId: 'TIMER_LEAK',
                  message: `Unassigned timer (setTimeout/setInterval) on line ${line + 1}. This can cause leaks if not cleared.`,
                  proposedFix: `const timerId = ${exprText}(...)`
                });
             }
          }
        }

        ts.forEachChild(node, visit);
      };

      visit(sourceFile);
      importGraph.set(filePath, imports);

      // Flag emitter leak
      if (hasEmitter && !hasRegister && !hasDispose) {
        findings.push({
          filePath,
          line: 1,
          ruleId: 'DISPOSABLE_LEAK',
          message: 'File instantiates Emitter but does not register it or implement a dispose pattern. This may leak resources.',
          proposedFix: 'Inherit from Disposable or call _register() on creation'
        });
      }

      // Flag listener leaks
      if (onCount > offCount) {
        findings.push({
          filePath,
          line: 1,
          ruleId: 'LISTENER_LEAK',
          message: `File has event subscription imbalance (subscribed ${onCount} times, unsubscribed/disposed ${offCount} times). This may cause event leak.`,
          proposedFix: 'Ensure every .on() call has matching .off() or is tracked via DisposableStore'
        });
      }

      // Flag high complexity
      if (complexityScore > 5) {
        findings.push({
          filePath,
          line: 1,
          ruleId: 'HIGH_COMPLEXITY',
          message: `Cognitive/Cyclomatic complexity score is too high (${complexityScore} > 5). Consider decomposing this class.`,
          proposedFix: 'Refactor monolithic methods into smaller, pure helpers'
        });
      }
    } catch (err) {
      console.error('Failed to parse AST:', err);
    }
  }

  private detectCircularImports(importGraph: Map<string, string[]>, findings: SweeperFinding[]): void {
    const visited = new Set<string>();
    const stack = new Set<string>();

    const dfs = (file: string, pathStack: string[]) => {
      visited.add(file);
      stack.add(file);
      pathStack.push(file);

      const deps = importGraph.get(file) || [];
      for (const dep of deps) {
        // Resolve path to make sure extension matches (e.g. file.ts vs file)
        const resolvedDep = this.resolveDepPath(file, dep, Array.from(importGraph.keys()));
        if (!resolvedDep) continue;

        if (stack.has(resolvedDep)) {
          const cycleStart = pathStack.indexOf(resolvedDep);
          const cycle = pathStack.slice(cycleStart).concat(resolvedDep).map(p => path.basename(p));
          findings.push({
            filePath: file,
            line: 1,
            ruleId: 'CIRCULAR_IMPORT',
            message: `Circular import dependency detected: ${cycle.join(' -> ')}`,
            proposedFix: 'Decompose shared interfaces to a separate decoupled types file'
          });
        } else if (!visited.has(resolvedDep)) {
          dfs(resolvedDep, pathStack);
        }
      }

      stack.delete(file);
      pathStack.pop();
    };

    for (const file of importGraph.keys()) {
      if (!visited.has(file)) {
        dfs(file, []);
      }
    }
  }

  private resolveDepPath(_srcFile: string, dep: string, allFiles: string[]): string | null {
    // Tries resolving relative module specs into matching filenames
    const possiblePaths = [
      dep,
      `${dep}.ts`,
      `${dep}.js`
    ].map(p => p.replace(/\\/g, '/'));

    for (const p of possiblePaths) {
      if (allFiles.includes(p)) return p;
      // Try resolving relative path matching
      const match = allFiles.find(f => f.endsWith(p) || f.replace(/\.[^/.]+$/, '').endsWith(p));
      if (match) return match;
    }
    return null;
  }
}

registerSingleton(ICodeSmellSweeperService, CodeSmellSweeperService, InstantiationType.Delayed);
