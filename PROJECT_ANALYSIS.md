# Lumiq Project Analysis

## Overview
Lumiq is an Electron-based desktop AI companion with a layered architecture:
- `src/main`: Electron main process, database, provider adapters, IPC, agent loop, tool execution, security.
- `src/preload`: secure context bridge exposing a whitelisted Electron API to renderer.
- `src/renderer/src`: React UI with Zustand state management and Monaco editor integration.
- `src/shared`: shared TypeScript types between main, preload, and renderer.
- `extensions/vscode`: companion VS Code integration using local gRPC to connect to Lumiq.

The project aims to provide multi-model provider orchestration, agentic tool execution, local semantic search (RAG), MCP server management, Git integration, OAuth providers, and self-healing workflows.

## Architecture
- Main process creates BrowserWindow with sandboxed renderer and strong security defaults.
- Preload API is tightly scoped and exposes only whitelisted IPC methods.
- Provider abstraction (`AIProvider`) allows adding new model endpoints consistently.
- Agent loop supports streaming responses, tool calls, provider failover, retry/backoff, context trimming, and loop detection.
- Tool executor separates read-only vs write tools, applies permission modes, and supports approval dialogs.
- SQLite database uses WAL, migrations, backups, integrity checks, and recovery.
- VS Code extension talks to local Lumiq via gRPC and supports remote session/chat commands.

## Key Findings
- The codebase is feature-rich and architected for extensibility.
- There is broad provider support: OpenAI, Anthropic, Gemini, Ollama, Bedrock, GitHub, Groq, OpenRouter, DeepSeek, and Custom endpoints.
- Security posture is strong in many areas: sandboxed renderer, CSP headers, external link handling, permission request denial, and whitelisted IPC.
- The project has tests for agent failover, semantic indexing, context management, and more.
- There are multiple high-value integrations: tool approval, RAG, MCP server tool discovery, self-healing, and workspace task sync.

## Notes
- `package.json` uses `electron: ^41.5.1`, which is extremely old. If this is intentional, it creates a compatibility and security risk.
- The repo contains rich documentation (`README.md`, `CONTRIBUTING.md`, `SECURITY.md`, `prompt.md`, `nextPlan.md`) and indicates a mature roadmap.
- The app uses `keytar`, `better-sqlite3`, and native modules, which are fine but require native build tooling on install.
- `electron.vite.config.ts` sets aliases cleanly; the renderer and preload bundling are properly separated.

## Recommended Next Actions
1. Validate the `electron` version and update to a secure supported version if possible.
2. Audit all provider implementations for typed event handling, especially `BedrockProvider`.
3. Refactor `AgentLoop.getFallbackConfigs` to handle multiple configs of the same provider type.
4. Review the VS Code gRPC integration for local trust assumptions.
5. Add a dedicated security test for the preload bridge and CSP behavior.
