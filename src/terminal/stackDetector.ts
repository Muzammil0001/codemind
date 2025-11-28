import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

export interface StackInfo {
  primary: 'node' | 'python' | 'java' | 'maven' | 'php' | 'laravel' | 'go' | 'rust' | 'unknown' | 'next' | 'react';
  packageManager?: string;
  framework?: string;
}

export class StackDetector {
  private static instance: StackDetector;

  private constructor() { }

  public static getInstance(): StackDetector {
    if (!StackDetector.instance) {
      StackDetector.instance = new StackDetector();
    }
    return StackDetector.instance;
  }

  public async detectStack(): Promise<StackInfo> {
    const workspaceRoot = this.getWorkspaceRoot();
    if (!workspaceRoot) {
      return { primary: 'unknown' };
    }

    if (await this.fileExists(workspaceRoot, 'package.json')) {
      const packageJson = await this.readJson(path.join(workspaceRoot, 'package.json'));
      const dependencies = { ...packageJson.dependencies, ...packageJson.devDependencies };

      let primary: StackInfo['primary'] = 'node';
      if (dependencies.next) primary = 'next';
      else if (dependencies.react) primary = 'react';

      let packageManager = 'npm';
      if (await this.fileExists(workspaceRoot, 'yarn.lock')) packageManager = 'yarn';
      if (await this.fileExists(workspaceRoot, 'pnpm-lock.yaml')) packageManager = 'pnpm';
      if (await this.fileExists(workspaceRoot, 'bun.lockb')) packageManager = 'bun';

      return { primary, packageManager };
    }

    if (await this.fileExists(workspaceRoot, 'requirements.txt') || await this.fileExists(workspaceRoot, 'pyproject.toml')) {
      return { primary: 'python', packageManager: 'pip' };
    }

    if (await this.fileExists(workspaceRoot, 'pom.xml')) {
      return { primary: 'maven' };
    }

    if (await this.fileExists(workspaceRoot, 'composer.json')) {
      const composerJson = await this.readJson(path.join(workspaceRoot, 'composer.json'));
      const dependencies = { ...composerJson.require, ...composerJson['require-dev'] };

      if (dependencies['laravel/framework']) {
        return { primary: 'laravel', packageManager: 'composer' };
      }
      return { primary: 'php', packageManager: 'composer' };
    }

    return { primary: 'unknown' };
  }

  private getWorkspaceRoot(): string | undefined {
    return vscode.workspace.workspaceFolders?.[0].uri.fsPath;
  }

  private async fileExists(root: string, fileName: string): Promise<boolean> {
    try {
      await fs.promises.access(path.join(root, fileName));
      return true;
    } catch {
      return false;
    }
  }

  private async readJson(filePath: string): Promise<any> {
    try {
      const content = await fs.promises.readFile(filePath, 'utf-8');
      return JSON.parse(content);
    } catch {
      return {};
    }
  }
}

export const stackDetector = StackDetector.getInstance();

export const detectProjectStack = () => stackDetector.detectStack();
