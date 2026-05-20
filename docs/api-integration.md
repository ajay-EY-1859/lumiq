# 🔌 API INTEGRATION GUIDE
## Lumiq — openclaude GUI

**Version:** 1.0
**Date:** April 27, 2026

---

## 1. OVERVIEW

The app supports 7 AI providers through a unified interface. All providers implement the same `AIProvider` interface — the UI never talks to providers directly, only through the main process IPC layer.

---

## 2. SUPPORTED PROVIDERS

### 2.1 Anthropic Claude

| Property | Value |
|----------|-------|
| SDK | `@anthropic-ai/sdk` |
| Base URL | `https://api.anthropic.com` |
| Auth | `x-api-key` header |
| Streaming | Server-sent events (SSE) |
| Models | claude-opus-4, claude-sonnet-4, claude-haiku-4 |

```typescript
// AnthropicProvider.ts
import Anthropic from '@anthropic-ai/sdk';

export class AnthropicProvider implements AIProvider {
  private client: Anthropic;

  constructor(config: ProviderConfig) {
    this.client = new Anthropic({
      apiKey: config.apiKey,
      baseURL: config.baseUrl  // optional override
    });
  }

  async sendMessage(messages: Message[], options: SendOptions): Promise<SendResult> {
    const stream = this.client.messages.stream({
      model: options.model,
      max_tokens: options.maxTokens ?? 8096,
      system: options.systemPrompt,
      messages: messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    });

    let content = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        content += event.delta.text;
        options.onChunk?.(event.delta.text);
        if (options.signal?.aborted) break;
      }
    }

    const finalMessage = await stream.finalMessage();
    return {
      content,
      tokensUsed: finalMessage.usage.output_tokens,
      stopReason: finalMessage.stop_reason ?? 'end_turn'
    };
  }

  async listModels(): Promise<string[]> {
    return ['claude-opus-4-5', 'claude-sonnet-4-5', 'claude-haiku-4-5'];
  }

  async testConnection(): Promise<TestResult> {
    try {
      await this.client.messages.create({
        model: 'claude-haiku-4-5',
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }]
      });
      return { success: true };
    } catch (e) {
      return { success: false, error: (e as Error).message };
    }
  }
}
```

---

### 2.2 OpenAI

| Property | Value |
|----------|-------|
| SDK | `openai` |
| Base URL | `https://api.openai.com/v1` |
| Auth | `Authorization: Bearer <key>` |
| Streaming | Server-sent events |
| Models | gpt-4o, gpt-4o-mini, gpt-4-turbo, gpt-3.5-turbo |

```typescript
// OpenAIProvider.ts
import OpenAI from 'openai';

export class OpenAIProvider implements AIProvider {
  private client: OpenAI;

  constructor(config: ProviderConfig) {
    this.client = new OpenAI({
      apiKey: config.apiKey,
      baseURL: config.baseUrl
    });
  }

  async sendMessage(messages: Message[], options: SendOptions): Promise<SendResult> {
    const openaiMessages: OpenAI.ChatCompletionMessageParam[] = [];

    if (options.systemPrompt) {
      openaiMessages.push({ role: 'system', content: options.systemPrompt });
    }

    openaiMessages.push(...messages.map(m => ({
      role: m.role as 'user' | 'assistant',
      content: m.content
    })));

    const stream = await this.client.chat.completions.create({
      model: options.model,
      messages: openaiMessages,
      stream: true,
      max_tokens: options.maxTokens
    });

    let content = '';
    let tokensUsed = 0;

    for await (const chunk of stream) {
      const delta = chunk.choices[0]?.delta?.content ?? '';
      content += delta;
      options.onChunk?.(delta);
      if (chunk.usage) tokensUsed = chunk.usage.completion_tokens;
      if (options.signal?.aborted) break;
    }

    return { content, tokensUsed, stopReason: 'stop' };
  }
}
```

---

### 2.3 Google Gemini

| Property | Value |
|----------|-------|
| SDK | `@google/generative-ai` |
| Base URL | `https://generativelanguage.googleapis.com` |
| Auth | API key as query param |
| Streaming | Streaming generateContent |
| Models | gemini-1.5-pro, gemini-1.5-flash, gemini-pro |

```typescript
// GeminiProvider.ts
import { GoogleGenerativeAI } from '@google/generative-ai';

export class GeminiProvider implements AIProvider {
  private genAI: GoogleGenerativeAI;

  constructor(config: ProviderConfig) {
    this.genAI = new GoogleGenerativeAI(config.apiKey!);
  }

  async sendMessage(messages: Message[], options: SendOptions): Promise<SendResult> {
    const model = this.genAI.getGenerativeModel({
      model: options.model,
      systemInstruction: options.systemPrompt
    });

    const history = messages.slice(0, -1).map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }]
    }));

    const chat = model.startChat({ history });
    const lastMessage = messages[messages.length - 1]!;

    const result = await chat.sendMessageStream(lastMessage.content);

    let content = '';
    for await (const chunk of result.stream) {
      const text = chunk.text();
      content += text;
      options.onChunk?.(text);
      if (options.signal?.aborted) break;
    }

    return { content, tokensUsed: 0, stopReason: 'stop' };
  }
}
```

---

### 2.4 Ollama (Local Models)

| Property | Value |
|----------|-------|
| SDK | HTTP client (axios) |
| Base URL | `http://localhost:11434` (configurable) |
| Auth | None |
| Streaming | NDJSON stream |
| Models | llama3, mistral, qwen2.5-coder, phi3, any installed |

```typescript
// OllamaProvider.ts
import axios from 'axios';

export class OllamaProvider implements AIProvider {
  private baseUrl: string;

  constructor(config: ProviderConfig) {
    this.baseUrl = config.baseUrl ?? 'http://localhost:11434';
  }

  async sendMessage(messages: Message[], options: SendOptions): Promise<SendResult> {
    const response = await axios.post(
      `${this.baseUrl}/api/chat`,
      {
        model: options.model,
        messages: [
          ...(options.systemPrompt ? [{ role: 'system', content: options.systemPrompt }] : []),
          ...messages.map(m => ({ role: m.role, content: m.content }))
        ],
        stream: true
      },
      {
        responseType: 'stream',
        signal: options.signal
      }
    );

    let content = '';
    for await (const chunk of response.data) {
      const lines = chunk.toString().split('\n').filter(Boolean);
      for (const line of lines) {
        const data = JSON.parse(line);
        if (data.message?.content) {
          content += data.message.content;
          options.onChunk?.(data.message.content);
        }
      }
    }

    return { content, tokensUsed: 0, stopReason: 'stop' };
  }

  async listModels(): Promise<string[]> {
    const response = await axios.get(`${this.baseUrl}/api/tags`);
    return response.data.models.map((m: { name: string }) => m.name);
  }

  async testConnection(): Promise<TestResult> {
    try {
      await axios.get(`${this.baseUrl}/api/tags`, { timeout: 3000 });
      return { success: true };
    } catch {
      return { success: false, error: 'Cannot connect to Ollama. Is it running?' };
    }
  }
}
```

---

### 2.5 DeepSeek

| Property | Value |
|----------|-------|
| SDK | OpenAI-compatible (use openai SDK) |
| Base URL | `https://api.deepseek.com/v1` |
| Auth | Bearer token |
| Models | deepseek-chat, deepseek-coder |

```typescript
// DeepSeekProvider.ts — extends OpenAIProvider with different base URL
export class DeepSeekProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super({
      ...config,
      baseUrl: config.baseUrl ?? 'https://api.deepseek.com/v1'
    });
  }

  async listModels(): Promise<string[]> {
    return ['deepseek-chat', 'deepseek-coder'];
  }
}
```

---

### 2.6 Amazon Bedrock

| Property | Value |
|----------|-------|
| SDK | `@anthropic-ai/bedrock-sdk` |
| Base URL | `https://bedrock-runtime.<region>.amazonaws.com` |
| Auth | AWS Access Key ID + Secret Access Key (no separate API key) |
| Streaming | Server-sent events (SSE) |
| Models | anthropic.claude-opus-4-5, anthropic.claude-sonnet-4-5, anthropic.claude-haiku-4-5, amazon.titan-text-express-v1 |

> **Note:** Amazon Bedrock uses AWS credentials (Access Key ID + Secret Access Key), NOT an Anthropic API key. You must first enable the desired models in your AWS Console under **Bedrock > Model Access**.

```typescript
// BedrockProvider.ts
import AnthropicBedrock from '@anthropic-ai/bedrock-sdk';

export class BedrockProvider implements AIProvider {
  private client: AnthropicBedrock;
  private region: string;

  constructor(config: ProviderConfig) {
    this.region = config.awsRegion ?? 'us-east-1';
    this.client = new AnthropicBedrock({
      awsAccessKey: config.awsAccessKeyId,
      awsSecretKey: config.awsSecretAccessKey,
      awsSessionToken: config.awsSessionToken,  // optional, for temporary credentials
      awsRegion: this.region
    });
  }

  async sendMessage(messages: Message[], options: SendOptions): Promise<SendResult> {
    const stream = this.client.messages.stream({
      model: options.model,  // e.g. 'anthropic.claude-sonnet-4-5-20251101-v1:0'
      max_tokens: options.maxTokens ?? 8096,
      system: options.systemPrompt,
      messages: messages
        .filter(m => m.role !== 'system')
        .map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))
    });

    let content = '';
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        content += event.delta.text;
        options.onChunk?.(event.delta.text);
        if (options.signal?.aborted) break;
      }
    }

    const finalMessage = await stream.finalMessage();
    return {
      content,
      tokensUsed: finalMessage.usage.output_tokens,
      stopReason: finalMessage.stop_reason ?? 'end_turn'
    };
  }

  async listModels(): Promise<string[]> {
    // Dynamically fetch all models available in your AWS account
    // Requires: aws-sdk v3 — npm install @aws-sdk/client-bedrock
    try {
      const { BedrockClient, ListFoundationModelsCommand } = await import('@aws-sdk/client-bedrock');
      const bedrockClient = new BedrockClient({
        region: this.region,
        credentials: {
          accessKeyId: this.config.awsAccessKeyId!,
          secretAccessKey: this.config.awsSecretAccessKey!,
          ...(this.config.awsSessionToken && { sessionToken: this.config.awsSessionToken })
        }
      });
      const response = await bedrockClient.send(
        new ListFoundationModelsCommand({ byOutputModality: 'TEXT' })
      );
      return (response.modelSummaries ?? [])
        .filter(m => m.modelId)
        .map(m => m.modelId!);
    } catch {
      // Fallback to known models if API call fails
      return BEDROCK_KNOWN_MODELS.map(m => m.id);
    }
  }

  async testConnection(): Promise<TestResult> {
    try {
      // Use a lightweight model for the test ping
      const testModel = this.config.defaultModel ?? 'amazon.titan-text-express-v1';
      await this.client.messages.create({
        model: testModel,
        max_tokens: 1,
        messages: [{ role: 'user', content: 'hi' }]
      });
      return { success: true };
    } catch (e) {
      const msg = (e as Error).message;
      // Give a helpful hint for common Bedrock errors
      if (msg.includes('AccessDeniedException')) {
        return { success: false, error: 'Access denied. Enable the model in AWS Console > Bedrock > Model Access.' };
      }
      if (msg.includes('UnrecognizedClientException')) {
        return { success: false, error: 'Invalid AWS credentials. Check your Access Key ID and Secret.' };
      }
      return { success: false, error: msg };
    }
  }
}
```

**ProviderConfig extension for Bedrock:**
```typescript
// In shared/types.ts — add Bedrock-specific fields
export interface ProviderConfig {
  // ... existing fields ...
  provider: 'anthropic' | 'openai' | 'gemini' | 'ollama' | 'deepseek' | 'bedrock' | 'custom';
  awsAccessKeyId?: string;      // Bedrock only
  awsSecretAccessKey?: string;  // Bedrock only (encrypted at rest)
  awsSessionToken?: string;     // Bedrock only (optional, for IAM roles)
  awsRegion?: string;           // Bedrock only, default: 'us-east-1'
}
```

**Fallback model list** (shown when AWS API call fails or before first connection):
```typescript
// bedrockModels.ts — static fallback, covers all major providers on Bedrock
export const BEDROCK_KNOWN_MODELS = [
  // Anthropic Claude
  { id: 'anthropic.claude-opus-4-5-20251101-v1:0',    label: 'Claude Opus 4.5',    provider: 'Anthropic' },
  { id: 'anthropic.claude-sonnet-4-5-20251101-v1:0',  label: 'Claude Sonnet 4.5',  provider: 'Anthropic' },
  { id: 'anthropic.claude-haiku-4-5-20251101-v1:0',   label: 'Claude Haiku 4.5',   provider: 'Anthropic' },
  // Meta Llama
  { id: 'meta.llama3-70b-instruct-v1:0',              label: 'Llama 3 70B',        provider: 'Meta' },
  { id: 'meta.llama3-8b-instruct-v1:0',               label: 'Llama 3 8B',         provider: 'Meta' },
  { id: 'meta.llama3-1-405b-instruct-v1:0',           label: 'Llama 3.1 405B',     provider: 'Meta' },
  { id: 'meta.llama3-1-70b-instruct-v1:0',            label: 'Llama 3.1 70B',      provider: 'Meta' },
  // Mistral
  { id: 'mistral.mistral-large-2402-v1:0',            label: 'Mistral Large',      provider: 'Mistral' },
  { id: 'mistral.mistral-small-2402-v1:0',            label: 'Mistral Small',      provider: 'Mistral' },
  { id: 'mistral.mixtral-8x7b-instruct-v0:1',         label: 'Mixtral 8x7B',       provider: 'Mistral' },
  // Amazon Titan
  { id: 'amazon.titan-text-express-v1',               label: 'Titan Text Express', provider: 'Amazon' },
  { id: 'amazon.titan-text-lite-v1',                  label: 'Titan Text Lite',    provider: 'Amazon' },
  { id: 'amazon.titan-text-premier-v1:0',             label: 'Titan Text Premier', provider: 'Amazon' },
  // Cohere
  { id: 'cohere.command-r-plus-v1:0',                 label: 'Command R+',         provider: 'Cohere' },
  { id: 'cohere.command-r-v1:0',                      label: 'Command R',          provider: 'Cohere' },
  // AI21 Labs
  { id: 'ai21.jamba-1-5-large-v1:0',                  label: 'Jamba 1.5 Large',    provider: 'AI21' },
  { id: 'ai21.jamba-1-5-mini-v1:0',                   label: 'Jamba 1.5 Mini',     provider: 'AI21' },
];
```

> **Important:** Not all models support the Anthropic Messages API format. Non-Anthropic models (Llama, Mistral, Titan, etc.) use the **Bedrock Converse API** instead. `BedrockProvider` automatically routes to the correct API based on the model ID prefix.

**Converse API routing for non-Anthropic models:**
```typescript
// Inside BedrockProvider — auto-detect which API to use
private isAnthropicModel(modelId: string): boolean {
  return modelId.startsWith('anthropic.');
}

async sendMessage(messages: Message[], options: SendOptions): Promise<SendResult> {
  if (this.isAnthropicModel(options.model)) {
    return this.sendViaMessagesApi(messages, options);   // @anthropic-ai/bedrock-sdk
  } else {
    return this.sendViaConverseApi(messages, options);   // @aws-sdk/client-bedrock-runtime
  }
}

private async sendViaConverseApi(messages: Message[], options: SendOptions): Promise<SendResult> {
  const { BedrockRuntimeClient, ConverseStreamCommand } = await import('@aws-sdk/client-bedrock-runtime');
  const client = new BedrockRuntimeClient({
    region: this.region,
    credentials: {
      accessKeyId: this.config.awsAccessKeyId!,
      secretAccessKey: this.config.awsSecretAccessKey!,
      ...(this.config.awsSessionToken && { sessionToken: this.config.awsSessionToken })
    }
  });

  const converseMessages = messages.map(m => ({
    role: m.role as 'user' | 'assistant',
    content: [{ text: m.content }]
  }));

  const command = new ConverseStreamCommand({
    modelId: options.model,
    messages: converseMessages,
    system: options.systemPrompt ? [{ text: options.systemPrompt }] : undefined,
    inferenceConfig: { maxTokens: options.maxTokens ?? 4096 }
  });

  const response = await client.send(command);
  let content = '';

  for await (const event of response.stream!) {
    const text = event.contentBlockDelta?.delta?.text ?? '';
    if (text) {
      content += text;
      options.onChunk?.(text);
    }
    if (options.signal?.aborted) break;
  }

  return { content, tokensUsed: 0, stopReason: 'stop' };
}
```

**Settings UI for Bedrock** (in `ApiProvidersTab.tsx`):
```
┌─────────────────────────────────────────┐
│ 🟠 Amazon Bedrock              ● ──────  │
├─────────────────────────────────────────┤
│ AWS Access Key ID                        │
│ [AKIA...                    ] [👁]       │
│                                          │
│ AWS Secret Access Key                    │
│ [****************************] [👁]       │
│                                          │
│ AWS Session Token (optional)             │
│ [Leave blank for permanent credentials]  │
│                                          │
│ AWS Region                               │
│ [us-east-1                  ▼]           │
│                                          │
│ Default Model                            │
│ [anthropic.claude-sonnet-4-5...▼]        │
│                                          │
│ [Test Connection]                        │
└─────────────────────────────────────────┘
```

---

### 2.7 Custom Provider

| Property | Value |
|----------|-------|
| SDK | OpenAI-compatible (use openai SDK) |
| Base URL | User-configured |
| Auth | Configurable (Bearer / API Key header) |
| Models | User-specified |

```typescript
// CustomProvider.ts — OpenAI-compatible endpoint
export class CustomProvider extends OpenAIProvider {
  constructor(config: ProviderConfig) {
    super(config);  // uses config.baseUrl and config.apiKey
  }
}
```

---

## 3. PROVIDER FACTORY

```typescript
// ProviderFactory.ts
export class ProviderFactory {
  static create(config: ProviderConfig): AIProvider {
    switch (config.provider) {
      case 'anthropic': return new AnthropicProvider(config);
      case 'openai':    return new OpenAIProvider(config);
      case 'gemini':    return new GeminiProvider(config);
      case 'ollama':    return new OllamaProvider(config);
      case 'deepseek':  return new DeepSeekProvider(config);
      case 'bedrock':   return new BedrockProvider(config);
      case 'custom':    return new CustomProvider(config);
      default: throw new Error(`Unknown provider: ${config.provider}`);
    }
  }
}
```

---

## 4. TOOL CALL PARSING

AI responses may contain tool calls. The agent loop parses these and routes to the tool executor.

### 4.1 Anthropic Tool Use Format

```json
{
  "type": "tool_use",
  "id": "toolu_01A09q90qw90lq917835lq9",
  "name": "BashTool",
  "input": { "command": "npm test" }
}
```

### 4.2 OpenAI Function Call Format

```json
{
  "tool_calls": [{
    "id": "call_abc123",
    "type": "function",
    "function": {
      "name": "BashTool",
      "arguments": "{\"command\": \"npm test\"}"
    }
  }]
}
```

### 4.3 Tool Schema Registration

```typescript
// Tools are registered with each provider in their schema format
const TOOLS_FOR_ANTHROPIC = [
  {
    name: 'BashTool',
    description: 'Execute a shell command',
    input_schema: {
      type: 'object',
      properties: {
        command: { type: 'string', description: 'The command to run' },
        cwd: { type: 'string', description: 'Working directory (optional)' }
      },
      required: ['command']
    }
  },
  // ... other tools
];
```

---

## 5. ERROR HANDLING

### 5.1 Error Types

```typescript
enum ApiErrorType {
  NETWORK_ERROR = 'network_error',       // No internet / server down
  AUTH_ERROR = 'auth_error',             // Invalid API key
  RATE_LIMIT = 'rate_limit',             // Too many requests
  CONTEXT_LENGTH = 'context_length',     // Message too long
  MODEL_NOT_FOUND = 'model_not_found',   // Invalid model name
  SERVER_ERROR = 'server_error',         // 5xx from provider
  CANCELLED = 'cancelled',              // User cancelled
}
```

### 5.2 Error Recovery

```typescript
// chatHandlers.ts
async function handleChatSend(event, { message, sessionId, provider, model }) {
  try {
    const client = ProviderFactory.create(getProviderConfig(provider));
    // ... send message
  } catch (error) {
    const apiError = classifyError(error);

    switch (apiError.type) {
      case ApiErrorType.AUTH_ERROR:
        event.sender.send(IPC.CHAT_ERROR, {
          error: 'Invalid API key. Check Settings > API Providers.',
          type: 'auth'
        });
        break;

      case ApiErrorType.RATE_LIMIT:
        event.sender.send(IPC.CHAT_ERROR, {
          error: 'Rate limit exceeded. Please wait a moment.',
          type: 'rate_limit',
          retryAfter: error.retryAfter
        });
        break;

      case ApiErrorType.CONTEXT_LENGTH:
        event.sender.send(IPC.CHAT_ERROR, {
          error: 'Conversation too long. Starting a new session.',
          type: 'context'
        });
        break;

      default:
        event.sender.send(IPC.CHAT_ERROR, {
          error: error.message,
          type: 'unknown'
        });
    }
  }
}
```

---

## 6. STREAMING IMPLEMENTATION

### 6.1 Main Process (sends chunks via IPC)

```typescript
// chatHandlers.ts
ipcMain.handle(IPC.CHAT_SEND, async (event, payload) => {
  const abortController = new AbortController();
  activeSessions.set(payload.sessionId, abortController);

  const client = ProviderFactory.create(config);

  await client.sendMessage(messages, {
    model: payload.model,
    stream: true,
    signal: abortController.signal,
    onChunk: (chunk) => {
      // Send each token to renderer
      event.sender.send(IPC.CHAT_STREAM_CHUNK, { chunk, sessionId: payload.sessionId });
    }
  });

  event.sender.send(IPC.CHAT_STREAM_END, { sessionId: payload.sessionId });
  activeSessions.delete(payload.sessionId);
});

ipcMain.handle(IPC.CHAT_CANCEL, (event, { sessionId }) => {
  activeSessions.get(sessionId)?.abort();
});
```

### 6.2 Renderer (receives and displays chunks)

```typescript
// useChat.ts
export function useChat() {
  const [streamingContent, setStreamingContent] = useState('');

  useEffect(() => {
    const removeChunkListener = window.electronAPI.chat.onChunk((chunk) => {
      setStreamingContent(prev => prev + chunk);
    });

    const removeEndListener = window.electronAPI.chat.onEnd(() => {
      // Move streaming content to messages store
      chatStore.finalizeStreamingMessage(streamingContent);
      setStreamingContent('');
    });

    return () => {
      removeChunkListener();
      removeEndListener();
    };
  }, []);

  return { streamingContent };
}
```

---

## 7. RATE LIMITING

```typescript
// RateLimiter.ts
class RateLimiter {
  private requests: Map<string, number[]> = new Map();

  canMakeRequest(provider: string, limit: number, windowMs: number): boolean {
    const now = Date.now();
    const timestamps = this.requests.get(provider) ?? [];
    const recent = timestamps.filter(t => now - t < windowMs);

    if (recent.length >= limit) return false;

    recent.push(now);
    this.requests.set(provider, recent);
    return true;
  }
}
```

---

## 8. PROVIDER DEFAULTS

| Provider | Default Model | Context Window | Streaming |
|----------|--------------|----------------|-----------|
| Anthropic | claude-sonnet-4-5 | 200K tokens | ✅ |
| OpenAI | gpt-4o | 128K tokens | ✅ |
| Gemini | gemini-1.5-flash | 1M tokens | ✅ |
| Ollama | llama3.2 | Model-dependent | ✅ |
| DeepSeek | deepseek-chat | 64K tokens | ✅ |
| Amazon Bedrock | anthropic.claude-sonnet-4-5 | 200K tokens | ✅ |
| Custom | User-defined | Unknown | ✅ |

---

## 🤖 AGENT INSTRUCTIONS

### On Error
Jab bhi koi error aaye task execute karte waqt, turant ek file banao:
**Filename:** `ERROR_LOG.md`

File mein yeh sab likho:
- Kaunsa task chal raha tha jab error aaya
- Error ka poora message (exact text)
- Kaunsi file ya line mein error tha
- Sambhavit karan (possible cause)
- Kya try kiya tha solve karne ke liye
- Agle steps kya hone chahiye

### On Interruption or Risk
Jab bhi task execution achanak band ho ya khatre mein ho, turant ek file banao:
**Filename:** `REMAINING_PLAN.md`

File mein yeh sab likho:
- Kya kaam poora ho chuka hai (completed tasks)
- Kaunsa kaam chal raha tha jab ruka (in-progress task)
- Kya kaam abhi bacha hai (pending tasks)
- Koi important context jo agli baar kaam aaye

---

**Document Version:** 1.0
**Last Updated:** April 27, 2026
**Status:** Ready for Development
