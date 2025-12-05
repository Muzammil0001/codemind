

import * as vscode from 'vscode';
import { spawn, ChildProcess } from 'child_process';
import { logger } from '../utils/logger';
import {
    TerminalCommand,
    CommandStatus,
    TerminalLocation,
    TerminalOutputLine,
    CommandExecutionOptions,
    CommandExecutionResult,
    CommandRiskLevel
} from '../types/terminalTypes';

export type TerminalOutputCallback = (commandId: string, line: TerminalOutputLine) => void;
export type TerminalStatusCallback = (commandId: string, status: CommandStatus, pid?: number) => void;
export type TerminalCompleteCallback = (commandId: string, exitCode: number, duration: number, status: CommandStatus) => void;

export class TerminalManager {
    private commands: Map<string, TerminalCommand> = new Map();
    private processes: Map<string, ChildProcess> = new Map();
    private terminals: Map<string, vscode.Terminal> = new Map();

    private onOutputCallback?: TerminalOutputCallback;
    private onStatusCallback?: TerminalStatusCallback;
    private onCompleteCallback?: TerminalCompleteCallback;

    constructor() {
        logger.info('TerminalManager initialized');
    }

    setOnOutput(callback: TerminalOutputCallback): void {
        this.onOutputCallback = callback;
    }

    setOnStatus(callback: TerminalStatusCallback): void {
        this.onStatusCallback = callback;
    }

    setOnComplete(callback: TerminalCompleteCallback): void {
        this.onCompleteCallback = callback;
    }

    async executeCommand(
        command: string,
        options: CommandExecutionOptions
    ): Promise<CommandExecutionResult> {
        const commandId = options.id || this.generateCommandId();
        const cwd = options.cwd || vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || process.cwd();

        logger.info(`Executing command ${commandId}: ${command} in ${cwd}`);

        const terminalCommand: TerminalCommand = {
            id: commandId,
            command,
            cwd,
            status: CommandStatus.PENDING,
            startTime: Date.now(),
            output: [],
            location: options.location,
            riskLevel: this.assessCommandRisk(command),
            hidden: options.hidden || this.shouldHideCommand(command)
        };

        this.commands.set(commandId, terminalCommand);

        try {
            if (options.location === TerminalLocation.CHAT) {
                await this.executeInBackground(commandId, command, cwd, options.env);
            } else {
                await this.executeInMainTerminal(commandId, command, cwd);
            }

            return {
                success: true,
                commandId,
                status: CommandStatus.RUNNING
            };
        } catch (error) {
            logger.error(`Failed to execute command ${commandId}`, error as Error);

            terminalCommand.status = CommandStatus.FAILED;
            terminalCommand.endTime = Date.now();

            this.notifyComplete(commandId, 1, 0, CommandStatus.FAILED);

            return {
                success: false,
                commandId,
                status: CommandStatus.FAILED,
                error: (error as Error).message
            };
        }
    }

    private async executeInBackground(
        commandId: string,
        command: string,
        cwd: string,
        env?: Record<string, string>
    ): Promise<void> {
        const terminalCommand = this.commands.get(commandId);
        if (!terminalCommand) {
            throw new Error(`Command ${commandId} not found`);
        }

        const shell = process.platform === 'win32' ? 'cmd.exe' : '/bin/sh';
        const shellArgs = process.platform === 'win32' ? ['/c', command] : ['-c', command];

        const childProcess = spawn(shell, shellArgs, {
            cwd,
            env: { ...process.env, ...env },
            shell: false
        });

        this.processes.set(commandId, childProcess);
        terminalCommand.status = CommandStatus.RUNNING;
        terminalCommand.pid = childProcess.pid;
        terminalCommand.startTime = Date.now();

        this.notifyStatus(commandId, CommandStatus.RUNNING, childProcess.pid);

        childProcess.stdout?.on('data', (data: Buffer) => {
            const output = data.toString();
            this.addOutput(commandId, output, 'stdout');
        });

        childProcess.stderr?.on('data', (data: Buffer) => {
            const output = data.toString();
            this.addOutput(commandId, output, 'stderr');
        });

        logger.info(`Starting background process for command ${commandId}: ${command} in ${cwd}`);

        const FAILSAFE_TIMEOUT_MS = 300000;
        let isCompleted = false;
        const timeout = setTimeout(() => {
            if (!isCompleted) {
                logger.error(`Fail-safe timeout reached for command ${commandId}`);
                try {
                    childProcess.kill('SIGKILL');
                } catch (e) {
                    logger.error(`Failed to kill process for command ${commandId}:`, e);
                }
                terminalCommand.status = CommandStatus.FAILED;
                terminalCommand.endTime = Date.now();
                this.addOutput(commandId, `Error: Command timed out after ${FAILSAFE_TIMEOUT_MS / 1000}s`, 'stderr');
                this.notifyComplete(commandId, 1, FAILSAFE_TIMEOUT_MS, CommandStatus.FAILED);
                this.processes.delete(commandId);
                isCompleted = true;
            }
        }, FAILSAFE_TIMEOUT_MS);

        childProcess.on('exit', (code, signal) => {
            if (isCompleted) return;
            isCompleted = true;
            clearTimeout(timeout);
            logger.info(`Process exit event for command ${commandId}: code=${code}, signal=${signal}`);
            const exitCode = code ?? (signal ? 1 : 0);
            const duration = Date.now() - terminalCommand.startTime;

            terminalCommand.exitCode = exitCode;
            terminalCommand.endTime = Date.now();

            if (exitCode === 0) {
                terminalCommand.status = CommandStatus.COMPLETED;
                this.notifyComplete(commandId, exitCode, duration, CommandStatus.COMPLETED);
            } else if (signal === 'SIGTERM' || signal === 'SIGKILL') {
                terminalCommand.status = CommandStatus.STOPPED;
                this.notifyComplete(commandId, exitCode, duration, CommandStatus.STOPPED);
            } else {
                terminalCommand.status = CommandStatus.FAILED;
                this.notifyComplete(commandId, exitCode, duration, CommandStatus.FAILED);
            }

            this.processes.delete(commandId);
            logger.info(`Command ${commandId} exited with code ${exitCode}`);
        });

        childProcess.on('error', (error) => {
            if (isCompleted) return;
            isCompleted = true;
            clearTimeout(timeout);
            logger.error(`Process error event for command ${commandId}:`, error);
            terminalCommand.status = CommandStatus.FAILED;
            terminalCommand.endTime = Date.now();

            this.addOutput(commandId, `Error: ${error.message}`, 'stderr');
            this.notifyComplete(commandId, 1, Date.now() - terminalCommand.startTime, CommandStatus.FAILED);
            this.processes.delete(commandId);
        });
    }

    private async executeInMainTerminal(
        commandId: string,
        command: string,
        cwd: string
    ): Promise<void> {
        const terminalCommand = this.commands.get(commandId);
        if (!terminalCommand) {
            throw new Error(`Command ${commandId} not found`);
        }

        let terminal = this.terminals.get('main');
        if (!terminal || terminal.exitStatus) {
            terminal = vscode.window.createTerminal({
                name: 'CodeMind AI Terminal',
                cwd
            });
            this.terminals.set('main', terminal);
        }

        terminal.show();

        terminal.sendText(command);

        terminalCommand.status = CommandStatus.RUNNING;
        terminalCommand.startTime = Date.now();

        this.notifyStatus(commandId, CommandStatus.RUNNING);

        setTimeout(() => {
            terminalCommand.status = CommandStatus.COMPLETED;
            terminalCommand.endTime = Date.now();
            this.notifyComplete(
                commandId,
                0,
                terminalCommand.endTime - terminalCommand.startTime,
                CommandStatus.COMPLETED
            );
        }, 1000);
    }

    stopCommand(commandId: string): boolean {
        const command = this.commands.get(commandId);
        if (!command) {
            logger.warn(`Command ${commandId} not found`);
            return false;
        }

        if (command.status !== CommandStatus.RUNNING) {
            logger.warn(`Command ${commandId} is not running`);
            return false;
        }

        const process = this.processes.get(commandId);
        if (process) {
            logger.info(`Stopping command ${commandId} (PID: ${process.pid})`);

            process.kill('SIGTERM');

            setTimeout(() => {
                if (this.processes.has(commandId)) {
                    logger.warn(`Force killing command ${commandId}`);
                    process.kill('SIGKILL');
                }
            }, 5000);

            return true;
        }

        return false;
    }

    getCommand(commandId: string): TerminalCommand | undefined {
        return this.commands.get(commandId);
    }

    getRunningCommands(): TerminalCommand[] {
        return Array.from(this.commands.values()).filter(
            cmd => cmd.status === CommandStatus.RUNNING
        );
    }

    getAllCommands(): TerminalCommand[] {
        return Array.from(this.commands.values());
    }

    getProcess(commandId: string): ChildProcess | undefined {
        return this.processes.get(commandId);
    }

    clearCompleted(): void {
        for (const [id, command] of this.commands.entries()) {
            if (command.status === CommandStatus.COMPLETED ||
                command.status === CommandStatus.FAILED ||
                command.status === CommandStatus.STOPPED) {
                this.commands.delete(id);
            }
        }
    }

    dispose(): void {
        for (const [commandId, process] of this.processes.entries()) {
            logger.info(`Disposing command ${commandId}`);
            process.kill('SIGTERM');
        }
        this.processes.clear();

        for (const terminal of this.terminals.values()) {
            terminal.dispose();
        }
        this.terminals.clear();

        this.commands.clear();
        logger.info('TerminalManager disposed');
    }

    private addOutput(commandId: string, content: string, type: 'stdout' | 'stderr'): void {
        const command = this.commands.get(commandId);
        if (!command) {
            return;
        }

        const lines = content.split('\n').filter(line => line.trim().length > 0);

        for (const line of lines) {
            const outputLine: TerminalOutputLine = {
                content: line,
                type,
                timestamp: Date.now()
            };

            command.output.push(outputLine);

            if (this.onOutputCallback) {
                this.onOutputCallback(commandId, outputLine);
            }
        }
    }

    private notifyStatus(commandId: string, status: CommandStatus, pid?: number): void {
        if (this.onStatusCallback) {
            this.onStatusCallback(commandId, status, pid);
        }
    }

    private notifyComplete(commandId: string, exitCode: number, duration: number, status: CommandStatus): void {
        if (this.onCompleteCallback) {
            this.onCompleteCallback(commandId, exitCode, duration, status);
        }
    }

    private generateCommandId(): string {
        return `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    private assessCommandRisk(command: string): CommandRiskLevel {
        const cmd = command.toLowerCase().trim();

        const dangerousPatterns = [
            /rm\s+-rf/,
            /rm\s+-fr/,
            /sudo/,
            /chmod\s+777/,
            /shutdown/,
            /reboot/,
            /mkfs/,
            /dd\s+if=/,
            /:\(\)\{/,
            />\/dev\/sd/,
            /curl.*\|.*sh/,
            /wget.*\|.*sh/
        ];

        if (dangerousPatterns.some(pattern => pattern.test(cmd))) {
            return CommandRiskLevel.DANGEROUS;
        }

        const moderatePatterns = [
            /rm\s+/,
            /git\s+push/,
            /git\s+reset/,
            /npm\s+install/,
            /yarn\s+install/,
            /pip\s+install/,
            /apt-get\s+install/,
            /brew\s+install/,
            /chmod/,
            /chown/
        ];

        if (moderatePatterns.some(pattern => pattern.test(cmd))) {
            return CommandRiskLevel.MODERATE;
        }

        return CommandRiskLevel.SAFE;
    }

    private shouldHideCommand(command: string): boolean {
        const cmd = command.trim().toLowerCase();

        // Never hide build/script commands - these should always show output
        const neverHidePatterns = [
            /npm\s+/,
            /npx\s+/,
            /yarn\s+/,
            /pnpm\s+/,
            /bun\s+/,
            /node\s+/,
            /python\s+/,
            /pip\s+/,
            /cargo\s+/,
            /go\s+/,
            /make\s+/,
            /gradle\s+/,
            /mvn\s+/,
            /composer\s+/,
            /bundle\s+/,
            /gem\s+/
        ];

        if (neverHidePatterns.some(pattern => pattern.test(cmd))) {
            return false;
        }

        // Only hide simple file operations that don't produce meaningful output
        const hiddenPatterns = [
            /^mkdir\s/,
            /^touch\s/,
            /^echo\s/,
            /^printf\s/,
            /^cat\s.*>/,
            /^cp\s/,
            /^mv\s/,
            /^nano\s/,
            /^cat\s/,
            /^rm\s/,
            /^rm\s+-fr/,

        ];

        return hiddenPatterns.some(pattern => pattern.test(cmd));
    }
}

export const terminalManager = new TerminalManager();
