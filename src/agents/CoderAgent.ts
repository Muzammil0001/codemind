/**
 * Coder Agent - Writes and edits code
 */

import { BaseAgent } from './BaseAgent';
import { AgentTask, AgentResult } from '../types';
import { modelRouter } from '../ai/ModelRouter';
import { projectBrain } from '../brain/ProjectBrain';
import * as vscode from 'vscode';

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

        const code = this.extractCode(response.content);
        const linesChanged = code.split('\n').length;

        return this.createResult(task.id, true, code, {
            metrics: {
                tokensUsed: response.tokensUsed,
                latency: response.latency,
                linesChanged
            },
            suggestions: [
                'Review generated code for correctness',
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
