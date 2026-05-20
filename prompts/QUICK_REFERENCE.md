# Agent Prompts - Quick Reference

## 🎯 Agents at a Glance

```
┌─────────────────────────────────────────────────────────────────┐
│                    MULTI-AGENT SYSTEM                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  🔍 PROJECT EXPLORER  ─→  Understand everything              │
│                                                                  │
│  ┌────────┬────────┬────────┬────────┬────────┬────────┐       │
│  │        │        │        │        │        │        │       │
│  ▼        ▼        ▼        ▼        ▼        ▼        ▼       │
│  🔒      🐛       🏗️       ✨       ⚡       🔌       ✅       │
│ SECURITY DEBUGGER ARCHITECT FEATURE PERFORMA INTEGRATION TESTING│
│                                                                  │
│         ▲        ▲        ▲        ▲        ▲        ▲         │
│         │        │        │        │        │        │         │
│  ┌──────┴─────────┴────────┴────────┴────────┴────────┴───┐   │
│  │                                                         │   │
│  └────────  📚 DOCUMENTATION  ──────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 📋 All Agents Reference

| # | Agent | File | Purpose | When to Use |
|---|-------|------|---------|-------------|
| 1 | 🔍 Project Explorer | `project-explorer-agent.prompt.md` | Full codebase analysis | Starting work, onboarding |
| 2 | 🔒 Security | `security-agent.prompt.md` | Vulnerability detection | Before release, audit |
| 3 | 🐛 Debugger | `debugger-agent.prompt.md` | Bug identification & fixing | Bug reported, tests fail |
| 4 | 🏗️ Architecture | `architecture-agent.prompt.md` | Design & code quality | Refactoring, review |
| 5 | ✨ Feature Research | `feature-research-agent.prompt.md` | Innovation & new features | Planning features |
| 6 | ⚡ Performance | `performance-agent.prompt.md` | Optimization & efficiency | Performance issues |
| 7 | 🔌 Integration | `integration-agent.prompt.md` | Tool/provider integration | Adding tools, providers |
| 8 | ✅ Testing | `testing-agent.prompt.md` | Test strategy & QA | Test planning, coverage |
| 9 | 📚 Documentation | `documentation-agent.prompt.md` | Code & API docs | Documentation gaps |

## 🚀 Common Workflows

### Workflow 1: Complete Project Analysis (2-3 hours)
```
Start → Project Explorer (30min)
        ↓
        Security Agent (30min)
        ↓
        Architecture Agent (30min)
        ↓
        Testing Agent (20min)
        ↓
        Performance Agent (20min)
        ↓
        → Complete Health Report
```

### Workflow 2: Feature Implementation (1-2 days)
```
Feature Idea → Feature Research Agent (1hr)
              ↓
              Architecture Agent (2hrs)
              ↓
              Integration Agent (2hrs)
              ↓
              Testing Agent (2hrs)
              ↓
              Implementation (4-6hrs)
              ↓
              Documentation Agent (1hr)
              ↓
              → Ready to Ship
```

### Workflow 3: Bug Fix Sprint (1-2 hours)
```
Bug Report → Debugger Agent (30min)
            ↓
            Fix Implementation (20min)
            ↓
            Testing Agent (20min)
            ↓
            Performance Agent (10min)
            ↓
            → Bug Fixed & Validated
```

### Workflow 4: Release Preparation (1-2 hours)
```
Ready to Release → Security Agent (20min)
                  ↓
                  Testing Agent (20min)
                  ↓
                  Performance Agent (15min)
                  ↓
                  Documentation Agent (20min)
                  ↓
                  → Release Ready
```

---

## 🛠️ Skills Quick Lookup by Task

**NEW: Integrated Skills Library** (700+ available skills)

### 🔧 Common Tasks → Recommended Skills

| Task | Primary Skill | Secondary Skills |
|------|---------------|------------------|
| **Add Feature** | `@ai-product`, `@api-design-principles` | `@database-design`, `@agent-tool-builder` |
| **Fix Bug** | `@error-diagnostics-error-analysis` | `@distributed-tracing`, `@testing-patterns` |
| **Optimize Performance** | `@performance-profiling` | `@performance-optimizer`, `@database-optimizer` |
| **Security Review** | `@security-audit` | `@secrets-management`, `@auth-implementation-patterns` |
| **Write Tests** | `@testing-patterns` | `@test-driven-development`, `@unit-testing-test-generate` |
| **Build Agent Tool** | `@agent-tool-builder` | `@api-design-principles`, `@error-handling-patterns` |
| **Refactor Code** | `@code-refactoring-refactor-clean` | `@code-simplifier`, `@architecture-patterns` |
| **Architecture Review** | `@ddd-strategic-design` | `@architecture-patterns`, `@database-design` |
| **Deploy Release** | `@deployment-pipeline-design` | `@github-actions-templates`, `@docker-expert` |
| **Optimize Database** | `@database-design` | `@database-optimizer`, `@database-migrations-sql-migrations` |

### 🚀 Getting Started with Skills

1. **See [SKILLS_INDEX.md](SKILLS_INDEX.md)** - Full catalog of 700+ available skills
2. **See [SKILLS_INTEGRATION_GUIDE.md](SKILLS_INTEGRATION_GUIDE.md)** - How to use skills with agents
3. **In agent prompts**, use syntax: `Use @skill-name to [specific request]`

### ⭐ Top 10 Essential Skills for This Project

1. `@agent-tool-builder` - Design agent tools
2. `@mcp-builder` - Build MCP servers
3. `@agent-orchestration-multi-agent-optimize` - Multi-agent tuning
4. `@database-design` - Schema design
5. `@api-design-principles` - API design
6. `@testing-patterns` - Test strategy
7. `@security-audit` - Security review
8. `@performance-profiling` - Baseline metrics
9. `@auth-implementation-patterns` - Auth system
10. `@error-handling-patterns` - Error handling

## 🎓 Using Each Agent

### 🔍 Project Explorer
**Start Here First**
- Goal: Understand project architecture completely
- Time: 30-60 minutes
- Output: Architecture overview, dependency map, health report
- Next: Move to specific agents for detailed work

### 🔒 Security Agent
**Before Release & After Dependencies Update**
- Goal: Find vulnerabilities and security issues
- Time: 30-45 minutes
- Output: Vulnerability report, risk assessment, fixes
- Blocks: Fix critical issues before proceeding

### 🐛 Debugger Agent
**When Bugs Reported**
- Goal: Identify and fix bugs
- Time: Variable (depends on complexity)
- Output: Fixed code, root cause analysis, tests
- Follow-up: Run Testing Agent to verify

### 🏗️ Architecture Agent
**During Design & Refactoring**
- Goal: Improve design and reduce technical debt
- Time: 1-2 hours for review
- Output: Design recommendations, refactoring plan
- Follow-up: Use for implementing improvements

### ✨ Feature Research Agent
**Planning Phase**
- Goal: Identify valuable new features
- Time: 1-2 hours per feature
- Output: Feature ideas, feasibility analysis, roadmap
- Follow-up: Use Architecture Agent for design

### ⚡ Performance Agent
**Before Release & When Issues Occur**
- Goal: Optimize performance and efficiency
- Time: 1-2 hours for analysis
- Output: Bottlenecks identified, optimization plan
- Follow-up: Implement optimizations with Architecture Agent

### 🔌 Integration Agent
**Adding Tools or Providers**
- Goal: Plan and implement integrations
- Time: 1-3 hours per integration
- Output: Integration plan, architecture, roadmap
- Follow-up: Testing Agent for validation

### ✅ Testing Agent
**Before Each Commit/Release**
- Goal: Ensure adequate test coverage
- Time: 30-60 minutes
- Output: Test strategy, test cases, automation plan
- Follow-up: Implement tests and run Debugger if issues found

### 📚 Documentation Agent
**When Creating New Features**
- Goal: Maintain clear documentation
- Time: 30-45 minutes
- Output: Documentation audit, missing docs, templates
- Follow-up: Create and maintain documentation

## 📊 Task-to-Agent Mapping

| Task | Primary Agent | Supporting Agents |
|------|--------------|-------------------|
| Start new work | 🔍 Explorer | - |
| Find bugs | 🐛 Debugger | 🔍 Explorer |
| Improve security | 🔒 Security | 🐛 Debugger |
| Optimize code | 🏗️ Architecture | ⚡ Performance |
| Add feature | ✨ Feature Research | 🏗️ Architecture |
| Speed up system | ⚡ Performance | 🔍 Explorer |
| Add tool/provider | 🔌 Integration | 🏗️ Architecture |
| Improve tests | ✅ Testing | 🐛 Debugger |
| Update docs | 📚 Documentation | 🔍 Explorer |
| Before release | 🔒 Security | ✅ Testing, ⚡ Performance |

## ⏱️ Estimated Time Investment

### Daily (5 minutes)
- Review agent summaries
- Prioritize daily tasks

### Weekly (1-2 hours)
- Run Security Agent (30min)
- Run Testing Agent (30min)
- Review findings and plan fixes (30min)

### Monthly (3-4 hours)
- Run Performance Agent (1hr)
- Run Architecture Agent (1hr)
- Run Documentation Agent (30min)
- Plan optimizations (30min)

### Quarterly (8-10 hours)
- Run Project Explorer (1hr)
- Run all agents (4hrs)
- Review findings (2hrs)
- Plan major improvements (2-3hrs)

## 🎯 Success Metrics by Agent

| Agent | Metric | Good | Excellent |
|-------|--------|------|-----------|
| 🔍 Explorer | Architecture clarity | Understood | Documented |
| 🔒 Security | Vulnerabilities found | 0 Critical | 0 All |
| 🐛 Debugger | Bug fix rate | Weekly | Daily |
| 🏗️ Architecture | Tech debt score | Stable | Decreasing |
| ✨ Feature | Features delivered | On time | Ahead |
| ⚡ Performance | Response time | < 100ms | < 50ms |
| 🔌 Integration | Tools available | Growing | Planned |
| ✅ Testing | Code coverage | > 80% | > 90% |
| 📚 Documentation | Onboarding time | < 2h | < 1h |

## 💾 File Structure

```
prompts/
├── README.md                          # Start here!
├── QUICK_REFERENCE.md                # This file
├── AGENT_STRATEGY.md                 # Detailed strategy guide
│
├── project-explorer-agent.prompt.md   # 🔍 Full exploration
├── security-agent.prompt.md           # 🔒 Security
├── debugger-agent.prompt.md           # 🐛 Debugging
├── architecture-agent.prompt.md       # 🏗️ Architecture
├── feature-research-agent.prompt.md   # ✨ Features
├── performance-agent.prompt.md        # ⚡ Performance
├── integration-agent.prompt.md        # 🔌 Integration
├── testing-agent.prompt.md            # ✅ Testing
└── documentation-agent.prompt.md      # 📚 Documentation
```

## 🚦 Getting Started

### Today (30 minutes)
1. Read this file (5 min)
2. Read `README.md` (10 min)
3. Pick one agent for current task (5 min)
4. Run that agent (10 min)

### This Week (2-3 hours)
1. Run Project Explorer for full understanding
2. Run Security Agent for audit
3. Run Testing Agent for test coverage
4. Review findings and plan next steps

### This Month
1. Use agents based on your workflow
2. Track improvements using metrics
3. Refine agent usage patterns
4. Share results with team

## 🎓 Learning Resources

1. **README.md** - Overview and how to use
2. **AGENT_STRATEGY.md** - Detailed strategy and workflows
3. **Each agent's .prompt.md** - Specific expertise and checklists
4. **This file** - Quick reference and navigation

## 📞 Quick Decisions

**"I don't know where to start"**
→ Run 🔍 Project Explorer

**"My app is crashing"**
→ Run 🐛 Debugger Agent

**"Is my code secure?"**
→ Run 🔒 Security Agent

**"How do I improve this?"**
→ Run 🏗️ Architecture Agent

**"What features should I add?"**
→ Run ✨ Feature Research Agent

**"Why is it slow?"**
→ Run ⚡ Performance Agent

**"How do I add new tools?"**
→ Run 🔌 Integration Agent

**"Do I have good tests?"**
→ Run ✅ Testing Agent

**"Is documentation complete?"**
→ Run 📚 Documentation Agent

---

**Next: Choose an agent for your current task or start with 🔍 Project Explorer!**
