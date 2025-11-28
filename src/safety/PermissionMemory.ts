

import * as vscode from 'vscode';
import { ActionCategory, PermissionLevel, PermissionMemoryEntry } from '../types';
import { logger } from '../utils/logger';

export class PermissionMemory {
    private context: vscode.ExtensionContext;
    private readonly STORAGE_KEY = 'codemind.permissionMemory';

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
    }

    async getPermission(category: ActionCategory): Promise<PermissionLevel | undefined> {
        const memory = await this.loadMemory();
        const entry = memory.get(category);

        if (!entry) {
            return undefined;
        }

        entry.lastUsed = Date.now();
        entry.useCount++;
        await this.saveMemory(memory);

        return entry.decision;
    }

    async setPermission(
        category: ActionCategory,
        decision: PermissionLevel
    ): Promise<void> {
        const memory = await this.loadMemory();

        const entry: PermissionMemoryEntry = {
            category,
            decision,
            createdAt: Date.now(),
            lastUsed: Date.now(),
            useCount: 1
        };

        memory.set(category, entry);
        await this.saveMemory(memory);

        logger.info(`Permission set for ${category}: ${decision}`);
    }

    async removePermission(category: ActionCategory): Promise<void> {
        const memory = await this.loadMemory();
        memory.delete(category);
        await this.saveMemory(memory);

        logger.info(`Permission removed for ${category}`);
    }

    async clearAll(): Promise<void> {
        await this.context.globalState.update(this.STORAGE_KEY, undefined);
        logger.info('All permissions cleared');
    }

    async getAllPermissions(): Promise<Map<ActionCategory, PermissionMemoryEntry>> {
        return await this.loadMemory();
    }

    async getPermissionStats(): Promise<{
        total: number;
        alwaysAllow: number;
        alwaysDeny: number;
        categories: ActionCategory[];
    }> {
        const memory = await this.loadMemory();
        let alwaysAllow = 0;
        let alwaysDeny = 0;

        for (const entry of memory.values()) {
            if (entry.decision === 'always-allow') {
                alwaysAllow++;
            } else if (entry.decision === 'deny') {
                alwaysDeny++;
            }
        }

        return {
            total: memory.size,
            alwaysAllow,
            alwaysDeny,
            categories: Array.from(memory.keys())
        };
    }

    private async loadMemory(): Promise<Map<ActionCategory, PermissionMemoryEntry>> {
        const stored = this.context.globalState.get<Record<string, PermissionMemoryEntry>>(
            this.STORAGE_KEY,
            {}
        );

        const memory = new Map<ActionCategory, PermissionMemoryEntry>();

        for (const [category, entry] of Object.entries(stored)) {
            memory.set(category as ActionCategory, entry);
        }

        return memory;
    }

    private async saveMemory(memory: Map<ActionCategory, PermissionMemoryEntry>): Promise<void> {
        const obj: Record<string, PermissionMemoryEntry> = {};

        for (const [category, entry] of memory.entries()) {
            obj[category] = entry;
        }

        await this.context.globalState.update(this.STORAGE_KEY, obj);
    }
}
