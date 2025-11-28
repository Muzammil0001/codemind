

import * as vscode from 'vscode';
import { modelRouter } from '../ai/ModelRouter';
import { logger } from '../utils/logger';

export class CommitMessageGenerator {
    async generateCommitMessage(): Promise<string | undefined> {
        try {
            const diff = await this.getGitDiff();

            if (!diff) {
                vscode.window.showWarningMessage('No changes to commit');
                return undefined;
            }

            const prompt = this.buildPrompt(diff);

            const response = await modelRouter.generateCompletion({
                prompt,
                systemPrompt: 'You are an expert at writing clear, conventional commit messages. Follow the Conventional Commits specification.',
                maxTokens: 200
            }, 'code-generation');

            const commitMessage = this.extractCommitMessage(response.content);

            return commitMessage;
        } catch (error) {
            logger.error('Failed to generate commit message', error as Error);
            vscode.window.showErrorMessage('Failed to generate commit message');
            return undefined;
        }
    }

    private async getGitDiff(): Promise<string | undefined> {
        const gitExtension = vscode.extensions.getExtension('vscode.git')?.exports;

        if (!gitExtension) {
            return undefined;
        }

        const api = gitExtension.getAPI(1);
        const repo = api.repositories[0];

        if (!repo) {
            return undefined;
        }

        const diff = await repo.diff(true);
        return diff;
    }

    private buildPrompt(diff: string): string {
        let prompt = `Generate a commit message for the following changes:\n\n`;
        prompt += `${diff}\n\n`;
        prompt += `Requirements:\n`;
        prompt += `1. Follow Conventional Commits format: <type>(<scope>): <description>\n`;
        prompt += `2. Types: feat, fix, docs, style, refactor, test, chore\n`;
        prompt += `3. Keep the first line under 72 characters\n`;
        prompt += `4. Add a body if changes are complex (optional)\n`;
        prompt += `5. Be specific and descriptive\n\n`;
        prompt += `Generate only the commit message, no explanations.`;

        return prompt;
    }

    private extractCommitMessage(response: string): string {
        let message = response.replace(/```[\w]*\n?/g, '').trim();

        message = message.replace(/^commit message:\s*/i, '');

        return message;
    }

    async showCommitMessageDialog(): Promise<void> {
        const message = await this.generateCommitMessage();

        if (message) {
            const action = await vscode.window.showInformationMessage(
                'Generated commit message:',
                { modal: true, detail: message },
                'Copy to Clipboard',
                'Use in Git'
            );

            if (action === 'Copy to Clipboard') {
                await vscode.env.clipboard.writeText(message);
                vscode.window.showInformationMessage('Commit message copied to clipboard');
            } else if (action === 'Use in Git') {
                vscode.commands.executeCommand('workbench.view.scm');
                vscode.window.showInformationMessage('Paste the commit message in the Source Control view');
            }
        }
    }
}

export const commitMessageGenerator = new CommitMessageGenerator();
