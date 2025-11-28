

import * as vscode from 'vscode';
import * as path from 'path';
import { DependencyGraph, FileNode } from '../types';
import { logger } from '../utils/logger';
import { astParser } from './ASTParser';

export class DependencyGraphBuilder {
    private graph: DependencyGraph = {
        nodes: new Map(),
        edges: new Map(),
        circularDependencies: []
    };

    async buildGraph(workspaceRoot: string): Promise<DependencyGraph> {
        logger.info('Building dependency graph...');

        const files = await this.findAllFiles(workspaceRoot);

        for (const file of files) {
            await this.addFileToGraph(file);
        }

        this.buildEdges();

        this.detectCircularDependencies();

        logger.info(`Dependency graph built: ${this.graph.nodes.size} files, ${this.graph.edges.size} dependencies`);

        return this.graph;
    }

    private async findAllFiles(workspaceRoot: string): Promise<string[]> {
        const files: string[] = [];
        const pattern = new vscode.RelativePattern(workspaceRoot, '**/*.{ts,tsx,js,jsx,py,go,rs,java}');
        const excludePattern = '**/node_modules/**';

        const uris = await vscode.workspace.findFiles(pattern, excludePattern);

        for (const uri of uris) {
            files.push(uri.fsPath);
        }

        return files;
    }

    private async addFileToGraph(filePath: string): Promise<void> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const parsed = await astParser.parseFile(filePath);

            const fileNode: FileNode = {
                path: filePath,
                language: document.languageId,
                size: document.getText().length,
                lastModified: Date.now(),
                imports: parsed.imports,
                exports: parsed.exports,
                functions: parsed.functions,
                classes: parsed.classes,
                dependencies: this.extractDependencies(parsed.imports, filePath)
            };

            this.graph.nodes.set(filePath, fileNode);
        } catch (error) {
            logger.error(`Failed to add file to graph: ${filePath}`, error as Error);
        }
    }

    private extractDependencies(imports: string[], currentFile: string): string[] {
        const dependencies: string[] = [];
        const currentDir = path.dirname(currentFile);

        for (const importStatement of imports) {
            const match = importStatement.match(/from\s+['"]([^'"]+)['"]/);
            if (!match) {
                continue;
            }

            const importPath = match[1];

            if (!importPath.startsWith('.')) {
                continue;
            }

            const resolvedPath = this.resolveImportPath(importPath, currentDir);
            if (resolvedPath) {
                dependencies.push(resolvedPath);
            }
        }

        return dependencies;
    }

    private resolveImportPath(importPath: string, currentDir: string): string | null {
        const extensions = ['.ts', '.tsx', '.js', '.jsx', '.py', '.go', '.rs', '.java'];

        let resolvedPath = path.resolve(currentDir, importPath);

        for (const ext of extensions) {
            const withExt = resolvedPath + ext;
            if (this.graph.nodes.has(withExt)) {
                return withExt;
            }
        }

        for (const ext of extensions) {
            const indexPath = path.join(resolvedPath, `index${ext}`);
            if (this.graph.nodes.has(indexPath)) {
                return indexPath;
            }
        }

        return null;
    }

    private buildEdges(): void {
        for (const [filePath, fileNode] of this.graph.nodes.entries()) {
            const dependencies = new Set<string>();

            for (const dep of fileNode.dependencies) {
                if (this.graph.nodes.has(dep)) {
                    dependencies.add(dep);
                }
            }

            this.graph.edges.set(filePath, dependencies);
        }
    }

    private detectCircularDependencies(): void {
        const visited = new Set<string>();
        const recursionStack = new Set<string>();
        const cycles: string[][] = [];

        const dfs = (node: string, path: string[]): void => {
            visited.add(node);
            recursionStack.add(node);
            path.push(node);

            const dependencies = this.graph.edges.get(node) || new Set();

            for (const dep of dependencies) {
                if (!visited.has(dep)) {
                    dfs(dep, [...path]);
                } else if (recursionStack.has(dep)) {
                    const cycleStart = path.indexOf(dep);
                    const cycle = path.slice(cycleStart);
                    cycles.push(cycle);
                }
            }

            recursionStack.delete(node);
        };

        for (const node of this.graph.nodes.keys()) {
            if (!visited.has(node)) {
                dfs(node, []);
            }
        }

        this.graph.circularDependencies = cycles;

        if (cycles.length > 0) {
            logger.warn(`Detected ${cycles.length} circular dependencies`);
        }
    }

    getDependents(filePath: string): string[] {
        const dependents: string[] = [];

        for (const [file, deps] of this.graph.edges.entries()) {
            if (deps.has(filePath)) {
                dependents.push(file);
            }
        }

        return dependents;
    }

    getDependencies(filePath: string): string[] {
        const deps = this.graph.edges.get(filePath);
        return deps ? Array.from(deps) : [];
    }

    getImpactAnalysis(filePath: string): {
        directDependents: string[];
        indirectDependents: string[];
        totalImpact: number;
    } {
        const directDependents = this.getDependents(filePath);
        const indirectDependents = new Set<string>();

        const traverse = (file: string) => {
            const deps = this.getDependents(file);
            for (const dep of deps) {
                if (!directDependents.includes(dep) && !indirectDependents.has(dep)) {
                    indirectDependents.add(dep);
                    traverse(dep);
                }
            }
        };

        for (const dep of directDependents) {
            traverse(dep);
        }

        return {
            directDependents,
            indirectDependents: Array.from(indirectDependents),
            totalImpact: directDependents.length + indirectDependents.size
        };
    }

    getCircularDependencies(): string[][] {
        return this.graph.circularDependencies;
    }

    getGraph(): DependencyGraph {
        return this.graph;
    }

    clear(): void {
        this.graph = {
            nodes: new Map(),
            edges: new Map(),
            circularDependencies: []
        };
    }
}

export const dependencyGraphBuilder = new DependencyGraphBuilder();
