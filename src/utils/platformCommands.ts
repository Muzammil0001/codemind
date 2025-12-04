import * as os from 'os';

export class PlatformCommands {
    private static readonly platform = os.platform();

    static getFileViewCommand(): 'cat' | 'type' {
        return this.platform === 'win32' ? 'type' : 'cat';
    }

    static getFileDeleteCommand(): 'rm' | 'del' {
        return this.platform === 'win32' ? 'del' : 'rm';
    }


    static getDirDeleteCommand(): 'rm -rf' | 'rmdir /s /q' {
        return this.platform === 'win32' ? 'rmdir /s /q' : 'rm -rf';
    }

    static getDirCreateCommand(): 'mkdir' | 'mkdir' {
        return 'mkdir'; // Same on both platforms
    }


    static convertToPlatformCommand(genericCommand: string): string {
        let command = genericCommand;

        if (this.platform === 'win32') {
            // Convert Unix commands to Windows
            command = command.replace(/\bcat\s+([^|]+)/g, 'type $1');
            command = command.replace(/\brm\s+([^|&\n\r]*)$/gm, 'del $1');
            command = command.replace(/\brm\s+-rf\s+([^|&\n\r]*)/g, 'rmdir /s /q $1');
        } else {
            // Convert Windows commands to Unix (Linux/Mac)
            command = command.replace(/\btype\s+([^|]+)/g, 'cat $1');
            command = command.replace(/\bdel\s+([^|&\n\r]*)$/gm, 'rm $1');
            command = command.replace(/\brmdir\s+\/s\s+\/q\s+([^|&\n\r]*)/g, 'rm -rf $1');
        }

        return command;
    }

    static isWindows(): boolean {
        return this.platform === 'win32';
    }

    static isMac(): boolean {
        return this.platform === 'darwin';
    }

    static isLinux(): boolean {
        return this.platform === 'linux';
    }

    /**
     * Get the current platform name
     */
    static getPlatformName(): 'windows' | 'macos' | 'linux' {
        switch (this.platform) {
            case 'win32': return 'windows';
            case 'darwin': return 'macos';
            case 'linux': return 'linux';
            default: return 'linux';
        }
    }
}








































