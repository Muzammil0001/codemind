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
                systemPrompt: 'You are a highly accurate code completion engine. Your task is to complete the code based on the context provided. Return ONLY the code completion. Do not include markdown formatting, explanations, or the original code.',
                maxTokens: 50, // Short completion
                temperature: 0.1 // Very deterministic
            }, 'code-completion');

            return this.extractCompletion(response.content, textBeforeCursor);
        } catch (error) {
            logger.warn('Failed to generate suggestion', error as Error);
            return undefined;
        }
    }

    private getContext(document: vscode.TextDocument, position: vscode.Position): string {
        const startLine = Math.max(0, position.line - 20); // More context
        const endLine = Math.min(document.lineCount - 1, position.line + 5);

        const lines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
            if (i === position.line) {
                // Mark cursor position
                const lineText = document.lineAt(i).text;
                lines.push(lineText.substring(0, position.character) + '<CURSOR>' + lineText.substring(position.character));
            } else {
                lines.push(document.lineAt(i).text);
            }
        }

        return lines.join('\n');
    }

    private buildPrompt(context: string, textBeforeCursor: string): string {
        return `Complete the code at <CURSOR>.
Context:
${context}

Completion:`;
    }

    private extractCompletion(response: string, prefix: string): string {
        // Remove code blocks if present
        let completion = response.replace(/```[\w]*\n?/g, '').replace(/```/g, '').trim();

        // Remove the prefix if AI repeated it
        if (completion.startsWith(prefix)) {
            completion = completion.substring(prefix.length);
        }

        // Only return the first line or up to the first closing brace/semicolon if it makes sense
        const lines = completion.split('\n');
        return lines[0].trimEnd();
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
