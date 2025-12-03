

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

    private resolveWorkspacePath(filePath: string): vscode.Uri {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri;

        if (!workspaceRoot) {
            throw new Error('No workspace folder open');
        }

        const cleanPath = filePath.startsWith('/') ? filePath.slice(1) : filePath;

        return vscode.Uri.joinPath(workspaceRoot, cleanPath);
    }

    private async createFile(operation: FileOperation): Promise<void> {
        const uri = this.resolveWorkspacePath(operation.path);
        const content = operation.content || '';

        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.joinPath(uri, '..'));
        } catch (error) {
        }

        await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));

        await this.refreshFileSystem();

        // Don't open the file automatically to prevent stealing focus from the chat panel
        // Users can click the file link in the response to open it
        /*
        try {
            const document = await vscode.workspace.openTextDocument(uri);
            await vscode.window.showTextDocument(document, {
                preview: false,
                preserveFocus: true,
                viewColumn: vscode.ViewColumn.One
            });
        } catch (error) {
            logger.warn(`Could not open created file: ${operation.path}`, error as Error);
        }
        */
    }

    private async modifyFile(operation: FileOperation): Promise<void> {
        const uri = this.resolveWorkspacePath(operation.path);

        // Read the file content without opening it in the editor
        const fileContent = await vscode.workspace.fs.readFile(uri);
        const currentText = Buffer.from(fileContent).toString('utf8');

        let newContent: string;

        if (operation.diff) {
            const changes = diffGenerator.generateMinimalDiff(
                currentText,
                operation.diff.modified
            );

            // Apply changes to the text
            const lines = currentText.split('\n');
            for (const change of changes.reverse()) {
                lines.splice(
                    change.startLine - 1,
                    change.endLine - change.startLine + 1,
                    ...change.replacement.split('\n')
                );
            }
            newContent = lines.join('\n');
        } else if (operation.content) {
            newContent = operation.content;
        } else {
            return;
        }

        // Write the modified content back to the file
        await vscode.workspace.fs.writeFile(uri, Buffer.from(newContent, 'utf8'));

        await this.refreshFileSystem();
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

        await this.refreshFileSystem();
    }

    async executeBatch(operations: FileOperation[]): Promise<void> {
        logger.info(`Executing batch of ${operations.length} file operations`);

        for (const operation of operations) {
            await this.executeOperation(operation);
        }

        await this.refreshFileSystem();

        logger.info('Batch execution complete');
    }


    private async refreshFileSystem(): Promise<void> {
        // Don't refresh the file explorer as it steals focus from the chat panel
        // The file watcher in WebviewProvider will handle updates automatically
        /*
        try {
            await vscode.commands.executeCommand('workbench.files.action.refreshFilesExplorer');
            logger.info('File system refreshed to update @ reference suggestions');
        } catch (error) {
            logger.warn('Failed to refresh file system:', error);
        }
        */
    }
}

export const fileOperationManager = new FileOperationManager();
