/**
 * Logging utility for CodeMind AI
 */

import * as vscode from 'vscode';

export enum LogLevel {
    DEBUG = 0,
    INFO = 1,
    WARN = 2,
    ERROR = 3
}

class Logger {
    private outputChannel: vscode.OutputChannel;
    private logLevel: LogLevel = LogLevel.INFO;

    constructor() {
        this.outputChannel = vscode.window.createOutputChannel('CodeMind AI');
    }

    setLogLevel(level: LogLevel): void {
        this.logLevel = level;
    }

    debug(message: string, ...args: any[]): void {
        this.log(LogLevel.DEBUG, message, ...args);
    }

    info(message: string, ...args: any[]): void {
        this.log(LogLevel.INFO, message, ...args);
    }

    warn(message: string, ...args: any[]): void {
        this.log(LogLevel.WARN, message, ...args);
    }

    error(message: string, error?: Error, ...args: any[]): void {
        const errorMessage = error ? `${message}: ${error.message}\n${error.stack}` : message;
        this.log(LogLevel.ERROR, errorMessage, ...args);
    }

    private log(level: LogLevel, message: string, ...args: any[]): void {
        if (level < this.logLevel) {
            return;
        }

        const timestamp = new Date().toISOString();
        const levelName = LogLevel[level];
        const formattedArgs = args.length > 0 ? ` ${JSON.stringify(args)}` : '';
        const logMessage = `[${timestamp}] [${levelName}] ${message}${formattedArgs}`;

        this.outputChannel.appendLine(logMessage);

        // Also log to console in development
        if (process.env.NODE_ENV === 'development') {
            console.log(logMessage);
        }

        // Show error messages to user
        if (level === LogLevel.ERROR) {
            vscode.window.showErrorMessage(`CodeMind AI: ${message}`);
        }
    }

    show(): void {
        this.outputChannel.show();
    }

    clear(): void {
        this.outputChannel.clear();
    }

    dispose(): void {
        this.outputChannel.dispose();
    }
}

export const logger = new Logger();
