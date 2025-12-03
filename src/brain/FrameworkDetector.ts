import * as vscode from 'vscode';
import * as path from 'path';
import { DetectedFramework } from '../types';
import { logger } from '../utils/logger';
import { FRAMEWORKS } from '../constants/stacks';
export class FrameworkDetector {
    async detectFrameworks(workspaceRoot: string): Promise<DetectedFramework[]> {
        const frameworks: DetectedFramework[] = [];

        for (const [frameworkName, frameworkDef] of Object.entries(FRAMEWORKS)) {
            const detected = await this.detectFramework(workspaceRoot, frameworkName, frameworkDef);
            if (detected) {
                frameworks.push(detected);
            }
        }

        logger.info(`Detected ${frameworks.length} frameworks`);
        return frameworks;
    }

    private async detectFramework(
        workspaceRoot: string,
        frameworkName: string,
        frameworkDef: any
    ): Promise<DetectedFramework | null> {
        for (const configFile of frameworkDef.configFiles) {
            const configPath = path.join(workspaceRoot, configFile);
            try {
                await vscode.workspace.fs.stat(vscode.Uri.file(configPath));

                return {
                    name: frameworkName,
                    confidence: 0.95,
                    configFiles: [configFile],
                    entryPoints: [...frameworkDef.entryPoints],
                    conventions: frameworkDef.conventions
                };
            } catch {
                continue;
            }
        }

        if (frameworkDef.dependencies && frameworkDef.dependencies.length > 0) {
            // Node.js , JavaScript frameworks
            if (await this.fileExists(path.join(workspaceRoot, 'package.json'))) {
                const packageJsonPath = path.join(workspaceRoot, 'package.json');
                try {
                    const content = await this.readFile(packageJsonPath);
                    const packageJson = JSON.parse(content);
                    const allDeps = { ...packageJson.dependencies, ...packageJson.devDependencies };

                    const hasDeps = frameworkDef.dependencies.some((dep: string) => allDeps[dep]);
                    if (hasDeps) {
                        return {
                            name: frameworkName,
                            confidence: 0.85,
                            configFiles: ['package.json'],
                            entryPoints: [...frameworkDef.entryPoints],
                            conventions: frameworkDef.conventions
                        };
                    }
                } catch (err) {
                    logger.warn(`Cannot read package.json: ${err}`);
                }
            }

            // Python
            if (await this.fileExists(path.join(workspaceRoot, 'requirements.txt')) ||
                await this.fileExists(path.join(workspaceRoot, 'pyproject.toml'))) {

                const depFiles = ['requirements.txt', 'pyproject.toml', 'setup.py'];
                for (const depFile of depFiles) {
                    if (await this.fileExists(path.join(workspaceRoot, depFile))) {
                        try {
                            const content = await this.readFile(path.join(workspaceRoot, depFile));
                            const hasDeps = frameworkDef.dependencies.some((dep: string) =>
                                content.toLowerCase().includes(dep.toLowerCase())
                            );
                            if (hasDeps) {
                                return {
                                    name: frameworkName,
                                    confidence: 0.8,
                                    configFiles: [depFile],
                                    entryPoints: [...frameworkDef.entryPoints],
                                    conventions: frameworkDef.conventions
                                };
                            }
                        } catch (err) {
                            logger.warn(`Cannot read ${depFile}: ${err}`);
                        }
                    }
                }
            }

            // PHP , Composer frameworks
            if (await this.fileExists(path.join(workspaceRoot, 'composer.json'))) {
                const composerPath = path.join(workspaceRoot, 'composer.json');
                try {
                    const content = await this.readFile(composerPath);
                    const composerJson = JSON.parse(content);
                    const allDeps = { ...composerJson.require, ...composerJson['require-dev'] };

                    const hasDeps = frameworkDef.dependencies.some((dep: string) => allDeps[dep]);
                    if (hasDeps) {
                        return {
                            name: frameworkName,
                            confidence: 0.85,
                            configFiles: ['composer.json'],
                            entryPoints: [...frameworkDef.entryPoints],
                            conventions: frameworkDef.conventions
                        };
                    }
                } catch (err) {
                    logger.warn(`Cannot read composer.json: ${err}`);
                }
            }

            // Java , Maven frameworks
            if (await this.fileExists(path.join(workspaceRoot, 'pom.xml'))) {
                const pomPath = path.join(workspaceRoot, 'pom.xml');
                try {
                    const content = await this.readFile(pomPath);
                    const hasDeps = frameworkDef.dependencies.some((dep: string) =>
                        content.toLowerCase().includes(dep.toLowerCase())
                    );
                    if (hasDeps) {
                        return {
                            name: frameworkName,
                            confidence: 0.8,
                            configFiles: ['pom.xml'],
                            entryPoints: [...frameworkDef.entryPoints],
                            conventions: frameworkDef.conventions
                        };
                    }
                } catch (err) {
                    logger.warn(`Cannot read pom.xml: ${err}`);
                }
            }

            // Go
            if (await this.fileExists(path.join(workspaceRoot, 'go.mod'))) {
                const goModPath = path.join(workspaceRoot, 'go.mod');
                try {
                    const content = await this.readFile(goModPath);
                    const hasDeps = frameworkDef.dependencies.some((dep: string) =>
                        content.toLowerCase().includes(dep.toLowerCase())
                    );
                    if (hasDeps) {
                        return {
                            name: frameworkName,
                            confidence: 0.8,
                            configFiles: ['go.mod'],
                            entryPoints: [...frameworkDef.entryPoints],
                            conventions: frameworkDef.conventions
                        };
                    }
                } catch (err) {
                    logger.warn(`Cannot read go.mod: ${err}`);
                }
            }

            // Rust
            if (await this.fileExists(path.join(workspaceRoot, 'Cargo.toml'))) {
                const cargoPath = path.join(workspaceRoot, 'Cargo.toml');
                try {
                    const content = await this.readFile(cargoPath);
                    const hasDeps = frameworkDef.dependencies.some((dep: string) =>
                        content.toLowerCase().includes(dep.toLowerCase())
                    );
                    if (hasDeps) {
                        return {
                            name: frameworkName,
                            confidence: 0.8,
                            configFiles: ['Cargo.toml'],
                            entryPoints: [...frameworkDef.entryPoints],
                            conventions: frameworkDef.conventions
                        };
                    }
                } catch (err) {
                    logger.warn(`Cannot read Cargo.toml: ${err}`);
                }
            }

            // Ruby / Gemfile
            if (await this.fileExists(path.join(workspaceRoot, 'Gemfile'))) {
                const gemfilePath = path.join(workspaceRoot, 'Gemfile');
                try {
                    const content = await this.readFile(gemfilePath);
                    const hasDeps = frameworkDef.dependencies.some((dep: string) =>
                        content.toLowerCase().includes(dep.toLowerCase())
                    );
                    if (hasDeps) {
                        return {
                            name: frameworkName,
                            confidence: 0.8,
                            configFiles: ['Gemfile'],
                            entryPoints: [...frameworkDef.entryPoints],
                            conventions: frameworkDef.conventions
                        };
                    }
                } catch (err) {
                    logger.warn(`Cannot read Gemfile: ${err}`);
                }
            }
        }

        return null;
    }

    getFrameworkConventions(frameworkName: string): any {
        return FRAMEWORKS[frameworkName]?.conventions || null;
    }


    getAllConventions(): Record<string, any> {
        const conventions: Record<string, any> = {};
        for (const [name, framework] of Object.entries(FRAMEWORKS)) {
            if (framework.conventions) {
                conventions[name] = framework.conventions;
            }
        }
        return conventions;
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
