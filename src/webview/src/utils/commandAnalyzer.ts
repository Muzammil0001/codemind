/**
 * AI-Powered Command Analyzer
 * Uses AI models to intelligently detect and generate shell commands from natural language
 */

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

/**
 * Analyze user query with AI to detect command intent
 */
export async function analyzeCommandWithAI(
    request: CommandAnalysisRequest
): Promise<CommandIntent | null> {
    try {
        // Send message to backend for AI analysis
        const response = await sendMessageToBackend({
            type: 'analyzeCommand',
            data: request
        });

        if (!response || !response.isCommand) {
            return null;
        }

        // Convert AI response to CommandIntent
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

/**
 * Build specialized prompt for AI command analysis
 */
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

/**
 * Parse AI response into structured format
 */
export function parseAICommandResponse(aiResponse: string): AICommandResponse {
    try {
        // Try to extract JSON from response
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

/**
 * Send message to backend via VSCode API
 */
function sendMessageToBackend(message: any): Promise<any> {
    return new Promise((resolve, reject) => {
        // Get vscode API
        const vscode = (window as any).vscode;
        if (!vscode) {
            reject(new Error('VSCode API not available'));
            return;
        }

        // Create unique message ID
        const messageId = `cmd-analysis-${Date.now()}`;

        // Set up one-time listener for response
        const listener = (event: MessageEvent) => {
            const response = event.data;
            if (response.type === 'commandAnalysisResponse' && response.messageId === messageId) {
                window.removeEventListener('message', listener);
                resolve(response.data);
            }
        };

        window.addEventListener('message', listener);

        // Send message with ID
        vscode.postMessage({
            ...message,
            messageId
        });

        // Timeout after 10 seconds
        setTimeout(() => {
            window.removeEventListener('message', listener);
            reject(new Error('Command analysis timeout'));
        }, 10000);
    });
}

/**
 * Detect platform from navigator
 */
export function detectPlatform(): 'windows' | 'macos' | 'linux' {
    if (typeof navigator !== 'undefined') {
        const platform = navigator.platform.toLowerCase();
        if (platform.includes('win')) return 'windows';
        if (platform.includes('mac')) return 'macos';
    }
    return 'linux';
}

/**
 * Build command string based on package manager
 */
function buildCommand(packageManager: string, scriptName: string): string {
    switch (packageManager) {
        case 'npm':
        case 'yarn':
        case 'pnpm':
        case 'bun':
            return `${packageManager} run ${scriptName}`;

        case 'pip':
            // pip doesn't have "run" - scripts are usually in setup.py or pyproject.toml
            return `python -m ${scriptName}`;

        case 'poetry':
            return `poetry run ${scriptName}`;

        case 'cargo':
            // cargo run for binaries, cargo build for building
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

/**
 * Pattern-based command detection (fallback when AI fails)
 */
export function detectCommandByPattern(
    query: string,
    projectContext: any
): CommandIntent | null {
    const lowerQuery = query.toLowerCase().trim();

    // Pattern: "run X" or "execute X" or "start X"
    const runMatch = lowerQuery.match(/^(run|execute|start|npm run|yarn|pnpm)\s+(.+)$/);
    if (runMatch) {
        const scriptName = runMatch[2].trim();

        // Check if it's a known script from package.json
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

        // Common build commands
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

    // Pattern: "build X and Y" or "run X and Y build"
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

    // Pattern: "install X" or "add X"
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

    // Pattern: "delete X" or "remove X"
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
