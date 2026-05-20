# Using Agent Prompts with VS Code Customization

## Overview

These prompt files can be used to create specialized agents in VS Code with GitHub Copilot Chat. This guide shows you how to set up and use these agents.

## Option 1: VS Code Agent Configuration

### Step 1: Create Agent Configuration File

Create a `.agent.md` file in your project:

```bash
# Example: Create a Security Agent configuration
.vscode/security-agent.agent.md
```

### Step 2: Copy Prompt Content

```markdown
---
title: Security Agent
description: Specialized agent for security analysis and vulnerability detection
version: 1.0
---

# Security Agent

[Copy content from security-agent.prompt.md here]
```

### Step 3: Use in VS Code

In Copilot Chat:
```
@agents security

Scan the codebase for security vulnerabilities
```

## Option 2: Using with Copilot Instructions

### Create .github/copilot-instructions.md

Add agent prompts to your project's Copilot instructions:

```markdown
# Copilot Instructions

## Available Agents

### Security Analysis
[Include security-agent.prompt.md content]

### Bug Fixing
[Include debugger-agent.prompt.md content]

### Architecture Review
[Include architecture-agent.prompt.md content]

# Usage
@copilot use [agent-name] for [task]
```

## Option 3: Custom Agent Mode

### Create Specialized Configurations

Create multiple agent configurations:

```
.vscode/agents/
├── security.agent.md
├── debugger.agent.md
├── architect.agent.md
├── feature-research.agent.md
├── performance.agent.md
├── integration.agent.md
├── testing.agent.md
├── documentation.agent.md
└── explorer.agent.md
```

Each file contains:

```markdown
---
title: [Agent Name]
description: [One-line description]
tags: [comma, separated, tags]
---

[Full prompt content from corresponding .prompt.md]
```

## Option 4: Programmatic Usage

### With Agent Runners

Create scripts to run agents:

```typescript
// run-agent.ts
import { runAgent } from '@copilot/agent-sdk';

const securityAgent = readFileSync('prompts/security-agent.prompt.md', 'utf8');

await runAgent({
  name: 'Security Agent',
  systemPrompt: securityAgent,
  task: 'Scan src/main/security/ for vulnerabilities'
});
```

## Recommended Setup

### Project Structure

```
.vscode/
├── agents/
│   ├── security.agent.md
│   ├── debugger.agent.md
│   ├── architect.agent.md
│   ├── feature-research.agent.md
│   ├── performance.agent.md
│   ├── integration.agent.md
│   ├── testing.agent.md
│   ├── documentation.agent.md
│   └── explorer.agent.md
│
└── copilot-instructions.md

prompts/
├── README.md
├── AGENT_STRATEGY.md
├── QUICK_REFERENCE.md
├── security-agent.prompt.md
├── debugger-agent.prompt.md
├── architecture-agent.prompt.md
├── feature-research-agent.prompt.md
├── performance-agent.prompt.md
├── integration-agent.prompt.md
├── testing-agent.prompt.md
└── documentation-agent.prompt.md
```

### .vscode/agents/security.agent.md Example

```markdown
---
title: Security Agent
description: Specialized agent for detecting and analyzing security vulnerabilities
version: 1.0
tags:
  - security
  - vulnerability
  - audit
keywords:
  - vulnerability
  - encryption
  - authentication
  - secrets
---

# Security Agent Prompt

## Role & Purpose
You are a Security-Focused Agent specializing in vulnerability detection, security scanning, and threat analysis for the agentic desktop application.

[... rest of security-agent.prompt.md content ...]
```

## Using Agents in Chat

### Direct Usage

```
@agents security

Analyze src/main/auth/ for OAuth security issues
```

### Multi-Agent Query

```
@agents security,debugger

Find security issues that might cause bugs in the authentication flow
```

### With Context

```
@agents architect

Review the current agent loop design and suggest improvements for scalability
```

## Advanced: Custom Agent Profiles

### Create Role-Based Profiles

```yaml
# .vscode/agent-profiles.yml

security:
  agents:
    - security
  guidelines:
    - "Always prioritize vulnerability discovery"
    - "Check for hardcoded secrets"
    - "Verify encryption practices"

development:
  agents:
    - debugger
    - testing
    - architecture
  guidelines:
    - "Focus on code quality"
    - "Improve test coverage"
    - "Reduce technical debt"

innovation:
  agents:
    - feature-research
    - integration
    - performance
  guidelines:
    - "Look for new opportunities"
    - "Research emerging technologies"
    - "Optimize for user experience"

maintenance:
  agents:
    - explorer
    - documentation
  guidelines:
    - "Keep knowledge up to date"
    - "Improve onboarding"
    - "Document architecture"
```

## Integration with Workflows

### Pre-Commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

# Run security agent on changed files
copilot-agent security --files $(git diff --cached --name-only)

# Run testing agent to verify tests pass
copilot-agent testing --mode quick
```

### CI/CD Integration

```yaml
# .github/workflows/agent-checks.yml

name: Agent-Based Quality Checks

on: [pull_request]

jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: copilot-agent-runner@v1
        with:
          agent: security
          files: src/main/security/**
          
  test-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: copilot-agent-runner@v1
        with:
          agent: testing
          focus: coverage
          
  performance:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
      - uses: copilot-agent-runner@v1
        with:
          agent: performance
          files: src/main/agent/**
```

## Customization Examples

### Example 1: Project-Specific Security Agent

Create `security-agent-custom.agent.md`:

```markdown
---
title: Security Agent (Custom)
description: Security agent configured for our project standards
---

# Security Agent - Customized

## Base Prompt
[Content from security-agent.prompt.md]

## Project-Specific Requirements

### Additional Security Standards
- Must check for company-specific compliance requirements
- Verify encryption uses company-approved algorithms
- Check for proper API gateway security headers
- Validate custom authentication mechanisms

### Focus Areas for This Project
- OAuth implementation correctness
- Database encryption (SQLite specifics)
- IPC message validation
- Provider API key handling
- Electron process isolation
```

### Example 2: Strict Performance Agent

Create `performance-agent-strict.agent.md`:

```markdown
---
title: Performance Agent (Strict)
description: Performance agent with stricter targets
---

# Performance Agent - Strict Mode

[Content from performance-agent.prompt.md]

## Strict Targets
- Agent loop cycle: < 50ms (vs 100ms)
- Tool execution: < 2s (vs 5s)
- UI responsiveness: 60 FPS minimum
- Memory: < 250MB (vs 500MB)
- Startup time: < 1s (vs 3s)
```

## Team Setup

### Share with Team

```bash
# .vscode/settings.json
{
  "copilot.agent.prompts": [
    "prompts/security-agent.prompt.md",
    "prompts/debugger-agent.prompt.md",
    "prompts/architecture-agent.prompt.md",
    "prompts/feature-research-agent.prompt.md",
    "prompts/performance-agent.prompt.md",
    "prompts/integration-agent.prompt.md",
    "prompts/testing-agent.prompt.md",
    "prompts/documentation-agent.prompt.md",
    "prompts/project-explorer-agent.prompt.md"
  ]
}
```

### Team Guidelines

Create `AGENT_GUIDELINES.md`:

```markdown
# Team Agent Guidelines

## Required Agents by Role

### Backend Developer
- Use 🐛 Debugger Agent
- Use ✅ Testing Agent
- Use 🔍 Project Explorer Agent

### Security Engineer
- Use 🔒 Security Agent (daily)
- Use 🏗️ Architecture Agent
- Use 📚 Documentation Agent

### Tech Lead
- Use 🔍 Project Explorer Agent
- Use 🏗️ Architecture Agent
- Use ⚡ Performance Agent
- Use ✨ Feature Research Agent

### DevOps/Infrastructure
- Use 🔌 Integration Agent
- Use ⚡ Performance Agent
- Use 📚 Documentation Agent

## Recommended Workflows

### Daily
- Run Debugger on active bugs
- Run Testing before commit

### Weekly  
- Run Security Agent
- Review findings

### Monthly
- Run Performance Agent
- Run Architecture Agent

### Quarterly
- Run Project Explorer
- Run all agents
- Review comprehensive report
```

## Troubleshooting

### Agent Not Loading

1. Check file format is valid YAML frontmatter
2. Verify prompt content is properly formatted
3. Check file encoding is UTF-8
4. Ensure file is in correct directory

### Agent Behaving Unexpectedly

1. Verify full prompt content is included
2. Check for conflicting instructions
3. Review recent changes to prompts
4. Update to latest prompt version

### Performance Issues

1. Use specific agents instead of all at once
2. Focus agents on specific files/areas
3. Run non-blocking agents in background
4. Use quick/summary modes for fast feedback

## Next Steps

1. Copy one agent prompt to `.vscode/agents/`
2. Customize the YAML frontmatter
3. Test in Copilot Chat
4. Share with team
5. Iterate based on feedback

---

**Ready to customize?** Start with Option 1 (VS Code Agent Configuration) for the easiest setup!
