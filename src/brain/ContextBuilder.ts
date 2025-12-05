
import * as vscode from 'vscode';
import { projectBrain } from './ProjectBrain';
import { semanticSearch } from '../search/SemanticSearch';
import { codeIndexer } from '../search/CodeIndexer';
import { memoryEngine } from '../memory/MemoryEngine';
import { logger } from '../utils/logger';

export interface ContextBuilderOptions {
    userQuery: string;
    maxFiles?: number;
    maxMemories?: number;
    includeProjectStructure?: boolean;
    includeDependencies?: boolean;
    includeMemory?: boolean;
    includeSymbols?: boolean;
}

export interface BuiltContext {
    query: string;
    projectStructure: string;
    relevantFiles: Array<{
        path: string;
        content: string;
        reason: string;
        language?: string;
    }>;
    relevantSymbols: Array<{
        name: string;
        type: 'function' | 'class';
        file: string;
        signature: string;
    }>;
    dependencies: Array<{
        file: string;
        dependents: string[];
        dependencies: string[];
    }>;
    memories: Array<{
        type: string;
        content: string;
        timestamp: number;
    }>;
    summary: string;
    contextPrompt: string;
}

export class ContextBuilder {

    /**
     * Build comprehensive context for AI agent based on user query
     */
    async buildContext(options: ContextBuilderOptions): Promise<BuiltContext> {
        const {
            userQuery,
            maxFiles = 5,
            maxMemories = 10,
            includeProjectStructure = true,
            includeDependencies = true,
            includeMemory = true,
            includeSymbols = true
        } = options;

        logger.info(`Building context for query: "${userQuery}"`);

        const context: BuiltContext = {
            query: userQuery,
            projectStructure: '',
            relevantFiles: [],
            relevantSymbols: [],
            dependencies: [],
            memories: [],
            summary: '',
            contextPrompt: ''
        };

        // 1. Get project structure context
        if (includeProjectStructure) {
            context.projectStructure = await this.getProjectStructureContext(userQuery);
        }

        // 2. Find relevant files using multiple strategies
        const relevantFilePaths = await this.findRelevantFiles(userQuery, maxFiles);

        // 3. Load file contents with context
        for (const filePath of relevantFilePaths) {
            const fileContext = await this.getFileContext(filePath, userQuery);
            if (fileContext) {
                context.relevantFiles.push(fileContext);
            }
        }

        // 4. Extract relevant symbols (functions/classes)
        if (includeSymbols) {
            context.relevantSymbols = await this.findRelevantSymbols(userQuery, context.relevantFiles);
        }

        // 5. Get dependency information
        if (includeDependencies && context.relevantFiles.length > 0) {
            context.dependencies = await this.getDependencyContext(context.relevantFiles.map(f => f.path));
        }

        // 6. Retrieve relevant memories
        if (includeMemory) {
            context.memories = await this.getRelevantMemories(userQuery, maxMemories);
        }

        // 7. Generate summary and context prompt
        context.summary = this.generateContextSummary(context);
        context.contextPrompt = this.buildContextPrompt(context);

        logger.info(`Context built: ${context.relevantFiles.length} files, ${context.relevantSymbols.length} symbols`);

        return context;
    }

    /**
     * Get project structure context based on query
     */
    private async getProjectStructureContext(query: string): Promise<string> {
        logger.info(`🏗️ Building project structure context for query: "${query}"`);
        const structure = projectBrain.getProjectStructure();
        if (!structure) {
            logger.warn('⚠️ No project structure available');
            return '';
        }

        logger.info(`📊 Project structure loaded: ${structure.name} (${structure.type}) with ${structure.frameworks.length} frameworks detected`);
        const context = projectBrain.getStructureContext(query);
        logger.info(`📝 Generated context prompt (${context.length} chars) for file placement decisions`);
        return context;
    }

    private async findRelevantFiles(query: string, maxFiles: number): Promise<string[]> {
        const filePaths = new Set<string>();

        const mentionRegex = /@([^\s]+)/g;
        let match;
        while ((match = mentionRegex.exec(query)) !== null) {
            const mentionedPath = match[1];
            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            if (workspaceRoot) {
                let fullPath = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), mentionedPath).fsPath;
                if (await this.fileExists(fullPath)) {
                    filePaths.add(fullPath);
                    continue;
                }
                console.log('Found file:', fullPath);
                const ignorePattern = '**/{node_modules,venv,.venv,target,vendor,bin,obj,dist,build,out}/**';
                const files = await vscode.workspace.findFiles(`**/${mentionedPath}*`, ignorePattern, 1);
                if (files.length > 0) {
                    filePaths.add(files[0].fsPath);
                }
            }
        }

        // Strategy 1: Use project brain's relevance scoring
        try {
            const brainResults = await projectBrain.getRelevantContext(query, maxFiles);
            brainResults.forEach(path => filePaths.add(path));
        } catch (error) {
            logger.warn('Project brain search failed', error as Error);
        }

        // Strategy 2: Semantic search
        try {
            const semanticResults = await semanticSearch.search(query, maxFiles);
            semanticResults.forEach(result => {
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (workspaceRoot) {
                    const fullPath = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), result.path).fsPath;
                    filePaths.add(fullPath);
                }
            });
        } catch (error) {
            logger.warn('Semantic search failed', error as Error);
        }

        // Strategy 3: Keyword-based code indexer search
        try {
            const keywordResults = codeIndexer.search(query, maxFiles);
            keywordResults.forEach(path => {
                const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
                if (workspaceRoot) {
                    const fullPath = vscode.Uri.joinPath(vscode.Uri.file(workspaceRoot), path).fsPath;
                    filePaths.add(fullPath);
                }
            });
        } catch (error) {
            logger.warn('Keyword search failed', error as Error);
        }

        // Return top N results
        return Array.from(filePaths).slice(0, maxFiles);
    }

    /**
     * Get file context including content and metadata
     */
    private async getFileContext(filePath: string, query: string): Promise<{
        path: string;
        content: string;
        reason: string;
        language?: string;
    } | null> {
        try {
            const uri = vscode.Uri.file(filePath);
            const document = await vscode.workspace.openTextDocument(uri);
            const content = document.getText();

            // Determine why this file is relevant
            const reason = this.determineRelevanceReason(filePath, query, content);

            return {
                path: vscode.workspace.asRelativePath(filePath),
                content: content.length > 5000 ? content.substring(0, 5000) + '\n... (truncated)' : content,
                reason,
                language: document.languageId
            };
        } catch (error) {
            logger.error(`Failed to get file context for ${filePath}`, error as Error);
            return null;
        }
    }

    /**
     * Determine why a file is relevant to the query
     */
    private determineRelevanceReason(filePath: string, query: string, content: string): string {
        const reasons: string[] = [];
        const queryLower = query.toLowerCase();
        const pathLower = filePath.toLowerCase();
        const contentLower = content.toLowerCase();

        // Check filename match
        if (pathLower.includes(queryLower)) {
            reasons.push('filename matches query');
        }

        // Check content match
        const queryWords = queryLower.split(/\s+/);
        const matchingWords = queryWords.filter(word => contentLower.includes(word));
        if (matchingWords.length > 0) {
            reasons.push(`contains ${matchingWords.length}/${queryWords.length} query terms`);
        }

        // Check if it's a key file type
        if (pathLower.includes('component') && queryLower.includes('component')) {
            reasons.push('component file');
        }
        if (pathLower.includes('api') || pathLower.includes('route')) {
            reasons.push('API/route file');
        }

        return reasons.length > 0 ? reasons.join(', ') : 'semantic similarity';
    }

    /**
     * Find relevant symbols (functions/classes) from files
     */
    private async findRelevantSymbols(query: string, files: Array<{ path: string; content: string }>): Promise<Array<{
        name: string;
        type: 'function' | 'class';
        file: string;
        signature: string;
    }>> {
        const symbols: Array<{
            name: string;
            type: 'function' | 'class';
            file: string;
            signature: string;
        }> = [];

        const queryLower = query.toLowerCase();

        for (const file of files) {
            const brainState = projectBrain.getState();
            if (!brainState) continue;

            const fileNode = brainState.dependencyGraph.nodes.get(file.path);
            if (!fileNode) continue;

            // Add relevant functions
            for (const func of fileNode.functions) {
                if (func.name.toLowerCase().includes(queryLower) ||
                    queryLower.includes(func.name.toLowerCase())) {
                    symbols.push({
                        name: func.name,
                        type: 'function',
                        file: file.path,
                        signature: `${func.name}(${func.parameters.map(p => p.name).join(', ')})`
                    });
                }
            }

            // Add relevant classes
            for (const cls of fileNode.classes) {
                if (cls.name.toLowerCase().includes(queryLower) ||
                    queryLower.includes(cls.name.toLowerCase())) {
                    symbols.push({
                        name: cls.name,
                        type: 'class',
                        file: file.path,
                        signature: `class ${cls.name}`
                    });
                }
            }
        }

        return symbols.slice(0, 10); // Limit to top 10 symbols
    }

    /**
     * Get dependency context for files
     */
    private async getDependencyContext(filePaths: string[]): Promise<Array<{
        file: string;
        dependents: string[];
        dependencies: string[];
    }>> {
        const dependencies: Array<{
            file: string;
            dependents: string[];
            dependencies: string[];
        }> = [];

        for (const filePath of filePaths) {
            try {
                const context = await projectBrain.getFileContext(filePath);
                dependencies.push({
                    file: vscode.workspace.asRelativePath(filePath),
                    dependents: context.dependents.map(d => vscode.workspace.asRelativePath(d)),
                    dependencies: context.dependencies.map(d => vscode.workspace.asRelativePath(d))
                });
            } catch (error) {
                // Skip if file context not available
            }
        }

        return dependencies;
    }

    /**
     * Get relevant memories based on query
     */
    private async getRelevantMemories(query: string, maxMemories: number): Promise<Array<{
        type: string;
        content: string;
        timestamp: number;
    }>> {
        try {
            const memories = await memoryEngine.searchMemories(query, maxMemories);
            return memories.map(m => ({
                type: m.type,
                content: m.content.substring(0, 200), // Truncate long memories
                timestamp: m.timestamp
            }));
        } catch (error) {
            logger.warn('Failed to retrieve memories', error as Error);
            return [];
        }
    }

    /**
     * Generate a summary of the built context
     */
    private generateContextSummary(context: BuiltContext): string {
        const parts: string[] = [];

        if (context.projectStructure) {
            parts.push('Project structure analyzed');
        }

        if (context.relevantFiles.length > 0) {
            const languages = [...new Set(context.relevantFiles.map(f => f.language).filter(Boolean))];
            parts.push(`${context.relevantFiles.length} relevant files (${languages.join(', ')})`);
        }

        if (context.relevantSymbols.length > 0) {
            const funcCount = context.relevantSymbols.filter(s => s.type === 'function').length;
            const classCount = context.relevantSymbols.filter(s => s.type === 'class').length;
            parts.push(`${funcCount} functions, ${classCount} classes`);
        }

        if (context.dependencies.length > 0) {
            parts.push(`${context.dependencies.length} dependency graphs`);
        }

        if (context.memories.length > 0) {
            parts.push(`${context.memories.length} relevant memories`);
        }

        return parts.join(' • ') || 'No context available';
    }

    /**
     * Build the final context prompt for the AI
     */
    private buildContextPrompt(context: BuiltContext): string {
        let prompt = '';

        if (context.projectStructure) {
            prompt += context.projectStructure + '\n\n';
        }

        // Add relevant files
        if (context.relevantFiles.length > 0) {
            prompt += '## Relevant Files\n\n';
            for (const file of context.relevantFiles) {
                prompt += `### ${file.path}\n`;
                prompt += `**Language:** ${file.language || 'unknown'}\n`;
                prompt += `**Relevance:** ${file.reason}\n\n`;
                prompt += '```' + (file.language || '') + '\n';
                prompt += file.content + '\n';
                prompt += '```\n\n';
            }
        }

        // Add relevant symbols
        if (context.relevantSymbols.length > 0) {
            prompt += '## Relevant Symbols\n\n';
            for (const symbol of context.relevantSymbols) {
                prompt += `- **${symbol.name}** (${symbol.type}) in \`${symbol.file}\`: \`${symbol.signature}\`\n`;
            }
            prompt += '\n';
        }

        // Add dependencies
        if (context.dependencies.length > 0) {
            prompt += '## Dependencies\n\n';
            for (const dep of context.dependencies) {
                if (dep.dependencies.length > 0 || dep.dependents.length > 0) {
                    prompt += `**${dep.file}**:\n`;
                    if (dep.dependencies.length > 0) {
                        prompt += `  - Depends on: ${dep.dependencies.slice(0, 3).join(', ')}${dep.dependencies.length > 3 ? '...' : ''}\n`;
                    }
                    if (dep.dependents.length > 0) {
                        prompt += `  - Used by: ${dep.dependents.slice(0, 3).join(', ')}${dep.dependents.length > 3 ? '...' : ''}\n`;
                    }
                }
            }
            prompt += '\n';
        }

        // Add memories
        if (context.memories.length > 0) {
            prompt += '## Previous Context\n\n';
            for (const memory of context.memories.slice(0, 3)) {
                prompt += `- [${memory.type}] ${memory.content}\n`;
            }
            prompt += '\n';
        }

        return prompt;
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            return true;
        } catch {
            return false;
        }
    }
}

export const contextBuilder = new ContextBuilder();
