

import { BaseAgent } from './BaseAgent';
import { AgentTask, AgentResult } from '../types';
import { modelRouter } from '../ai/ModelRouter';
import * as vscode from 'vscode';

export class DocumentationAgent extends BaseAgent {
    constructor() {
        super('documenter', 'Documentation Agent');
    }

    async execute(task: AgentTask): Promise<AgentResult> {
        const code = await this.getCodeToDocument(task);
        const docType = this.determineDocType(task.description);
        const prompt = this.buildDocPrompt(code, docType, task.description);

        const response = await modelRouter.generateCompletion({
            prompt,
            systemPrompt: 'You are an expert technical writer. Create clear, comprehensive documentation that helps developers understand and use the code.',
            maxTokens: 3000
        }, 'documentation');

        const documentation = response.content;

        return this.createResult(task.id, true, documentation, {
            suggestions: [
                'Review documentation for accuracy',
                'Ensure all public APIs are documented',
                'Add usage examples where helpful',
                'Keep documentation up to date with code changes'
            ],
            metrics: {
                tokensUsed: response.tokensUsed,
                latency: response.latency,
                linesChanged: documentation.split('\n').length
            }
        });
    }

    private async getCodeToDocument(task: AgentTask): Promise<string> {
        if (task.context.files.length > 0) {
            const codes: string[] = [];

            for (const filePath of task.context.files) {
                try {
                    const document = await vscode.workspace.openTextDocument(filePath);
                    codes.push(`File: ${filePath}\n\`\`\`\n${document.getText()}\n\`\`\``);
                } catch {
                    continue;
                }
            }

            return codes.join('\n\n');
        }

        const editor = vscode.window.activeTextEditor;
        if (editor) {
            return editor.document.getText();
        }

        return '';
    }

    private determineDocType(description: string): 'inline' | 'readme' | 'api' | 'guide' {
        const lower = description.toLowerCase();

        if (lower.includes('inline') || lower.includes('comment') || lower.includes('jsdoc')) {
            return 'inline';
        } else if (lower.includes('readme')) {
            return 'readme';
        } else if (lower.includes('api')) {
            return 'api';
        } else if (lower.includes('guide') || lower.includes('tutorial')) {
            return 'guide';
        }

        return 'inline';
    }

    private buildDocPrompt(code: string, docType: string, description: string): string {
        let prompt = '';

        switch (docType) {
            case 'inline':
                prompt = this.buildInlineDocPrompt(code, description);
                break;
            case 'readme':
                prompt = this.buildReadmePrompt(code, description);
                break;
            case 'api':
                prompt = this.buildApiDocPrompt(code, description);
                break;
            case 'guide':
                prompt = this.buildGuidePrompt(code, description);
                break;
        }

        return prompt;
    }

    private buildInlineDocPrompt(code: string, description: string): string {
        let prompt = `Add comprehensive inline documentation (JSDoc/TSDoc comments) to the following code:\n\n`;
        prompt += `${code}\n\n`;

        if (description) {
            prompt += `Additional requirements: ${description}\n\n`;
        }

        prompt += `Requirements:\n`;
        prompt += `1. Add JSDoc/TSDoc comments to all functions, classes, and methods\n`;
        prompt += `2. Document parameters, return values, and exceptions\n`;
        prompt += `3. Include usage examples for complex functions\n`;
        prompt += `4. Add inline comments for complex logic\n`;
        prompt += `5. Keep comments concise but informative\n\n`;

        prompt += `Return the complete code with documentation added.`;

        return prompt;
    }

    private buildReadmePrompt(code: string, description: string): string {
        let prompt = `Generate a comprehensive README.md for the following code:\n\n`;
        prompt += `${code}\n\n`;

        if (description) {
            prompt += `Additional context: ${description}\n\n`;
        }

        prompt += `Include:\n`;
        prompt += `1. Project title and description\n`;
        prompt += `2. Features list\n`;
        prompt += `3. Installation instructions\n`;
        prompt += `4. Usage examples\n`;
        prompt += `5. API documentation (if applicable)\n`;
        prompt += `6. Configuration options\n`;
        prompt += `7. Contributing guidelines\n`;
        prompt += `8. License information\n\n`;

        prompt += `Format as markdown.`;

        return prompt;
    }

    private buildApiDocPrompt(code: string, description: string): string {
        let prompt = `Generate API documentation for the following code:\n\n`;
        prompt += `${code}\n\n`;

        if (description) {
            prompt += `Additional requirements: ${description}\n\n`;
        }

        prompt += `Include:\n`;
        prompt += `1. All public functions, classes, and methods\n`;
        prompt += `2. Parameters with types and descriptions\n`;
        prompt += `3. Return values with types\n`;
        prompt += `4. Usage examples for each API\n`;
        prompt += `5. Error handling information\n`;
        prompt += `6. Code examples\n\n`;

        prompt += `Format as markdown with clear sections.`;

        return prompt;
    }

    private buildGuidePrompt(code: string, description: string): string {
        let prompt = `Create a comprehensive usage guide for the following code:\n\n`;
        prompt += `${code}\n\n`;

        if (description) {
            prompt += `Focus on: ${description}\n\n`;
        }

        prompt += `Include:\n`;
        prompt += `1. Introduction and overview\n`;
        prompt += `2. Getting started tutorial\n`;
        prompt += `3. Common use cases with examples\n`;
        prompt += `4. Best practices\n`;
        prompt += `5. Troubleshooting section\n`;
        prompt += `6. Advanced usage patterns\n\n`;

        prompt += `Format as markdown with clear sections and code examples.`;

        return prompt;
    }
}

export const documentationAgent = new DocumentationAgent();
