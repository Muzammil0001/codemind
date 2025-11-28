

import { BaseAgent } from './BaseAgent';
import { AgentTask, AgentResult } from '../types';
import { modelRouter } from '../ai/ModelRouter';
import { projectBrain } from '../brain/ProjectBrain';
import * as vscode from 'vscode';
import * as path from 'path';

export class TestAgent extends BaseAgent {
    constructor() {
        super('tester', 'Test Agent');
    }

    async execute(task: AgentTask): Promise<AgentResult> {
        const codeToTest = await this.getCodeToTest(task);
        const testFramework = await this.detectTestFramework();
        const prompt = this.buildTestPrompt(codeToTest, testFramework, task.description);

        const response = await modelRouter.generateCompletion({
            prompt,
            systemPrompt: 'You are an expert at writing comprehensive, maintainable tests. Generate complete test suites with good coverage.',
            maxTokens: 3000
        }, 'testing');

        const tests = this.extractCode(response.content);
        const testFilePath = await this.getTestFilePath(task);

        return this.createResult(task.id, true, tests, {
            filesCreated: testFilePath ? [testFilePath] : [],
            suggestions: [
                'Review generated tests for completeness',
                'Run tests to ensure they pass',
                'Consider adding edge case tests',
                'Update test coverage reports'
            ],
            metrics: {
                tokensUsed: response.tokensUsed,
                latency: response.latency,
                linesChanged: tests.split('\n').length
            }
        });
    }

    private async getCodeToTest(task: AgentTask): Promise<string> {
        if (task.context.files.length > 0) {
            const filePath = task.context.files[0];
            try {
                const document = await vscode.workspace.openTextDocument(filePath);
                return document.getText();
            } catch {
                return '';
            }
        }

        const editor = vscode.window.activeTextEditor;
        if (editor) {
            return editor.document.getText();
        }

        return '';
    }

    private async detectTestFramework(): Promise<string> {
        const brainState = projectBrain.getState();

        const frameworks = brainState?.frameworks.map(f => f.name.toLowerCase()) || [];

        if (frameworks.some(f => f.includes('jest'))) {
            return 'Jest';
        } else if (frameworks.some(f => f.includes('mocha'))) {
            return 'Mocha';
        } else if (frameworks.some(f => f.includes('vitest'))) {
            return 'Vitest';
        } else if (frameworks.some(f => f.includes('pytest'))) {
            return 'pytest';
        }

        return 'Jest';
    }

    private buildTestPrompt(code: string, framework: string, description: string): string {
        let prompt = `Generate comprehensive unit tests for the following code using ${framework}:\n\n`;
        prompt += `\`\`\`\n${code}\n\`\`\`\n\n`;

        if (description) {
            prompt += `Additional requirements: ${description}\n\n`;
        }

        prompt += `Requirements:\n`;
        prompt += `1. Test all public functions and methods\n`;
        prompt += `2. Cover edge cases and error conditions\n`;
        prompt += `3. Use descriptive test names\n`;
        prompt += `4. Include setup and teardown if needed\n`;
        prompt += `5. Mock external dependencies\n`;
        prompt += `6. Aim for high code coverage\n`;
        prompt += `7. Follow ${framework} best practices\n\n`;

        prompt += `Generate a complete, runnable test file.`;

        return prompt;
    }

    private extractCode(response: string): string {
        const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)\n```/);

        if (codeBlockMatch) {
            return codeBlockMatch[1];
        }

        return response;
    }

    private async getTestFilePath(task: AgentTask): Promise<string | null> {
        if (task.context.files.length > 0) {
            const originalFile = task.context.files[0];
            const ext = path.extname(originalFile);
            const baseName = path.basename(originalFile, ext);
            const dirName = path.dirname(originalFile);

            return path.join(dirName, `${baseName}.test${ext}`);
        }

        const editor = vscode.window.activeTextEditor;
        if (editor) {
            const originalFile = editor.document.fileName;
            const ext = path.extname(originalFile);
            const baseName = path.basename(originalFile, ext);
            const dirName = path.dirname(originalFile);

            return path.join(dirName, `${baseName}.test${ext}`);
        }

        return null;
    }
}

export const testAgent = new TestAgent();
