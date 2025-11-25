/**
 * Coder Agent - Writes and edits code
 */

import { BaseAgent } from './BaseAgent';
import { AgentTask, AgentResult } from '../types';
import { modelRouter } from '../ai/ModelRouter';
import { projectBrain } from '../brain/ProjectBrain';
import { fileOperationManager } from '../operations/FileOperationManager';
import * as vscode from 'vscode';
import { logger } from '../utils/logger';

export class CoderAgent extends BaseAgent {
    constructor() {
        super('coder', 'Coder Agent');
    }

    async execute(task: AgentTask): Promise<AgentResult> {
        const context = await this.buildContext(task);
        const prompt = this.buildCodingPrompt(task, context);

        const response = await modelRouter.generateCompletion({
            prompt,
            systemPrompt: 'You are an expert software engineer. Write clean, well-documented, production-ready code.',
            context: context.relevantFiles,
            maxTokens: 3000,
            model: task.context.modelId
        }, 'code-generation');

        // Detect and execute file operations
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

        // Get relevant files from Project Brain
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
            style: null // TODO: Add style from StyleAnalyzer
        };
    }

    private buildCodingPrompt(task: AgentTask, context: any): string {
        let prompt = `Task: ${task.description}\n\n`;

        if (context.frameworks.length > 0) {
            prompt += `Project uses: ${context.frameworks.join(', ')}\n\n`;
        }

        if (task.context.codeSelection) {
            prompt += `Current code:\n\`\`\`\n${task.context.userPrompt}\n\`\`\`\n\n`;
        }

        prompt += `Requirements:\n`;
        prompt += `- Write clean, readable code\n`;
        prompt += `- Follow best practices\n`;
        prompt += `- Add appropriate comments\n`;
        prompt += `- Handle errors properly\n`;
        prompt += `- Use TypeScript types if applicable\n\n`;

        prompt += `Generate the code:`;

        return prompt;
    }

    private extractFileOperations(response: string): any[] {
        const operations: any[] = [];

        // Match JSON code blocks with file operations
        const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
        let match;

        while ((match = jsonBlockRegex.exec(response)) !== null) {
            try {
                const jsonContent = match[1];
                const parsed = JSON.parse(jsonContent);

                // Check if it's a file operation
                if (parsed.operation && ['create', 'modify', 'delete', 'rename', 'move'].includes(parsed.operation)) {
                    operations.push({
                        type: parsed.operation,
                        path: parsed.path,
                        content: parsed.content,
                        newPath: parsed.newPath
                    });
                }
            } catch (error) {
                // Not valid JSON or not a file operation, skip
                continue;
            }
        }

        return operations;
    }

    private extractCode(response: string): string {
        // Try to extract code from markdown code blocks
        const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)\n```/);

        if (codeBlockMatch) {
            return codeBlockMatch[1];
        }

        // If no code block, return the entire response
        return response;
    }
}

export const coderAgent = new CoderAgent();
