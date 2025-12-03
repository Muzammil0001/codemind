import * as vscode from 'vscode';

// ============================================================================
// AI Model Types
// ============================================================================

export type ModelProvider =
    | 'groq'
    | 'deepseek'
    | 'gemini'
    | 'openai'
    | 'anthropic'
    | 'xai'
    | 'ollama'
    | 'lmstudio';

export type ModelCapability =
    | 'code-generation'
    | 'code-completion'
    | 'code-review'
    | 'explanation'
    | 'refactoring'
    | 'testing'
    | 'documentation'
    | 'image-to-code';

export interface ModelConfig {
    id: string;
    provider: ModelProvider;
    name: string;
    contextWindow: number;
    capabilities: ModelCapability[];
    costPerToken: number; // 0 for free models
    averageLatency: number; // milliseconds
    isLocal: boolean;
    requiresApiKey: boolean;
}

export interface AIRequest {
    prompt: string;
    systemPrompt?: string;
    context?: string[];
    maxTokens?: number;
    temperature?: number;
    stream?: boolean;
    model?: string;
}

export interface AIResponse {
    content: string;
    model: string;
    provider: ModelProvider;
    tokensUsed: number;
    latency: number;
    cached: boolean;
}

// ============================================================================
// Permission & Safety Types
// ============================================================================

export type PermissionLevel = 'allow-once' | 'always-allow' | 'always-ask' | 'deny';

export type ActionCategory =
    | 'file-delete'
    | 'file-rename'
    | 'file-move'
    | 'file-overwrite'
    | 'folder-create'
    | 'folder-delete'
    | 'large-refactor'
    | 'terminal-command'
    | 'dependency-install'
    | 'env-modify'
    | 'db-migration'
    | 'auth-modify'
    | 'framework-modify';

export type RiskLevel = 'safe' | 'moderate' | 'high' | 'critical';

export interface ActionRequest {
    id: string;
    category: ActionCategory;
    riskLevel: RiskLevel;
    description: string;
    affectedFiles: string[];
    estimatedImpact: string;
    reversible: boolean;
    timestamp: number;
}

export interface PermissionDecision {
    actionId: string;
    decision: PermissionLevel;
    timestamp: number;
    reason?: string;
}

export interface PermissionMemoryEntry {
    category: ActionCategory;
    decision: PermissionLevel;
    createdAt: number;
    lastUsed: number;
    useCount: number;
}

// ============================================================================
// Codebase Intelligence Types
// ============================================================================

export interface FileNode {
    path: string;
    language: string;
    size: number;
    lastModified: number;
    imports: string[];
    exports: string[];
    functions: FunctionNode[];
    classes: ClassNode[];
    dependencies: string[];
}

export interface FunctionNode {
    name: string;
    startLine: number;
    endLine: number;
    parameters: ParameterNode[];
    returnType?: string;
    isAsync: boolean;
    isExported: boolean;
    calls: string[];
    complexity: number;
}

export interface ClassNode {
    name: string;
    startLine: number;
    endLine: number;
    extends?: string;
    implements: string[];
    methods: FunctionNode[];
    properties: PropertyNode[];
    isExported: boolean;
}

export interface ParameterNode {
    name: string;
    type?: string;
    optional: boolean;
    defaultValue?: string;
}

export interface PropertyNode {
    name: string;
    type?: string;
    visibility: 'public' | 'private' | 'protected';
    isStatic: boolean;
    isReadonly: boolean;
}

export interface DependencyGraph {
    nodes: Map<string, FileNode>;
    edges: Map<string, Set<string>>;
    circularDependencies: string[][];
}

export interface FolderInfo {
    name: string;
    path: string;
    type: 'frontend' | 'backend' | 'fullstack' | 'component' | 'api' | 'service' | 'util' | 'config' | 'test' | 'docs' | 'unknown';
    language?: string;
    indicators?: string[];
    fileCount?: number;
}

export interface ProjectStructure {
    root: string;
    name: string;
    type: 'monorepo' | 'single' | 'mixed' | 'unknown';
    languages: string[];
    frameworks: DetectedFramework[];
    folders: FolderInfo[];
    frontendPaths: string[];
    backendPaths: string[];
    componentPaths: string[];
    summary: string;
}

export interface ProjectBrainState {
    rootPath: string;
    fileCount: number;
    totalLines: number;
    languages: Map<string, number>;
    frameworks: DetectedFramework[];
    dependencyGraph: DependencyGraph;
    projectStructure?: ProjectStructure;
    lastAnalyzed: number;
    analysisProgress: number;
}

export interface DetectedFramework {
    name: string;
    version?: string;
    confidence: number;
    configFiles: string[];
    entryPoints: string[];
    conventions?: {
        description: string;
        patterns: Record<string, string[]>;
        specialRules?: string[];
    };
}

export interface CodeStyle {
    indentation: 'spaces' | 'tabs';
    indentSize: number;
    quotes: 'single' | 'double';
    semicolons: boolean;
    namingConvention: 'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case';
    importStyle: 'named' | 'default' | 'mixed';
}

// ============================================================================
// Agent Types
// ============================================================================

export type AgentType =
    | 'planner'
    | 'coder'
    | 'reviewer'
    | 'tester'
    | 'documenter'
    | 'image-to-code'
    | 'langchain';

export interface AgentTask {
    id: string;
    type: AgentType;
    description: string;
    context: TaskContext;
    priority: number;
    status: 'pending' | 'running' | 'completed' | 'failed';
    createdAt: number;
    startedAt?: number;
    completedAt?: number;
    result?: AgentResult;
    error?: string;
}

export interface TaskContext {
    files: string[];
    codeSelection?: vscode.Range;
    userPrompt: string;
    projectBrain?: ProjectBrainState;
    relatedTasks?: string[];
    modelId?: string;
}

export interface AgentResult {
    taskId: string;
    success: boolean;
    output: string;
    filesModified: string[];
    filesCreated: string[];
    filesDeleted: string[];
    suggestions: string[];
    warnings: string[];
    commandIds?: string[]; // Terminal command IDs for tracking output
    metrics: {
        tokensUsed: number;
        latency: number;
        linesChanged: number;
        operationsExecuted?: number;
    };
}

export interface ExecutionPlan {
    id: string;
    steps: PlanStep[];
    estimatedDuration: number;
    riskAssessment: RiskLevel;
    requiresApproval: boolean;
    createdAt: number;
}

export interface PlanStep {
    id: string;
    description: string;
    action: ActionCategory;
    dependencies: string[];
    estimatedDuration: number;
    riskLevel: RiskLevel;
}

// ============================================================================
// File Operation Types
// ============================================================================

export interface FileOperation {
    type: 'create' | 'modify' | 'delete' | 'rename' | 'move';
    path: string;
    newPath?: string;
    content?: string;
    diff?: FileDiff;
    backup?: string;
}

export interface FileDiff {
    original: string;
    modified: string;
    hunks: DiffHunk[];
    stats: {
        additions: number;
        deletions: number;
        changes: number;
    };
}

export interface DiffHunk {
    oldStart: number;
    oldLines: number;
    newStart: number;
    newLines: number;
    lines: DiffLine[];
}

export interface DiffLine {
    type: 'add' | 'delete' | 'context';
    content: string;
    lineNumber: number;
}

// ============================================================================
// Memory Types
// ============================================================================

export interface MemoryEntry {
    id: string;
    type: 'conversation' | 'operation' | 'context' | 'learning';
    content: string;
    metadata: Record<string, any>;
    embedding?: number[];
    createdAt: number;
    relevance: number;
}

export interface ProjectMemory {
    projectPath: string;
    entries: MemoryEntry[];
    lastUpdated: number;
    totalOperations: number;
}

// ============================================================================
// Suggestion Types
// ============================================================================

export interface CodeSuggestion {
    type: 'completion' | 'refactor' | 'import' | 'fix' | 'security' | 'performance';
    range: vscode.Range;
    text: string;
    description: string;
    confidence: number;
    priority: number;
}

// ============================================================================
// UI Types
// ============================================================================

export interface WebviewMessage {
    type: string;
    payload: any;
}

export interface UIState {
    theme: 'dark' | 'light' | 'auto';
    layout: 'default' | 'compact' | 'expanded';
    activeTab: string;
    showMetrics: boolean;
    showLogs: boolean;
}

export interface MetricsData {
    totalTokensUsed: number;
    averageLatency: number;
    requestCount: number;
    cacheHitRate: number;
    activeModel: string;
    uptime: number;
}

// ============================================================================
// Configuration Types
// ============================================================================

export interface ExtensionConfig {
    primaryModel: string;
    enableAutoFallback: boolean;
    enableLocalModels: boolean;
    ollamaUrl: string;
    lmstudioUrl: string;
    apiKeys: {
        groq?: string;
        deepseek?: string;
        gemini?: string;
        openai?: string;
        anthropic?: string;
    };
    enableInlineSuggestions: boolean;
    enableCodebaseAnalysis: boolean;
    turboMode: boolean;
    safetyLevel: 'strict' | 'moderate' | 'relaxed';
    theme: 'auto' | 'dark' | 'light' | 'custom';
    maxContextLines: number;
    enableParallelExecution: boolean;
    cacheEmbeddings: boolean;
}
