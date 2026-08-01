/* eslint-disable no-redeclare */
import { createDecorator } from './instantiation/instantiation';
import { DapState, McpServer, McpToolDefinition, McpStatusChange, CollaborationState, TimelineAction, HoverResult } from './types';

// ── TraceLogger Service ──
export interface TracePayload {
  timestamp: string;
  sessionId: string;
  provider: string;
  model: string;
  systemPrompt?: string;
  messages: Array<{
    role: string;
    content: string;
    toolName?: string;
    toolCallId?: string;
    toolInput?: any;
    toolResult?: string;
  }>;
  response: {
    content: string;
    tokensUsed: number;
    toolCalls?: Array<{
      id: string;
      toolName: string;
      input: any;
    }>;
  };
}

export const ITraceLogger = createDecorator<ITraceLogger>('traceLogger');
export interface ITraceLogger {
  log(payload: TracePayload): void;
  listTraces(): Array<{ name: string; sizeBytes: number; createdAt: string }>;
}

// ── Autocomplete Service ──
export const IAutocompleteService = createDecorator<IAutocompleteService>('autocompleteService');
export interface IAutocompleteService {
  predict(prefix: string, suffix: string, providerName: string, modelName: string): Promise<string>;
  predictOneShot(prompt: string, systemPrompt: string, providerName: string, modelName: string): Promise<string>;
}

// ── SystemCapability Service ──
export interface Capability {
  toolName: string;
  isInstalled: boolean;
  version: string | null;
  installPath: string | null;
  lastChecked?: string;
}

export const ISystemCapabilityService = createDecorator<ISystemCapabilityService>('systemCapabilityService');
export interface ISystemCapabilityService {
  getCapabilities(): Capability[];
  scan(): Promise<Capability[]>;
  getRecommendations(workspaceFiles: string[]): string[];
}

// ── Dap Service ──
export const IDapService = createDecorator<IDapService>('dapService');
export interface IDapService {
  getStatus(): DapState;
  toggleBreakpoint(filePath: string, line: number): void;
  startDebugSession(port: number, scriptPath: string): void;
  stopDebugSession(): void;
  stepOver(): void;
  stepInto(): void;
  stepOut(): void;
  continueExecution(): void;
  explainDebuggerState(goal: string): Promise<string>;
}

// ── CostManager Service ──
export const ICostManager = createDecorator<ICostManager>('costManager');
export interface ICostManager {
  calculateCost(provider: string, model: string, inputTokens: number, outputTokens: number): number;
  logTransaction(sessionId: string, provider: string, model: string, inputTokens: number, outputTokens: number): number;
  getDailyCost(): number;
  getMonthlyCost(): number;
  checkBudgetLimits(): void;
  getCostSummary(): Record<string, any>;
}

// ── CodeIntelligence Service ──
export const ICodeIntelligenceService = createDecorator<ICodeIntelligenceService>('codeIntelligenceService');
export interface ICodeIntelligenceService {
  setWorkspace(path: string | null, options?: { skipIndexing?: boolean }): Promise<void>;
  indexFile(filePath: string): { symbols: number; references: number };
  getIndexStats(): { files: number; symbols: number; references: number };
}

// ── Composer Service ──
export const IComposerService = createDecorator<IComposerService>('composerService');
export interface IComposerService {
  isStagingActive(): boolean;
  getStagedContent(filePath: string): string | undefined;
  isStagedDeleted(filePath: string): boolean;
  stageWrite(filePath: string, content: string): void;
  stageDelete(filePath: string): void;
  getStagedFileContent(filePath: string): { original: string; proposed: string };
  startComposerTask(goal: string, workspacePath: string): Promise<void>;
  approveChanges(): void;
  rejectChanges(): void;
  cancelActiveTask(): void;
}

// ── McpServerManager Service ──
export const IMcpServerManager = createDecorator<IMcpServerManager>('mcpServerManager');
export interface IMcpServerManager {
  list(): McpServer[];
  getTools(): Array<McpToolDefinition & { serverId: string; serverName: string }>;
  start(serverId: string): Promise<McpStatusChange>;
  stop(serverId: string): McpStatusChange;
  test(serverId: string): Promise<{ success: boolean; error?: string; toolsCount?: number }>;
  callTool(serverId: string, toolName: string, args: Record<string, unknown>): Promise<unknown>;
  stopAll(): void;
  on(event: 'status-change', listener: (change: McpStatusChange) => void): this;
}

// ── McpGallery Service ──
export interface McpGalleryItem {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  downloadUrl?: string;
  tools?: string[];
}

export const IMcpGalleryService = createDecorator<IMcpGalleryService>('mcpGalleryService');
export interface IMcpGalleryService {
  browse(): Promise<McpGalleryItem[]>;
  install(server: McpGalleryItem): Promise<void>;
  uninstall(serverId: string): Promise<void>;
  getInstalled(): Promise<McpGalleryItem[]>;
}

// ── McpManagement Service ──
export const IMcpManagementService = createDecorator<IMcpManagementService>('mcpManagementService');
export interface IMcpManagementService {
  startServer(id: string): Promise<void>;
  stopServer(id: string): Promise<void>;
  restartServer(id: string): Promise<void>;
  getServerStatus(id: string): 'running' | 'starting' | 'stopped' | 'error';
  isServerAllowed(id: string): boolean;
  setServerAllowed(id: string, allowed: boolean): void;
}

// ── McpResourceScanner Service ──
export interface McpResource {
  uri: string;
  name: string;
  description?: string;
  mimeType?: string;
}

export const IMcpResourceScannerService = createDecorator<IMcpResourceScannerService>('mcpResourceScannerService');
export interface IMcpResourceScannerService {
  scanResources(serverId: string): Promise<McpResource[]>;
  getResourceContent(serverId: string, resourceUri: string): Promise<string>;
}

// ── AgentHost Service ──
export interface AgentHostSession {
  id: string;
  workspacePath: string;
  status: 'running' | 'checkpointed' | 'terminated';
  logs: string[];
}

export const IAgentHostService = createDecorator<IAgentHostService>('agentHostService');
export interface IAgentHostService {
  spawnHost(workspacePath: string, sandboxConfig?: any): Promise<AgentHostSession>;
  checkpointHost(sessionId: string): Promise<string>;
  restoreHost(sessionId: string, checkpointId: string): Promise<void>;
  terminateHost(sessionId: string): Promise<void>;
  getSession(sessionId: string): AgentHostSession | undefined;
}

// ── SessionsProviders Service ──
export interface ISessionsProvider {
  readonly id: string;
  readonly name: string;
  createSession(workspacePath: string): Promise<any>;
}

export const ISessionsProvidersService = createDecorator<ISessionsProvidersService>('sessionsProvidersService');
export interface ISessionsProvidersService {
  registerProvider(provider: ISessionsProvider): void;
  getProviders(): ISessionsProvider[];
  createSession(providerId: string, workspacePath: string): Promise<any>;
}

// ── CustomizationHarness Service ──
export interface CustomizationItem {
  id: string;
  type: 'prompt' | 'instruction' | 'hook' | 'skill';
  content: string;
}

export const ICustomizationHarnessService = createDecorator<ICustomizationHarnessService>('customizationHarnessService');
export interface ICustomizationHarnessService {
  getCustomizations(harnessId: string): CustomizationItem[];
  setCustomization(harnessId: string, item: CustomizationItem): void;
}

// ── Skills Service ──
export interface Skill {
  id: string;
  name: string;
  description: string;
  content: string;
  tags: string[];
}

export const ISkillsService = createDecorator<ISkillsService>('skillsService');
export interface ISkillsService {
  discoverSkills(workspacePath: string): Promise<Skill[]>;
  getSkill(id: string): Skill | undefined;
}

// ── CodeSmellSweeper Service ──
export interface SweeperFinding {
  filePath: string;
  line: number;
  ruleId: string;
  message: string;
  proposedFix?: string;
}

export const ICodeSmellSweeperService = createDecorator<ICodeSmellSweeperService>('codeSmellSweeperService');
export interface ICodeSmellSweeperService {
  sweep(workspacePath: string): Promise<SweeperFinding[]>;
  proposeSplit(filePath: string): Promise<{ modules: string[]; proposedCode: Record<string, string> }>;
}

// ── VisualCanvas Service ──
export interface CanvasLayout {
  id: string;
  code: string;
  previewUrl?: string;
}

export const IVisualCanvasService = createDecorator<IVisualCanvasService>('visualCanvasService');
export interface IVisualCanvasService {
  compileMockup(mockupPath: string): Promise<CanvasLayout>;
  mapClickToCode(layoutId: string, x: number, y: number): { filePath: string; line: number };
}

// ── PerformanceProfiler Service ──
export interface TelemetrySpan {
  id: string;
  name: string;
  durationMs: number;
  metadata?: Record<string, any>;
}

export const IPerformanceProfilerService = createDecorator<IPerformanceProfilerService>('performanceProfilerService');
export interface IPerformanceProfilerService {
  startSpan(name: string): string;
  endSpan(spanId: string, metadata?: Record<string, any>): void;
  getSpans(): TelemetrySpan[];
  logSlowQuery(query: string, durationMs: number): void;
}

// ── WebSandbox Service ──
export interface SandboxServer {
  id: string;
  port: number;
  status: 'stopped' | 'starting' | 'running';
}

export const IWebSandboxService = createDecorator<IWebSandboxService>('webSandboxService');
export interface IWebSandboxService {
  startServer(workspacePath: string): Promise<SandboxServer>;
  stopServer(serverId: string): Promise<void>;
  inspectStyles(serverId: string, selector: string): Promise<Record<string, string>>;
}

// ── CDP Inspector Service ──
export const ICdpInspectorService = createDecorator<ICdpInspectorService>('cdpInspectorService');
export interface ICdpInspectorService {
  getDomTree(workspacePath: string, htmlContent?: string): any;
  inspectElementBySelector(selector: string, htmlContent?: string): any;
  updateElementStyle(selector: string, property: string, value: string): boolean;
  getConsoleLogs(): any[];
  logMessage(level: 'info' | 'warn' | 'error' | 'log', message: string, source?: string): void;
  takeHeapSnapshot(): { totalJSHeapSize: number; usedJSHeapSize: number; timestamp: number };
  getInjectedCdpScript(port: number): string;
}

// ── IpcFramework Service (Milestone 26) ──
export interface IChannel {
  call(command: string, arg?: any): Promise<any>;
}
export interface IServerChannel {
  call(command: string, arg: any): Promise<any>;
}
export const IIpcFrameworkService = createDecorator<IIpcFrameworkService>('ipcFrameworkService');
export interface IIpcFrameworkService {
  registerChannel(channelName: string, channel: IServerChannel): void;
  getChannel(channelName: string): IChannel;
}

// ── TestOrchestrator Service (Milestone 27) ──
export interface TestRunResult {
  passed: boolean;
  exitCode: number;
  stdout: string;
  stderr: string;
}
export const ITestOrchestratorService = createDecorator<ITestOrchestratorService>('testOrchestratorService');
export interface ITestOrchestratorService {
  generateTestSuite(filePath: string, testContent: string): Promise<string>;
  runTestSuite(testFilePath: string): Promise<TestRunResult>;
  autonomousRepairLoop(testFilePath: string, sourceFilePath: string, maxRetries?: number): Promise<boolean>;
}

// ── DatabaseExplorer Service (Milestone 28) ──
export interface DBTableInfo {
  name: string;
  type: string;
}
export interface DBColumnInfo {
  name: string;
  type: string;
  notnull: boolean;
  dflt_value: any;
  pk: boolean;
}
export const IDatabaseExplorerService = createDecorator<IDatabaseExplorerService>('databaseExplorerService');
export interface IDatabaseExplorerService {
  getTables(): Promise<DBTableInfo[]>;
  getTableSchema(tableName: string): Promise<DBColumnInfo[]>;
  executeQuery(sql: string): Promise<any[]>;
  generateSchemaDeclaration(format: 'prisma' | 'drizzle'): Promise<string>;
  generateMockData(tableName: string, count: number): Promise<any[]>;
}

// ── Deployment Service (Milestone 29) ──
export const IDeploymentService = createDecorator<IDeploymentService>('deploymentService');
export interface IDeploymentService {
  generateIaC(workspacePath: string, target: 'docker' | 'serverless'): Promise<{ filePath: string; content: string }>;
  verifyPreDeployBuild(workspacePath: string): Promise<{ success: boolean; log: string }>;
}

// ── ArchitectWiki Service (Milestone 30) ──
export const IArchitectWikiService = createDecorator<IArchitectWikiService>('architectWikiService');
export interface IArchitectWikiService {
  analyzeCodebase(workspacePath: string): Promise<{ filesParsed: number; importsMap: Record<string, string[]> }>;
  generateMermaidDiagram(workspacePath: string): Promise<string>;
  writeWikiFile(workspacePath: string): Promise<string>;
}

// ── Collaboration Service (Milestone 31) ──
export const ICollaborationService = createDecorator<ICollaborationService>('collaborationService');
export interface ICollaborationService {
  createRoom(roomName: string, passcode?: string): Promise<{ roomId: string; inviteCode: string }>;
  joinRoom(inviteCode: string, user: string): Promise<boolean>;
  leaveRoom(): Promise<void>;
  getRoomState(): CollaborationState;
  broadcastCursor(filePath: string, line: number, column: number): void;
  sendChangePacket(filePath: string, changeText: string, range: any): void;
  getTimeline(): TimelineAction[];
  logTimelineAction(user: string, action: string): void;
  encryptPayload(payload: string): string;
  decryptPayload(cipher: string): string;
}

// ── LSP Engine Service (Milestone 32) ──
export const ILspService = createDecorator<ILspService>('lspService');
export interface ILspService {
  startLanguageServer(languageId: string, workspacePath: string): Promise<boolean>;
  stopLanguageServer(languageId: string): Promise<void>;
  getHover(filePath: string, line: number, column: number, content?: string): Promise<HoverResult | null>;
  getCompletion(filePath: string, line: number, column: number, content?: string): Promise<any[]>;
  getSignatureHelp(filePath: string, line: number, column: number, content?: string): Promise<any | null>;
}

