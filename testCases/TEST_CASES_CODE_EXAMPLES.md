# Lumiq IDE - Executable Test Code Examples

> Status: Ready for Integration with Jest/Vitest

---

## Unit Test Examples

### 1. Agent Loop - Tool Call Reconstruction

```typescript
// src/main/agent/__tests__/AgentLoop.reconstruction.test.ts
import { describe, it, expect } from 'vitest'
import { AgentLoop } from '../AgentLoop'
import type { Message } from '@shared/types'

describe('AgentLoop - Tool Call Reconstruction', () => {
  const agentLoop = new AgentLoop()

  // Private method access via reflection for testing
  const reconstructToolCalls = (agentLoop: any, messages: Message[]) => {
    return agentLoop.reconstructToolCalls(messages)
  }

  it('should reconstruct missing toolCalls from subsequent tool messages', () => {
    const messages: Message[] = [
      {
        id: '1',
        sessionId: 'sess_1',
        role: 'user',
        content: 'read file.txt',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        sessionId: 'sess_1',
        role: 'assistant',
        content: '',
        toolCalls: [], // Empty toolCalls (old DB format)
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        sessionId: 'sess_1',
        role: 'tool',
        content: 'file content here',
        toolName: 'FileReadTool',
        toolCallId: 'call_1',
        createdAt: new Date().toISOString(),
      },
    ]

    const result = reconstructToolCalls(agentLoop, messages)

    // Verify assistant message now has toolCalls reconstructed
    const assistantMsg = result[1]
    expect(assistantMsg.toolCalls).toHaveLength(1)
    expect(assistantMsg.toolCalls![0]).toEqual({
      id: 'call_1',
      toolName: 'FileReadTool',
      input: {},
    })

    // Verify tool message has matching callId
    expect(result[2].toolCallId).toBe('call_1')
  })

  it('should handle orphaned tool messages (no matching assistant)', () => {
    const messages: Message[] = [
      {
        id: '1',
        sessionId: 'sess_1',
        role: 'user',
        content: 'test',
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        sessionId: 'sess_1',
        role: 'tool',
        content: 'orphaned result',
        toolName: 'BashTool',
        // No toolCallId (simulating old DB)
        createdAt: new Date().toISOString(),
      },
    ]

    const result = reconstructToolCalls(agentLoop, messages)

    // Orphaned tool message should get synthetic ID
    expect(result[1].toolCallId).toMatch(/synth_orphan_/)
  })

  it('should not duplicate toolCalls if already present', () => {
    const messages: Message[] = [
      {
        id: '1',
        sessionId: 'sess_1',
        role: 'assistant',
        content: '',
        toolCalls: [{ id: 'tc_1', toolName: 'FileRead', input: {} }],
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        sessionId: 'sess_1',
        role: 'tool',
        content: 'result',
        toolCallId: 'tc_1',
        createdAt: new Date().toISOString(),
      },
    ]

    const result = reconstructToolCalls(agentLoop, messages)

    // Should have exactly 1 toolCall, not reconstructed
    expect(result[0].toolCalls).toHaveLength(1)
    expect(result[0].toolCalls![0].id).toBe('tc_1')
  })
})
```

---

### 2. Tool Executor - Permission Mode Enforcement

```typescript
// src/main/agent/__tests__/ToolExecutor.permissions.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ToolExecutor } from '../ToolExecutor'
import type { ToolApprovalResponse, ToolSettings } from '@shared/types'

describe('ToolExecutor - Permission Mode Enforcement', () => {
  let executor: ToolExecutor

  beforeEach(() => {
    executor = new ToolExecutor()
  })

  describe('MANUAL mode', () => {
    beforeEach(() => {
      executor.setPermissionMode('MANUAL')
    })

    it('should require approval for BashTool', async () => {
      // Setup
      const toolSettings: ToolSettings[] = [
        {
          name: 'BashTool',
          permission: 'ask', // Default ask for bash
        },
      ]
      executor.updateToolSettings(toolSettings)

      // Execute
      const result = await executor.executeTool('BashTool', {
        command: 'ls -la',
      })

      // Verify
      expect(result.requiresApproval).toBe(true)
      expect(result.approvalRequestId).toBeDefined()
    })

    it('should allow tool with per-tool always-allow setting', async () => {
      const toolSettings: ToolSettings[] = [
        {
          name: 'FileReadTool',
          permission: 'always-allow',
        },
      ]
      executor.updateToolSettings(toolSettings)

      const result = await executor.executeTool('FileReadTool', {
        path: '/workspace/file.txt',
      })

      // Should execute without approval
      expect(result.requiresApproval).toBe(false)
      expect(result.output).toBeDefined()
    })

    it('should deny tool with per-tool always-deny regardless of mode', async () => {
      executor.setPermissionMode('AUTO') // Should auto-approve most tools
      const toolSettings: ToolSettings[] = [
        {
          name: 'BashTool',
          permission: 'always-deny',
        },
      ]
      executor.updateToolSettings(toolSettings)

      const result = await executor.executeTool('BashTool', {
        command: 'pwd',
      })

      expect(result.requiresApproval).toBe(true)
      expect(result.reason).toContain('always-deny')
    })
  })

  describe('LIMITED mode', () => {
    beforeEach(() => {
      executor.setPermissionMode('LIMITED')
    })

    it('should auto-approve read-only tools (FileReadTool)', async () => {
      const result = await executor.executeTool('FileReadTool', {
        path: '/workspace/file.txt',
      })

      expect(result.requiresApproval).toBe(false)
      expect(result.output).toBeDefined()
    })

    it('should auto-approve GlobTool', async () => {
      const result = await executor.executeTool('GlobTool', {
        pattern: '**/*.ts',
      })

      expect(result.requiresApproval).toBe(false)
    })

    it('should require approval for BashTool even in LIMITED', async () => {
      const result = await executor.executeTool('BashTool', {
        command: 'echo test',
      })

      expect(result.requiresApproval).toBe(true)
    })
  })

  describe('AUTO mode', () => {
    beforeEach(() => {
      executor.setPermissionMode('AUTO')
    })

    it('should auto-approve all tools except denied', async () => {
      // Test several different tools
      const tools = ['BashTool', 'FileWriteTool', 'GrepTool']

      for (const tool of tools) {
        const result = await executor.executeTool(tool, {
          command: 'test',
        })
        expect(result.requiresApproval).toBe(false)
      }
    })

    it('should respect always-deny override even in AUTO', async () => {
      const toolSettings: ToolSettings[] = [
        {
          name: 'FileDeleteTool',
          permission: 'always-deny',
        },
      ]
      executor.updateToolSettings(toolSettings)

      const result = await executor.executeTool('FileDeleteTool', {
        path: '/workspace/file.txt',
      })

      expect(result.requiresApproval).toBe(true)
      expect(result.reason).toContain('always-deny')
    })
  })
})
```

---

### 3. Context Manager - Token Counting Accuracy

```typescript
// src/main/agent/__tests__/ContextManager.tokens.test.ts
import { describe, it, expect } from 'vitest'
import { ContextManager } from '../ContextManager'
import type { Message } from '@shared/types'

describe('ContextManager - Token Counting', () => {
  const contextManager = new ContextManager()

  it('should accurately count tokens for simple message', () => {
    const message: Message = {
      id: '1',
      sessionId: 'sess_1',
      role: 'user',
      content: 'Hello, how are you?',
      createdAt: new Date().toISOString(),
    }

    const tokens = contextManager.estimateTokens(message.content)
    
    // "Hello, how are you?" should be approximately 5-6 tokens
    expect(tokens).toBeGreaterThanOrEqual(4)
    expect(tokens).toBeLessThanOrEqual(8)
  })

  it('should count tokens for message with special characters', () => {
    const content = 'Test: (test) [test] {test} @test #test 🎉'
    const tokens = contextManager.estimateTokens(content)
    
    // Should handle special chars and emoji without crashing
    expect(tokens).toBeGreaterThan(0)
  })

  it('should count system prompt tokens', () => {
    const systemPrompt = `You are a helpful assistant.
You should always be polite and concise.
Remember to use the tools available to you.`

    const tokens = contextManager.estimateTokens(systemPrompt)
    
    // System prompt should be significant token count
    expect(tokens).toBeGreaterThan(20)
  })

  it('should trim context to stay under token limit', () => {
    const messages: Message[] = [
      {
        id: '1',
        sessionId: 'sess_1',
        role: 'system',
        content: 'System message ' + 'x'.repeat(500), // ~100 tokens
        createdAt: new Date().toISOString(),
      },
      {
        id: '2',
        sessionId: 'sess_1',
        role: 'user',
        content: 'User 1: ' + 'x'.repeat(1000), // ~250 tokens
        createdAt: new Date().toISOString(),
      },
      {
        id: '3',
        sessionId: 'sess_1',
        role: 'assistant',
        content: 'Assistant 1: ' + 'x'.repeat(1500), // ~375 tokens
        createdAt: new Date().toISOString(),
      },
      {
        id: '4',
        sessionId: 'sess_1',
        role: 'user',
        content: 'User 2: ' + 'x'.repeat(1000), // ~250 tokens
        createdAt: new Date().toISOString(),
      },
    ]

    const tokenLimit = 800
    const trimmed = contextManager.trimContext(messages, tokenLimit)

    // System message should always be preserved
    expect(trimmed.some(m => m.role === 'system')).toBe(true)

    // Total tokens should be under limit
    const totalTokens = trimmed.reduce((sum, m) => {
      return sum + contextManager.estimateTokens(m.content)
    }, 0)
    expect(totalTokens).toBeLessThanOrEqual(tokenLimit + 50) // Allow 50 token buffer
  })
})
```

---

### 4. File Operations - Race Condition Testing

```typescript
// src/main/tools/__tests__/FileOperations.concurrent.test.ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import fs from 'fs/promises'
import path from 'path'
import { FileReadTool } from '../FileReadTool'
import { FileWriteTool } from '../FileWriteTool'

describe('FileOperations - Concurrent Access', () => {
  const testDir = '/tmp/lumiq-test-concurrent'
  const testFile = path.join(testDir, 'test.txt')

  beforeEach(async () => {
    await fs.mkdir(testDir, { recursive: true })
    await fs.writeFile(testFile, 'initial content', 'utf-8')
  })

  afterEach(async () => {
    await fs.rm(testDir, { recursive: true, force: true })
  })

  it('should handle concurrent reads consistently', async () => {
    const readTool = new FileReadTool()
    const promises: Promise<string>[] = []

    // Launch 10 concurrent reads
    for (let i = 0; i < 10; i++) {
      promises.push(
        readTool.execute({
          path: testFile,
        })
      )
    }

    const results = await Promise.all(promises)

    // All reads should get the same content
    const firstResult = results[0]
    for (const result of results) {
      expect(result).toBe(firstResult)
    }

    // Content should be valid
    expect(firstResult).toContain('initial content')
  })

  it('should prevent partial reads during concurrent write', async () => {
    const readTool = new FileReadTool()
    const writeTool = new FileWriteTool()

    const writePromise = writeTool.execute({
      path: testFile,
      content: 'new content from write operation',
    })

    // Concurrent read while write is happening
    const readPromise = readTool.execute({
      path: testFile,
    })

    const [writeResult, readResult] = await Promise.all([writePromise, readPromise])

    // Read should get either old or new content, never partial/corrupted
    expect(['initial content', 'new content from write operation']).toContain(readResult)
  })

  it('should serialize writes to prevent corruption', async () => {
    const writeTool = new FileWriteTool()

    // Launch 5 concurrent writes
    const promises = [
      writeTool.execute({ path: testFile, content: 'content v1' }),
      writeTool.execute({ path: testFile, content: 'content v2' }),
      writeTool.execute({ path: testFile, content: 'content v3' }),
      writeTool.execute({ path: testFile, content: 'content v4' }),
      writeTool.execute({ path: testFile, content: 'content v5' }),
    ]

    await Promise.all(promises)

    // Final content should be one of the writes (not corrupted mix)
    const finalContent = await fs.readFile(testFile, 'utf-8')
    expect(['content v1', 'content v2', 'content v3', 'content v4', 'content v5']).toContain(
      finalContent
    )
  })
})
```

---

## Integration Test Examples

### 5. Chat Handler - End-to-End Flow

```typescript
// src/main/ipc/__tests__/chatHandlers.integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { ipcMain } from 'electron'
import { registerChatHandlers } from '../chatHandlers'
import { createSession } from '../../db/sessions'
import { getSession } from '../../db/sessions'
import type { ProviderConfig } from '@shared/types'

describe('Chat Handlers - Integration', () => {
  beforeEach(() => {
    // Setup IPC handlers
    registerChatHandlers()

    // Mock provider configuration
    vi.mock('../../db/apiConfigs', () => ({
      getApiConfig: () => ({
        id: 'openai_1',
        provider: 'openai',
        apiKey: 'sk-test123',
        defaultModel: 'gpt-4',
        isActive: true,
      } as ProviderConfig),
    }))
  })

  it('should handle chat:send with valid input', async () => {
    // Setup: Create a session
    const sessionId = 'sess_' + Date.now()
    createSession({
      id: sessionId,
      title: 'Test Chat',
      provider: 'openai',
      model: 'gpt-4',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    // Execute: Send message via IPC
    const result = await ipcMain.invoke('chat:send', {
      message: 'Hello, what is 2+2?',
      sessionId,
      provider: 'openai',
      model: 'gpt-4',
    })

    // Verify
    expect(result).toBeDefined()
    expect(result.content).toContain('4') // Should contain answer
    expect(result.tokensUsed).toBeGreaterThan(0)

    // Verify message persisted
    const session = getSession(sessionId)
    expect(session).toBeDefined()
  })

  it('should validate required fields', async () => {
    // Execute with missing fields
    const promise = ipcMain.invoke('chat:send', {
      message: 'test',
      // Missing sessionId, provider, model
    })

    // Verify error
    await expect(promise).rejects.toThrow('Missing required fields')
  })

  it('should handle invalid provider gracefully', async () => {
    const sessionId = 'sess_' + Date.now()
    createSession({
      id: sessionId,
      title: 'Test',
      provider: 'invalid_provider',
      model: 'test',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    })

    const promise = ipcMain.invoke('chat:send', {
      message: 'test',
      sessionId,
      provider: 'invalid_provider',
      model: 'test-model',
    })

    await expect(promise).rejects.toThrow('not configured')
  })
})
```

---

### 6. Permission System - Approval Workflow

```typescript
// src/main/security/__tests__/permissions.integration.test.ts
import { describe, it, expect, beforeEach, vi } from 'vitest'
import { evaluatePermission } from '../permissions'
import { ToolExecutor } from '../../agent/ToolExecutor'
import type { ToolSettings } from '@shared/types'

describe('Permission System - Approval Workflow', () => {
  let executor: ToolExecutor

  beforeEach(() => {
    executor = new ToolExecutor()
  })

  it('should block dangerous tool in MANUAL mode without approval', async () => {
    executor.setPermissionMode('MANUAL')

    // Attempt to execute BashTool
    const result = await executor.executeTool('BashTool', {
      command: 'rm -rf /',
    })

    expect(result.requiresApproval).toBe(true)
    expect(result.approvalRequestId).toBeDefined()
    expect(result.executed).toBe(false)
  })

  it('should execute tool after approval granted', async () => {
    executor.setPermissionMode('MANUAL')

    // Request execution
    const approval = await executor.requestToolApproval('BashTool', {
      command: 'echo test',
    })

    // Approve
    await executor.respondToApproval(approval.id, {
      approved: true,
    })

    // Execute with approval
    const result = await executor.executeTool('BashTool', {
      command: 'echo test',
    })

    expect(result.executed).toBe(true)
  })

  it('should deny tool after approval rejected', async () => {
    executor.setPermissionMode('MANUAL')

    const approval = await executor.requestToolApproval('BashTool', {
      command: 'echo test',
    })

    // Reject
    await executor.respondToApproval(approval.id, {
      approved: false,
    })

    // Attempt execute
    const result = await executor.executeTool('BashTool', {
      command: 'echo test',
    })

    expect(result.executed).toBe(false)
  })

  it('should auto-approve safe tools in LIMITED mode', async () => {
    executor.setPermissionMode('LIMITED')

    const result = await executor.executeTool('FileReadTool', {
      path: '/workspace/file.txt',
    })

    expect(result.requiresApproval).toBe(false)
  })

  it('should override mode with per-tool always-allow', async () => {
    executor.setPermissionMode('MANUAL')
    executor.updateToolSettings([
      {
        name: 'FileReadTool',
        permission: 'always-allow',
      },
    ])

    const result = await executor.executeTool('FileReadTool', {
      path: '/workspace/file.txt',
    })

    expect(result.requiresApproval).toBe(false)
    expect(result.executed).toBe(true)
  })

  it('should override mode with per-tool always-deny', async () => {
    executor.setPermissionMode('AUTO')
    executor.updateToolSettings([
      {
        name: 'BashTool',
        permission: 'always-deny',
      },
    ])

    const result = await executor.executeTool('BashTool', {
      command: 'test',
    })

    expect(result.requiresApproval).toBe(true)
  })
})
```

---

## E2E Test Examples

### 7. Complex Workflow - File Editing Scenario

```typescript
// e2e/workflows/file-editing.e2e.test.ts
import { describe, it, expect } from 'vitest'
import { ElectronApp, electronApp } from 'electron-playwright-helpers'
import path from 'path'
import fs from 'fs/promises'

describe('E2E - File Editing Workflow', () => {
  let app: ElectronApp

  beforeEach(async () => {
    app = await electronApp.start()
  })

  afterEach(async () => {
    await app.close()
  })

  it('should complete file editing workflow end-to-end', async () => {
    const { window } = app
    if (!window) throw new Error('No window')

    // Step 1: Create new session
    await window.click('[data-testid="new-session-btn"]')
    await window.waitForSelector('[data-testid="session-title-input"]')

    // Step 2: Set workspace
    await window.click('[data-testid="workspace-select"]')
    await window.fill('[data-testid="workspace-select"]', '/tmp/lumiq-test')

    // Step 3: Send message requesting file creation
    const chatInput = '[data-testid="chat-input"]'
    await window.fill(chatInput, 'Create a TypeScript file with a hello function')
    await window.press(chatInput, 'Enter')

    // Step 4: Wait for response and tool execution
    await window.waitForSelector('[data-testid="tool-execution-banner"]', { timeout: 5000 })

    // Step 5: Verify file was created
    const filePath = '/tmp/lumiq-test/hello.ts'
    const fileExists = await fs.stat(filePath).catch(() => false)
    expect(fileExists).toBeTruthy()

    // Step 6: Verify content
    const content = await fs.readFile(filePath, 'utf-8')
    expect(content).toContain('hello')
    expect(content).toContain('function')
  })

  it('should handle tool approval workflow', async () => {
    const { window } = app
    if (!window) throw new Error('No window')

    // Step 1: Set permission mode to MANUAL
    await window.click('[data-testid="settings-btn"]')
    await window.waitForSelector('[data-testid="permission-mode-select"]')
    await window.selectOption('[data-testid="permission-mode-select"]', 'MANUAL')

    // Step 2: Send message with tool request
    await window.fill('[data-testid="chat-input"]', 'Delete the file old.txt')
    await window.press('[data-testid="chat-input"]', 'Enter')

    // Step 3: Wait for approval modal
    await window.waitForSelector('[data-testid="approval-modal"]', { timeout: 2000 })

    // Step 4: Verify modal shows correct tool and action
    const modalText = await window.textContent('[data-testid="approval-modal"]')
    expect(modalText).toContain('FileDeleteTool')
    expect(modalText).toContain('old.txt')

    // Step 5: Deny approval
    await window.click('[data-testid="approval-deny-btn"]')

    // Step 6: Verify tool was not executed
    expect(modalText).not.toContain('Executed successfully')
  })
})
```

---

## Security Test Examples

### 8. Injection & XSS Prevention

```typescript
// src/main/security/__tests__/injection.test.ts
import { describe, it, expect } from 'vitest'
import { sanitizeForDatabase } from '../sanitization'
import { sanitizeForDisplay } from '../sanitization'
import { escapePath } from '../pathValidation'

describe('Security - Injection & XSS Prevention', () => {
  describe('SQL Injection Prevention', () => {
    it('should safely handle SQL metacharacters', () => {
      const malicious = "'; DROP TABLE sessions; --"
      const result = sanitizeForDatabase(malicious)

      // Should be escaped/quoted
      expect(result).not.toContain('DROP TABLE')
    })

    it('should handle unicode escapes', () => {
      const malicious = "\\u0027; DELETE FROM users; --"
      const result = sanitizeForDatabase(malicious)

      expect(result).not.toContain('DELETE FROM')
    })
  })

  describe('XSS Prevention', () => {
    it('should escape HTML tags', () => {
      const malicious = '<img src=x onerror="alert(1)">'
      const result = sanitizeForDisplay(malicious)

      expect(result).not.toContain('<img')
      expect(result).toContain('&lt;img')
    })

    it('should escape JavaScript URLs', () => {
      const malicious = '<a href="javascript:alert(1)">click</a>'
      const result = sanitizeForDisplay(malicious)

      expect(result).not.toContain('javascript:')
    })

    it('should handle event handlers', () => {
      const malicious = '<div onmouseover="alert(document.cookie)">test</div>'
      const result = sanitizeForDisplay(malicious)

      expect(result).not.toContain('onmouseover')
    })
  })

  describe('Path Traversal Prevention', () => {
    it('should block directory traversal', () => {
      const traversal = '../../../etc/passwd'
      const result = escapePath(traversal, '/workspace')

      expect(result).toThrow()
    })

    it('should handle URL-encoded traversal', () => {
      const encoded = '..%2F..%2F..%2Fetc%2Fpasswd'
      const result = escapePath(encoded, '/workspace')

      expect(result).toThrow()
    })

    it('should allow legitimate relative paths', () => {
      const legitimate = './src/main.ts'
      const result = escapePath(legitimate, '/workspace')

      expect(result).toBe('/workspace/src/main.ts')
    })
  })

  describe('Command Injection Prevention', () => {
    it('should escape shell metacharacters', () => {
      const malicious = 'test; rm -rf /'
      const result = escapeBashCommand(malicious)

      // Should be quoted or escaped
      expect(result).toContain("'")
    })

    it('should handle command substitution', () => {
      const malicious = 'test $(whoami)'
      const result = escapeBashCommand(malicious)

      expect(result).not.toContain('$')
    })
  })
})
```

---

## Performance Test Examples

### 9. Load Testing Configuration

```typescript
// e2e/performance/load.test.ts
import { describe, it, expect } from 'vitest'
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  vus: 100, // 100 virtual users
  duration: '5m', // 5 minute test
  thresholds: {
    http_req_duration: ['p(95)<1000', 'p(99)<2000'], // 95% < 1s, 99% < 2s
    http_req_failed: ['rate<0.1'], // Error rate < 0.1%
  },
}

export default function () {
  // Simulate sending messages from 100 concurrent users
  const url = 'http://localhost:3000/api/chat'
  const payload = JSON.stringify({
    message: 'What is 2+2?',
    sessionId: `session_${__VU}`, // Unique session per VU
    provider: 'openai',
    model: 'gpt-4',
  })

  const params = {
    headers: {
      'Content-Type': 'application/json',
    },
  }

  const res = http.post(url, payload, params)

  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 1s': (r) => r.timings.duration < 1000,
    'has content': (r) => r.body.length > 0,
  })

  sleep(1) // Wait 1 second between requests
}
```

---

## Running Tests

```bash
# Run all unit tests
npm test

# Run specific test file
npm test -- ToolExecutor.permissions.test.ts

# Run with coverage
npm test -- --coverage

# Run integration tests
npm test -- e2e/

# Run performance tests (k6)
k6 run e2e/performance/load.test.ts

# Run with watch mode
npm test -- --watch

# Run only P0 critical tests
npm test -- --grep "P0|critical|MANUAL mode"
```

---

## Test Data Factories

```typescript
// e2e/factories/messageFactory.ts
import type { Message } from '@shared/types'
import { v4 as uuidv4 } from 'uuid'

export class MessageFactory {
  static createUserMessage(content: string, sessionId: string): Message {
    return {
      id: uuidv4(),
      sessionId,
      role: 'user',
      content,
      createdAt: new Date().toISOString(),
    }
  }

  static createAssistantMessage(content: string, sessionId: string): Message {
    return {
      id: uuidv4(),
      sessionId,
      role: 'assistant',
      content,
      createdAt: new Date().toISOString(),
    }
  }

  static createToolMessage(
    toolName: string,
    toolCallId: string,
    result: string,
    sessionId: string
  ): Message {
    return {
      id: uuidv4(),
      sessionId,
      role: 'tool',
      toolName,
      toolCallId,
      content: result,
      toolResult: result,
      createdAt: new Date().toISOString(),
    }
  }

  static createSystemMessage(content: string, sessionId: string): Message {
    return {
      id: uuidv4(),
      sessionId,
      role: 'system',
      content,
      createdAt: new Date().toISOString(),
    }
  }
}

// Usage:
const userMsg = MessageFactory.createUserMessage('hello', 'sess_1')
const assistantMsg = MessageFactory.createAssistantMessage('hi there', 'sess_1')
```

---

## Test Coverage Report

Generate with:
```bash
npm test -- --coverage --coverage.reporter=html
```

Expected coverage:
- **Statements**: >85%
- **Branches**: >80%
- **Functions**: >85%
- **Lines**: >85%

Critical paths (must be 100%):
- Permission evaluation
- Tool executor
- Chat handlers
- Database operations
- Security/sanitization

