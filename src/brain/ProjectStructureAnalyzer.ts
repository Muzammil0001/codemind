import * as vscode from 'vscode';
import * as path from 'path';
import * as ts from 'typescript';
import { logger } from '../utils/logger';
import { ProjectStructure, FolderInfo } from '../types';

interface FolderAnalysis {
    path: string;
    files: string[];
    hasConfigFiles: string[];
    fileExtensions: Map<string, number>;
    topExports?: string[];
    frameworks?: string[];
}

export class ProjectStructureAnalyzer {
    private readonly FRONTEND_INDICATORS = {
        folderNames: ['frontend', 'client', 'web', 'ui', 'app', 'public', 'static', 'www'],
        subfolders: ['components', 'pages', 'views', 'screens', 'layouts', 'templates', 'widgets', 'hooks', 'context', 'store', 'styles', 'assets'],
        configFiles: ['package.json', 'tsconfig.json', 'vite.config', 'webpack.config', 'next.config', 'nuxt.config', 'angular.json', 'vue.config', 'svelte.config'],
        filePatterns: ['.jsx', '.tsx', '.vue', '.svelte', '.html', '.css', '.scss', '.sass', '.less']
    };

    private readonly BACKEND_INDICATORS = {
        folderNames: ['backend', 'server', 'api', 'service', 'services'],
        subfolders: ['routes', 'controllers', 'models', 'middleware', 'handlers', 'database', 'db', 'migrations', 'schemas', 'entities', 'repositories'],
        configFiles: ['requirements.txt', 'pyproject.toml', 'Pipfile', 'go.mod', 'Cargo.toml', 'composer.json', 'Gemfile', 'pom.xml', 'build.gradle', 'package.json'],
        filePatterns: ['.py', '.go', '.rs', '.php', '.rb', '.java', '.kt', '.cs']
    };

    private readonly LANGUAGE_DETECTION = {
        javascript: ['.js', '.mjs', '.cjs'],
        typescript: ['.ts', '.tsx'],
        python: ['.py'],
        go: ['.go'],
        rust: ['.rs'],
        php: ['.php'],
        ruby: ['.rb'],
        java: ['.java'],
        kotlin: ['.kt'],
        csharp: ['.cs'],
        cpp: ['.cpp', '.cc', '.cxx'],
        c: ['.c', '.h']
    };

    async analyzeProject(workspaceRoot: string): Promise<ProjectStructure> {
        logger.info('Analyzing project structure...');

        const folderAnalyses = await this.scanAndAnalyzeFolders(workspaceRoot);
        const classified = await this.classifyFolders(folderAnalyses, workspaceRoot);
        const languages = this.detectLanguages(folderAnalyses);
        const frameworks = await this.detectFrameworks(folderAnalyses, workspaceRoot);

        const frontendPaths = classified.filter(f => f.type === 'frontend' || f.type === 'component').map(f => f.path);
        const backendPaths = classified.filter(f => f.type === 'backend' || f.type === 'api').map(f => f.path);
        const componentPaths = classified.filter(f => f.type === 'component').map(f => f.path);

        const projectType = this.determineProjectType(classified);
        const summary = this.generateSummary(classified, projectType, languages, frameworks);

        return {
            root: workspaceRoot,
            name: path.basename(workspaceRoot),
            type: projectType,
            languages,
            folders: classified,
            frontendPaths,
            backendPaths,
            componentPaths,
            summary
        };
    }

    private async scanAndAnalyzeFolders(root: string, maxDepth: number = 3): Promise<FolderAnalysis[]> {
        const analyses: FolderAnalysis[] = [];
        const exclude = ['node_modules', '.git', 'dist', 'build', 'out', '.vscode', 'coverage', '__pycache__', 'venv', 'env', 'target', 'bin', 'obj'];

        const scan = async (dir: string, depth: number) => {
            if (depth > maxDepth) return;

            try {
                const entries = await vscode.workspace.fs.readDirectory(vscode.Uri.file(dir));
                const files: string[] = [];
                const hasConfigFiles: string[] = [];
                const fileExtensions = new Map<string, number>();

                for (const [name, type] of entries) {
                    if (type === vscode.FileType.File) {
                        files.push(name);
                        const ext = path.extname(name);
                        if (ext) fileExtensions.set(ext, (fileExtensions.get(ext) || 0) + 1);

                        if (this.isConfigFile(name)) hasConfigFiles.push(name);
                    } else if (type === vscode.FileType.Directory && !exclude.includes(name)) {
                        const folderPath = path.join(dir, name);
                        await scan(folderPath, depth + 1);
                    }
                }

                let topExports: string[] = [];
                for (const file of files) {
                    const ext = path.extname(file);
                    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
                        const fullPath = path.join(dir, file);
                        try {
                            const fileUri = vscode.Uri.file(fullPath);
                            const fileData = await vscode.workspace.fs.readFile(fileUri);
                            const content = new TextDecoder().decode(fileData);
                            topExports.push(...this.extractTopExports(content));
                        } catch { }
                    }
                }

                if (files.length > 0 || hasConfigFiles.length > 0) {
                    analyses.push({ path: dir, files, hasConfigFiles, fileExtensions, topExports });
                }
            } catch (err) {
                logger.warn(`Cannot read directory ${dir}: ${err}`);
            }
        };

        await scan(root, 0);
        return analyses;
    }

    private extractTopExports(content: string): string[] {
        try {
            const sourceFile = ts.createSourceFile('temp.ts', content, ts.ScriptTarget.Latest, true);
            const exports: string[] = [];

            sourceFile.forEachChild(node => {
                if (ts.isFunctionDeclaration(node) && node.name) exports.push(node.name.text);
                if (ts.isClassDeclaration(node) && node.name) exports.push(node.name.text);
                if (ts.isVariableStatement(node)) {
                    node.declarationList.declarations.forEach(decl => {
                        if (ts.isIdentifier(decl.name)) exports.push(decl.name.text);
                    });
                }
            });

            return exports;
        } catch {
            return [];
        }
    }

    private isConfigFile(filename: string): boolean {
        const configPatterns = [
            'package.json', 'tsconfig.json', 'requirements.txt', 'pyproject.toml',
            'Pipfile', 'go.mod', 'Cargo.toml', 'composer.json', 'Gemfile',
            'pom.xml', 'build.gradle', 'settings.gradle', 'webpack.config',
            'vite.config', 'next.config', 'nuxt.config', 'angular.json',
            'vue.config', 'svelte.config', 'laravel', 'artisan', 'manage.py',
            'Dockerfile', 'docker-compose'
        ];
        return configPatterns.some(pattern => filename.includes(pattern));
    }

    private async classifyFolders(analyses: FolderAnalysis[], root: string): Promise<FolderInfo[]> {
        const classified: FolderInfo[] = [];
        for (const analysis of analyses) {
            const relativePath = path.relative(root, analysis.path);
            const folderName = path.basename(analysis.path);
            const { type, indicators, language } = this.detectFolderType(folderName, relativePath, analysis);
            classified.push({
                name: folderName,
                path: relativePath,
                type,
                language,
                indicators,
                fileCount: analysis.files.length
            });
        }
        return classified;
    }

    private detectFolderType(folderName: string, relativePath: string, analysis: FolderAnalysis): { type: FolderInfo['type']; indicators: string[]; language?: string } {
        const lower = folderName.toLowerCase();
        const pathLower = relativePath.toLowerCase();
        const indicators: string[] = [];

        const language = this.detectFolderLanguage(analysis.fileExtensions);
        if (language) indicators.push(`Language: ${language}`);

        let frontendScore = 0;
        let backendScore = 0;

        if (this.FRONTEND_INDICATORS.folderNames.some(n => lower.includes(n))) { frontendScore += 3; indicators.push('Frontend folder name'); }
        if (this.FRONTEND_INDICATORS.subfolders.some(sub => pathLower.includes(sub))) { frontendScore += 2; indicators.push('Frontend subfolder'); }
        const frontendConfigs = analysis.hasConfigFiles.filter(file => this.FRONTEND_INDICATORS.configFiles.some(pattern => file.includes(pattern)));
        if (frontendConfigs.length > 0) { frontendScore += 2; indicators.push(`Frontend config: ${frontendConfigs.join(', ')}`); }

        const frontendFileCount = Array.from(analysis.fileExtensions.entries())
            .filter(([ext]) => this.FRONTEND_INDICATORS.filePatterns.includes(ext))
            .reduce((sum, [, count]) => sum + count, 0);
        if (frontendFileCount > 0) { frontendScore += 1; indicators.push(`${frontendFileCount} frontend files`); }

        if (this.BACKEND_INDICATORS.folderNames.some(n => lower.includes(n))) { backendScore += 3; indicators.push('Backend folder name'); }
        if (this.BACKEND_INDICATORS.subfolders.some(sub => pathLower.includes(sub))) { backendScore += 2; indicators.push('Backend subfolder'); }
        const backendConfigs = analysis.hasConfigFiles.filter(file => this.BACKEND_INDICATORS.configFiles.some(pattern => file.includes(pattern)));
        if (backendConfigs.length > 0) { backendScore += 2; indicators.push(`Backend config: ${backendConfigs.join(', ')}`); }

        // Special folders
        const parentPath = path.dirname(relativePath).toLowerCase();
        const isBackendParent = this.BACKEND_INDICATORS.folderNames.some(n => parentPath.includes(n));

        if (['components', 'widgets', 'elements'].includes(lower)) {
            if (isBackendParent) return { type: 'backend', indicators: [...indicators, 'Backend component'], language };
            return { type: 'component', indicators, language };
        }
        if (['api', 'routes', 'endpoints'].includes(lower)) return { type: 'api', indicators, language };
        if (['utils', 'helpers', 'lib', 'shared', 'common'].includes(lower)) return { type: 'util', indicators, language };
        if (['config', 'configuration', 'settings'].includes(lower)) return { type: 'config', indicators, language };
        if (['test', 'tests', '__tests__', 'spec'].includes(lower)) return { type: 'test', indicators, language };
        if (['docs', 'documentation'].includes(lower)) return { type: 'docs', indicators, language };

        if (frontendScore > backendScore && frontendScore >= 2) return { type: 'frontend', indicators, language };
        if (backendScore > frontendScore && backendScore >= 2) return { type: 'backend', indicators, language };
        if (frontendScore > 0 && backendScore > 0) return { type: 'fullstack', indicators, language };

        return { type: 'unknown', indicators, language };
    }

    private detectFolderLanguage(fileExtensions: Map<string, number>): string | undefined {
        const scores = new Map<string, number>();
        for (const [ext, count] of fileExtensions.entries()) {
            for (const [lang, exts] of Object.entries(this.LANGUAGE_DETECTION)) {
                if (exts.includes(ext)) scores.set(lang, (scores.get(lang) || 0) + count);
            }
        }
        if (scores.size === 0) return undefined;
        return Array.from(scores.entries()).sort((a, b) => b[1] - a[1])[0][0];
    }

    private detectLanguages(analyses: FolderAnalysis[]): string[] {
        const counts = new Map<string, number>();
        for (const analysis of analyses) {
            for (const [ext, count] of analysis.fileExtensions.entries()) {
                for (const [lang, exts] of Object.entries(this.LANGUAGE_DETECTION)) {
                    if (exts.includes(ext)) counts.set(lang, (counts.get(lang) || 0) + count);
                }
            }
        }
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
    }

    private async detectFrameworks(analyses: FolderAnalysis[], root: string): Promise<string[]> {
        const frameworks: Set<string> = new Set();
        for (const analysis of analyses) {
            for (const file of analysis.hasConfigFiles) {
                const fullPath = path.join(root, analysis.path, file);
                try {
                    const fileUri = vscode.Uri.file(fullPath);
                    const fileData = await vscode.workspace.fs.readFile(fileUri);
                    const content = new TextDecoder().decode(fileData).toLowerCase();

                    if (content.includes('react')) frameworks.add('React');
                    if (content.includes('vue')) frameworks.add('Vue');
                    if (content.includes('next')) frameworks.add('Next.js');
                    if (content.includes('nuxt')) frameworks.add('Nuxt.js');
                    if (content.includes('angular')) frameworks.add('Angular');
                    if (content.includes('svelte')) frameworks.add('Svelte');
                    if (content.includes('django')) frameworks.add('Django');
                    if (content.includes('flask')) frameworks.add('Flask');
                    if (content.includes('spring')) frameworks.add('Spring');
                } catch { }
            }
        }
        return Array.from(frameworks);
    }

    private determineProjectType(folders: FolderInfo[]): ProjectStructure['type'] {
        const hasFrontend = folders.some(f => f.type === 'frontend');
        const hasBackend = folders.some(f => f.type === 'backend');
        if (hasFrontend && hasBackend) return 'monorepo';
        if (hasFrontend || hasBackend) return 'single';
        return 'unknown';
    }

    private generateSummary(folders: FolderInfo[], projectType: ProjectStructure['type'], languages: string[], frameworks: string[]): string {
        let summary = `Project Type: ${projectType}\nLanguages: ${languages.join(', ') || 'Unknown'}\nFrameworks: ${frameworks.join(', ') || 'Unknown'}\n\n`;
        folders.slice(0, 20).forEach(f => {
            summary += `- ${f.path} [${f.type}] (${f.language || 'Unknown'})\n`;
        });
        return summary.trim();
    }

    getContextForPrompt(structure: ProjectStructure, userQuery: string): string {
        let context = `## Project Overview\n\n`;
        context += `${structure.summary}\n\n`;

        const query = userQuery.toLowerCase();

        if (query.includes('component') || query.includes('ui') || query.includes('page') || query.includes('view')) {
            if (structure.frontendPaths.length > 0) {
                context += `**RECOMMENDED ACTION:** Create UI components in: \`${structure.frontendPaths[0]}/components/\`\n\n`;
            }
        }

        if (query.includes('api') || query.includes('endpoint') || query.includes('route')) {
            if (structure.backendPaths.length > 0) {
                context += `**RECOMMENDED ACTION:** Create API endpoints in: \`${structure.backendPaths[0]}/\`\n\n`;
            }
        }

        context += `**CRITICAL INSTRUCTION:** Always use the correct paths listed above.\n`;

        logger.info('➡️ Generated Structure Context:', context);

        return context;
    }
}

export const projectStructureAnalyzer = new ProjectStructureAnalyzer();
