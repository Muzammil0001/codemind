

import * as vscode from 'vscode';
import * as path from 'path';
import { logger } from '../utils/logger';

export interface MemoryEntry {
    id: string;
    type: 'operation' | 'conversation' | 'context' | 'feedback';
    content: string;
    metadata: Record<string, any>;
    timestamp: number;
    embedding?: number[];
}

export class MemoryEngine {
    private memories: Map<string, MemoryEntry> = new Map();
    private memoryFile: string = '';
    private maxMemories: number = 1000;

    async initialize(workspaceRoot: string): Promise<void> {
        this.memoryFile = path.join(workspaceRoot, '.codemind', 'memory.json');

        try {
            await this.loadMemories();
            logger.info(`Memory engine initialized with ${this.memories.size} entries`);
        } catch (error) {
            logger.warn('Failed to load memories, starting fresh');
            this.memories = new Map();
        }
    }

    async addMemory(entry: Omit<MemoryEntry, 'id' | 'timestamp'>): Promise<string> {
        const id = `mem-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

        const memory: MemoryEntry = {
            id,
            ...entry,
            timestamp: Date.now()
        };

        this.memories.set(id, memory);

        if (this.memories.size > this.maxMemories) {
            await this.pruneOldMemories();
        }

        await this.saveMemories();

        logger.info(`Memory added: ${id} (${entry.type})`);
        return id;
    }

    async getMemory(id: string): Promise<MemoryEntry | undefined> {
        return this.memories.get(id);
    }

    async searchMemories(query: string, limit: number = 10): Promise<MemoryEntry[]> {
        const results: MemoryEntry[] = [];
        const queryLower = query.toLowerCase();

        for (const memory of this.memories.values()) {
            const contentLower = memory.content.toLowerCase();

            if (contentLower.includes(queryLower)) {
                results.push(memory);
            }

            if (results.length >= limit) {
                break;
            }
        }

        return results.sort((a, b) => b.timestamp - a.timestamp);
    }

    async getMemoriesByType(type: MemoryEntry['type'], limit: number = 50): Promise<MemoryEntry[]> {
        const results: MemoryEntry[] = [];

        for (const memory of this.memories.values()) {
            if (memory.type === type) {
                results.push(memory);
            }

            if (results.length >= limit) {
                break;
            }
        }

        return results.sort((a, b) => b.timestamp - a.timestamp);
    }

    async getRecentMemories(limit: number = 20): Promise<MemoryEntry[]> {
        const all = Array.from(this.memories.values());
        return all
            .sort((a, b) => b.timestamp - a.timestamp)
            .slice(0, limit);
    }

    async recordOperation(operation: string, details: Record<string, any>): Promise<string> {
        return await this.addMemory({
            type: 'operation',
            content: operation,
            metadata: details
        });
    }

    async recordConversation(message: string, role: 'user' | 'assistant'): Promise<string> {
        return await this.addMemory({
            type: 'conversation',
            content: message,
            metadata: { role }
        });
    }

    async recordContext(context: string, source: string): Promise<string> {
        return await this.addMemory({
            type: 'context',
            content: context,
            metadata: { source }
        });
    }

    async recordFeedback(feedback: string, rating: number): Promise<string> {
        return await this.addMemory({
            type: 'feedback',
            content: feedback,
            metadata: { rating }
        });
    }

    async deleteMemory(id: string): Promise<void> {
        this.memories.delete(id);
        await this.saveMemories();
        logger.info(`Memory deleted: ${id}`);
    }

    async clearMemories(): Promise<void> {
        this.memories.clear();
        await this.saveMemories();
        logger.info('All memories cleared');
    }

    private async pruneOldMemories(): Promise<void> {
        const all = Array.from(this.memories.entries());
        const sorted = all.sort((a, b) => b[1].timestamp - a[1].timestamp);

        const toKeep = sorted.slice(0, this.maxMemories);

        this.memories = new Map(toKeep);
        logger.info(`Pruned memories to ${this.memories.size} entries`);
    }

    private async loadMemories(): Promise<void> {
        try {
            const uri = vscode.Uri.file(this.memoryFile);
            const content = await vscode.workspace.fs.readFile(uri);
            const data = JSON.parse(Buffer.from(content).toString('utf8'));

            this.memories = new Map(Object.entries(data));
        } catch (error) {
            this.memories = new Map();
        }
    }

    private async saveMemories(): Promise<void> {
        try {
            const data = Object.fromEntries(this.memories);
            const content = JSON.stringify(data, null, 2);

            const uri = vscode.Uri.file(this.memoryFile);
            await vscode.workspace.fs.writeFile(uri, Buffer.from(content, 'utf8'));
        } catch (error) {
            logger.error('Failed to save memories', error as Error);
        }
    }

    getStatistics(): {
        total: number;
        byType: Record<string, number>;
        oldestTimestamp: number;
        newestTimestamp: number;
    } {
        const byType: Record<string, number> = {};
        let oldest = Date.now();
        let newest = 0;

        for (const memory of this.memories.values()) {
            byType[memory.type] = (byType[memory.type] || 0) + 1;
            oldest = Math.min(oldest, memory.timestamp);
            newest = Math.max(newest, memory.timestamp);
        }

        return {
            total: this.memories.size,
            byType,
            oldestTimestamp: oldest,
            newestTimestamp: newest
        };
    }

    clear(): void {
        this.memories.clear();
    }
}

export const memoryEngine = new MemoryEngine();
