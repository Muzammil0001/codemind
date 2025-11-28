

import { BaseAgent } from './BaseAgent';
import { AgentTask, AgentResult } from '../types';
import { modelRouter } from '../ai/ModelRouter';
import { projectBrain } from '../brain/ProjectBrain';
import * as vscode from 'vscode';

export class ImageToCodeAgent extends BaseAgent {
    constructor() {
        super('image-to-code', 'Image-to-Code Agent');
    }

    async execute(task: AgentTask): Promise<AgentResult> {
        const imagePath = task.context.files[0];

        if (!imagePath) {
            throw new Error('No image provided for conversion');
        }

        const framework = await this.detectUIFramework();
        const prompt = this.buildImageToCodePrompt(framework, task.description);

        const response = await modelRouter.generateCompletion({
            prompt,
            systemPrompt: 'You are an expert at converting UI designs to code. Generate clean, responsive, production-ready code.',
            maxTokens: 4000
        }, 'code-generation');

        const code = this.extractCode(response.content);

        return this.createResult(task.id, true, code, {
            suggestions: [
                'Review generated code for accuracy',
                'Adjust responsive breakpoints as needed',
                'Add proper TypeScript types',
                'Test on different screen sizes',
                'Optimize images and assets'
            ],
            metrics: {
                tokensUsed: response.tokensUsed,
                latency: response.latency,
                linesChanged: code.split('\n').length
            }
        });
    }

    private async detectUIFramework(): Promise<string> {
        const brainState = projectBrain.getState();
        const frameworks = brainState?.frameworks.map(f => f.name.toLowerCase()) || [];

        if (frameworks.some(f => f.includes('next'))) {
            return 'Next.js with React and Tailwind CSS';
        } else if (frameworks.some(f => f.includes('react'))) {
            return 'React with Tailwind CSS';
        } else if (frameworks.some(f => f.includes('vue'))) {
            return 'Vue.js with Tailwind CSS';
        }

        return 'HTML with Tailwind CSS';
    }

    private buildImageToCodePrompt(framework: string, description: string): string {
        let prompt = `Convert the provided UI design/screenshot to ${framework} code.\n\n`;

        if (description) {
            prompt += `Additional requirements: ${description}\n\n`;
        }

        prompt += `Requirements:\n`;
        prompt += `1. Generate clean, semantic HTML/JSX\n`;
        prompt += `2. Use Tailwind CSS for styling\n`;
        prompt += `3. Make it fully responsive (mobile, tablet, desktop)\n`;
        prompt += `4. Follow ${framework} best practices\n`;
        prompt += `5. Use proper component structure\n`;
        prompt += `6. Add appropriate TypeScript types if applicable\n`;
        prompt += `7. Include accessibility attributes (ARIA)\n`;
        prompt += `8. Optimize for performance\n\n`;

        prompt += `Generate complete, runnable code.`;

        return prompt;
    }

    private extractCode(response: string): string {
        const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)\n```/);

        if (codeBlockMatch) {
            return codeBlockMatch[1];
        }

        return response;
    }

    async convertScreenshot(): Promise<void> {
        const options: vscode.OpenDialogOptions = {
            canSelectMany: false,
            openLabel: 'Select UI Screenshot',
            filters: {
                'Images': ['png', 'jpg', 'jpeg', 'webp']
            }
        };

        const fileUri = await vscode.window.showOpenDialog(options);

        if (fileUri && fileUri[0]) {
            const imagePath = fileUri[0].fsPath;

            vscode.window.showInformationMessage(
                `Converting ${imagePath} to code...`
            );

            const task: AgentTask = {
                id: `image-to-code-${Date.now()}`,
                type: 'image-to-code',
                description: 'Convert UI screenshot to code',
                context: {
                    files: [imagePath],
                    userPrompt: 'Convert this UI to code'
                },
                priority: 1,
                status: 'pending',
                createdAt: Date.now()
            };

            const result = await this.execute(task);

            if (result.success) {
                const fileName = 'GeneratedComponent.tsx';
                const workspaceFolder = vscode.workspace.workspaceFolders?.[0];

                if (workspaceFolder) {
                    const filePath = vscode.Uri.joinPath(workspaceFolder.uri, fileName);
                    await vscode.workspace.fs.writeFile(filePath, Buffer.from(result.output, 'utf8'));

                    const document = await vscode.workspace.openTextDocument(filePath);
                    await vscode.window.showTextDocument(document);

                    vscode.window.showInformationMessage('UI converted to code successfully!');
                }
            }
        }
    }
}

export const imageToCodeAgent = new ImageToCodeAgent();
