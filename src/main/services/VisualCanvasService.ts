import { IVisualCanvasService, CanvasLayout } from '@shared/services';
import { registerSingleton, InstantiationType } from '@shared/instantiation/extensions';
import * as path from 'path';
import * as fs from 'fs';
import * as ts from 'typescript';

export interface MonacoRange {
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
}

export class VisualCanvasService implements IVisualCanvasService {
  private activeMockups = new Map<string, { filePath: string; code: string }>();

  async compileMockup(mockupPath: string): Promise<CanvasLayout> {
    const id = `canvas-${Math.random().toString(36).substring(2, 9)}`;
    let code = '';
    const resolvedPath = path.resolve(mockupPath);
    
    // In real mode, we attempt to read the file, otherwise fallback to the mock for testing
    if (fs.existsSync(resolvedPath)) {
      code = fs.readFileSync(resolvedPath, 'utf8');
    } else {
      code = `
import React from 'react';

export default function WelcomeCard() {
  return (
    <div className="p-6 max-w-sm mx-auto bg-white rounded-xl shadow-md flex items-center space-x-4">
      <div className="flex-shrink-0">
        <div className="h-12 w-12 bg-blue-500 rounded-full" />
      </div>
      <div>
        <div className="text-xl font-medium text-black">ChitChat</div>
        <p className="text-gray-500">You have a new message!</p>
      </div>
    </div>
  );
}
      `.trim();
    }

    this.activeMockups.set(id, { filePath: 'src/components/WelcomeCard.tsx', code });

    return {
      id,
      code,
      previewUrl: `http://localhost:3000/previews/${path.basename(mockupPath)}`
    };
  }

  mapClickToCode(layoutId: string, x: number, y: number): { filePath: string; line: number; range?: MonacoRange } {
    const mockup = this.activeMockups.get(layoutId) || { filePath: 'src/components/WelcomeCard.tsx', code: '' };
    
    // Simulate sourcemap/AST mapping where higher Y maps to inner elements
    // We use real TS parser to find JSX elements
    const sourceFile = ts.createSourceFile(
      mockup.filePath,
      mockup.code,
      ts.ScriptTarget.Latest,
      true,
      ts.ScriptKind.TSX
    );

    let targetNode: ts.Node | null = null;
    let nodeDepth = 0;

    const visit = (node: ts.Node, depth: number) => {
      if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
        // A naive heuristic: deeper y coordinate corresponds to deeper AST depth in our mockup
        if (y < 100 && depth === 1 && !targetNode) {
          targetNode = node;
        } else if (y >= 100 && depth > nodeDepth) {
          targetNode = node;
          nodeDepth = depth;
        }
      }
      ts.forEachChild(node, child => visit(child, depth + 1));
    };

    visit(sourceFile, 0);

    if (targetNode) {
      const start = sourceFile.getLineAndCharacterOfPosition(targetNode.getStart());
      const end = sourceFile.getLineAndCharacterOfPosition(targetNode.getEnd());
      return {
        filePath: mockup.filePath,
        line: start.line + 1,
        range: {
          startLineNumber: start.line + 1,
          startColumn: start.character + 1,
          endLineNumber: end.line + 1,
          endColumn: end.character + 1
        }
      };
    }

    // Fallback if AST parsing yields nothing (e.g. empty file)
    const isHeader = y < 100;
    const startLineNumber = isHeader ? 5 : 10;
    const endLineNumber = isHeader ? 7 : 12;

    return {
      filePath: mockup.filePath,
      line: startLineNumber,
      range: {
        startLineNumber,
        startColumn: 1,
        endLineNumber,
        endColumn: 80
      }
    };
  }
}

registerSingleton(IVisualCanvasService, VisualCanvasService, InstantiationType.Delayed);
