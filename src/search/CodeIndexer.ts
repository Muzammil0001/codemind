import * as vscode from 'vscode';
import * as fs from 'fs-extra';
import * as path from 'path';
import FlexSearch from 'flexsearch';
import { logger } from '../utils/logger';

export interface CodeIndexEntry {
    id: string;
    path: string;
    content: string;
    type: 'file' | 'function' | 'class';
    startLine?: number;
    endLine?: number;
}

export class CodeIndexer {
    private index: any;
    private fileHashes: Map<string, string> = new Map();
    private isIndexing: boolean = false;

    constructor() {
        // @ts-ignore
        this.index = new FlexSearch.Index({
            tokenize: 'full',
            resolution: 9,
            cache: true
        });
    }

    async indexWorkspace(): Promise<void> {
        if (this.isIndexing) return;
        this.isIndexing = true;

        try {
            logger.info('Starting workspace indexing...');
            const files = await vscode.workspace.findFiles(
                '**/*.{ts,tsx,js,jsx,py,go,rs,java}',
                '{**/node_modules/**,**/.git/**,**/dist/**,**/out/**}',
                1000
            );

            for (const file of files) {
                await this.indexFile(file);
            }

            logger.info(`Indexed ${files.length} files`);
        } catch (error) {
            logger.error('Workspace indexing failed', error as Error);
        } finally {
            this.isIndexing = false;
        }
    }

    async indexFile(uri: vscode.Uri): Promise<void> {
        try {
            const content = await fs.readFile(uri.fsPath, 'utf-8');
            const relativePath = vscode.workspace.asRelativePath(uri);

            const hash = this.computeHash(content);
            if (this.fileHashes.get(relativePath) === hash) {
                return;
            }

            // Index full file content
            this.index.add(relativePath, content);
            this.fileHashes.set(relativePath, hash);

            // Extract and index symbols using AST
            try {
                const { astParser } = await import('../brain/ASTParser');
                const parsed = await astParser.parseFile(uri.fsPath);

                // Index functions
                for (const func of parsed.functions) {
                    const symbolId = `${relativePath}::${func.name}`;
                    const symbolContent = `${func.name} function ${func.parameters.map(p => p.name).join(' ')}`;
                    this.index.add(symbolId, symbolContent);
                }

                // Index classes
                for (const cls of parsed.classes) {
                    const symbolId = `${relativePath}::${cls.name}`;
                    const symbolContent = `${cls.name} class ${cls.methods.map(m => m.name).join(' ')}`;
                    this.index.add(symbolId, symbolContent);
                }

                logger.info(`Indexed ${parsed.functions.length} functions and ${parsed.classes.length} classes from ${relativePath}`);
            } catch (error) {
                logger.warn(`AST parsing failed for ${relativePath}, using content-only indexing`);
            }

        } catch (error) {
            logger.error(`Failed to index file ${uri.fsPath}`, error as Error);
        }
    }

    search(query: string, limit: number = 20): string[] {
        return this.index.search(query, limit) as string[];
    }

    private computeHash(content: string): string {
        let hash = 0;
        for (let i = 0; i < content.length; i++) {
            const char = content.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash.toString();
    }
}

export const codeIndexer = new CodeIndexer();
