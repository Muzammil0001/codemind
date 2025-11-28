

import { ChatOpenAI } from '@langchain/openai';
import { createAgent, tool } from 'langchain';
import { z } from 'zod';

import { FileSearchTool } from '../tools/FileSearchTool';
import { FilePatchTool } from '../tools/FilePatchTool';
import { ASTEditTool } from '../tools/ASTEditTool';
import { TerminalTool } from '../tools/TerminalTool';
import { logger } from '../utils/logger';
import { PROMPTS } from '../config/prompts';

import { BaseAgent } from './BaseAgent';
import { AgentTask, AgentResult } from '../types';

export class LangChainOrchestrator extends BaseAgent {
    private agent: ReturnType<typeof createAgent> | null = null;

    private fileSearchTool = new FileSearchTool();
    private filePatchTool = new FilePatchTool();
    private astEditTool = new ASTEditTool();
    private terminalTool = new TerminalTool();

    constructor() {
        super('langchain', 'LangChain Agent');
    }

    async execute(task: AgentTask): Promise<AgentResult> {
        try {
            if (!this.agent) {
                await this.initialize();
            }

            const output = await this.runAgent(task.description);
            return this.createResult(task.id, true, output);
        } catch (error) {
            return this.createResult(task.id, false, (error as Error).message);
        }
    }

    private async initialize() {
        if (this.agent) return;

        const fileSearch = tool(
            async (args: { query: string; type?: 'file' | 'symbol' | 'content'; fuzzy?: boolean; semantic?: boolean }) => {
                return await this.fileSearchTool.execute(args as any);
            },
            {
                name: 'file_search',
                description: 'Search files or content in the codebase',
                schema: z.object({
                    query: z.string(),
                    type: z.enum(['file', 'symbol', 'content']).optional(),
                    fuzzy: z.boolean().optional(),
                    semantic: z.boolean().optional(),
                }),
            }
        );

        const filePatch = tool(
            async (args: { filePath: string; patch: string; createBackup?: boolean }) => {
                return await this.filePatchTool.execute(args as any);
            },
            {
                name: 'file_patch',
                description: 'Apply unified-diff patch to a file',
                schema: z.object({
                    filePath: z.string(),
                    patch: z.string(),
                    createBackup: z.boolean().optional(),
                }),
            }
        );

        const astEdit = tool(
            async (args: { filePath: string; operation: 'rename' | 'add-import' | 'remove-import' | 'add-parameter'; target: string; value?: any }) => {
                return await this.astEditTool.execute(args as any);
            },
            {
                name: 'ast_edit',
                description: 'Perform AST-based code edits (rename, imports, etc.)',
                schema: z.object({
                    filePath: z.string(),
                    operation: z.enum(['rename', 'add-import', 'remove-import', 'add-parameter']),
                    target: z.string(),
                    value: z.any().optional(),
                }),
            }
        );

        const terminal = tool(
            async (args: { command: string; cwd?: string; timeout?: number }) => {
                return await this.terminalTool.execute(args as any);
            },
            {
                name: 'terminal',
                description: 'Execute terminal commands',
                schema: z.object({
                    command: z.string(),
                    cwd: z.string().optional(),
                    timeout: z.number().optional(),
                }),
            }
        );

        const llm = new ChatOpenAI({
            modelName: 'gpt-4o-mini',
            temperature: 0,
            openAIApiKey: process.env.OPENAI_API_KEY || '',
        });
        this.agent = createAgent({
            model: llm,
            tools: [fileSearch, filePatch, astEdit, terminal],
            systemPrompt: PROMPTS.SYSTEM.LANGCHAIN_AGENT,
        });
    }

    private async runAgent(input: string): Promise<string> {
        if (!this.agent) {
            await this.initialize();
        }

        try {
            const res = await this.agent!.invoke({ messages: [{ role: 'user', content: input }] });
            return res.output ?? '';
        } catch (error) {
            logger.error('Agent execution failed', error as Error);
            return `I encountered an error while executing your request: ${(error as Error).message}`;
        }
    }
}

export const langChainOrchestrator = new LangChainOrchestrator();
