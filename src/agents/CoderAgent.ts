import { BaseAgent } from './BaseAgent';
import { AgentTask, AgentResult } from '../types';
import { modelRouter } from '../ai/ModelRouter';
import { projectBrain } from '../brain/ProjectBrain';
import { fileOperationManager } from '../operations/FileOperationManager';
import { logger } from '../utils/logger';
import { PROMPTS } from '../config/prompts';
import { terminalManager } from '../terminal/TerminalManager';
import { TerminalLocation } from '../types/terminalTypes';

export class CoderAgent extends BaseAgent {
    constructor() {
        super('coder', 'Coder Agent');
    }

    async execute(task: AgentTask): Promise<AgentResult> {
        const context = await this.buildContext(task);
        const prompt = this.buildCodingPrompt(task, context);

        if (task.context.images && task.context.images.length > 0) {
            logger.info(`CoderAgent: Processing ${task.context.images.length} image(s) for vision analysis`);
        }

        const response = await modelRouter.generateCompletion({
            prompt,
            systemPrompt: PROMPTS.SYSTEM.CODER,
            context: [context.fullContext],
            maxTokens: 3000,
            model: task.context.modelId,
            images: task.context.images // Pass images for vision models
        }, 'code-generation');


        const operations = this.extractFileOperations(response.content);
        let operationsExecuted = 0;
        const commandIds: string[] = [];

        let finalResponse = response.content;

        finalResponse = this.removeOperationJsonBlocks(response.content);

        if (operations.length > 0) {
            const fileOps = operations.filter(op => op.type !== 'run_script');
            const scriptOps = operations.filter(op => op.type === 'run_script');
            logger.info('====>>operations', operations);
            if (fileOps.length > 0) {
                const grouped = this.groupOperationsByType(fileOps);

                if (grouped.create.length > 0) {
                    finalResponse += `\n**Created ${grouped.create.length} file(s):**\n`;
                    grouped.create.forEach(op => {
                        const filename = op.path.split('/').pop() || op.path;
                        finalResponse += `\n[${filename}](${op.path}) - \`${op.path}\`\n`;
                    });
                }

                if (grouped.modify.length > 0) {
                    finalResponse += `\n**Modified ${grouped.modify.length} file(s):**\n`;
                    grouped.modify.forEach(op => {
                        const filename = op.path.split('/').pop() || op.path;
                        finalResponse += `\n[${filename}](${op.path}) - \`${op.path}\`\n`;
                    });
                }

                if (grouped.delete.length > 0) {
                    finalResponse += `\n**Deleted ${grouped.delete.length} file(s):**\n`;
                    grouped.delete.forEach(op => {
                        finalResponse += `\n\`${op.path}\`\n`;
                    });
                }

                if (grouped.rename.length > 0) {
                    finalResponse += `\n**Renamed/Moved ${grouped.rename.length} file(s):**\n`;
                    grouped.rename.forEach(op => {
                        finalResponse += `\n\`${op.path}\` → \`${op.newPath}\`\n`;
                    });
                }
            }

            if (scriptOps.length > 0) {
                finalResponse += `\n\n**🧠 Running Scripts in Terminal A...**\n`;
            }

            logger.info(`🔄 Executing ${operations.length} operation(s)`);

            const backgroundOps: Promise<void>[] = [];

            for (const op of operations) {
                if (op.type === 'run_script') {
                    try {
                        logger.info(`🚀 Executing script: ${op.script}`);

                        const result = await terminalManager.executeCommand(op.script, {
                            location: TerminalLocation.CHAT
                        });

                        if (result?.success && result?.commandId) {
                            commandIds.push(result.commandId);
                            logger.info(`Script command ID: ${result.commandId}`);
                        }

                        operationsExecuted++;
                    } catch (err) {
                        logger.error(`❌ Script execution failed: ${op.script}`, err as Error);
                    }

                } else if (op.type === 'generate_image') {
                    try {
                        logger.info(`🎨 Generating image: ${op.prompt}`);

                       finalResponse += `\n\n@@image_generation@@${JSON.stringify({
                            prompt: op.prompt,
                            filename: op.filename,
                            width: op.width,
                            height: op.height
                        })}@@\n\n`;

                        operationsExecuted++;
                    } catch (err) {
                        logger.error(`❌ Image generation failed: ${op.prompt}`, err as Error);
                    }

                } else {
                    logger.info(`⚙️ Background ${op.type} on: ${op.path}`);

                    const taskPromise = fileOperationManager.executeOperation(op)
                        .then(() => {
                            operationsExecuted++;
                            logger.info(`✅ ${op.type.toUpperCase()} completed: ${op.path}`);
                        })
                        .catch(err => {
                            logger.error(`❌ File operation failed: ${op.type} on ${op.path}`, err as Error);
                        });

                    backgroundOps.push(taskPromise);
                }
            }

            Promise.allSettled(backgroundOps);

            logger.info(`📊 Summary: ${operationsExecuted}/${operations.length} completed (scripts foreground, files async)`);
        } else {
            logger.info('ℹ️ No file operations detected');
        }


        const code = this.extractCode(finalResponse);
        const linesChanged = code.split('\n').length;

        const result = this.createResult(task.id, true, finalResponse, {
            metrics: {
                tokensUsed: response.tokensUsed,
                latency: response.latency,
                linesChanged,
                operationsExecuted
            },
            commandIds: commandIds.length > 0 ? commandIds : undefined,
            suggestions: [
                operationsExecuted > 0 ? `Executed ${operationsExecuted} file operation(s)` : 'Review generated code for correctness',
                'Run tests after applying changes',
                'Consider adding error handling'
            ]
        });
        return result;
    }

    private groupOperationsByType(operations: any[]) {
        return {
            create: operations.filter(op => op.type === 'create'),
            modify: operations.filter(op => op.type === 'modify'),
            delete: operations.filter(op => op.type === 'delete'),
            rename: operations.filter(op => op.type === 'rename' || op.type === 'move')
        };
    }

    private async buildContext(task: AgentTask): Promise<{
        relevantFiles: string[];
        frameworks: string[];
        style: any;
        structureContext: string;
        fullContext: string;
    }> {
        const brainState = projectBrain.getState();

        const { contextBuilder } = await import('../brain/ContextBuilder');

        const builtContext = await contextBuilder.buildContext({
            userQuery: task.description,
            maxFiles: 5,
            maxMemories: 10,
            includeProjectStructure: true,
            includeDependencies: true,
            includeMemory: true,
            includeSymbols: true
        });

        const relevantFiles = builtContext.relevantFiles.map(f =>
            `File: ${f.path}\nLanguage: ${f.language}\nReason: ${f.reason}\n\n${f.content}`
        );

        return {
            relevantFiles,
            frameworks: brainState?.frameworks.map(f => f.name) || [],
            style: null,
            structureContext: builtContext.projectStructure,
            fullContext: builtContext.contextPrompt
        };
    }

    private buildCodingPrompt(task: AgentTask, context: any): string {
        let enhancedDescription = task.description;

        if (context.structureContext) {
            enhancedDescription = `${context.structureContext}\n\n---\n\nUser Request: ${task.description}`;
        }

        return PROMPTS.CODING_TASK({
            description: enhancedDescription,
            frameworks: context.frameworks.length > 0 ? context.frameworks.join(', ') : undefined,
            currentCode: task.context.codeSelection ? task.context.userPrompt : undefined
        });
    }

    private extractFileOperations(response: string): any[] {
        const operations: any[] = [];

        const jsonBlockRegex = /```(?:json)?\s*([\s\S]*?)\s*```/gi;
        let match;

        while ((match = jsonBlockRegex.exec(response)) !== null) {
            try {
                const jsonContent = match[1];
                const parsed = JSON.parse(jsonContent);

                if (parsed.tool_code && parsed.kwargs) {
                    if (parsed.tool_code === 'create_file') {
                        operations.push({
                            type: 'create',
                            path: parsed.kwargs.file_path,
                            content: parsed.kwargs.content
                        });
                    } else if (parsed.tool_code === 'modify_file' || parsed.tool_code === 'edit_file') {
                        operations.push({
                            type: 'modify',
                            path: parsed.kwargs.file_path,
                            content: parsed.kwargs.content || parsed.kwargs.new_content
                        });
                    } else if (parsed.tool_code === 'delete_file') {
                        operations.push({
                            type: 'delete',
                            path: parsed.kwargs.file_path
                        });
                    } else if (parsed.tool_code === 'rename_file' || parsed.tool_code === 'move_file') {
                        operations.push({
                            type: 'rename',
                            path: parsed.kwargs.file_path || parsed.kwargs.old_path,
                            newPath: parsed.kwargs.new_path
                        });
                    } else if (parsed.tool_code === 'generate_image') {
                        operations.push({
                            type: 'generate_image',
                            prompt: parsed.kwargs.prompt,
                            filename: parsed.kwargs.filename,
                            width: parsed.kwargs.width,
                            height: parsed.kwargs.height
                        });
                    } else if (parsed.tool_code === 'run_script') {
                        operations.push({
                            type: 'run_script',
                            script: parsed.kwargs.script
                        });
                    }
                }
                else if (parsed.operation && ['create', 'modify', 'delete', 'rename', 'move', 'run_script', 'generate_image'].includes(parsed.operation)) {
                    if (parsed.operation === 'generate_image') {
                        operations.push({
                            type: 'generate_image',
                            prompt: parsed.kwargs?.prompt || parsed.prompt,
                            filename: parsed.kwargs?.filename || parsed.filename,
                            width: parsed.kwargs?.width || parsed.width,
                            height: parsed.kwargs?.height || parsed.height
                        });
                    } else {
                        operations.push({
                            type: parsed.operation,
                            path: parsed.path,
                            content: parsed.content,
                            newPath: parsed.newPath,
                            script: parsed.script
                        });
                    }
                }
            } catch (error) {
                continue;
            }
        }

        return operations;
    }

    private removeOperationJsonBlocks(response: string): string {
        // Same permissive regex as extraction
        return response.replace(/```(?:json)?\s*([\s\S]*?)\s*```/gi, (match, jsonContent) => {
            try {
                const parsed = JSON.parse(jsonContent);

                // check if it is a valid operation JSON
                const isOp = (parsed.operation && ['create', 'modify', 'delete', 'rename', 'move', 'run_script', 'generate_image'].includes(parsed.operation)) ||
                    (parsed.tool_code && ['create_file', 'modify_file', 'delete_file', 'rename_file', 'move_file', 'run_script', 'generate_image'].includes(parsed.tool_code));

                if (isOp) {
                    return ''; 
                }
            } catch {}
            return match;
        });
    }

    private extractCode(response: string): string {
        const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)\n```/);

        if (codeBlockMatch) {
            return codeBlockMatch[1];
        }

        return response;
    }

    private isBuildTestDeployScript(command: string): boolean {
        // Generic patterns that work across any programming language stack
        const buildTestDeployPatterns = [
            // Common build/test/deploy verbs in any language/tool
            /\b(build|compile|package|assemble|bundle|minify|optimize)\b/i,
            /\b(test|spec|check|verify|validate|lint|format|analyze)\b/i,
            /\b(deploy|publish|release|upload|push|ship)\b/i,
            /\b(install|setup|configure|init|bootstrap)\b/i,
            /\b(clean|purge|remove|delete)\b/i,
            /\b(start|run|serve|dev|development|production)\b/i,

            // Common package managers and build tools with build/test/deploy actions
            /\b(npm|yarn|pnpm|pip|composer|maven|gradle|cargo|go|rustc|dotnet|nuget)\b.*\b(build|test|deploy|compile|package|install|run)\b/i,

            // Common script names that indicate build/test/deploy operations
            /\b(build|test|deploy|ci|cd|pipeline|workflow)\b/i,

            // Docker and container operations
            /\b(docker|podman|containerd)\b.*\b(build|run|push|deploy|compose)\b/i,

            // Common build output files or directories
            /\b(dist|build|target|out|bin|obj)\b/i
        ];

        return buildTestDeployPatterns.some(pattern => pattern.test(command));
    }
}

export const coderAgent = new CoderAgent();
