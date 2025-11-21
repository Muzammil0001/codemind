/**
 * Framework Detector - Identifies and understands project frameworks
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { DetectedFramework } from '../types';
import { logger } from '../utils/logger';

export class FrameworkDetector {
    async detectFrameworks(workspaceRoot: string): Promise<DetectedFramework[]> {
        const frameworks: DetectedFramework[] = [];

        // Check for various frameworks
        const detectors = [
            this.detectNextJS.bind(this),
            this.detectReact.bind(this),
            this.detectVue.bind(this),
            this.detectNuxt.bind(this),
            this.detectExpress.bind(this),
            this.detectNestJS.bind(this),
            this.detectDjango.bind(this),
            this.detectFastAPI.bind(this),
            this.detectPrisma.bind(this),
            this.detectTypeORM.bind(this)
        ];

        for (const detector of detectors) {
            const framework = await detector(workspaceRoot);
            if (framework) {
                frameworks.push(framework);
            }
        }

        logger.info(`Detected ${frameworks.length} frameworks`);
        return frameworks;
    }

    private async detectNextJS(root: string): Promise<DetectedFramework | null> {
        const configFiles = ['next.config.js', 'next.config.ts', 'next.config.mjs'];

        for (const configFile of configFiles) {
            const configPath = path.join(root, configFile);
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(configPath));

                // Check for app or pages directory
                const hasAppDir = await this.fileExists(path.join(root, 'app'));
                const hasPagesDir = await this.fileExists(path.join(root, 'pages'));

                return {
                    name: 'Next.js',
                    confidence: 0.95,
                    configFiles: [configFile],
                    entryPoints: hasAppDir ? ['app'] : hasPagesDir ? ['pages'] : []
                };
            } catch {
                continue;
            }
        }

        return null;
    }

    private async detectReact(root: string): Promise<DetectedFramework | null> {
        const packageJsonPath = path.join(root, 'package.json');

        try {
            const content = await this.readFile(packageJsonPath);
            const packageJson = JSON.parse(content);

            if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
                return {
                    name: 'React',
                    version: packageJson.dependencies?.react || packageJson.devDependencies?.react,
                    confidence: 0.9,
                    configFiles: ['package.json'],
                    entryPoints: ['src']
                };
            }
        } catch {
            // No package.json or React not found
        }

        return null;
    }

    private async detectVue(root: string): Promise<DetectedFramework | null> {
        const configFiles = ['vue.config.js', 'vite.config.ts', 'vite.config.js'];

        for (const configFile of configFiles) {
            const configPath = path.join(root, configFile);
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(configPath));

                return {
                    name: 'Vue.js',
                    confidence: 0.9,
                    configFiles: [configFile],
                    entryPoints: ['src']
                };
            } catch {
                continue;
            }
        }

        return null;
    }

    private async detectNuxt(root: string): Promise<DetectedFramework | null> {
        const configFiles = ['nuxt.config.js', 'nuxt.config.ts'];

        for (const configFile of configFiles) {
            const configPath = path.join(root, configFile);
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(configPath));

                return {
                    name: 'Nuxt.js',
                    confidence: 0.95,
                    configFiles: [configFile],
                    entryPoints: ['pages', 'components']
                };
            } catch {
                continue;
            }
        }

        return null;
    }

    private async detectExpress(root: string): Promise<DetectedFramework | null> {
        const packageJsonPath = path.join(root, 'package.json');

        try {
            const content = await this.readFile(packageJsonPath);
            const packageJson = JSON.parse(content);

            if (packageJson.dependencies?.express) {
                return {
                    name: 'Express',
                    version: packageJson.dependencies.express,
                    confidence: 0.85,
                    configFiles: ['package.json'],
                    entryPoints: ['src', 'server']
                };
            }
        } catch {
            // No package.json or Express not found
        }

        return null;
    }

    private async detectNestJS(root: string): Promise<DetectedFramework | null> {
        const configFiles = ['nest-cli.json'];

        for (const configFile of configFiles) {
            const configPath = path.join(root, configFile);
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(configPath));

                return {
                    name: 'NestJS',
                    confidence: 0.95,
                    configFiles: [configFile],
                    entryPoints: ['src']
                };
            } catch {
                continue;
            }
        }

        return null;
    }

    private async detectDjango(root: string): Promise<DetectedFramework | null> {
        const managePyPath = path.join(root, 'manage.py');

        try {
            const content = await this.readFile(managePyPath);
            if (content.includes('django')) {
                return {
                    name: 'Django',
                    confidence: 0.9,
                    configFiles: ['manage.py'],
                    entryPoints: []
                };
            }
        } catch {
            // No manage.py
        }

        return null;
    }

    private async detectFastAPI(root: string): Promise<DetectedFramework | null> {
        const requirementsPath = path.join(root, 'requirements.txt');

        try {
            const content = await this.readFile(requirementsPath);
            if (content.includes('fastapi')) {
                return {
                    name: 'FastAPI',
                    confidence: 0.85,
                    configFiles: ['requirements.txt'],
                    entryPoints: []
                };
            }
        } catch {
            // No requirements.txt
        }

        return null;
    }

    private async detectPrisma(root: string): Promise<DetectedFramework | null> {
        const schemaPath = path.join(root, 'prisma', 'schema.prisma');

        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(schemaPath));

            return {
                name: 'Prisma',
                confidence: 0.95,
                configFiles: ['prisma/schema.prisma'],
                entryPoints: []
            };
        } catch {
            // No Prisma schema
        }

        return null;
    }

    private async detectTypeORM(root: string): Promise<DetectedFramework | null> {
        const configFiles = ['ormconfig.json', 'ormconfig.js'];

        for (const configFile of configFiles) {
            const configPath = path.join(root, configFile);
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(configPath));

                return {
                    name: 'TypeORM',
                    confidence: 0.9,
                    configFiles: [configFile],
                    entryPoints: []
                };
            } catch {
                continue;
            }
        }

        return null;
    }

    private async fileExists(filePath: string): Promise<boolean> {
        try {
            await vscode.workspace.fs.stat(vscode.Uri.file(filePath));
            return true;
        } catch {
            return false;
        }
    }

    private async readFile(filePath: string): Promise<string> {
        const uri = vscode.Uri.file(filePath);
        const content = await vscode.workspace.fs.readFile(uri);
        return Buffer.from(content).toString('utf8');
    }
}

export const frameworkDetector = new FrameworkDetector();
