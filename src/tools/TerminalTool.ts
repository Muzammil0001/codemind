

import * as vscode from 'vscode';
import { execa } from 'execa';
import type { BaseTool, ToolResult, TerminalResult, TerminalOptions } from './types';
import { logger } from '../utils/logger';

export class TerminalTool implements BaseTool {
    name = 'terminal';
    description = 'Execute terminal commands with robust handling and output capture';

    async execute(options: TerminalOptions): Promise<ToolResult<TerminalResult>> {
        try {
            const { command, cwd, env, timeout = 30000, shell = true } = options;

            const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
            const workingDir = cwd || workspaceRoot;

            if (!workingDir) {
                throw new Error('No working directory specified and no workspace open');
            }

            logger.info(`Executing command: ${command} in ${workingDir}`);

            const startTime = Date.now();

            const { stdout, stderr, exitCode } = await execa(command, {
                cwd: workingDir,
                env: { ...process.env, ...env },
                timeout,
                shell,
                all: true,
                reject: false 
            });

            const duration = Date.now() - startTime;

            return {
                success: exitCode === 0,
                data: {
                    success: exitCode === 0,
                    stdout,
                    stderr,
                    exitCode,
                    duration,
                    command
                }
            };

        } catch (error) {
            logger.error('Terminal execution failed', error as Error);
            return {
                success: false,
                error: (error as Error).message
            };
        }
    }

    async runInIntegratedTerminal(command: string, name: string = 'CodeMind'): Promise<void> {
        const terminal = vscode.window.terminals.find(t => t.name === name)
            || vscode.window.createTerminal(name);

        terminal.show();
        terminal.sendText(command);
    }
}
