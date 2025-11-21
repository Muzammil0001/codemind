/**
 * Terminal Command Executor - Safe terminal command execution with approval
 */

import * as vscode from 'vscode';
import { PermissionEngine } from '../safety/PermissionEngine';
import { actionClassifier } from '../safety/ActionClassifier';
import { logger } from '../utils/logger';

export interface CommandResult {
    success: boolean;
    output: string;
    exitCode: number;
    duration: number;
}

export class TerminalExecutor {
    private permissionEngine: PermissionEngine | null = null;
    private terminal: vscode.Terminal | null = null;

    setPermissionEngine(engine: PermissionEngine): void {
        this.permissionEngine = engine;
    }

    async executeCommand(
        command: string,
        cwd?: string
    ): Promise<CommandResult> {
        logger.info(`Executing command: ${command}`);

        // Classify the command
        const action = actionClassifier.classifyTerminalCommand(
            command,
            cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
        );

        // Request permission if needed
        if (this.permissionEngine) {
            const decision = await this.permissionEngine.requestPermission(action);

            if (decision.decision === 'deny') {
                logger.warn(`Command denied: ${command}`);
                throw new Error('Command denied by user');
            }
        }

        // Execute the command
        const startTime = Date.now();

        try {
            const output = await this.runCommand(command, cwd);
            const duration = Date.now() - startTime;

            logger.info(`Command completed in ${duration}ms`);

            return {
                success: true,
                output,
                exitCode: 0,
                duration
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            logger.error(`Command failed: ${command}`, error as Error);

            return {
                success: false,
                output: (error as Error).message,
                exitCode: 1,
                duration
            };
        }
    }

    private async runCommand(command: string, cwd?: string): Promise<string> {
        return new Promise((resolve, reject) => {
            // Get or create terminal
            if (!this.terminal || this.terminal.exitStatus) {
                this.terminal = vscode.window.createTerminal({
                    name: 'CodeMind AI',
                    cwd
                });
            }

            // Show terminal
            this.terminal.show();

            // Send command
            this.terminal.sendText(command);

            // Note: We can't easily capture output from VS Code terminal
            // This is a limitation of the VS Code API
            // For now, we'll just resolve after sending the command
            setTimeout(() => {
                resolve('Command sent to terminal. Check terminal output.');
            }, 1000);
        });
    }

    async executeWithOutput(
        command: string,
        cwd?: string
    ): Promise<CommandResult> {
        // For commands where we need output, we can use child_process
        // But this requires careful security considerations
        logger.warn('executeWithOutput not fully implemented - using basic execution');
        return this.executeCommand(command, cwd);
    }

    disposeTerminal(): void {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = null;
        }
    }

    getTerminal(): vscode.Terminal | null {
        return this.terminal;
    }
}

export const terminalExecutor = new TerminalExecutor();
