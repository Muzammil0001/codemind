import * as vscode from 'vscode';
import * as path from 'path';
import * as ts from 'typescript';
import { logger } from '../utils/logger';
import { ProjectStructure, FolderInfo, DetectedFramework } from '../types';

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
            frameworks,
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

                const topExports: string[] = [];
                for (const file of files) {
                    const ext = path.extname(file);
                    if (ext === '.ts' || ext === '.tsx' || ext === '.js' || ext === '.jsx') {
                        const fullPath = path.join(dir, file);
                        try {
                            const fileUri = vscode.Uri.file(fullPath);
                            const fileData = await vscode.workspace.fs.readFile(fileUri);
                            const content = new TextDecoder().decode(fileData);
                            topExports.push(...this.extractTopExports(content));
                        } catch (err) {
                            logger.warn(`Cannot read file ${file}: ${err}`);
                            // Skip files that can't be parsed
                        }
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
        Array.from(fileExtensions.entries()).forEach(([ext, count]) => {
            Object.entries(this.LANGUAGE_DETECTION).forEach(([lang, exts]) => {
                if (exts.includes(ext)) scores.set(lang, (scores.get(lang) || 0) + count);
            });
        });
        if (scores.size === 0) return undefined;
        return Array.from(scores.entries()).sort((a, b) => b[1] - a[1])[0][0];
    }

    private detectLanguages(analyses: FolderAnalysis[]): string[] {
        const counts = new Map<string, number>();
        analyses.forEach(analysis => {
            Array.from(analysis.fileExtensions.entries()).forEach(([ext, count]) => {
                Object.entries(this.LANGUAGE_DETECTION).forEach(([lang, exts]) => {
                    if (exts.includes(ext)) counts.set(lang, (counts.get(lang) || 0) + count);
                });
            });
        });
        return Array.from(counts.entries()).sort((a, b) => b[1] - a[1]).map(([lang]) => lang);
    }

    private async detectFrameworks(analyses: FolderAnalysis[], root: string): Promise<DetectedFramework[]> {
        // Use the centralized FrameworkDetector for consistent detection
        const { frameworkDetector } = await import('./FrameworkDetector');
        return await frameworkDetector.detectFrameworks(root);
    }

    private determineProjectType(folders: FolderInfo[]): ProjectStructure['type'] {
        const hasFrontend = folders.some(f => f.type === 'frontend');
        const hasBackend = folders.some(f => f.type === 'backend');
        if (hasFrontend && hasBackend) return 'monorepo';
        if (hasFrontend || hasBackend) return 'single';
        return 'unknown';
    }

    private generateSummary(folders: FolderInfo[], projectType: ProjectStructure['type'], languages: string[], frameworks: DetectedFramework[]): string {
        const frameworkNames = frameworks.map(f => f.name);
        let summary = `Project Type: ${projectType}\nLanguages: ${languages.join(', ') || 'Unknown'}\nFrameworks: ${frameworkNames.join(', ') || 'Unknown'}\n\n`;
        folders.slice(0, 20).forEach(f => {
            summary += `- ${f.path} [${f.type}] (${f.language || 'Unknown'})\n`;
        });
        return summary.trim();
    }

    getContextForPrompt(structure: ProjectStructure, _userQuery: string): string {
        let context = `## Project Structure & Paths\n\n`;
        context += `${structure.summary}\n\n`;

        // Use absolute paths as requested by user
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '';

        context += `## Absolute Paths (Use these for all file operations):\n\n`;

        // Dynamically categorize and display all folders by type
        const foldersByType = new Map<string, string[]>();
        for (const folder of structure.folders) {
            if (!foldersByType.has(folder.type)) {
                foldersByType.set(folder.type, []);
            }
            foldersByType.get(folder.type)!.push(folder.path);
        }

        // Display all folder types dynamically
        Array.from(foldersByType.entries()).forEach(([type, paths]) => {
            const typeName = type.charAt(0).toUpperCase() + type.slice(1);
            context += `### ${typeName} Paths:\n`;
            paths.forEach(path => {
                const absPath = path.startsWith('/') ? path : `${workspaceRoot}/${path}`;
                const folderInfo = structure.folders.find(f => f.path === path);
                context += `- \`${absPath}/\` (${folderInfo?.language || 'unknown'})\n`;
                if (folderInfo?.indicators && folderInfo.indicators.length > 0) {
                    context += `  - Purpose: ${folderInfo.indicators.join(', ')}\n`;
                }
            });
            context += `\n`;
        });

        // Add common development patterns and conventions
        context += `## Development Patterns & Conventions:\n\n`;

        // Frontend patterns
        if (structure.frontendPaths.length > 0 || structure.componentPaths.length > 0) {
            context += `### Frontend Development:\n`;
            context += `- UI components typically go in component directories\n`;
            context += `- Pages/views go in frontend directories\n`;
            context += `- Styles and assets are usually organized separately\n`;
            context += `- Common frontend frameworks: ${structure.frameworks.filter(f =>
                ['React', 'Vue', 'Angular', 'Svelte', 'Next.js', 'Nuxt.js'].includes(f.name)
            ).map(f => f.name).join(', ') || 'None detected'}\n\n`;
        }

        // Backend patterns
        if (structure.backendPaths.length > 0 || foldersByType.get('api')) {
            context += `### Backend Development:\n`;
            context += `- API endpoints and routes go in backend/api directories\n`;
            context += `- Business logic and services go in backend directories\n`;
            context += `- Database models/schemas go in backend directories\n`;
            context += `- Server configuration files stay at backend root\n\n`;
        }

        // General patterns
        context += `### General Patterns:\n`;
        context += `- Configuration files (config, settings) go in dedicated config directories\n`;
        context += `- Utility/helper functions go in util/lib directories\n`;
        context += `- Tests go in test directories\n`;
        context += `- Documentation goes in docs directories\n\n`;

        // Framework-specific guidance
        if (structure.frameworks.length > 0) {
            logger.info(`🏗️ Detected frameworks: ${structure.frameworks.map(f => f.name).join(', ')}`);
            context += `## Framework-Specific Conventions:\n`;
            structure.frameworks.forEach(framework => {
                context += `### ${framework.name}\n`;
                context += `**Description:** ${framework.conventions?.description || 'No description available'}\n\n`;

                if (framework.conventions?.patterns) {
                    context += `**Directory Patterns:**\n`;
                    Object.entries(framework.conventions.patterns).forEach(([type, paths]) => {
                        if (paths.length > 0) {
                            const typeName = type.charAt(0).toUpperCase() + type.slice(1);
                            context += `- **${typeName}**: ${paths.join(', ')}\n`;
                        }
                    });
                    context += `\n`;
                }

                if (framework.conventions?.specialRules) {
                    context += `**Special Rules:**\n`;
                    framework.conventions.specialRules.forEach(rule => {
                        context += `- ${rule}\n`;
                    });
                    context += `\n`;
                }
            });
        }

        // Language-specific guidance
        if (structure.languages.length > 0) {
            context += `## Language-Specific Guidance:\n`;
            structure.languages.forEach(lang => {
                const langName = lang.charAt(0).toUpperCase() + lang.slice(1);
                context += `- **${langName}**: Use ${langName}-appropriate file extensions and follow ${langName} project conventions\n`;
            });
            context += `\n`;
        }

        // Intelligent placement guidance based on detected project structure
        context += `## Intelligent File Placement:\n\n`;
        context += `When creating new files, analyze the user's request and match it to the most appropriate location based on the detected project structure and common patterns:\n\n`;

        // Provide guidance based on detected folder patterns
        if (structure.componentPaths.length > 0) {
            context += `### Component Files:\n`;
            context += `- **UI Components**: ${structure.componentPaths.map(p => `\`${p}/\``).join(' or ')}\n`;
            context += `- **Reusable Elements**: Use existing component directories\n`;
            context += `- **Widget Files**: Follow established component patterns\n\n`;
        }

        if (structure.frontendPaths.length > 0) {
            context += `### Frontend Files:\n`;
            context += `- **Pages/Views**: ${structure.frontendPaths.map(p => `\`${p}/\``).join(' or ')}\n`;
            context += `- **Client-side Code**: Use frontend directories\n`;
            context += `- **User Interface**: Follow frontend folder structure\n\n`;
        }

        if (structure.backendPaths.length > 0 || foldersByType.get('api')) {
            context += `### Backend/API Files:\n`;
            if (structure.backendPaths.length > 0) {
                context += `- **Server Logic**: ${structure.backendPaths.map(p => `\`${p}/\``).join(' or ')}\n`;
            }
        if (foldersByType.get('api')) {
                context += `- **API Endpoints**: ${foldersByType.get('api')!.map(p => `\`${p}/\``).join(' or ')}\n`;
            }
            context += `- **Business Logic**: Use backend directories\n\n`;
        }

        // Generic framework guidance (if frameworks are detected)
        if (structure.frameworks.length > 0) {
            context += `### Framework-Specific Patterns:\n`;
            structure.frameworks.forEach(framework => {
                if (framework.conventions?.patterns) {
                    context += `**${framework.name}**:\n`;
                    Object.entries(framework.conventions.patterns).forEach(([type, paths]) => {
                        if (paths.length > 0) {
                            const typeName = type.charAt(0).toUpperCase() + type.slice(1);
                            context += `- ${typeName}: ${paths.join(' or ')}\n`;
        }
                    });
                    context += `\n`;
                }
            });
        }

        // Dynamic file placement guidance based on detected structure
        context += `### Dynamic File Placement (Based on Detected Structure):\n\n`;

        // Analyze and provide guidance for each detected folder type
        const folderTypeGuidance: Record<string, string[]> = {
            component: ['UI components', 'reusable components', 'widget files'],
            frontend: ['user interface files', 'client-side code', 'frontend views'],
            backend: ['server logic', 'business logic', 'data processing'],
            api: ['API endpoints', 'route handlers', 'API controllers'],
            util: ['utility functions', 'helper methods', 'shared code'],
            config: ['configuration files', 'settings', 'environment files'],
            test: ['test files', 'spec files', 'test suites'],
            docs: ['documentation', 'README files', 'API docs']
        };

        // For each detected folder type, provide specific guidance
        Array.from(foldersByType.entries()).forEach(([folderType, folderPaths]) => {
            const guidance = folderTypeGuidance[folderType];
            if (guidance) {
                const typeName = folderType.charAt(0).toUpperCase() + folderType.slice(1);
                context += `**${typeName} Files** → Use: ${folderPaths.map(p => `\`${p}/\``).join(', ')}\n`;
                context += `- Suitable for: ${guidance.join(', ')}\n\n`;
            }
        });

        // Add fallback guidance for undetected patterns
        context += `**Other Files** (when no specific directory exists):\n`;
        context += `- Create logical folder structure based on file purpose\n`;
        context += `- Use common naming conventions (src/, lib/, utils/, etc.)\n`;
        context += `- Follow the established patterns in your project\n\n`;

        context += `**CRITICAL INSTRUCTIONS:**\n`;
        context += `1. ALWAYS use absolute paths (starting with ${workspaceRoot}) for all file operations\n`;
        context += `2. Analyze the user's natural language request to understand what type of file/code they want\n`;
        context += `3. Match the request to the most semantically appropriate location based on the project structure above\n`;
        context += `4. Follow existing folder naming conventions and patterns\n`;
        context += `5. Use appropriate file extensions for the detected programming languages\n`;
        context += `6. Create new directories if needed following the established patterns\n`;
        context += `7. Consider the file's purpose and relationship to other files when choosing location\n`;
        context += `8. Never guess - use the provided structure and patterns as your guide\n\n`;

        logger.info('➡️ Generated Intelligent Structure Context:', context);

        return context;
    }
}

export const projectStructureAnalyzer = new ProjectStructureAnalyzer();
