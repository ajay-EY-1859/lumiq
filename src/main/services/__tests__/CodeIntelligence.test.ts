import { describe, it, expect } from 'vitest'
import { join } from 'path'
import { writeFileSync, unlinkSync } from 'fs'

const native = require('@lumiq/native')

describe('CodeIntelligence Native AST Parser', () => {
  it('should export parseFileAst function', () => {
    expect(native.parseFileAst).toBeDefined()
    expect(typeof native.parseFileAst).toBe('function')
  })

  it('should parse TypeScript files correctly using tree-sitter', () => {
    const filePath = join(__dirname, 'temp_test_file.ts')
    const content = `
      import { helper } from "./myHelper";
      import defaultVal from "external-lib";

      export interface User {
        id: string;
        name: string;
      }

      export class UserService {
        constructor() {}

        getUser(id: string): User {
          const result = helper(id);
          return { id, name: "Test User" };
        }
      }

      export function fetchUser(id: string) {
        return new UserService().getUser(id);
      }

      const logUser = (user: User) => {
        console.log(user);
      };
    `

    writeFileSync(filePath, content, 'utf8')

    try {
      const result = native.parseFileAst(filePath, content)

      expect(result).toBeDefined()
      expect(result.symbols).toBeDefined()
      expect(result.references).toBeDefined()

      // Verify symbols
      const symbols = result.symbols
      const interfaceSym = symbols.find((s: any) => s.name === 'User' && s.kind === 'Interface')
      const classSym = symbols.find((s: any) => s.name === 'UserService' && s.kind === 'Class')
      const methodSym = symbols.find((s: any) => s.name === 'getUser' && s.kind === 'Method')
      const functionSym = symbols.find((s: any) => s.name === 'fetchUser' && s.kind === 'Function')
      const arrowFunctionSym = symbols.find((s: any) => s.name === 'logUser' && s.kind === 'Function')

      expect(interfaceSym).toBeDefined()
      expect(classSym).toBeDefined()
      expect(methodSym).toBeDefined()
      expect(methodSym.containerName).toBe('UserService')
      expect(functionSym).toBeDefined()
      expect(arrowFunctionSym).toBeDefined()

      // Verify references (imports and calls)
      const references = result.references
      const helperImport = references.find((r: any) => r.targetName === 'helper' && r.kind === 'import')
      const defaultValImport = references.find((r: any) => r.targetName === 'defaultVal' && r.kind === 'import')
      const helperCall = references.find((r: any) => r.targetName === 'helper' && r.kind === 'call')

      expect(helperImport).toBeDefined()
      expect(helperImport.moduleSpecifier).toBe('./myHelper')

      expect(defaultValImport).toBeDefined()
      expect(defaultValImport.moduleSpecifier).toBe('external-lib')

      expect(helperCall).toBeDefined()
    } finally {
      unlinkSync(filePath)
    }
  })

  it('should parse Python files correctly using tree-sitter', () => {
    const filePath = join(__dirname, 'temp_test_file.py')
    const content = `
from .utils import clean_text
import sys

class DataProcessor:
    def __init__(self):
        pass

    def process(self, text):
        clean = clean_text(text)
        print(clean)
        return clean

def run_process():
    processor = DataProcessor()
    processor.process("hello")
`

    writeFileSync(filePath, content, 'utf8')

    try {
      const result = native.parseFileAst(filePath, content)

      expect(result).toBeDefined()

      // Verify symbols
      const symbols = result.symbols
      const classSym = symbols.find((s: any) => s.name === 'DataProcessor' && s.kind === 'Class')
      const methodSym = symbols.find((s: any) => s.name === 'process' && s.kind === 'Method')
      const functionSym = symbols.find((s: any) => s.name === 'run_process' && s.kind === 'Function')

      expect(classSym).toBeDefined()
      expect(methodSym).toBeDefined()
      expect(methodSym.containerName).toBe('DataProcessor')
      expect(functionSym).toBeDefined()

      // Verify references
      const references = result.references
      const importRef = references.find((r: any) => r.targetName === 'clean_text' && r.kind === 'import')
      const dottedImport = references.find((r: any) => r.targetName === 'sys' && r.kind === 'import')
      const callRef = references.find((r: any) => r.targetName === 'clean_text' && r.kind === 'call')

      expect(importRef).toBeDefined()
      expect(importRef.moduleSpecifier).toBe('.utils')

      expect(dottedImport).toBeDefined()
      expect(dottedImport.moduleSpecifier).toBe('sys')

      expect(callRef).toBeDefined()
    } finally {
      unlinkSync(filePath)
    }
  })

  it('should parse Go and Rust files correctly using tree-sitter', () => {
    const rustPath = join(__dirname, 'temp_test_file.rs')
    const rustContent = `
      pub struct UserProfile {
          pub username: String,
      }

      pub fn get_profile(username: &str) -> UserProfile {
          let lowercase = username.to_lowercase();
          UserProfile { username: lowercase }
      }
    `
    const goPath = join(__dirname, 'temp_test_file.go')
    const goContent = `
      package main

      type ServerConfig struct {
          Port int
      }

      func StartServer(port int) {
          println("Server running")
      }
    `

    writeFileSync(rustPath, rustContent, 'utf8')
    writeFileSync(goPath, goContent, 'utf8')

    try {
      const rustResult = native.parseFileAst(rustPath, rustContent)
      const goResult = native.parseFileAst(goPath, goContent)

      // Verify Rust struct and function
      const structSym = rustResult.symbols.find((s: any) => s.name === 'UserProfile' && s.kind === 'Class')
      const fnSym = rustResult.symbols.find((s: any) => s.name === 'get_profile' && s.kind === 'Function')
      expect(structSym).toBeDefined()
      expect(fnSym).toBeDefined()

      // Verify Go struct and function
      const typeSym = goResult.symbols.find((s: any) => s.name === 'ServerConfig' && s.kind === 'Class')
      const goFnSym = goResult.symbols.find((s: any) => s.name === 'StartServer' && s.kind === 'Function')
      expect(typeSym).toBeDefined()
      expect(goFnSym).toBeDefined()
    } finally {
      unlinkSync(rustPath)
      unlinkSync(goPath)
    }
  })

  it('should fall back to regex parsing for unsupported files', () => {
    const filePath = join(__dirname, 'temp_test_file.java')
    const content = `
      public class DatabaseConnector {
          public void connect() {
              System.out.println("Connecting...");
          }
      }

      public interface Connector {
          void connect();
      }

      function globalFunction() {
          return true;
      }
    `

    writeFileSync(filePath, content, 'utf8')

    try {
      const result = native.parseFileAst(filePath, content)

      expect(result).toBeDefined()
      
      const symbols = result.symbols
      const classSym = symbols.find((s: any) => s.name === 'DatabaseConnector' && s.kind === 'Class')
      const interfaceSym = symbols.find((s: any) => s.name === 'Connector' && s.kind === 'Class') // regex maps struct/class/interface to Class
      const fnSym = symbols.find((s: any) => s.name === 'globalFunction' && s.kind === 'Function')

      expect(classSym).toBeDefined()
      expect(interfaceSym).toBeDefined()
      expect(fnSym).toBeDefined()
    } finally {
      unlinkSync(filePath)
    }
  })
})
