import { create } from 'zustand';

export interface TerminalOutputLine {
    content: string;
    type: 'stdout' | 'stderr';
    timestamp: number;
}

export interface TerminalCommand {
    id: string;
    command: string;
    cwd: string;
    status: 'pending' | 'running' | 'completed' | 'failed' | 'stopped';
    startTime: number;
    endTime?: number;
    exitCode?: number;
    output: TerminalOutputLine[];
    location: 'chat' | 'main';
    pid?: number;
}

interface TerminalState {
    commands: Record<string, TerminalCommand>;
    addCommand: (command: TerminalCommand) => void;
    updateCommand: (id: string, updates: Partial<TerminalCommand>) => void;
    addOutput: (id: string, output: TerminalOutputLine) => void;
    clearCompleted: () => void;
}

export const useTerminalStore = create<TerminalState>((set) => ({
    commands: {},

    addCommand: (command) =>
        set((state) => {
            return {
                commands: {
                    ...state.commands,
                    [command.id]: { ...command },
                },
            };
        }),

    updateCommand: (id, updates) =>
        set((state) => {
            const existing = state.commands[id];
            if (!existing) {
                console.warn(`⚠️ Cannot update non-existent command: ${id}`);
                return state;
            }

            return {
                commands: {
                    ...state.commands,
                    [id]: {
                        ...existing,
                        ...updates,
                    },
                },
            };
        }),

    addOutput: (id, output) =>
        set((state) => {
            let existing = state.commands[id];
            let currentCommands = state.commands;

            if (!existing) {
                console.warn(`⚠️ Output arrived before command registration for: ${id}`);

                existing = {
                    id,
                    command: 'Loading...',
                    cwd: '',
                    status: 'running',
                    output: [],
                    startTime: Date.now(),
                    location: 'chat'
                };

                currentCommands = {
                    ...state.commands,
                    [id]: existing
                };
            }
            const updatedCommand = {
                ...existing,
                output: [...existing.output, output],
            };

            const newState = {
                commands: {
                    ...currentCommands,
                    [id]: updatedCommand,
                },
            };

            return newState;
        }),

    clearCompleted: () =>
        set((state) => {
            const newCommands: Record<string, TerminalCommand> = {};

            Object.entries(state.commands).forEach(([id, cmd]) => {
                if (
                    cmd.status !== 'completed' &&
                    cmd.status !== 'failed' &&
                    cmd.status !== 'stopped'
                ) {
                    newCommands[id] = cmd;
                }
            });

            return { commands: newCommands };
        }),
}));