import * as vscode from 'vscode';
import * as path from 'path';
import { distance } from 'fuzzball';
import FlexSearch from 'flexsearch';
import { modelRouter } from '../ai/ModelRouter';
import type { BaseTool, ToolResult, SearchResult, FileSearchOptions } from './types';
import { logger } from '../utils/logger';

export class FileSearchTool implements BaseTool {
    name = 'file_search';
    description = 'Search for files, symbols, and code content with fuzzy and semantic matching';

    private fileIndex: any;
    private symbolIndex: any;
    private embeddingCache: Map<string, number> = new Map();

    constructor() {
        // @ts-ignore
        this.fileIndex = new FlexSearch.Index({
            tokenize: 'forward',
            resolution: 9
        });

        // @ts-ignore
        this.symbolIndex = new FlexSearch.Index({
            tokenize: 'full',
            resolution: 9
        });
    }

    async execute(options: FileSearchOptions): Promise<ToolResult<SearchResult[]>> {
        try {
            const { query, type = 'file', fuzzy = true, semantic = false, maxResults = 20 } = options;

            let results: SearchResult[] = [];

            // File search
            if (type === 'file') {
                results = await this.searchFiles(query, fuzzy, semantic, maxResults);
            }
            // Symbol search (functions, classes, variables)
            else if (type === 'symbol') {
                results = await this.searchSymbols(query, fuzzy, maxResults);
            }
            // Content search
            else if (type === 'content') {
                results = await this.searchContent(query, maxResults);
            }

            return {
                success: true,
                data: results,
                metadata: {
                    query,
                    type,
                    resultCount: results.length
                }
            };
        } catch (error) {
            logger.error('File search failed', error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    /**
     * Search for files with fuzzy and semantic matching
     */
    private async searchFiles(
        query: string,
        fuzzy: boolean,
        semantic: boolean,
        maxResults: number
    ): Promise<SearchResult[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) return [];

        // Find all files
        const files = await vscode.workspace.findFiles(
            '**/*',
            '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**,**/build/**}',
            1000
        );

        const results: SearchResult[] = [];

        for (const file of files) {
            const relativePath = vscode.workspace.asRelativePath(file);
            const fileName = path.basename(relativePath);

            let score = 0;

            // Fuzzy matching
            if (fuzzy) {
                const pathScore = distance(query.toLowerCase(), relativePath.toLowerCase());
                const nameScore = distance(query.toLowerCase(), fileName.toLowerCase());
                score = Math.max(pathScore, nameScore);
            }

            // Semantic matching (if enabled)
            if (semantic && score < 80) {
                const semanticScore = await this.getSemanticSimilarity(query, relativePath);
                score = Math.max(score, semanticScore);
            }

            if (score > 50) {
                results.push({
                    path: relativePath,
                    score,
                    type: 'file'
                });
            }
        }

        // Sort by score and limit results
        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
    }


    private async searchSymbols(query: string, fuzzy: boolean, maxResults: number): Promise<SearchResult[]> {
        const results: SearchResult[] = [];

        // Get all document symbols in workspace
        const files = await vscode.workspace.findFiles(
            '**/*.{ts,tsx,js,jsx,py,go,rs,java}',
            '{**/node_modules/**,**/.git/**}',
            100
        );

        for (const file of files) {
            try {
                const document = await vscode.workspace.openTextDocument(file);
                const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                    'vscode.executeDocumentSymbolProvider',
                    file
                );

                if (!symbols) continue;

                for (const symbol of symbols) {
                    const score = fuzzy
                        ? distance(query.toLowerCase(), symbol.name.toLowerCase())
                        : query.toLowerCase() === symbol.name.toLowerCase() ? 100 : 0;

                    if (score > 60) {
                        results.push({
                            path: vscode.workspace.asRelativePath(file),
                            score,
                            type: this.mapSymbolKind(symbol.kind),
                            line: symbol.range.start.line,
                            column: symbol.range.start.character,
                            context: symbol.name
                        });
                    }

                    if (symbol.children) {
                        results.push(...this.searchSymbolChildren(symbol.children, query, fuzzy, file));
                    }
                }
            } catch (error) {
                logger.error(`Failed to search symbols in ${file.fsPath}`, error as Error);
            }
        }

        return results
            .sort((a, b) => b.score - a.score)
            .slice(0, maxResults);
    }


    private searchSymbolChildren(
        symbols: vscode.DocumentSymbol[],
        query: string,
        fuzzy: boolean,
        file: vscode.Uri
    ): SearchResult[] {
        const results: SearchResult[] = [];

        for (const symbol of symbols) {
            const score = fuzzy
                ? distance(query.toLowerCase(), symbol.name.toLowerCase())
                : query.toLowerCase() === symbol.name.toLowerCase() ? 100 : 0;

            if (score > 60) {
                results.push({
                    path: vscode.workspace.asRelativePath(file),
                    score,
                    type: this.mapSymbolKind(symbol.kind),
                    line: symbol.range.start.line,
                    column: symbol.range.start.character,
                    context: symbol.name
                });
            }

            if (symbol.children) {
                results.push(...this.searchSymbolChildren(symbol.children, query, fuzzy, file));
            }
        }

        return results;
    }

    private async searchContent(query: string, maxResults: number): Promise<SearchResult[]> {
        const results: SearchResult[] = [];

        const files = await vscode.workspace.findFiles(
            '**/*.{ts,tsx,js,jsx,py,go,rs,java,md,json,txt}',
            '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**}',
            100
        );

        for (const file of files) {
            try {
                const content = await vscode.workspace.fs.readFile(file);
                const text = Buffer.from(content).toString('utf8');
                const lines = text.split('\n');

                for (let i = 0; i < lines.length; i++) {
                    if (lines[i].toLowerCase().includes(query.toLowerCase())) {
                        results.push({
                            path: vscode.workspace.asRelativePath(file),
                            score: 100,
                            type: 'file',
                            line: i,
                            column: lines[i].toLowerCase().indexOf(query.toLowerCase()),
                            snippet: lines[i].trim()
                        });

                        if (results.length >= maxResults) return results;
                    }
                }
            } catch (error) {
                logger.error(`Failed to search content in ${file.fsPath}`, error as Error);
            }
        }

        return results;
    }

    private async getSemanticSimilarity(query: string, text: string): Promise<number> {
        try {
            const cacheKey = `${query}::${text}`;
            if (this.embeddingCache.has(cacheKey)) {
                return this.embeddingCache.get(cacheKey)!;
            }

            const queryWords = query.toLowerCase().split(/\s+/);
            const textWords = text.toLowerCase().split(/[\s\/\\_\\.]+/);

            const matches = queryWords.filter(word => textWords.some(tw => tw.includes(word)));
            const score = (matches.length / queryWords.length) * 100;

            this.embeddingCache.set(cacheKey, score);
            return score;
        } catch (error) {
            return 0;
        }
    }

    private mapSymbolKind(kind: vscode.SymbolKind): SearchResult['type'] {
        switch (kind) {
            case vscode.SymbolKind.Function:
            case vscode.SymbolKind.Method:
                return 'function';
            case vscode.SymbolKind.Class:
            case vscode.SymbolKind.Interface:
                return 'class';
            case vscode.SymbolKind.Variable:
            case vscode.SymbolKind.Constant:
            case vscode.SymbolKind.Property:
                return 'variable';
            default:
                return 'file';
        }
    }

    async indexWorkspace(): Promise<void> {
        const files = await vscode.workspace.findFiles(
            '**/*',
            '{**/node_modules/**,**/.git/**}',
            1000
        );

        for (let i = 0; i < files.length; i++) {
            const relativePath = vscode.workspace.asRelativePath(files[i]);
            this.fileIndex.add(i, relativePath);
        }

        logger.info(`Indexed ${files.length} files`);
    }
}
