# Multi-Agent Strategy Guide

## Overview
This project uses multiple specialized agents, each focusing on different aspects of the codebase. Together, they provide comprehensive coverage for project development, maintenance, and improvement.

## Available Agents & Specialties

### 1. 🔍 **Project Explorer Agent** (`project-explorer-agent.prompt.md`)
**Purpose**: Full codebase exploration and understanding
- Complete architecture analysis
- Dependency mapping
- Complexity assessment
- Pattern recognition
- **When to Use**: Starting new work, understanding project scope, onboarding
- **Output**: Architecture diagrams, dependency maps, health assessment

### 2. 🔒 **Security Agent** (`security-agent.prompt.md`)
**Purpose**: Security vulnerability detection and hardening
- Vulnerability scanning
- Authentication/authorization review
- Encryption validation
- Secret management
- **When to Use**: Before releases, after dependency updates, security audit
- **Output**: Vulnerability report, security recommendations, risk assessment

### 3. 🐛 **Debugger Agent** (`debugger-agent.prompt.md`)
**Purpose**: Bug identification and fixing
- Root cause analysis
- Type safety issues
- Async/await problems
- State management bugs
- **When to Use**: Bug reported, tests failing, unexpected behavior
- **Output**: Bug report, reproduction steps, fix implementation

### 4. 🏗️ **Architecture Agent** (`architecture-agent.prompt.md`)
**Purpose**: System design and code quality
- Architecture review
- Design pattern evaluation
- Technical debt assessment
- Scalability analysis
- **When to Use**: Planning refactoring, pre-release review, design decisions
- **Output**: Architecture assessment, refactoring roadmap, design recommendations

### 5. ✨ **Feature Research Agent** (`feature-research-agent.prompt.md`)
**Purpose**: New feature identification and innovation
- Feature ideation
- Market research
- Integration opportunities
- Capability expansion
- **When to Use**: Planning next features, researching trends, expansion planning
- **Output**: Feature ideas, feasibility analysis, implementation roadmap

### 6. ⚡ **Performance Agent** (`performance-agent.prompt.md`)
**Purpose**: Optimization and efficiency improvements
- Performance profiling
- Memory optimization
- I/O optimization
- Bottleneck identification
- **When to Use**: Performance issues, optimization sprint, before release
- **Output**: Performance analysis, optimization recommendations, benchmarks

### 7. 🔌 **Integration Agent** (`integration-agent.prompt.md`)
**Purpose**: Tool/provider integration and extensibility
- Tool integration
- Provider management
- Plugin architecture
- MCP server support
- **When to Use**: Adding new tools, integrating providers, designing extensibility
- **Output**: Integration plan, plugin architecture, new tool roadmap

### 8. ✅ **Testing Agent** (`testing-agent.prompt.md`)
**Purpose**: Testing strategy and quality assurance
- Test coverage analysis
- Test scenario design
- CI/CD strategy
- Quality metrics
- **When to Use**: Test planning, coverage analysis, QA before release
- **Output**: Test strategy, test cases, coverage report, automation roadmap

### 9. 📚 **Documentation Agent** (`documentation-agent.prompt.md`)
**Purpose**: Documentation and maintainability
- Code documentation audit
- API documentation
- Architecture documentation
- Developer onboarding
- **When to Use**: Improving documentation, onboarding developers, creating guides
- **Output**: Documentation audit, missing docs list, guide templates

## Agent Collaboration Workflows

### Workflow 1: Complete Project Analysis
1. **Project Explorer** → Understand full architecture
2. **Security Agent** → Identify vulnerabilities
3. **Architecture Agent** → Find design improvements
4. **Testing Agent** → Assess test coverage
5. **Performance Agent** → Find bottlenecks
6. **Documentation Agent** → Documentation gaps

**Output**: Comprehensive project health report

### Workflow 2: Feature Development
1. **Feature Research Agent** → Identify new feature
2. **Architecture Agent** → Design architecture
3. **Integration Agent** → Plan integrations
4. **Testing Agent** → Design tests
5. **Documentation Agent** → Plan documentation

**Output**: Feature implementation plan

### Workflow 3: Bug Fix Sprint
1. **Debugger Agent** → Identify and fix bugs
2. **Testing Agent** → Add regression tests
3. **Performance Agent** → Check impact
4. **Security Agent** → Check security implications

**Output**: Fixed bugs, test coverage, performance validated

### Workflow 4: Optimization Sprint
1. **Performance Agent** → Identify bottlenecks
2. **Architecture Agent** → Design optimizations
3. **Testing Agent** → Verify improvements
4. **Documentation Agent** → Update performance docs

**Output**: Optimized code, performance benchmarks

### Workflow 5: Release Preparation
1. **Security Agent** → Final security audit
2. **Testing Agent** → Run full test suite
3. **Performance Agent** → Performance verification
4. **Documentation Agent** → Release notes, documentation

**Output**: Release-ready code, documentation, notes

## How to Use These Agents

### With VS Code Agent Customization

Each agent has a corresponding `.prompt.md` file in `/prompts/` directory:

```
prompts/
├── security-agent.prompt.md
├── debugger-agent.prompt.md
├── architecture-agent.prompt.md
├── feature-research-agent.prompt.md
├── performance-agent.prompt.md
├── integration-agent.prompt.md
├── testing-agent.prompt.md
├── documentation-agent.prompt.md
└── project-explorer-agent.prompt.md
```

### Using with GitHub Copilot Chat
1. Copy the desired `.prompt.md` file content
2. Create a new agent/customization in VS Code Copilot
3. Paste the prompt content
4. Customize for your needs
5. Use the agent for specific tasks

### Using with Subagents
Each prompt can be adapted to run as a specialized subagent:

```typescript
// Example: Run Security Agent as subagent
await runSubagent({
  agentName: "SecurityAgent",
  prompt: `[Content from security-agent.prompt.md]`
});
```

## Recommended Agent Usage Pattern

### Daily Development
- **Debugger Agent**: When fixing bugs
- **Testing Agent**: Before committing changes
- **Documentation Agent**: When adding features

### Weekly Reviews
- **Architecture Agent**: Code quality check
- **Performance Agent**: Performance monitoring
- **Security Agent**: Dependency audit

### Sprint Planning
- **Feature Research Agent**: Next features
- **Integration Agent**: New integrations
- **Testing Agent**: Test strategy

### Major Milestones
- **Project Explorer**: Complete audit
- **Architecture Agent**: Design review
- **Security Agent**: Full audit
- **Testing Agent**: Coverage verification
- **Performance Agent**: Optimization

## Agent Specialization Matrix

| Aspect | Agent | Focus |
|--------|-------|-------|
| Discovery | Project Explorer | Complete understanding |
| Security | Security Agent | Vulnerabilities |
| Bugs | Debugger Agent | Root cause & fix |
| Design | Architecture Agent | Structure & patterns |
| Innovation | Feature Research | New capabilities |
| Speed | Performance Agent | Optimization |
| Integration | Integration Agent | Extensibility |
| Quality | Testing Agent | Coverage & validation |
| Knowledge | Documentation Agent | Understanding & onboarding |

## Agent Communication

Agents can reference each other's findings:

- **Debugger** may find issues that **Architecture** can resolve
- **Performance** findings can inform **Architecture** decisions
- **Security** findings may need **Debugger** to fix
- **Testing** validates fixes from **Debugger**
- **Feature Research** ideas may need **Integration** for implementation
- **Documentation** captures decisions from **Architecture**

## Customization Tips

### Enhance Any Agent
- Add project-specific requirements
- Include team standards
- Add custom metrics
- Link to internal tools
- Add company policies

### Create Specialized Variants
- Create `security-agent-strict.prompt.md` for extra strict security
- Create `performance-agent-web.prompt.md` for web-specific optimization
- Create `testing-agent-e2e.prompt.md` for E2E focus

### Extend Agents
- Add new investigation areas
- Include additional metrics
- Add more detailed checklists
- Include specific tools to use

## Integration with CI/CD

These agents can drive automation:

```yaml
# Example: Run agents on each PR
on: pull_request
jobs:
  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: copilot-action/run-agent
        with:
          agent: security-agent
          
  test-coverage:
    runs-on: ubuntu-latest
    steps:
      - uses: copilot-action/run-agent
        with:
          agent: testing-agent
          
  performance-check:
    runs-on: ubuntu-latest
    steps:
      - uses: copilot-action/run-agent
        with:
          agent: performance-agent
```

## Success Metrics

Track improvements across agents:

| Agent | Metric | Target |
|-------|--------|--------|
| Security | Vulnerabilities Found | 0 |
| Debugger | Bugs Fixed | Track trend |
| Architecture | Technical Debt Score | Decreasing |
| Feature Research | Features Implemented | On roadmap |
| Performance | Response Time | < target |
| Integration | New Tools Added | On roadmap |
| Testing | Code Coverage | > 80% |
| Documentation | Onboarding Time | < 2 hours |
| Project Explorer | Complexity Score | Stable/decreasing |

## Next Steps

1. **Start with Project Explorer**: Understand full architecture
2. **Run Security Agent**: Identify immediate issues
3. **Use Debugger**: Fix reported bugs
4. **Plan with Feature Research**: Next features
5. **Optimize with Performance**: Speed improvements
6. **Complete with Documentation**: Share knowledge

Each agent is self-contained and can be used independently or in combination for comprehensive project management.
