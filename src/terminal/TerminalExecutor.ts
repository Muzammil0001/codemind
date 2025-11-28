

import * as vscode from 'vscode';
import { PermissionEngine } from '../safety/PermissionEngine';
import { actionClassifier } from '../safety/ActionClassifier';
import { logger } from '../utils/logger';
import { terminalManager } from './TerminalManager';
import { TerminalLocation, CommandRiskLevel } from '../types/terminalTypes';

export interface CommandResult {
    success: boolean;
    output: string;
    exitCode: number;
    duration: number;
    commandId?: string;
}

export class TerminalExecutor {
    private permissionEngine: PermissionEngine | null = null;
    private terminal: vscode.Terminal | null = null;

    setPermissionEngine(engine: PermissionEngine): void {
        this.permissionEngine = engine;
    }

    async executeCommandWithBackground(
        command: string,
        cwd?: string,
        location: TerminalLocation = TerminalLocation.CHAT
    ): Promise<CommandResult> {
        logger.info(`Executing command with background: ${command}`);

        const action = actionClassifier.classifyTerminalCommand(
            command,
            cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
        );

        if (this.permissionEngine) {
            const decision = await this.permissionEngine.requestPermission(action);

            if (decision.decision === 'deny') {
                logger.warn(`Command denied: ${command}`);
                throw new Error('Command denied by user');
            }
        }

        const startTime = Date.now();
        const result = await terminalManager.executeCommand(command, {
            cwd: cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath,
            location
        });

        if (result.success) {
            return {
                success: true,
                output: 'Command started successfully',
                exitCode: 0,
                duration: Date.now() - startTime,
                commandId: result.commandId
            };
        } else {
            return {
                success: false,
                output: result.error || 'Command failed',
                exitCode: 1,
                duration: Date.now() - startTime,
                commandId: result.commandId
            };
        }
    }

    async executeCommand(
        command: string,
        cwd?: string
    ): Promise<CommandResult> {
        logger.info(`Executing command: ${command}`);

        const action = actionClassifier.classifyTerminalCommand(
            command,
            cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || ''
        );

        if (this.permissionEngine) {
            const decision = await this.permissionEngine.requestPermission(action);

            if (decision.decision === 'deny') {
                logger.warn(`Command denied: ${command}`);
                throw new Error('Command denied by user');
            }
        }

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
            if (!this.terminal || this.terminal.exitStatus) {
                this.terminal = vscode.window.createTerminal({
                    name: 'CodeMind AI',
                    cwd
                });
            }

            this.terminal.show();

            this.terminal.sendText(command);

            setTimeout(() => {
                resolve('Command sent to terminal. Check terminal output.');
            }, 1000);
        });
    }

    async executeWithOutput(
        command: string,
        cwd?: string
    ): Promise<CommandResult> {
        logger.info('Using TerminalManager for executeWithOutput');
        return this.executeCommandWithBackground(command, cwd, TerminalLocation.CHAT);
    }

    stopCommand(commandId: string): boolean {
        return terminalManager.stopCommand(commandId);
    }

    getCommandStatus(commandId: string) {
        return terminalManager.getCommand(commandId);
    }

    getRunningCommands() {
        return terminalManager.getRunningCommands();
    }

    disposeTerminal(): void {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = null;
        }

        terminalManager.dispose();
    }

    getTerminal(): vscode.Terminal | null {
        return this.terminal;
    }
}

export const terminalExecutor = new TerminalExecutor();
