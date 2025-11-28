

export enum CommandStatus {
    PENDING = 'pending',
    RUNNING = 'running',
    COMPLETED = 'completed',
    FAILED = 'failed',
    STOPPED = 'stopped'
}

export enum TerminalLocation {
    CHAT = 'chat',
    MAIN = 'main'
}

export enum CommandRiskLevel {
    SAFE = 'safe',
    MODERATE = 'moderate',
    DANGEROUS = 'dangerous'
}

export interface TerminalCommand {
    
    id: string;

    command: string;

    cwd: string;

    status: CommandStatus;

    startTime: number;

    endTime?: number;

    exitCode?: number;

    output: TerminalOutputLine[];

    location: TerminalLocation;

    pid?: number;

    riskLevel?: CommandRiskLevel;
}

export interface TerminalOutputLine {
    
    content: string;

    type: 'stdout' | 'stderr';

    timestamp: number;
}

export enum TerminalMessageType {
    EXECUTE_COMMAND = 'executeTerminalCommand',
    STOP_COMMAND = 'stopTerminalCommand',
    OUTPUT = 'terminalOutput',
    STATUS = 'terminalStatus',
    COMPLETE = 'terminalComplete',
    GET_STATUS = 'getTerminalStatus',
    GET_RUNNING_COMMANDS = 'getRunningCommands'
}

export interface TerminalMessage {
    type: TerminalMessageType;
    commandId: string;
}

export interface ExecuteCommandMessage extends TerminalMessage {
    type: TerminalMessageType.EXECUTE_COMMAND;
    command: string;
    cwd?: string;
    location: TerminalLocation;
}

export interface StopCommandMessage extends TerminalMessage {
    type: TerminalMessageType.STOP_COMMAND;
}

export interface TerminalOutputMessage extends TerminalMessage {
    type: TerminalMessageType.OUTPUT;
    output: TerminalOutputLine;
}

export interface TerminalStatusMessage extends TerminalMessage {
    type: TerminalMessageType.STATUS;
    status: CommandStatus;
    pid?: number;
}

export interface TerminalCompleteMessage extends TerminalMessage {
    type: TerminalMessageType.COMPLETE;
    exitCode: number;
    duration: number;
    status: CommandStatus;
}

export interface CommandExecutionOptions {
    
    cwd?: string;

    env?: Record<string, string>;

    location: TerminalLocation;

    requireConfirmation?: boolean;

    timeout?: number;

    id?: string;
}

export interface CommandExecutionResult {
    
    success: boolean;

    commandId: string;

    exitCode?: number;

    error?: string;

    status: CommandStatus;
}
