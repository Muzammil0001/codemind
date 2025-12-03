import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';
import { StackType, PackageManager } from '../types/stackTypes';
import { StackUtils } from '../utils/stackHelpers';

export interface StackInfo {
  primary: StackType;
  packageManager?: PackageManager;
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

      let primary: StackType = 'node';

      if (dependencies.next) {
        primary = 'next';
      }
      else if (dependencies.react) {
        primary = 'react';
      }
      else if (dependencies.vue) {
        primary = 'vue';
      }
      else if (dependencies.nuxt) {
        primary = 'nuxt';
      }
      else if (dependencies['@angular/core']) {
        primary = 'angular';
      }
      else if (dependencies.svelte) {
        primary = 'svelte';
      }
      else if (dependencies.express) {
        primary = 'express';
      }
      else if (dependencies['@nestjs/core']) {
        primary = 'nestjs';
      }

      const lockFiles = await this.getLockFiles(workspaceRoot);
      const packageManager = StackUtils.detectPackageManager(lockFiles) || 'npm';

      return { primary, packageManager };
    }

    if (await this.fileExists(workspaceRoot, 'requirements.txt') ||
        await this.fileExists(workspaceRoot, 'pyproject.toml') ||
        await this.fileExists(workspaceRoot, 'Pipfile')) {

      const requirements = await this.readRequirements(workspaceRoot);
      let primary: StackType = 'python';

      if (requirements.includes('django')) {
        primary = 'django';
      }
      else if (requirements.includes('flask')) {
        primary = 'flask';
      }
      else if (requirements.includes('fastapi')) {
        primary = 'fastapi';
      }

      return { primary, packageManager: 'pip' };
    }

    if (await this.fileExists(workspaceRoot, 'pom.xml')) {
      const pomContent = await this.readFile(path.join(workspaceRoot, 'pom.xml'));

      if (pomContent.includes('spring-boot') || pomContent.includes('spring-framework')) {
        return { primary: 'spring', packageManager: 'maven' };
      }

      return { primary: 'maven', packageManager: 'maven' };
    }

    if (await this.fileExists(workspaceRoot, 'build.gradle') ||
        await this.fileExists(workspaceRoot, 'build.gradle.kts')) {
      return { primary: 'java', packageManager: 'maven' };
    }

    if (await this.fileExists(workspaceRoot, 'composer.json')) {
      const composerJson = await this.readJson(path.join(workspaceRoot, 'composer.json'));
      const dependencies = { ...composerJson.require, ...composerJson['require-dev'] };

      if (dependencies['laravel/framework']) {
        return { primary: 'laravel', packageManager: 'composer' };
      }
      return { primary: 'php', packageManager: 'composer' };
    }

    if (await this.fileExists(workspaceRoot, 'go.mod')) {
      return { primary: 'go' };
    }

    if (await this.fileExists(workspaceRoot, 'Cargo.toml')) {
      return { primary: 'rust' };
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

  private async getLockFiles(root: string): Promise<string[]> {
    const possibleLockFiles = [
      'package-lock.json',
      'yarn.lock',
      'pnpm-lock.yaml',
      'bun.lockb',
      'composer.lock',
      'Pipfile.lock'
    ];

    const existingFiles: string[] = [];
    for (const file of possibleLockFiles) {
      if (await this.fileExists(root, file)) {
        existingFiles.push(file);
      }
    }
    return existingFiles;
  }

  private async readRequirements(root: string): Promise<string> {
    const requirementFiles = ['requirements.txt', 'pyproject.toml', 'Pipfile'];

    for (const file of requirementFiles) {
      try {
        const content = await this.readFile(path.join(root, file));
        return content.toLowerCase();
      } catch {
        continue;
      }
    }
    return '';
  }

  private async readFile(filePath: string): Promise<string> {
    try {
      return await fs.promises.readFile(filePath, 'utf-8');
    } catch {
      return '';
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
