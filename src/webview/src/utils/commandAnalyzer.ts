

import type { CommandIntent, ProjectContext } from './commandDetection';
import { PROMPTS } from '../../../config/prompts';

export interface CommandAnalysisRequest {
    userQuery: string;
    projectContext: ProjectContext;
    availableFiles: Array<{ path: string; type: 'file' | 'directory' }>;
    platform: 'windows' | 'macos' | 'linux';
}

export interface AICommandResponse {
    isCommand: boolean;
    command?: string;
    type?: CommandIntent['type'];
    requiresConfirmation?: boolean;
    riskLevel?: 'safe' | 'moderate' | 'dangerous';
    confidence?: number;
    reasoning?: string;
}

export async function analyzeCommandWithAI(
    request: CommandAnalysisRequest
): Promise<CommandIntent | null> {
    try {
        const response = await sendMessageToBackend({
            type: 'analyzeCommand',
            data: request
        });

        if (!response || !response.isCommand) {
            return null;
        }

        return {
            type: response.type || 'file-op',
            command: response.command || '',
            requiresConfirmation: response.requiresConfirmation || false,
            riskLevel: response.riskLevel || 'safe',
            originalMessage: request.userQuery,
            confidence: response.confidence || 0.8
        };
    } catch (error) {
        console.error('AI command analysis failed:', error);
        return null;
    }
}

export function buildCommandAnalysisPrompt(request: CommandAnalysisRequest): string {
    const fileContext = request.availableFiles.length > 0
        ? `\nAvailable Files/Directories (sample):\n${request.availableFiles.slice(0, 20).map(f => `- ${f.path} (${f.type})`).join('\n')}`
        : '';

    return PROMPTS.COMMAND_ANALYSIS({
        projectType: request.projectContext.type,
        packageManager: request.projectContext.packageManager,
        scripts: Object.keys(request.projectContext.scripts || {}).join(', ') || 'None',
        platform: request.platform,
        availableFiles: fileContext,
        userQuery: request.userQuery
    });
}

export function parseAICommandResponse(aiResponse: string): AICommandResponse {
    try {
        const jsonMatch = aiResponse.match(/\{[\s\S]*\}/);
        if (!jsonMatch) {
            return { isCommand: false };
        }

        const parsed = JSON.parse(jsonMatch[0]);
        return {
            isCommand: parsed.isCommand || false,
            command: parsed.command,
            type: parsed.type,
            requiresConfirmation: parsed.requiresConfirmation || false,
            riskLevel: parsed.riskLevel || 'safe',
            confidence: parsed.confidence || 0.8,
            reasoning: parsed.reasoning
        };
    } catch (error) {
        console.error('Failed to parse AI command response:', error);
        return { isCommand: false };
    }
}

function sendMessageToBackend(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const vscode = (window as any).vscode;
        if (!vscode) {
            reject(new Error('VSCode API not available'));
            return;
        }

        const messageId = `cmd-analysis-${Date.now()}`;

        const listener = (event: MessageEvent) => {
            const response = event.data;
            if (response.type === 'commandAnalysisResponse' && response.messageId === messageId) {
                window.removeEventListener('message', listener);
                resolve(response.data);
            }
        };

        window.addEventListener('message', listener);

        vscode.postMessage({
            ...message,
            messageId
        });

        setTimeout(() => {
            window.removeEventListener('message', listener);
            reject(new Error('Command analysis timeout'));
        }, 10000);
    });
}

export function detectPlatform(): 'windows' | 'macos' | 'linux' {
    if (typeof navigator !== 'undefined') {
        const platform = navigator.platform.toLowerCase();
        if (platform.includes('win')) return 'windows';
        if (platform.includes('mac')) return 'macos';
    }
    return 'linux';
}

function buildCommand(packageManager: string, scriptName: string): string {
    switch (packageManager) {
        case 'npm':
        case 'yarn':
        case 'pnpm':
        case 'bun':
            return `${packageManager} run ${scriptName}`;

        case 'pip':
            return `python -m ${scriptName}`;

        case 'poetry':
            return `poetry run ${scriptName}`;

        case 'cargo':
            if (scriptName === 'build' || scriptName === 'test' || scriptName === 'check') {
                return `cargo ${scriptName}`;
            }
            return `cargo run --bin ${scriptName}`;

        case 'go':
            if (scriptName === 'build' || scriptName === 'test') {
                return `go ${scriptName}`;
            }
            return `go run ${scriptName}`;

        default:
            return `${packageManager} run ${scriptName}`;
    }
}

export function detectCommandByPattern(
    query: string,
    projectContext: any
): CommandIntent | null {
    const lowerQuery = query.toLowerCase().trim();

    const runMatch = lowerQuery.match(/^(run|execute|start|npm run|yarn|pnpm)\s+(.+)$/);
    if (runMatch) {
        const scriptName = runMatch[2].trim();

        if (projectContext.scripts && projectContext.scripts[scriptName]) {
            return {
                type: 'script',
                command: buildCommand(projectContext.packageManager, scriptName),
                requiresConfirmation: false,
                riskLevel: 'safe',
                originalMessage: query,
                confidence: 0.9
            };
        }

        if (['build', 'dev', 'start', 'test', 'lint', 'format'].includes(scriptName)) {
            return {
                type: 'script',
                command: buildCommand(projectContext.packageManager, scriptName),
                requiresConfirmation: false,
                riskLevel: 'safe',
                originalMessage: query,
                confidence: 0.85
            };
        }
    }

    const multiCommandMatch = lowerQuery.match(/(?:run|build|execute)\s+.*(?:and|,).*(?:build|vsix|package)/);
    if (multiCommandMatch) {
        const commands: string[] = [];

        if (lowerQuery.includes('frontend') || lowerQuery.includes('webview')) {
            if (projectContext.scripts?.['build:webview']) {
                commands.push('build:webview');
            }
        }

        if (lowerQuery.includes('backend') || lowerQuery.includes('extension')) {
            if (projectContext.scripts?.['build:extension']) {
                commands.push('build:extension');
            }
        }

        if (lowerQuery.includes('vsix') || lowerQuery.includes('package')) {
            if (projectContext.scripts?.['package']) {
                commands.push('package');
            }
        }

        if (commands.length > 0) {
            const packageManager = projectContext.packageManager || 'npm';
            const command = commands.map(cmd => buildCommand(packageManager, cmd)).join(' && ');

            return {
                type: 'build',
                command,
                requiresConfirmation: false,
                riskLevel: 'safe',
                originalMessage: query,
                confidence: 0.8
            };
        }
    }

    if (lowerQuery.match(/^(install|add)\s+/)) {
        const packageName = lowerQuery.replace(/^(install|add)\s+/, '');
        const pm = projectContext.packageManager || 'npm';

        let installCommand: string;
        switch (pm) {
            case 'yarn':
            case 'pnpm':
            case 'bun':
                installCommand = `${pm} add ${packageName}`;
                break;
            case 'npm':
                installCommand = `npm install ${packageName}`;
                break;
            case 'pip':
                installCommand = `pip install ${packageName}`;
                break;
            case 'poetry':
                installCommand = `poetry add ${packageName}`;
                break;
            case 'cargo':
                installCommand = `cargo add ${packageName}`;
                break;
            case 'go':
                installCommand = `go get ${packageName}`;
                break;
            default:
                installCommand = `${pm} install ${packageName}`;
        }

        return {
            type: 'install',
            command: installCommand,
            requiresConfirmation: true,
            riskLevel: 'moderate',
            originalMessage: query,
            confidence: 0.85
        };
    }

    if (lowerQuery.match(/^(delete|remove|rm)\s+/)) {
        return {
            type: 'remove',
            command: lowerQuery,
            requiresConfirmation: true,
            riskLevel: 'dangerous',
            originalMessage: query,
            confidence: 0.7
        };
    }

    return null;
}
