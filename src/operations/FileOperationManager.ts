

import * as vscode from 'vscode';
import { FileOperation } from '../types';
import { PermissionEngine } from '../safety/PermissionEngine';
import { actionClassifier } from '../safety/ActionClassifier';
import { backupManager } from './BackupManager';
import { diffGenerator } from './DiffGenerator';
import { logger } from '../utils/logger';

export class FileOperationManager {
    private permissionEngine: PermissionEngine | null = null;

    setPermissionEngine(engine: PermissionEngine): void {
        this.permissionEngine = engine;
    }

    async executeOperation(operation: FileOperation): Promise<void> {
        logger.info(`Executing file operation: ${operation.type} on ${operation.path}`);

        const action = actionClassifier.classifyFileOperation(
            operation.type,
            operation.path,
            operation.content
        );

        if (this.permissionEngine) {
            const decision = await this.permissionEngine.requestPermission(action);

            if (decision.decision === 'deny') {
                logger.warn(`Operation denied: ${operation.type} on ${operation.path}`);
                throw new Error('Operation denied by user');
            }
        }

        if (['modify', 'delete', 'rename', 'move'].includes(operation.type)) {
            try {
                await backupManager.createBackup(operation.path, `Before ${operation.type}`);
            } catch (error) {
                logger.warn('Failed to create backup, continuing anyway');
            }
        }

        try {
            switch (operation.type) {
                case 'create':
                    await this.createFile(operation);
                    break;
                case 'modify':
                    await this.modifyFile(operation);
                    break;
                case 'delete':
                    await this.deleteFile(operation);
                    break;
                case 'rename':
                    await this.renameFile(operation);
                    break;
                case 'move':
                    await this.moveFile(operation);
                    break;
            }

            logger.info(`Operation completed: ${operation.type} on ${operation.path}`);
        } catch (error) {
            logger.error(`Operation failed: ${operation.type} on ${operation.path}`, error as Error);
            throw error;
        }
    }

    /**
     * Resolve a file path relative to the workspace root
     */
    private resolveWorkspacePath(filePath: string): vscode.Uri {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

        if (!workspaceRoot) {
            throw new Error('No workspace folder open');
        }

        // Remove leading slash if present
        const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

        // Join with workspace root
        return vscode.Uri.joinPath(workspaceRoot, cleanPath);
    }

    private async createFile(operation: FileOperation): Promise<void> {
        const uri = this.resolveWorkspacePath(operation.path);
        const content = operation.content || '';

        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));

        const document = await vscode.workspace.openTextDocument(uri);
        await vscode.window.showTextDocument(document);
    }

    private async modifyFile(operation: FileOperation): Promise<void> {
        const uri = this.resolveWorkspacePath(operation.path);
        const document = await vscode.workspace.openTextDocument(uri);
        const editor = await vscode.window.showTextDocument(document);

        if (operation.diff) {
            const changes = diffGenerator.generateMinimalDiff(
                document.getText(),
                operation.diff.modified
            );

            await editor.edit(editBuilder => {
                for (const change of changes) {
                    const range = new vscode.Range(
                        change.startLine - 1,
                        0,
                        change.endLine,
                        0
                    );
                    editBuilder.replace(range, change.replacement);
                }
            });
        } else if (operation.content) {
            const fullRange = new vscode.Range(
                document.positionAt(0),
                document.positionAt(document.getText().length)
            );

            await editor.edit(editBuilder => {
                editBuilder.replace(fullRange, operation.content!);
            });
        }

        await document.save();
    }

    private async deleteFile(operation: FileOperation): Promise<void> {
        const uri = this.resolveWorkspacePath(operation.path);
        await vscode.workspace.fs.delete(uri);
    }

    private async renameFile(operation: FileOperation): Promise<void> {
        if (!operation.newPath) {
            throw new Error('New path required for rename operation');
        }

        const oldUri = this.resolveWorkspacePath(operation.path);
        const newUri = this.resolveWorkspacePath(operation.newPath);

        await vscode.workspace.fs.rename(oldUri, newUri);
    }

    private async moveFile(operation: FileOperation): Promise<void> {
        if (!operation.newPath) {
            throw new Error('New path required for move operation');
        }

        const oldUri = this.resolveWorkspacePath(operation.path);
        const newUri = this.resolveWorkspacePath(operation.newPath);

        await vscode.workspace.fs.rename(oldUri, newUri, { overwrite: false });
    }

    async executeBatch(operations: FileOperation[]): Promise<void> {
        logger.info(`Executing batch of ${operations.length} file operations`);

        for (const operation of operations) {
            await this.executeOperation(operation);
        }

        logger.info('Batch execution complete');
    }
}

export const fileOperationManager = new FileOperationManager();
