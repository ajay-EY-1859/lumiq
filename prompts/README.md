# Specialized Agents Prompt Files - README

## 📋 Overview

This directory contains specialized prompt files for creating different agents to handle various aspects of your agentic desktop application. Each prompt is designed to give an agent specific expertise and focus for comprehensive project coverage.

## 🎯 Agents Available

### 1. **Security Agent** 
📄 `security-agent.prompt.md`
- **Expertise**: Vulnerability detection, security audit, threat analysis
- **Focus**: Auth flows, encryption, secret management, IPC security
- **Use When**: Security review needed, before release, after dependency update
- **Deliverable**: Vulnerability report, security recommendations

### 2. **Debugger Agent**
📄 `debugger-agent.prompt.md`
- **Expertise**: Bug detection, root cause analysis, error tracing
- **Focus**: Type safety, async issues, integration bugs, race conditions
- **Use When**: Bug reported, tests failing, unexpected behavior
- **Deliverable**: Bug fix, root cause analysis, test cases

### 3. **Architecture Agent**
📄 `architecture-agent.prompt.md`
- **Expertise**: System design, code organization, technical debt
- **Focus**: Design patterns, scalability, maintainability, refactoring
- **Use When**: Planning refactoring, architectural review, design decisions
- **Deliverable**: Architecture assessment, refactoring roadmap

### 4. **Feature Research Agent**
📄 `feature-research-agent.prompt.md`
- **Expertise**: Feature ideation, market research, innovation
- **Focus**: New features, integrations, capabilities, advancement
- **Use When**: Planning next features, researching trends, expansion
- **Deliverable**: Feature ideas, feasibility analysis, roadmap

### 5. **Performance Agent**
📄 `performance-agent.prompt.md`
- **Expertise**: Optimization, profiling, efficiency improvements
- **Focus**: Bottlenecks, memory leaks, CPU optimization, I/O optimization
- **Use When**: Performance issues, optimization sprint, before release
- **Deliverable**: Performance analysis, optimization recommendations

### 6. **Integration Agent**
📄 `integration-agent.prompt.md`
- **Expertise**: Tool integration, provider management, extensibility
- **Focus**: Tool systems, provider architecture, MCP servers, plugins
- **Use When**: Adding tools, integrating providers, designing plugins
- **Deliverable**: Integration plan, plugin architecture, roadmap

### 7. **Testing Agent**
📄 `testing-agent.prompt.md`
- **Expertise**: Test strategy, QA, coverage analysis
- **Focus**: Unit/integration/E2E tests, test automation, CI/CD
- **Use When**: Test planning, coverage gaps, QA before release
- **Deliverable**: Test strategy, test cases, automation roadmap

### 8. **Documentation Agent**
📄 `documentation-agent.prompt.md`
- **Expertise**: Code documentation, API docs, developer onboarding
- **Focus**: Documentation gaps, code comments, guides, knowledge preservation
- **Use When**: Improving docs, onboarding developers, creating guides
- **Deliverable**: Documentation audit, missing docs, guide templates

### 9. **Project Explorer Agent**
📄 `project-explorer-agent.prompt.md`
- **Expertise**: Complete codebase analysis, pattern recognition
- **Focus**: Architecture, dependencies, data flows, complexity, health
- **Use When**: Starting new work, understanding scope, onboarding
- **Deliverable**: Architecture diagrams, dependency maps, health report

## 🚀 Quick Start

### Option 1: Using with VS Code Copilot

1. Open GitHub Copilot Chat in VS Code
2. Create a new chat and reference the agent prompt:
   ```
   @copilot I'll be using this agent prompt for code review:
   [paste content from security-agent.prompt.md]
   ```
3. Ask the agent to help with security issues

### Option 2: Create Custom Agent Configuration

1. Create a `.agent.md` file in your workspace:
   ```
   # Custom Security Agent
   
   [Content from security-agent.prompt.md]
   ```
2. Reference it in agent customization settings

### Option 3: Use as Subagent

For complex tasks requiring focused expertise:
```
Run a specialized agent to analyze security: [security-agent.prompt.md]
```

## 📊 Agent Usage Workflow

### Complete Project Analysis
```
1. Project Explorer → Understand architecture
2. Security Agent → Find vulnerabilities
3. Architecture Agent → Design improvements
4. Testing Agent → Coverage analysis
5. Performance Agent → Optimization opportunities
6. Documentation Agent → Doc gaps
```

### Feature Development
```
1. Feature Research → Identify feature
2. Architecture Agent → Design architecture
3. Integration Agent → Plan integration
4. Testing Agent → Design tests
5. Documentation Agent → Plan docs
```

### Before Release
```
1. Security Agent → Full audit
2. Testing Agent → Coverage verification
3. Performance Agent → Performance check
4. Documentation Agent → Release notes
```

## 🛠️ How to Customize

Each agent prompt can be customized for your needs:

### Add Project-Specific Requirements
```markdown
## Project-Specific Context

This project uses:
- Technology X for Y
- Custom patterns for Z
- Company policies: [...]
```

### Extend Agent Capabilities
```markdown
## Additional Focus Areas

Beyond standard coverage, also check:
- Custom compliance requirements
- Company security policies
- Specific performance targets
```

### Create Variants
- `security-agent-strict.prompt.md` - Stricter security checks
- `performance-agent-mobile.prompt.md` - Mobile-specific optimization
- `testing-agent-critical.prompt.md` - Critical path focus

## 📖 Agent Strategy Guide

For detailed information about how agents work together:
👉 See `AGENT_STRATEGY.md`

Key highlights:
- Multi-agent collaboration workflows
- Recommended usage patterns
- Agent specialization matrix
- Success metrics
- CI/CD integration examples

## 🔄 Workflow Examples

### Bug Fix Sprint
```
1. Debugger Agent → Identify and fix bugs
2. Testing Agent → Add regression tests
3. Performance Agent → Check performance impact
4. Documentation Agent → Update fix documentation
```

### Optimization Sprint
```
1. Performance Agent → Find bottlenecks
2. Architecture Agent → Design optimizations
3. Testing Agent → Verify improvements
4. Documentation Agent → Update performance docs
```

### Onboarding New Developer
```
1. Project Explorer → Full project overview
2. Architecture Agent → Design patterns and organization
3. Documentation Agent → Developer setup guide
4. Testing Agent → How to run tests
```

## 💡 Best Practices

1. **Use Specialized Agents**: Each agent has specific expertise - use them for their domain
2. **Collaborate**: Agents can reference each other's findings
3. **Prioritize**: Use recommended workflows for best results
4. **Document**: Each agent produces documentation of findings
5. **Track**: Monitor improvements over time using metrics

## 📈 Success Tracking

Use these metrics to track improvements:

| Agent | Metric | Target |
|-------|--------|--------|
| Security | Critical vulnerabilities | 0 |
| Debugger | Bug resolution time | Decreasing |
| Architecture | Technical debt | Decreasing |
| Feature | Features delivered | On schedule |
| Performance | Response time | < 100ms |
| Integration | Tools available | Growing |
| Testing | Code coverage | > 80% |
| Documentation | Onboarding time | < 2 hours |
| Explorer | Architecture clarity | Stable |

## 🎓 Learning Path

### For New Team Members
1. Read `project-explorer-agent.prompt.md` to understand project
2. Run Project Explorer Agent for complete overview
3. Read `documentation-agent.prompt.md` to understand docs
4. Review architecture and design docs

### For Feature Development
1. Read `feature-research-agent.prompt.md` for ideas
2. Run Architecture Agent for design
3. Read `integration-agent.prompt.md` for integrations
4. Run Testing Agent for test strategy

### For Maintenance
1. Run Security Agent weekly
2. Run Testing Agent before each release
3. Run Performance Agent monthly
4. Run Debugger Agent when bugs reported

## 🔗 Integration with Development Tools

### VS Code Integration
- Copy agent prompts into custom agent configurations
- Use with GitHub Copilot Chat
- Reference in task automation

### CI/CD Integration
- Run security agent on each PR
- Run tests agent on each commit
- Run performance agent on releases
- Capture and track metrics

### Documentation Generation
- Use documentation agent to generate docs
- Use explorer agent to create architecture diagrams
- Use architecture agent for design decisions

## 📞 Support

For questions about specific agents:
- Read the agent's `.prompt.md` file for detailed info
- Check `AGENT_STRATEGY.md` for workflow recommendations
- Review agent-specific sections in this README

## 🎯 Next Steps

1. **Start Here**: Run Project Explorer Agent to understand your project
2. **Audit**: Run Security Agent to find issues
3. **Plan**: Use Feature Research Agent for next features
4. **Build**: Use specific agents for implementation
5. **Release**: Run all agents before release

---

**Ready to use specialized agents?** Start with any agent prompt that matches your current need!
