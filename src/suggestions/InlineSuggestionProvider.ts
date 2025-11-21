/**
 * Inline Suggestion Provider - Real-time code suggestions
 */

import * as vscode from 'vscode';
import { modelRouter } from '../ai/ModelRouter';
import { projectBrain } from '../brain/ProjectBrain';
import { logger } from '../utils/logger';
import { debounce } from '../utils/performance';

export class InlineSuggestionProvider implements vscode.InlineCompletionItemProvider {
    private enabled: boolean = true;
    private debounceMs: number = 500;

    async provideInlineCompletionItems(
        document: vscode.TextDocument,
        position: vscode.Position,
        context: vscode.InlineCompletionContext,
        token: vscode.CancellationToken
    ): Promise<vscode.InlineCompletionItem[] | vscode.InlineCompletionList | undefined> {
        if (!this.enabled || token.isCancellationRequested) {
            return undefined;
        }

        try {
            const suggestion = await this.generateSuggestion(document, position);

            if (!suggestion || token.isCancellationRequested) {
                return undefined;
            }

            return [
                new vscode.InlineCompletionItem(
                    suggestion,
                    new vscode.Range(position, position)
                )
            ];
        } catch (error) {
            logger.error('Inline suggestion failed', error as Error);
            return undefined;
        }
    }

    private async generateSuggestion(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<string | undefined> {
        const currentLine = document.lineAt(position.line).text;
        const textBeforeCursor = currentLine.substring(0, position.character);

        // Don't suggest if line is empty or just whitespace
        if (!textBeforeCursor.trim()) {
            return undefined;
        }

        // Get context
        const context = this.getContext(document, position);
        const prompt = this.buildPrompt(context, textBeforeCursor);

        try {
            const response = await modelRouter.generateCompletion({
                prompt,
                systemPrompt: 'You are a code completion assistant. Provide only the completion, no explanations.',
                maxTokens: 100,
                temperature: 0.3 // Lower temperature for more deterministic completions
            }, 'code-generation');

            return this.extractCompletion(response.content, textBeforeCursor);
        } catch (error) {
            logger.warn('Failed to generate suggestion', error as Error);
            return undefined;
        }
    }

    private getContext(document: vscode.TextDocument, position: vscode.Position): string {
        const startLine = Math.max(0, position.line - 10);
        const endLine = Math.min(document.lineCount - 1, position.line + 5);

        const lines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
            lines.push(document.lineAt(i).text);
        }

        return lines.join('\n');
    }

    private buildPrompt(context: string, textBeforeCursor: string): string {
        return `Complete the following code:\n\n${context}\n\nComplete this line: ${textBeforeCursor}`;
    }

    private extractCompletion(response: string, prefix: string): string {
        // Remove code blocks if present
        let completion = response.replace(/```[\w]*\n?/g, '').trim();

        // Remove the prefix if AI repeated it
        if (completion.startsWith(prefix)) {
            completion = completion.substring(prefix.length);
        }

        // Only return the first line
        const firstLine = completion.split('\n')[0];

        return firstLine.trim();
    }

    enable(): void {
        this.enabled = true;
        logger.info('Inline suggestions enabled');
    }

    disable(): void {
        this.enabled = false;
        logger.info('Inline suggestions disabled');
    }

    toggle(): boolean {
        this.enabled = !this.enabled;
        logger.info(`Inline suggestions ${this.enabled ? 'enabled' : 'disabled'}`);
        return this.enabled;
    }
}

export const inlineSuggestionProvider = new InlineSuggestionProvider();
