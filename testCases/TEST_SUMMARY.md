# Lumiq IDE - Test Suite Summary & Execution Roadmap

**Date**: 2026-05-21  
**IDE Readiness**: 35-40%  
**Test Suite Coverage**: Comprehensive (13 major categories, 200+ test cases)

---

## Executive Summary

Lumiq is an **agentic desktop IDE** with ~25 integrated tools, 11 AI providers, MCP server support, and a sophisticated permission system. This document provides **200+ hard and comprehensive test cases** designed to:

1. ✅ Validate all core functionality
2. ✅ Test edge cases and boundary conditions
3. ✅ Verify security and permission enforcement
4. ✅ Ensure data consistency and recovery
5. ✅ Detect performance bottlenecks
6. ✅ Prevent regressions

---

## Test Suite Organization

### 📋 Test Documents

| Document | Purpose | Test Count | Difficulty |
|----------|---------|-----------|------------|
| `TEST_CASES.md` | Main test suite with 13 categories | 180+ | HARD |
| `TEST_CASES_ADVANCED.md` | Edge cases, fuzzing, chaos engineering | 60+ | EXTREME |
| `TEST_CASES_CODE_EXAMPLES.md` | Executable code examples | 9 | HARD |

### 🎯 Test Categories

| # | Category | Tests | Priority |
|---|----------|-------|----------|
| 1 | Chat & Agent System | 6 | P0 |
| 2 | Multi-Provider | 6 | P0 |
| 3 | Tool Execution | 10 | P0 |
| 4 | Permission & Security | 14 | P0 |
| 5 | MCP Integration | 6 | P1 |
| 6 | Database & Persistence | 8 | P1 |
| 7 | Context Management | 5 | P1 |
| 8 | File Operations | 7 | P1 |
| 9 | IPC Communication | 6 | P2 |
| 10 | Error Handling | 7 | P2 |
| 11 | Performance & Stress | 8 | P3 |
| 12 | Workspace & Sessions | 6 | P2 |
| 13 | OAuth & Authentication | 7 | P3 |
| Advanced | Edge Cases & Fuzzing | 60+ | EXTREME |

---

## Priority Levels

### 🔴 P0 - Critical (Release Blocker)
Must pass 100% before release. Tests core agent loop, tool execution, and security.

**Examples**:
- TC-1.1: Streaming with interruption
- TC-3.1: Bash tool with dangerous commands
- TC-4.1: Permission mode transitions
- TC-6.1: Database corruption recovery

**Timeline**: Week 1-2

### 🟠 P1 - High (Should Pass)
Major features. Can defer 1-2 edge cases. Tests providers, MCP, file operations.

**Examples**:
- TC-2.1: Provider switching
- TC-5.1: MCP server lifecycle
- TC-8.1: File write atomicity

**Timeline**: Week 3-4

### 🟡 P2 - Medium (Nice to Have)
Infrastructure and integration. Can delay some tests.

**Examples**:
- TC-9.1: IPC message size limits
- TC-10.1: Graceful degradation
- TC-12.1: Workspace isolation

**Timeline**: Week 5-6

### 🟢 P3 - Low (Future)
Performance, advanced scenarios, nice features.

**Examples**:
- TC-11.1: 1M token streaming
- TC-13.1: Google OAuth
- Advanced chaos tests

**Timeline**: After release

---

## Key Functionality to Test

### ✨ Chat & Agent System
- **Streaming responses** with interruption handling
- **Tool call reconstruction** from old DB formats
- **Context trimming** with system prompt preservation
- **Cancellation** of in-flight operations
- **Message persistence** during failures

### 🔌 Tool System (25+ tools)
- **File operations**: Read, Write, Edit, Delete, Move
- **Search**: Grep, Glob, FileSearch
- **Execution**: Bash, PowerShell, Git
- **Special**: MCP Dynamic, Diff, Image, Notebook
- **Concurrency**: Read-only parallel, mutating serial
- **Approval workflow**: Manual, Limited, Extended, Auto modes

### 🧠 Multi-Provider Support
- **11 providers**: OpenAI, Anthropic, Gemini, Ollama, DeepSeek, Bedrock, GitHub, OpenRouter, Groq, Custom
- **Switching mid-session** without data loss
- **Failover chains** with automatic retry
- **Rate limiting** with exponential backoff
- **Model-specific handling** (streaming, tool calling)

### 🔒 Permission System
- **4 permission modes**: MANUAL, LIMITED, EXTENDED, AUTO
- **Per-tool settings**: always-allow, ask, always-deny
- **Override semantics**: per-tool > global mode
- **Approval workflow**: request → user action → execution

### 🗄️ Data Persistence
- **SQLite with encryption** for API keys
- **Message history** with role/tool tracking
- **Session management** with workspace binding
- **Tool settings** and permissions
- **OAuth tokens** and refresh handling

### 🛠️ Developer Tools
- **MCP (Model Context Protocol)** support
- **gRPC server** on localhost:43187
- **VS Code extension** bridge
- **Workspace binding** for file scope
- **Skill injection** for custom behavior

---

## Execution Strategy

### Phase 1: Critical Path (Week 1-2)
**Goal**: Stabilize agent loop and tool execution

**P0 Tests to Run**:
```
TC-1.1 through TC-1.6    Chat & Agent basics
TC-2.1, TC-2.2           Provider basics
TC-3.1 through TC-3.3    Critical tools (Bash, File, Glob)
TC-4.1, TC-4.3, TC-4.4   Permission core + encryption
TC-6.1, TC-6.2           Database basics
```

**Success Criteria**: 100% pass

**Tools**: Jest/Vitest for unit tests

---

### Phase 2: Core Features (Week 3-4)
**Goal**: Validate all tools and multi-provider

**P1 Tests to Run**:
```
TC-2.3 through TC-2.6    Provider edge cases
TC-3.4 through TC-3.10   All tools (grep, git, etc)
TC-5.1 through TC-5.6    MCP integration
TC-8.1 through TC-8.7    File operations
TC-6.3 through TC-6.8    Database persistence
```

**Success Criteria**: 95%+ pass

**Tools**: Jest/Vitest + manual integration testing

---

### Phase 3: Infrastructure (Week 5-6)
**Goal**: Verify IPC, error handling, workspace

**P2 Tests to Run**:
```
TC-7.1 through TC-7.5    Context management
TC-9.1 through TC-9.6    IPC communication
TC-10.1 through TC-10.7  Error handling
TC-12.1 through TC-12.6  Workspace & sessions
TC-4.5 through TC-4.8    Advanced security
```

**Success Criteria**: 90%+ pass

**Tools**: Jest/Vitest + Playwright for E2E

---

### Phase 4: Advanced & Performance (Week 7+)
**Goal**: Stress test and security hardening

**P3 & Advanced Tests to Run**:
```
TC-11.1 through TC-11.8  Performance tests
TC-13.1 through TC-13.7  OAuth & auth
TC-ADV-1.1 through TC-ADV-9.8  Chaos + fuzzing
```

**Success Criteria**: 80%+ pass

**Tools**: k6 for load testing, AFL++ for fuzzing, Chaos Monkey

---

## Test Execution Commands

### Setup
```bash
# Install dependencies
npm install

# Install test dependencies
npm install --save-dev vitest @vitest/ui jest @testing-library/react

# Install Playwright for E2E
npm install --save-dev @playwright/test
```

### Run Tests

```bash
# All unit tests
npm test

# P0 critical tests only
npm test -- --grep "TC-[1-4]\\.[1-6]|P0|critical"

# Specific category
npm test -- --grep "ToolExecutor"

# With coverage
npm test -- --coverage

# Watch mode (development)
npm test -- --watch

# UI dashboard
npm test -- --ui

# Integration tests
npm run test:integration

# E2E tests
npm run test:e2e

# Performance tests
k6 run e2e/performance/load.test.ts

# Security tests with fuzzing
npm run test:security
```

---

## Expected Test Results

### Coverage Targets

| Area | Target | Current |
|------|--------|---------|
| Statements | >85% | TBD |
| Branches | >80% | TBD |
| Functions | >85% | TBD |
| Lines | >85% | TBD |

### Performance Targets

| Metric | Target | Notes |
|--------|--------|-------|
| Chat response latency (p95) | <1s | Streaming |
| Tool execution (p95) | <500ms | Read-only |
| Database query (p95) | <100ms | Indexed |
| Permission check | <10ms | In-memory |
| UI responsiveness | 60 FPS | No jank during stream |

### Reliability Targets

| Metric | Target |
|--------|--------|
| Tool success rate | >99.5% |
| Message persistence | 100% |
| Database ACID | 100% |
| Crash-free sessions | 99.9% |
| Recovery on restart | 100% |

---

## Test Data Setup

### Database State
```sql
-- Create test database with:
- 5 test sessions
- 50 test messages (mixed roles)
- 11 configured providers (with test API keys)
- 25 tool settings
- 3 MCP server configs
```

### File System
```
/tmp/lumiq-test/
  ├── src/
  │   ├── main.ts (500 lines)
  │   ├── app.ts (800 lines)
  │   └── config.json
  ├── tests/
  │   └── test.txt (10MB)
  └── large/
      └── bigfile.bin (1GB)
```

### Provider Credentials
```
OpenAI: sk-test123... (mock)
Anthropic: sk-ant-test... (mock)
Ollama: http://localhost:11434 (local)
Custom: https://localhost:8000 (self-signed cert)
```

---

## Continuous Integration

### GitHub Actions Workflow
```yaml
name: Test Suite

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm test -- --coverage
      - uses: codecov/codecov-action@v3

  integration-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:integration

  e2e-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
      - run: npm install
      - run: npm run test:e2e

  security-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - run: npm audit
      - run: npm run test:security
```

---

## Risk Assessment

### Critical Risks

| Risk | Mitigation |
|------|-----------|
| Message loss during crash | DB transaction logging + backup strategy |
| Tool execution with wrong scope | Workspace boundary validation tests |
| Permission bypass | Exhaustive permission mode testing |
| API key exposure | Encryption + no-log verification |
| Deadlock in concurrent ops | Lock ordering + timeout testing |

### Testing for Risks

```typescript
// High-risk test template
describe('Risk: Message Loss During Provider Crash', () => {
  it('should persist message before provider call', async () => {
    // 1. Verify message saved
    // 2. Simulate provider crash
    // 3. Verify message still in DB
    // 4. Verify correct state after restart
  })
})
```

---

## Defect Tracking

### Defect Report Template

```markdown
## Title: [Component] Brief description

### Severity
- [ ] P0 (Blocker)
- [ ] P1 (High)
- [ ] P2 (Medium)
- [ ] P3 (Low)

### Category
- [ ] Functional
- [ ] Performance
- [ ] Security
- [ ] UI/UX

### Reproduction Steps
1. ...
2. ...
3. ...

### Expected Result
...

### Actual Result
...

### Environment
- OS: Windows/Mac/Linux
- Version: 1.0.0
- Provider: OpenAI/Anthropic/etc

### Logs
\`\`\`
Error stack trace here
\`\`\`

### Test Case
References: TC-X.Y
```

---

## Sign-Off Checklist

### Pre-Release

- [ ] All P0 tests pass (100%)
- [ ] All P1 tests pass (95%+)
- [ ] Coverage >85% on critical paths
- [ ] No critical/high severity defects open
- [ ] Performance benchmarks met
- [ ] Security audit completed
- [ ] Documentation updated

### Post-Release Monitoring

- [ ] Crash reports monitored
- [ ] User feedback tracked
- [ ] Performance metrics baseline
- [ ] Security scanning enabled

---

## Next Steps

1. **Week 1**: Set up test infrastructure (Jest/Vitest)
2. **Week 2**: Implement P0 tests
3. **Week 3-4**: Implement P1 tests
4. **Week 5-6**: Implement P2 tests
5. **Week 7+**: Performance and advanced tests

---

## Contact & Escalation

### Test Lead
- Responsible for test execution and reporting
- Escalate blockers immediately

### Test Infrastructure
- Maintain CI/CD pipeline
- Manage test data
- Document test gaps

### Quality Gate
- All P0 tests must pass before release
- Risk assessment for P1/P2 failures
- Post-release monitoring plan

