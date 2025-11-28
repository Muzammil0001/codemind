

export interface ToolResult<T = any> {
    success: boolean;
    data?: T;
    error?: string;
    metadata?: Record<string, any>;
}

export interface SearchResult {
    path: string;
    score: number;
    type: 'file' | 'function' | 'class' | 'variable';
    line?: number;
    column?: number;
    context?: string;
    snippet?: string;
}

export interface PatchResult {
    success: boolean;
    filePath: string;
    changes: {
        additions: number;
        deletions: number;
        modifications: number;
    };
    conflicts?: Array<{
        line: number;
        original: string;
        proposed: string;
    }>;
    backup?: string;
}

export interface ASTEditResult {
    success: boolean;
    filePath: string;
    changes: string[];
    ast?: any;
    error?: string;
}

export interface TerminalResult {
    success: boolean;
    stdout: string;
    stderr: string;
    exitCode: number;
    duration: number;
    command: string;
}

export interface BaseTool {
    name: string;
    description: string;
    execute(...args: any[]): Promise<ToolResult>;
}

export interface FileSearchOptions {
    query: string;
    type?: 'file' | 'symbol' | 'content';
    fuzzy?: boolean;
    semantic?: boolean;
    maxResults?: number;
    fileTypes?: string[];
}

export interface FilePatchOptions {
    filePath: string;
    patch: string;
    createBackup?: boolean;
    validateBeforeApply?: boolean;
    resolveConflicts?: 'auto' | 'manual' | 'fail';
}

export interface ASTEditOptions {
    filePath: string;
    operation: 'rename' | 'add-parameter' | 'remove-parameter' | 'add-import' | 'remove-import' | 'modify-function';
    target: string;
    value?: any;
    preserveFormatting?: boolean;
}

export interface TerminalOptions {
    command: string;
    cwd?: string;
    env?: Record<string, string>;
    timeout?: number;
    shell?: boolean;
}
