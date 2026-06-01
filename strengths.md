# Lumiq Strengths

## Architecture & Design
- Clean separation between `main`, `preload`, `renderer`, and `shared`.
- Strong typed interface boundaries with shared TypeScript types.
- Secure renderer sandboxing and strict Content Security Policy on app load.
- Modular provider factory (`ProviderFactory`) enables multi-provider support.
- Good use of IPC and contextBridge to avoid exposing Node APIs to renderer.

## Feature Set
- Multi-provider AI support: OpenAI, Anthropic, Gemini, Ollama, Bedrock, GitHub, Groq, OpenRouter, DeepSeek, Custom.
- Agent loop with streaming, tool invocation, retry/backoff, provider failover, and circular tool-call detection.
- Robust tool ecosystem: Bash, FileRead, FileWrite, FileEdit, Glob, Grep, WebFetch, WebSearch, Git, Terminal, Notebook, Clipboard, Archive, HTTP, Env, and dynamic MCP tools.
- Permission modes and user approval flow provide strong control over unsafe operations.
- Local semantic search / RAG support and workspace context compaction.
- SQLite migrations with self-healing, recovery, backup, and WAL mode.
- VS Code integration through a companion extension and local gRPC.

## Security & Safety
- Renderer has `nodeIntegration` disabled and is sandboxed.
- Web preferences explicitly disable insecure webviews and node integration in workers.
- IPC bridge exposes only whitelisted channels.
- External links are opened in the OS browser, not inside the app.
- SQL prepared statements are used, and foreign keys are enforced.

## Developer Experience
- Detailed documentation and contributing guidelines are present.
- Scripts for dev, build, lint, typecheck, and tests are already configured.
- `electron-vite` configuration supports aliasing and React/Tailwind integration.
- Tests exist for critical agent behavior and semantic code indexing.
