# Lumiq Repository Bug Report

This document records concrete issues discovered during a deep inspection of the current Lumiq repository.

## 1. System prompt contamination in `src/main/ipc/chatHandlers.ts`
- Issue: `DEFAULT_SYSTEM_PROMPT` was polluted with internal tool usage guidance and agent tooling instructions.
- Impact: The model may receive irrelevant prompt text, internal policy instructions, or hidden tool strategy guidance, which can degrade responses and introduce unpredictable behavior.
- Fix: Keep the system prompt focused on Lumiq behavior only. Remove the injected tool operation guide from the prompt string.

## 2. Compiled output also contained the same contamination (`out/main/index.js`)
- Issue: The built Electron main bundle still contained the same polluted system prompt and a syntactically invalid insertion after the change.
- Impact: If the app loads the compiled bundle directly, it can still execute with wrong prompt content and may fail parsing in the runtime.
- Fix: Keep generated output in sync with source or regenerate the build after source fixes.

## 3. Context trimming is based on message count, not token usage (`src/main/agent/ContextManager.ts`)
- Issue: `ContextManager.trimMessages()` limits history by number of messages, not by estimated token size.
- Impact: Long messages or tool-result-heavy conversations can still exceed provider token limits, reducing performance and causing possible provider rejection.
- Fix: Use token-based trimming or provider-specific token budgeting, and consider summarizing older turns before trimming.

## 4. Agent loop has a fixed 20-iteration safety cap without diagnostic context (`src/main/agent/AgentLoop.ts`)
- Issue: `MAX_ITERATIONS = 20` is hard-coded and will silently stop long tool chains.
- Impact: Complex tool-driven workflows may terminate unexpectedly without clear diagnostics, making hard failures harder to debug.
- Fix: Make the limit configurable and add a diagnostic message or log entry when the loop limit is hit.

## 5. gRPC auth token generation is brittle (`src/main/services/grpc/DeveloperGrpcServer.ts`)
- Issue: A temporary auth token is auto-generated if `LUMIQ_GRPC_AUTH_TOKEN` is missing, but there is no documented or programmatic way to retrieve it for a client.
- Impact: Local gRPC clients may be unable to connect unless the token is manually obtained from console logs or environment setup.
- Fix: Expose the active token through secure IPC, a status endpoint, or require the caller to explicitly provide a stable token.

## Notes
- These issues are highest priority because they directly affect agent behavior, prompt correctness, and runtime reliability.
- The prompt contamination bug is especially severe because it changes the effective model instruction set.
