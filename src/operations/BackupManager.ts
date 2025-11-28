

import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface Backup {
    id: string;
    filePath: string;
    content: string;
    timestamp: number;
    reason: string;
}

export class BackupManager {
    private backups: Map<string, Backup[]> = new Map();
    private backupDir: string = '';

    async initialize(workspaceRoot: string): Promise<void> {
        this.backupDir = path.join(workspaceRoot, '.codemind', 'backups');

        try {
            await vscode.workspace.fs.createDirectory(vscode.Uri.file(this.backupDir));
            logger.info(`Backup directory initialized: ${this.backupDir}`);
        } catch (error) {
            logger.error('Failed to create backup directory', error as Error);
        }
    }

    async createBackup(filePath: string, reason: string = 'Manual backup'): Promise<string> {
        try {
            const document = await vscode.workspace.openTextDocument(filePath);
            const content = document.getText();

            const backup: Backup = {
                id: `backup-${Date.now()}`,
                filePath,
                content,
                timestamp: Date.now(),
                reason
            };

            if (!this.backups.has(filePath)) {
                this.backups.set(filePath, []);
            }
            this.backups.get(filePath)!.push(backup);

            const backupFileName = `${path.basename(filePath)}.${backup.id}.backup`;
            const backupPath = path.join(this.backupDir, backupFileName);

            await vscode.workspace.fs.writeFile(
                vscode.Uri.file(backupPath),
                Buffer.from(content, 'utf8')
            );

            logger.info(`Backup created: ${backupPath}`);
            return backup.id;
        } catch (error) {
            logger.error(`Failed to create backup for ${filePath}`, error as Error);
            throw error;
        }
    }

    async restoreBackup(backupId: string): Promise<void> {
        for (const [filePath, backups] of this.backups.entries()) {
            const backup = backups.find(b => b.id === backupId);

            if (backup) {
                try {
                    const uri = vscode.Uri.file(filePath);
                    await vscode.workspace.fs.writeFile(uri, Buffer.from(backup.content, 'utf8'));

                    logger.info(`Restored backup: ${backupId} for ${filePath}`);
                    vscode.window.showInformationMessage(`File restored from backup: ${path.basename(filePath)}`);
                } catch (error) {
                    logger.error(`Failed to restore backup ${backupId}`, error as Error);
                    throw error;
                }
                return;
            }
        }

        throw new Error(`Backup not found: ${backupId}`);
    }

    getBackups(filePath: string): Backup[] {
        return this.backups.get(filePath) || [];
    }

    getAllBackups(): Backup[] {
        const all: Backup[] = [];
        for (const backups of this.backups.values()) {
            all.push(...backups);
        }
        return all.sort((a, b) => b.timestamp - a.timestamp);
    }

    async deleteBackup(backupId: string): Promise<void> {
        for (const [filePath, backups] of this.backups.entries()) {
            const index = backups.findIndex(b => b.id === backupId);

            if (index !== -1) {
                backups.splice(index, 1);

                const backupFileName = `${path.basename(filePath)}.${backupId}.backup`;
                const backupPath = path.join(this.backupDir, backupFileName);

                try {
                    await vscode.workspace.fs.delete(vscode.Uri.file(backupPath));
                    logger.info(`Deleted backup: ${backupId}`);
                } catch (error) {
                    logger.warn(`Failed to delete backup file: ${backupPath}`);
                }

                return;
            }
        }
    }

    async clearOldBackups(maxAge: number = 7 * 24 * 60 * 60 * 1000): Promise<number> {
        const now = Date.now();
        let deleted = 0;

        for (const [filePath, backups] of this.backups.entries()) {
            const toDelete = backups.filter(b => now - b.timestamp > maxAge);

            for (const backup of toDelete) {
                await this.deleteBackup(backup.id);
                deleted++;
            }
        }

        logger.info(`Cleared ${deleted} old backups`);
        return deleted;
    }

    clear(): void {
        this.backups.clear();
    }
}

export const backupManager = new BackupManager();
