import * as path from 'path';
import * as vscode from 'vscode';
import { ProjectBrainState, CodeStyle, DetectedFramework, ProjectStructure } from '../types';
import { astParser } from './ASTParser';
import { dependencyGraphBuilder } from './DependencyGraph';
import { frameworkDetector } from './FrameworkDetector';
import { styleAnalyzer } from './StyleAnalyzer';
import { projectStructureAnalyzer } from './ProjectStructureAnalyzer';
import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performance';
import { analysisCache } from '../utils/cache';

export class ProjectBrain {
    private state: ProjectBrainState | null = null;
    private isAnalyzing: boolean = false;
    private workspaceRoot: string | null = null;
    private projectStructure: ProjectStructure | null = null;

    async initialize(workspaceRoot: string): Promise<void> {
        this.workspaceRoot = workspaceRoot;
        logger.info(`Initializing Project Brain for: ${workspaceRoot}`);

        const cacheKey = `project-brain-${workspaceRoot}`;
        const cached = analysisCache.get(cacheKey);

        if (cached) {
            this.state = cached as ProjectBrainState;

            const hasChanged = await this.hasProjectChanged();
            if (!hasChanged) {
                if (this.state.projectStructure) {
                    this.projectStructure = this.state.projectStructure;
                    logger.info('Restored project structure from cache (no changes detected)');
                }
                logger.info('Loaded Project Brain from cache');
                return;
            } else {
                logger.info('Project has changed since last analysis, re-analyzing...');
            }
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
                progress.report({ message: 'Analyzing project structure...', increment: 0 });
                this.projectStructure = await performanceMonitor.measure(
                    'analyze-structure',
                    () => projectStructureAnalyzer.analyzeProject(this.workspaceRoot!)
                );

                progress.report({ message: 'Building dependency graph...', increment: 20 });
                const dependencyGraph = await performanceMonitor.measure(
                    'build-dependency-graph',
                    () => dependencyGraphBuilder.buildGraph(this.workspaceRoot!)
                );

                progress.report({ message: 'Detecting frameworks...', increment: 40 });
                const frameworks = await performanceMonitor.measure(
                    'detect-frameworks',
                    () => frameworkDetector.detectFrameworks(this.workspaceRoot!)
                );

                progress.report({ message: 'Analyzing coding style...', increment: 60 });
                const codeStyle = await performanceMonitor.measure(
                    'analyze-style',
                    () => styleAnalyzer.analyzeProjectStyle(this.workspaceRoot!)
                );

                progress.report({ message: 'Calculating statistics...', increment: 80 });
                const stats = this.calculateStatistics(dependencyGraph);

                this.state = {
                    rootPath: this.workspaceRoot!,
                    fileCount: dependencyGraph.nodes.size,
                    totalLines: stats.totalLines,
                    languages: stats.languages,
                    frameworks,
                    dependencyGraph,
                    projectStructure: this.projectStructure!, // Save to state
                    lastAnalyzed: Date.now(),
                    analysisProgress: 100
                };

                const cacheKey = `project-brain-${this.workspaceRoot}`;
                analysisCache.set(cacheKey, this.state);

                progress.report({ message: 'Analysis complete!', increment: 100 });
            });

            logger.info('Project analysis complete', {
                files: this.state.fileCount,
                frameworks: this.state.frameworks.length,
                structure: this.projectStructure?.type
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
            const estimatedLines = Math.ceil(fileNode.size / 40);
            totalLines += estimatedLines;

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

        const relatedFiles = this.findRelatedFiles(filePath);

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
            if (path.startsWith(directory) && path !== filePath) {
                related.push(path);
            }
            else if (path.includes(fileName) && path !== filePath) {
                related.push(path);
            }
        }

        return related.slice(0, 10);
    }

    private getFrameworkForFile(filePath: string): string | undefined {
        if (!this.state) {
            return undefined;
        }

        for (const framework of this.state.frameworks) {
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

        const keywords = prompt.toLowerCase().split(/\s+/);
        const fileScores = new Map<string, number>();

        for (const [filePath, fileNode] of this.state.dependencyGraph.nodes.entries()) {
            let score = 0;
            const fileName = filePath.toLowerCase();

            for (const keyword of keywords) {
                if (fileName.includes(keyword)) {
                    score += 10;
                }
            }

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


    private async hasProjectChanged(): Promise<boolean> {
        if (!this.state || !this.workspaceRoot) {
            return true; 
        }

        const lastAnalysis = this.state.lastAnalyzed || 0;

        try {
            const keyFiles = [
                'package.json',
                'tsconfig.json',
                'next.config.js',
                'next.config.ts',
                'nuxt.config.js',
                'nuxt.config.ts',
                'vue.config.js',
                'vite.config.js',
                'webpack.config.js',
                'angular.json',
                'requirements.txt',
                'pyproject.toml',
                'manage.py',
                'Cargo.toml',
                'go.mod'
            ];

            for (const file of keyFiles) {
                const filePath = path.join(this.workspaceRoot, file);
                try {
                    const stat = await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
                    if (stat.mtime > lastAnalysis) {
                        logger.info(`Project changed: ${file} was modified`);
                        return true;
                    }
                } catch {
                    logger.warn(`File ${file} does not exist`);
                }
            }

            const keyDirs = ['src', 'pages', 'app', 'components', 'api', 'server', 'backend'];
            for (const dir of keyDirs) {
                const dirPath = path.join(this.workspaceRoot, dir);
                try {
                    const files = await this.getDirectoryFiles(dirPath, 2); // Check up to 2 levels deep
                    for (const file of files) {
                        const stat = await vscode.workspace.fs.stat(vscode.Uri.file(file));
                        if (stat.mtime > lastAnalysis) {
                            logger.info(`Project changed: ${path.relative(this.workspaceRoot, file)} was modified`);
                            return true;
                        }
                    }
                } catch {
                   logger.warn(`Directory ${dir} does not exist`);
                }
            }

            return false; 
        } catch (error) {
            logger.warn('Error checking for project changes, assuming changed:', error);
            return true;
        }
    }


    private async getDirectoryFiles(dirPath: string, maxDepth: number, currentDepth: number = 0): Promise<string[]> {
        if (currentDepth >= maxDepth) {
            return [];
        }

        const files: string[] = [];

        try {
            const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dirPath));

            for (const [name, type] of entries) {
                const fullPath = path.join(dirPath, name);

                if (type === vscode.FileType.File) {
                    // Only include source files
                    if (this.isSourceFile(name)) {
                        files.push(fullPath);
                    }
                } else if (type === vscode.FileType.Directory && !this.isIgnoredDirectory(name)) {
                    files.push(...await this.getDirectoryFiles(fullPath, maxDepth, currentDepth + 1));
                }
            }
        } catch {
           logger.warn(`Error getting directory files: ${dirPath}`);
        }

        return files;
    }

    private isSourceFile(filename: string): boolean {
        const sourceExtensions = [
            '.ts', '.tsx', '.js', '.jsx', '.vue', '.svelte', '.py', '.java', '.kt', '.rs', '.go',
            '.php', '.rb', '.cpp', '.cc', '.cxx', '.c', '.h', '.cs', '.fs', '.fsx'
        ];
        return sourceExtensions.some(ext => filename.endsWith(ext));
    }

    private isIgnoredDirectory(name: string): boolean {
        const ignored = ['node_modules', '.git', 'dist', 'build', 'out', '.vscode', 'coverage',
                        '__pycache__', 'venv', 'env', 'target', 'bin', 'obj', '.next', '.nuxt'];
        return ignored.includes(name);
    }

    async refresh(): Promise<void> {
        if (!this.workspaceRoot) {
            return;
        }

        const cacheKey = `project-brain-${this.workspaceRoot}`;
        analysisCache.delete(cacheKey);

        await this.analyzeProject();
    }

    getProjectStructure(): ProjectStructure | null {
        return this.projectStructure;
    }

    getStructureContext(userQuery: string): string {
        if (!this.projectStructure) {
            return '';
        }
        return projectStructureAnalyzer.getContextForPrompt(this.projectStructure, userQuery);
    }

    clear(): void {
        this.state = null;
        this.workspaceRoot = null;
        this.projectStructure = null;
        dependencyGraphBuilder.clear();
    }
}

export const projectBrain = new ProjectBrain();
