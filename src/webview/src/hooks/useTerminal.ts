

import { useCallback } from 'react';
import { useVSCode } from './useVSCode';
import { useTerminalStore, type TerminalCommand, type TerminalOutputLine } from '../stores/terminalStore';

export type TerminalStatus = 'pending' | 'running' | 'completed' | 'failed' | 'stopped';

export type { TerminalCommand, TerminalOutputLine };

export interface UseTerminalReturn {
    commands: TerminalCommand[];
    commandsMap: Record<string, TerminalCommand>;
    executeCommand: (command: string, cwd?: string) => string;
    stopCommand: (commandId: string) => void;
    updateCommandStatus: (commandId: string, updates: Partial<TerminalCommand>) => void;
    appendOutput: (commandId: string, content: string, type?: 'stdout' | 'stderr') => void;
    clearCommand: (commandId: string) => void;
    clearAllCommands: () => void;
}

export function useTerminal(): UseTerminalReturn {
    const { postMessage } = useVSCode();

    const commands = useTerminalStore(state => state.commands);
    const addCommand = useTerminalStore(state => state.addCommand);
    const updateCommand = useTerminalStore(state => state.updateCommand);
    const addOutput = useTerminalStore(state => state.addOutput);
    const clearCompleted = useTerminalStore(state => state.clearCompleted);

    const executeCommand = useCallback((command: string, cwd?: string) => {
        const commandId = `cmd_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        const newCommand: TerminalCommand = {
            id: commandId,
            command,
            cwd: cwd || '/workspace',
            status: 'pending',
            output: [],
            startTime: Date.now(),
            location: 'chat'
        };

        addCommand(newCommand);

        postMessage({
            type: 'runCommand',
            command,
            cwd,
            commandId
        });

        return commandId;
    }, [postMessage, addCommand]);

    const stopCommand = useCallback((commandId: string) => {
        postMessage({
            type: 'stopCommand',
            commandId
        });
    }, [postMessage]);

    const updateCommandStatus = useCallback((
        commandId: string,
        updates: Partial<TerminalCommand>
    ) => {
        updateCommand(commandId, updates);
    }, [updateCommand]);

    const appendOutput = useCallback((
        commandId: string,
        content: string,
        type: 'stdout' | 'stderr' = 'stdout'
    ) => {
        const newLine: TerminalOutputLine = {
            content,
            type,
            timestamp: Date.now()
        };
        addOutput(commandId, newLine);
    }, [addOutput]);

    const clearCommand = useCallback((commandId: string) => {
        updateCommand(commandId, { status: 'stopped' });
    }, [updateCommand]);

    const clearAllCommands = useCallback(() => {
        clearCompleted();
    }, [clearCompleted]);

    return {
        commands: Object.values(commands),
        commandsMap: commands,
        executeCommand,
        stopCommand,
        updateCommandStatus,
        appendOutput,
        clearCommand,
        clearAllCommands
    };
}

