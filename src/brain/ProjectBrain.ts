/**
 * Project Brain - Main intelligence engine coordinating codebase analysis
 */

import * as vscode from 'vscode';
import { ProjectBrainState, CodeStyle, DetectedFramework } from '../types';
import { astParser } from './ASTParser';
import { dependencyGraphBuilder } from './DependencyGraph';
import { frameworkDetector } from './FrameworkDetector';
import { styleAnalyzer } from './StyleAnalyzer';
import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performance';
import { analysisCache } from '../utils/cache';

export class ProjectBrain {
    private state: ProjectBrainState | null = null;
    private isAnalyzing: boolean = false;
    private workspaceRoot: string | null = null;

    async initialize(workspaceRoot: string): Promise<void> {
        this.workspaceRoot = workspaceRoot;
        logger.info(`Initializing Project Brain for: ${workspaceRoot}`);

        // Check cache first
        const cacheKey = `project-brain-${workspaceRoot}`;
        const cached = analysisCache.get(cacheKey);

        if (cached) {
            this.state = cached as ProjectBrainState;
            logger.info('Loaded Project Brain from cache');
            return;
        }

        await this.analyzeProject();
    }

    async analyzeProject(): Promise<void> {
        if (this.isAnalyzing) {
            logger.warn('Analysis already in progress');
            return;
        }

        if (!this.workspaceRoot) {
            throw new Error('Workspace root not set');
        }

        this.isAnalyzing = true;

        try {
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: 'CodeMind AI: Analyzing codebase...',
                cancellable: false
            }, async (progress) => {
                // Step 1: Build dependency graph
                progress.report({ message: 'Building dependency graph...', increment: 0 });
                const dependencyGraph = await performanceMonitor.measure(
                    'build-dependency-graph',
                    () => dependencyGraphBuilder.buildGraph(this.workspaceRoot!)
                );

                // Step 2: Detect frameworks
                progress.report({ message: 'Detecting frameworks...', increment: 25 });
                const frameworks = await performanceMonitor.measure(
                    'detect-frameworks',
                    () => frameworkDetector.detectFrameworks(this.workspaceRoot!)
                );

                // Step 3: Analyze coding style
                progress.report({ message: 'Analyzing coding style...', increment: 50 });
                const codeStyle = await performanceMonitor.measure(
                    'analyze-style',
                    () => styleAnalyzer.analyzeProjectStyle(this.workspaceRoot!)
                );

                // Step 4: Calculate statistics
                progress.report({ message: 'Calculating statistics...', increment: 75 });
                const stats = this.calculateStatistics(dependencyGraph);

                // Create state
                this.state = {
                    rootPath: this.workspaceRoot!,
                    fileCount: dependencyGraph.nodes.size,
                    totalLines: stats.totalLines,
                    languages: stats.languages,
                    frameworks,
                    dependencyGraph,
                    lastAnalyzed: Date.now(),
                    analysisProgress: 100
                };

                // Cache the state
                const cacheKey = `project-brain-${this.workspaceRoot}`;
                analysisCache.set(cacheKey, this.state);

                progress.report({ message: 'Analysis complete!', increment: 100 });
            });

            logger.info('Project analysis complete', {
                files: this.state.fileCount,
                frameworks: this.state.frameworks.length
            });

            vscode.window.showInformationMessage(
                `CodeMind AI analyzed ${this.state.fileCount} files and detected ${this.state.frameworks.length} frameworks`
            );
        } catch (error) {
            logger.error('Project analysis failed', error as Error);
            vscode.window.showErrorMessage('Failed to analyze project');
        } finally {
            this.isAnalyzing = false;
        }
    }

    private calculateStatistics(dependencyGraph: any): {
        totalLines: number;
        languages: Map<string, number>;
    } {
        let totalLines = 0;
        const languages = new Map<string, number>();

        for (const [_, fileNode] of dependencyGraph.nodes.entries()) {
            // Estimate lines from file size (rough approximation)
            const estimatedLines = Math.ceil(fileNode.size / 40);
            totalLines += estimatedLines;

            // Count files by language
            const lang = fileNode.language;
            languages.set(lang, (languages.get(lang) || 0) + 1);
        }

        return { totalLines, languages };
    }

    getState(): ProjectBrainState | null {
        return this.state;
    }

    getFrameworks(): DetectedFramework[] {
        return this.state?.frameworks || [];
    }

    getDependencyGraph() {
        return this.state?.dependencyGraph;
    }

    async getFileContext(filePath: string): Promise<{
        dependencies: string[];
        dependents: string[];
        framework?: string;
        relatedFiles: string[];
    }> {
        if (!this.state) {
            return { dependencies: [], dependents: [], relatedFiles: [] };
        }

        const dependencies = dependencyGraphBuilder.getDependencies(filePath);
        const dependents = dependencyGraphBuilder.getDependents(filePath);

        // Find related files (files in same directory or with similar names)
        const relatedFiles = this.findRelatedFiles(filePath);

        // Determine framework context
        const framework = this.getFrameworkForFile(filePath);

        return {
            dependencies,
            dependents,
            framework,
            relatedFiles
        };
    }

    private findRelatedFiles(filePath: string): string[] {
        if (!this.state) {
            return [];
        }

        const related: string[] = [];
        const fileName = filePath.split('/').pop()?.replace(/\.(ts|js|tsx|jsx)$/, '') || '';
        const directory = filePath.substring(0, filePath.lastIndexOf('/'));

        for (const [path, _] of this.state.dependencyGraph.nodes.entries()) {
            // Same directory
            if (path.startsWith(directory) && path !== filePath) {
                related.push(path);
            }
            // Similar name (e.g., UserCard.tsx and UserCard.test.tsx)
            else if (path.includes(fileName) && path !== filePath) {
                related.push(path);
            }
        }

        return related.slice(0, 10); // Limit to 10 related files
    }

    private getFrameworkForFile(filePath: string): string | undefined {
        if (!this.state) {
            return undefined;
        }

        for (const framework of this.state.frameworks) {
            // Check if file is in framework entry points
            for (const entryPoint of framework.entryPoints) {
                if (filePath.includes(entryPoint)) {
                    return framework.name;
                }
            }
        }

        return undefined;
    }

    async getRelevantContext(
        prompt: string,
        maxFiles: number = 5
    ): Promise<string[]> {
        if (!this.state) {
            return [];
        }

        // Simple relevance scoring based on prompt keywords
        const keywords = prompt.toLowerCase().split(/\s+/);
        const fileScores = new Map<string, number>();

        for (const [filePath, fileNode] of this.state.dependencyGraph.nodes.entries()) {
            let score = 0;
            const fileName = filePath.toLowerCase();

            // Score based on filename matches
            for (const keyword of keywords) {
                if (fileName.includes(keyword)) {
                    score += 10;
                }
            }

            // Score based on function/class names
            for (const func of fileNode.functions) {
                if (keywords.some(k => func.name.toLowerCase().includes(k))) {
                    score += 5;
                }
            }

            for (const cls of fileNode.classes) {
                if (keywords.some(k => cls.name.toLowerCase().includes(k))) {
                    score += 5;
                }
            }

            if (score > 0) {
                fileScores.set(filePath, score);
            }
        }

        // Sort by score and return top files
        const sortedFiles = Array.from(fileScores.entries())
            .sort((a, b) => b[1] - a[1])
            .slice(0, maxFiles)
            .map(([path, _]) => path);

        return sortedFiles;
    }

    getStatistics(): {
        totalFiles: number;
        totalLines: number;
        languages: Map<string, number>;
        frameworks: string[];
        circularDependencies: number;
    } | null {
        if (!this.state) {
            return null;
        }

        return {
            totalFiles: this.state.fileCount,
            totalLines: this.state.totalLines,
            languages: this.state.languages,
            frameworks: this.state.frameworks.map(f => f.name),
            circularDependencies: this.state.dependencyGraph.circularDependencies.length
        };
    }

    async refresh(): Promise<void> {
        if (!this.workspaceRoot) {
            return;
        }

        // Clear cache
        const cacheKey = `project-brain-${this.workspaceRoot}`;
        analysisCache.delete(cacheKey);

        // Re-analyze
        await this.analyzeProject();
    }

    clear(): void {
        this.state = null;
        this.workspaceRoot = null;
        dependencyGraphBuilder.clear();
    }
}

export const projectBrain = new ProjectBrain();
