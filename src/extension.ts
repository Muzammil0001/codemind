/**
 * CodeMind AI - Main Extension Entry Point
 */

import * as vscode from 'vscode';
import { logger } from './utils/logger';
import { configManager } from './config/settings';
import { modelRouter } from './ai/ModelRouter';
import { PermissionEngine } from './safety/PermissionEngine';

let permissionEngine: PermissionEngine;

export async function activate(context: vscode.ExtensionContext) {
    logger.info('CodeMind AI extension activating...');

    try {
        // Initialize core systems
        permissionEngine = new PermissionEngine(context);

        // Register commands
        registerCommands(context);

        // Initialize AI providers
        await initializeAI();

        // Show welcome message
        showWelcomeMessage(context);

        logger.info('CodeMind AI extension activated successfully');
    } catch (error) {
        logger.error('Failed to activate extension', error as Error);
        vscode.window.showErrorMessage('CodeMind AI failed to activate. Check output for details.');
    }
}

export function deactivate() {
    logger.info('CodeMind AI extension deactivating...');
    logger.dispose();
}

function registerCommands(context: vscode.ExtensionContext) {
    // Main panel command
    context.subscriptions.push(
        vscode.commands.registerCommand('codemind.openPanel', async () => {
            vscode.window.showInformationMessage('CodeMind AI Panel - Coming soon!');
        })
    );

    // Generate code command
    context.subscriptions.push(
        vscode.commands.registerCommand('codemind.generateCode', async () => {
            const prompt = await vscode.window.showInputBox({
                prompt: 'What code would you like to generate?',
                placeHolder: 'e.g., Create a React component for a login form'
            });

            if (!prompt) {
                return;
            }

            try {
                vscode.window.showInformationMessage('Generating code...');

                const response = await modelRouter.generateCompletion({
                    prompt,
                    systemPrompt: 'You are an expert software engineer. Generate clean, well-documented code.',
                    maxTokens: 2048
                }, 'code-generation');

                // Insert code at cursor
                const editor = vscode.window.activeTextEditor;
                if (editor) {
                    editor.edit(editBuilder => {
                        editBuilder.insert(editor.selection.active, response.content);
                    });
                }

                vscode.window.showInformationMessage(
                    `Code generated using ${response.model} (${response.latency}ms)`
                );
            } catch (error) {
                logger.error('Code generation failed', error as Error);
                vscode.window.showErrorMessage('Failed to generate code');
            }
        })
    );

    // Explain code command
    context.subscriptions.push(
        vscode.commands.registerCommand('codemind.explainCode', async () => {
            const editor = vscode.window.activeTextEditor;

            if (!editor || editor.selection.isEmpty) {
                vscode.window.showWarningMessage('Please select code to explain');
                return;
            }

            const selectedCode = editor.document.getText(editor.selection);

            try {
                const response = await modelRouter.generateCompletion({
                    prompt: `Explain this code:\n\n${selectedCode}`,
                    systemPrompt: 'You are an expert code reviewer. Provide clear, concise explanations.',
                    maxTokens: 1024
                }, 'explanation');

                vscode.window.showInformationMessage(response.content, { modal: true });
            } catch (error) {
                logger.error('Code explanation failed', error as Error);
                vscode.window.showErrorMessage('Failed to explain code');
            }
        })
    );

    // Refactor code command
    context.subscriptions.push(
        vscode.commands.registerCommand('codemind.refactorCode', async () => {
            const editor = vscode.window.activeTextEditor;

            if (!editor || editor.selection.isEmpty) {
                vscode.window.showWarningMessage('Please select code to refactor');
                return;
            }

            const selectedCode = editor.document.getText(editor.selection);
            const suggestion = await vscode.window.showInputBox({
                prompt: 'How would you like to refactor this code?',
                placeHolder: 'e.g., Extract into separate functions, improve performance'
            });

            if (!suggestion) {
                return;
            }

            try {
                const response = await modelRouter.generateCompletion({
                    prompt: `Refactor this code: ${suggestion}\n\n${selectedCode}`,
                    systemPrompt: 'You are an expert at code refactoring. Provide only the refactored code.',
                    maxTokens: 2048
                }, 'refactoring');

                // Replace selection with refactored code
                editor.edit(editBuilder => {
                    editBuilder.replace(editor.selection, response.content);
                });

                vscode.window.showInformationMessage('Code refactored successfully');
            } catch (error) {
                logger.error('Code refactoring failed', error as Error);
                vscode.window.showErrorMessage('Failed to refactor code');
            }
        })
    );

    // Generate tests command
    context.subscriptions.push(
        vscode.commands.registerCommand('codemind.generateTests', async () => {
            const editor = vscode.window.activeTextEditor;

            if (!editor) {
                vscode.window.showWarningMessage('Please open a file to generate tests for');
                return;
            }

            const code = editor.document.getText();
            const fileName = editor.document.fileName;

            try {
                const response = await modelRouter.generateCompletion({
                    prompt: `Generate comprehensive unit tests for this code:\n\n${code}`,
                    systemPrompt: 'You are an expert at writing tests. Generate complete test suites.',
                    maxTokens: 3000
                }, 'testing');

                // Create new test file
                const testFileName = fileName.replace(/\.(ts|js|tsx|jsx)$/, '.test.$1');
                const testUri = vscode.Uri.file(testFileName);

                const edit = new vscode.WorkspaceEdit();
                edit.createFile(testUri, { ignoreIfExists: true });
                edit.insert(testUri, new vscode.Position(0, 0), response.content);

                await vscode.workspace.applyEdit(edit);
                await vscode.window.showTextDocument(testUri);

                vscode.window.showInformationMessage('Tests generated successfully');
            } catch (error) {
                logger.error('Test generation failed', error as Error);
                vscode.window.showErrorMessage('Failed to generate tests');
            }
        })
    );

    // Generate documentation command
    context.subscriptions.push(
        vscode.commands.registerCommand('codemind.generateDocs', async () => {
            const editor = vscode.window.activeTextEditor;

            if (!editor) {
                vscode.window.showWarningMessage('Please open a file to document');
                return;
            }

            const code = editor.document.getText();

            try {
                const response = await modelRouter.generateCompletion({
                    prompt: `Add comprehensive JSDoc/TSDoc comments to this code:\n\n${code}`,
                    systemPrompt: 'You are an expert at writing documentation. Add clear, helpful comments.',
                    maxTokens: 3000
                }, 'documentation');

                // Replace entire file with documented version
                editor.edit(editBuilder => {
                    const fullRange = new vscode.Range(
                        editor.document.positionAt(0),
                        editor.document.positionAt(code.length)
                    );
                    editBuilder.replace(fullRange, response.content);
                });

                vscode.window.showInformationMessage('Documentation added successfully');
            } catch (error) {
                logger.error('Documentation generation failed', error as Error);
                vscode.window.showErrorMessage('Failed to generate documentation');
            }
        })
    );

    // Clear permissions command
    context.subscriptions.push(
        vscode.commands.registerCommand('codemind.clearPermissions', async () => {
            await permissionEngine.clearPermissions();
        })
    );

    // Toggle turbo mode command
    context.subscriptions.push(
        vscode.commands.registerCommand('codemind.toggleTurboMode', async () => {
            const enabled = await configManager.toggleTurboMode();
            vscode.window.showInformationMessage(
                `Turbo Mode ${enabled ? 'enabled' : 'disabled'}`
            );
        })
    );

    // Analyze codebase command
    context.subscriptions.push(
        vscode.commands.registerCommand('codemind.analyzeCodebase', async () => {
            vscode.window.showInformationMessage('Codebase analysis - Coming soon!');
        })
    );

    // Image to code command
    context.subscriptions.push(
        vscode.commands.registerCommand('codemind.imageToCode', async () => {
            vscode.window.showInformationMessage('Image to Code - Coming soon!');
        })
    );

    logger.info('Commands registered');
}

async function initializeAI() {
    try {
        const status = await modelRouter.getProviderStatus();
        const available = Array.from(status.entries())
            .filter(([_, isAvailable]) => isAvailable)
            .map(([provider, _]) => provider);

        if (available.length === 0) {
            vscode.window.showWarningMessage(
                'No AI providers available. Please configure API keys in settings.'
            );
        } else {
            logger.info(`Available AI providers: ${available.join(', ')}`);
        }
    } catch (error) {
        logger.error('Failed to initialize AI providers', error as Error);
    }
}

function showWelcomeMessage(context: vscode.ExtensionContext) {
    const hasShownWelcome = context.globalState.get('codemind.hasShownWelcome', false);

    if (!hasShownWelcome) {
        vscode.window.showInformationMessage(
            'Welcome to CodeMind AI! Configure your API keys in settings to get started.',
            'Open Settings'
        ).then(selection => {
            if (selection === 'Open Settings') {
                vscode.commands.executeCommand('workbench.action.openSettings', 'codemind');
            }
        });

        context.globalState.update('codemind.hasShownWelcome', true);
    }
}
