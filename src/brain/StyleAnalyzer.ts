import * as vscode from 'vscode';
import { CodeStyle } from '../types';
import { logger } from '../utils/logger';

export class StyleAnalyzer {
    async analyzeProjectStyle(workspaceRoot: string): Promise<CodeStyle> {
        logger.info('Analyzing project coding style...');

        const files = await this.getSampleFiles(workspaceRoot);

        const indentation = await this.detectIndentation(files);
        const quotes = await this.detectQuoteStyle(files);
        const semicolons = await this.detectSemicolonUsage(files);
        const namingConvention = await this.detectNamingConvention(files);
        const importStyle = await this.detectImportStyle(files);

        const style: CodeStyle = {
            indentation: indentation.type,
            indentSize: indentation.size,
            quotes,
            semicolons,
            namingConvention,
            importStyle
        };

        logger.info('Project style analyzed', style);
        return style;
    }

    private async getSampleFiles(workspaceRoot: string): Promise<vscode.TextDocument[]> {
        const pattern = new vscode.RelativePattern(workspaceRoot, '**/*.{ts,tsx,js,jsx}');
        const excludePattern = '**/node_modules/**';

        const uris = await vscode.workspace.findFiles(pattern, excludePattern, 20);
        const documents: vscode.TextDocument[] = [];

        for (const uri of uris) {
            try {
                const doc = await vscode.workspace.openTextDocument(uri);
                documents.push(doc);
            } catch {
                continue;
            }
        }

        return documents;
    }

    private async detectIndentation(files: vscode.TextDocument[]): Promise<{
        type: 'spaces' | 'tabs';
        size: number;
    }> {
        let spacesCount = 0;
        let tabsCount = 0;
        const spaceSizes: number[] = [];

        for (const file of files) {
            const text = file.getText();
            const lines = text.split('\n');

            for (const line of lines) {
                if (line.startsWith('\t')) {
                    tabsCount++;
                } else if (line.startsWith(' ')) {
                    spacesCount++;

                    const match = line.match(/^( +)/);
                    if (match) {
                        spaceSizes.push(match[1].length);
                    }
                }
            }
        }

        const type = tabsCount > spacesCount ? 'tabs' : 'spaces';

        let size = 2;
        if (spaceSizes.length > 0) {
            const sizeFrequency = new Map<number, number>();
            for (const s of spaceSizes) {
                sizeFrequency.set(s, (sizeFrequency.get(s) || 0) + 1);
            }

            let maxFreq = 0;
            for (const [s, freq] of sizeFrequency.entries()) {
                if (freq > maxFreq && [2, 4].includes(s)) {
                    maxFreq = freq;
                    size = s;
                }
            }
        }

        return { type, size };
    }

    private async detectQuoteStyle(files: vscode.TextDocument[]): Promise<'single' | 'double'> {
        let singleCount = 0;
        let doubleCount = 0;

        for (const file of files) {
            const text = file.getText();

            // Count string literals
            const singleQuotes = (text.match(/'/g) || []).length;
            const doubleQuotes = (text.match(/"/g) || []).length;

            singleCount += singleQuotes;
            doubleCount += doubleQuotes;
        }

        return singleCount > doubleCount ? 'single' : 'double';
    }

    private async detectSemicolonUsage(files: vscode.TextDocument[]): Promise<boolean> {
        let withSemicolon = 0;
        let withoutSemicolon = 0;

        for (const file of files) {
            const text = file.getText();
            const lines = text.split('\n');

            for (const line of lines) {
                const trimmed = line.trim();

                if (!trimmed || trimmed.startsWith('//') || trimmed.startsWith('/*')) {
                    continue;
                }

                if (trimmed.endsWith(';')) {
                    withSemicolon++;
                } else if (trimmed.match(/[a-zA-Z0-9)\]}\`]$/)) {
                    withoutSemicolon++;
                }
            }
        }

        return withSemicolon > withoutSemicolon;
    }

    private async detectNamingConvention(
        files: vscode.TextDocument[]
    ): Promise<'camelCase' | 'PascalCase' | 'snake_case' | 'kebab-case'> {
        const conventions = {
            camelCase: 0,
            PascalCase: 0,
            snake_case: 0,
            'kebab-case': 0
        };

        for (const file of files) {
            const text = file.getText();

            const identifiers = text.match(/(?:const|let|var|function)\s+([a-zA-Z_][a-zA-Z0-9_]*)/g);

            if (identifiers) {
                for (const id of identifiers) {
                    const name = id.split(/\s+/).pop() || '';

                    if (name.match(/^[a-z][a-zA-Z0-9]*$/)) {
                        conventions.camelCase++;
                    } else if (name.match(/^[A-Z][a-zA-Z0-9]*$/)) {
                        conventions.PascalCase++;
                    } else if (name.match(/^[a-z][a-z0-9_]*$/)) {
                        conventions.snake_case++;
                    } else if (name.match(/^[a-z][a-z0-9-]*$/)) {
                        conventions['kebab-case']++;
                    }
                }
            }
        }

        let maxCount = 0;
        let convention: keyof typeof conventions = 'camelCase';

        for (const [key, count] of Object.entries(conventions)) {
            if (count > maxCount) {
                maxCount = count;
                convention = key as keyof typeof conventions;
            }
        }

        return convention;
    }

    private async detectImportStyle(files: vscode.TextDocument[]): Promise<'named' | 'default' | 'mixed'> {
        let namedCount = 0;
        let defaultCount = 0;

        for (const file of files) {
            const text = file.getText();

            const namedImports = (text.match(/import\s*{[^}]+}\s*from/g) || []).length;
            namedCount += namedImports;

            const defaultImports = (text.match(/import\s+[a-zA-Z_][a-zA-Z0-9_]*\s+from/g) || []).length;
            defaultCount += defaultImports;
        }

        if (namedCount > defaultCount * 2) {
            return 'named';
        } else if (defaultCount > namedCount * 2) {
            return 'default';
        } else {
            return 'mixed';
        }
    }
}

export const styleAnalyzer = new StyleAnalyzer();
