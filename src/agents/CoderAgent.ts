

import { BaseAgent } from './BaseAgent';
import { AgentTask, AgentResult } from '../types';
import { modelRouter } from '../ai/ModelRouter';
import { projectBrain } from '../brain/ProjectBrain';
import { fileOperationManager } from '../operations/FileOperationManager';
import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { PROMPTS } from '../config/prompts';

export class CoderAgent extends BaseAgent {
    constructor() {
        super('coder', 'Coder Agent');
    }

    async execute(task: AgentTask): Promise<AgentResult> {
        const context = await this.buildContext(task);
        const prompt = this.buildCodingPrompt(task, context);

        const response = await modelRouter.generateCompletion({
            prompt,
            systemPrompt: PROMPTS.SYSTEM.CODER,
            context: context.relevantFiles,
            maxTokens: 3000,
            model: task.context.modelId
        }, 'code-generation');

        const operations = this.extractFileOperations(response.content);
        let operationsExecuted = 0;

        if (operations.length > 0) {
            logger.info(`Detected ${operations.length} file operation(s)`);

            for (const operation of operations) {
                try {
                    await fileOperationManager.executeOperation(operation);
                    operationsExecuted++;
                } catch (error) {
                    logger.error(`Failed to execute operation: ${operation.type} on ${operation.path}`, error as Error);
                }
            }
        }

        const code = this.extractCode(response.content);
        const linesChanged = code.split('\n').length;

        return this.createResult(task.id, true, response.content, {
            metrics: {
                tokensUsed: response.tokensUsed,
                latency: response.latency,
                linesChanged,
                operationsExecuted
            },
            suggestions: [
                operationsExecuted > 0 ? `Executed ${operationsExecuted} file operation(s)` : 'Review generated code for correctness',
                'Run tests after applying changes',
                'Consider adding error handling'
            ]
        });
    }

    private async buildContext(task: AgentTask): Promise<{
        relevantFiles: string[];
        frameworks: string[];
        style: any;
    }> {
        const brainState = projectBrain.getState();
        const relevantFiles: string[] = [];

        if (brainState) {
            const relevant = await projectBrain.getRelevantContext(task.description, 3);

            for (const filePath of relevant) {
                try {
                    const doc = await vscode.workspace.openTextDocument(filePath);
                    const content = doc.getText();
                    relevantFiles.push(`File: ${filePath}\n${content.slice(0, 500)}...`);
                } catch {
                    continue;
                }
            }
        }

        return {
            relevantFiles,
            frameworks: brainState?.frameworks.map(f => f.name) || [],
            style: null 
        };
    }

    private buildCodingPrompt(task: AgentTask, context: any): string {
        return PROMPTS.CODING_TASK({
            description: task.description,
            frameworks: context.frameworks.length > 0 ? context.frameworks.join(', ') : undefined,
            currentCode: task.context.codeSelection ? task.context.userPrompt : undefined
        });
    }

    private extractFileOperations(response: string): any[] {
        const operations: any[] = [];

        const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
        let match;

        while ((match = jsonBlockRegex.exec(response)) !== null) {
            try {
                const jsonContent = match[1];
                const parsed = JSON.parse(jsonContent);

                if (parsed.operation && ['create', 'modify', 'delete', 'rename', 'move'].includes(parsed.operation)) {
                    operations.push({
                        type: parsed.operation,
                        path: parsed.path,
                        content: parsed.content,
                        newPath: parsed.newPath
                    });
                }
            } catch (error) {
                continue;
            }
        }

        return operations;
    }

    private extractCode(response: string): string {
        const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)\n```/);

        if (codeBlockMatch) {
            return codeBlockMatch[1];
        }

        return response;
    }
}

export const coderAgent = new CoderAgent();
