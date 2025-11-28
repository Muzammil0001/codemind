

import { BaseAgent } from './BaseAgent';
import { AgentTask, AgentResult } from '../types';
import { modelRouter } from '../ai/ModelRouter';
import * as vscode from 'vscode';

export class ReviewerAgent extends BaseAgent {
    constructor() {
        super('reviewer', 'Reviewer Agent');
    }

    async execute(task: AgentTask): Promise<AgentResult> {
        const code = await this.getCodeToReview(task);
        const prompt = this.buildReviewPrompt(code, task.description);

        const response = await modelRouter.generateCompletion({
            prompt,
            systemPrompt: 'You are an expert code reviewer. Provide thorough, constructive feedback on code quality, security, and best practices.',
            maxTokens: 2000
        }, 'code-review');

        const review = this.parseReview(response.content);

        return this.createResult(task.id, true, response.content, {
            suggestions: review.suggestions,
            warnings: review.issues,
            metrics: {
                tokensUsed: response.tokensUsed,
                latency: response.latency,
                linesChanged: 0
            }
        });
    }

    private async getCodeToReview(task: AgentTask): Promise<string> {
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
        } else if (task.context.codeSelection) {
            return task.context.userPrompt;
        } else {
            const editor = vscode.window.activeTextEditor;
            if (editor) {
                return editor.document.getText();
            }
        }

        return '';
    }

    private buildReviewPrompt(code: string, description: string): string {
        let prompt = `Please review the following code:\n\n${code}\n\n`;

        if (description) {
            prompt += `Focus on: ${description}\n\n`;
        }

        prompt += `Provide a comprehensive code review covering:\n`;
        prompt += `1. **Code Quality**: Readability, maintainability, organization\n`;
        prompt += `2. **Best Practices**: Following language/framework conventions\n`;
        prompt += `3. **Security**: Potential vulnerabilities or security issues\n`;
        prompt += `4. **Performance**: Optimization opportunities\n`;
        prompt += `5. **Error Handling**: Proper error handling and edge cases\n`;
        prompt += `6. **Testing**: Testability and test coverage suggestions\n`;
        prompt += `7. **Documentation**: Code comments and documentation\n\n`;

        prompt += `Format your review as:\n`;
        prompt += `## Summary\n`;
        prompt += `Brief overall assessment\n\n`;
        prompt += `## Issues Found\n`;
        prompt += `- Critical issues (if any)\n`;
        prompt += `- Warnings (if any)\n`;
        prompt += `- Suggestions for improvement\n\n`;
        prompt += `## Positive Aspects\n`;
        prompt += `What's done well\n\n`;
        prompt += `## Recommendations\n`;
        prompt += `Specific actionable improvements\n`;

        return prompt;
    }

    private parseReview(content: string): {
        suggestions: string[];
        issues: string[];
    } {
        const suggestions: string[] = [];
        const issues: string[] = [];

        const issuesMatch = content.match(/## Issues Found\s*([\s\S]*?)(?=##|$)/);
        if (issuesMatch) {
            const issueLines = issuesMatch[1].split('\n').filter(line => line.trim().startsWith('-'));
            issues.push(...issueLines.map(line => line.trim().substring(1).trim()));
        }

        const recsMatch = content.match(/## Recommendations\s*([\s\S]*?)(?=##|$)/);
        if (recsMatch) {
            const recLines = recsMatch[1].split('\n').filter(line => line.trim().startsWith('-'));
            suggestions.push(...recLines.map(line => line.trim().substring(1).trim()));
        }

        return { suggestions, issues };
    }
}

export const reviewerAgent = new ReviewerAgent();
