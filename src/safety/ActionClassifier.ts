

import { ActionCategory, RiskLevel, ActionRequest } from '../types';
import * as vscode from 'vscode';
import * as path from 'path';

export class ActionClassifier {
    private static readonly DESTRUCTIVE_COMMANDS = [
        'rm', 'del', 'delete', 'dd', 'format', 'mkfs',
        'sudo rm', 'sudo dd', 'rmdir', 'rd'
    ];

    private static readonly SYSTEM_PATHS = [
        '/etc', '/usr', '/bin', '/sbin', '/System', '/Library',
        'C:\\Windows', 'C:\\Program Files'
    ];

    private static readonly CRITICAL_FILES = [
        '.env', '.env.local', '.env.production',
        'package.json', 'package-lock.json', 'yarn.lock',
        'Cargo.toml', 'go.mod', 'requirements.txt',
        'docker-compose.yml', 'Dockerfile',
        'tsconfig.json', 'webpack.config.js',
        'prisma/schema.prisma', 'database.yml'
    ];

    classifyFileOperation(
        operation: 'create' | 'modify' | 'delete' | 'rename' | 'move',
        filePath: string,
        content?: string
    ): ActionRequest {
        const category = this.getFileOperationCategory(operation);
        const riskLevel = this.assessFileRisk(operation, filePath, content);
        const affectedFiles = [filePath];

        return {
            id: this.generateId(),
            category,
            riskLevel,
            description: this.describeFileOperation(operation, filePath),
            affectedFiles,
            estimatedImpact: this.estimateFileImpact(operation, filePath, content),
            reversible: this.isFileOperationReversible(operation),
            timestamp: Date.now()
        };
    }

    classifyTerminalCommand(command: string, cwd: string): ActionRequest {
        const riskLevel = this.assessCommandRisk(command);

        return {
            id: this.generateId(),
            category: 'terminal-command',
            riskLevel,
            description: `Execute command: ${command}`,
            affectedFiles: [cwd],
            estimatedImpact: this.estimateCommandImpact(command),
            reversible: !this.isDestructiveCommand(command),
            timestamp: Date.now()
        };
    }

    classifyRefactor(
        files: string[],
        totalLines: number,
        description: string
    ): ActionRequest {
        const riskLevel = totalLines > 100 ? 'high' :
            totalLines > 30 ? 'moderate' : 'safe';

        return {
            id: this.generateId(),
            category: 'large-refactor',
            riskLevel,
            description,
            affectedFiles: files,
            estimatedImpact: `Modifying ${totalLines} lines across ${files.length} files`,
            reversible: true,
            timestamp: Date.now()
        };
    }

    private getFileOperationCategory(operation: string): ActionCategory {
        switch (operation) {
            case 'delete':
                return 'file-delete';
            case 'rename':
                return 'file-rename';
            case 'move':
                return 'file-move';
            default:
                return 'file-overwrite';
        }
    }

    private assessFileRisk(
        operation: string,
        filePath: string,
        content?: string
    ): RiskLevel {
        const fileName = path.basename(filePath);
        const fileExt = path.extname(filePath);

        if (operation === 'delete') {
            if (this.isCriticalFile(fileName)) {
                return 'critical';
            }
            if (this.isConfigFile(fileExt)) {
                return 'high';
            }
            return 'moderate';
        }

        if (this.isCriticalFile(fileName)) {
            return 'high';
        }

        if (this.isAuthFile(filePath) || this.isFrameworkFile(filePath)) {
            return 'high';
        }

        if (content && content.length > 10000) {
            return 'moderate';
        }

        return 'safe';
    }

    private assessCommandRisk(command: string): RiskLevel {
        const lowerCommand = command.toLowerCase();

        if (this.isDestructiveCommand(lowerCommand)) {
            return 'critical';
        }

        if (lowerCommand.includes('sudo') || lowerCommand.includes('chmod')) {
            return 'high';
        }

        if (this.isPackageInstall(lowerCommand)) {
            return 'moderate';
        }

        if (this.isDatabaseOperation(lowerCommand)) {
            return 'high';
        }

        if (lowerCommand.includes('curl') || lowerCommand.includes('wget')) {
            return 'moderate';
        }

        return 'safe';
    }

    private isDestructiveCommand(command: string): boolean {
        return ActionClassifier.DESTRUCTIVE_COMMANDS.some(cmd =>
            command.includes(cmd)
        );
    }

    private isPackageInstall(command: string): boolean {
        return command.includes('npm install') ||
            command.includes('yarn add') ||
            command.includes('pip install') ||
            command.includes('cargo install') ||
            command.includes('go get');
    }

    private isDatabaseOperation(command: string): boolean {
        return command.includes('migrate') ||
            command.includes('prisma') ||
            command.includes('sequelize') ||
            command.includes('typeorm') ||
            command.includes('psql') ||
            command.includes('mysql');
    }

    private isCriticalFile(fileName: string): boolean {
        return ActionClassifier.CRITICAL_FILES.includes(fileName);
    }

    private isConfigFile(ext: string): boolean {
        return ['.json', '.yml', '.yaml', '.toml', '.ini', '.conf'].includes(ext);
    }

    private isAuthFile(filePath: string): boolean {
        const lower = filePath.toLowerCase();
        return lower.includes('auth') ||
            lower.includes('login') ||
            lower.includes('password') ||
            lower.includes('token') ||
            lower.includes('session');
    }

    private isFrameworkFile(filePath: string): boolean {
        const lower = filePath.toLowerCase();
        return lower.includes('next.config') ||
            lower.includes('vite.config') ||
            lower.includes('webpack.config') ||
            lower.includes('rollup.config');
    }

    private isFileOperationReversible(operation: string): boolean {
        return operation !== 'delete';
    }

    private describeFileOperation(operation: string, filePath: string): string {
        const fileName = path.basename(filePath);

        switch (operation) {
            case 'delete':
                return `Delete file: ${fileName}`;
            case 'rename':
                return `Rename file: ${fileName}`;
            case 'move':
                return `Move file: ${fileName}`;
            case 'create':
                return `Create file: ${fileName}`;
            default:
                return `Modify file: ${fileName}`;
        }
    }

    private estimateFileImpact(
        operation: string,
        filePath: string,
        content?: string
    ): string {
        const fileName = path.basename(filePath);

        if (operation === 'delete') {
            return `File ${fileName} will be permanently deleted`;
        }

        if (content) {
            const lines = content.split('\n').length;
            return `${lines} lines will be modified in ${fileName}`;
        }

        return `File ${fileName} will be ${operation}d`;
    }

    private estimateCommandImpact(command: string): string {
        if (this.isPackageInstall(command)) {
            return 'New dependencies will be installed';
        }

        if (this.isDatabaseOperation(command)) {
            return 'Database schema may be modified';
        }

        return 'Command will be executed in terminal';
    }

    private generateId(): string {
        return `action_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
}

export const actionClassifier = new ActionClassifier();
