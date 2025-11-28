

import { BaseAgent } from './BaseAgent';
import { AgentTask, AgentResult } from '../types';
import { modelRouter } from '../ai/ModelRouter';
import { projectBrain } from '../brain/ProjectBrain';
import { fileOperationManager } from '../operations/FileOperationManager';
import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { PROMPTS } from '../config/prompts';
import { terminalManager } from '../terminal/TerminalManager';
import { TerminalLocation } from '../types/terminalTypes';

export class CoderAgent extends BaseAgent {
    constructor() {
        super('coder', 'Coder Agent');
    }

    async execute(task: AgentTask): Promise<AgentResult> {
        logger.info('=== CoderAgent Execute Start ===');
        logger.info(`Task: ${task.description}`);

        const context = await this.buildContext(task);

        // Log the context being used
        logger.info('=== Context Built ===');
        logger.info(`Structure Context Length: ${context.structureContext?.length || 0}`);
        logger.info(`Full Context Length: ${context.fullContext?.length || 0}`);
        logger.info(`Relevant Files: ${context.relevantFiles.length}`);
        logger.info('Structure Context Preview:');
        logger.info(context.structureContext?.substring(0, 500) || 'No structure context');
        console.log('🔍 PROJECT STRUCTURE CONTEXT:', context.structureContext);
        console.log('🔍 FULL CONTEXT:', context.fullContext?.substring(0, 1000));

        const prompt = this.buildCodingPrompt(task, context);

        logger.info('=== Prompt Built ===');
        logger.info(`Prompt Length: ${prompt.length}`);
        logger.info('Prompt Preview:');
        logger.info(prompt.substring(0, 500));
        console.log('📝 FINAL PROMPT TO AI:', prompt.substring(0, 1000));

        const response = await modelRouter.generateCompletion({
            prompt,
            systemPrompt: PROMPTS.SYSTEM.CODER,
            context: [context.fullContext], // Use comprehensive context
            maxTokens: 3000,
            model: task.context.modelId
        }, 'code-generation');

        const operations = this.extractFileOperations(response.content);
        let operationsExecuted = 0;

        if (operations.length > 0) {
            logger.info(`Detected ${operations.length} file operation(s)`);

            for (const operation of operations) {
                try {
                    if (operation.type === 'run_script') {
                        logger.info(`Executing script: ${operation.script}`);
                        await terminalManager.executeCommand(operation.script, {
                            location: TerminalLocation.MAIN
                        });
                        operationsExecuted++;
                    } else {
                        await fileOperationManager.executeOperation(operation);
                        operationsExecuted++;
                    }
                } catch (error) {
                    logger.error(`Failed to execute operation: ${operation.type}`, error as Error);
                }
            }
        }

        const code = this.extractCode(response.content);
        const linesChanged = code.split('\n').length;

        let finalResponse = response.content;
        if (operationsExecuted > 0) {
            // Show just the filename, not the full path, with better formatting
            const modifiedFiles = operations.map(op => {
                if (op.type === 'run_script') {
                    return `- **Run Script**: \`${op.script}\``;
                }
                const filename = op.path.split('/').pop() || op.path;
                return `- **[${filename}](${op.path})**`;
            }).join('\n');
            finalResponse += `\n\n### 📝 Modified Files\n${modifiedFiles}`;
        }

        return this.createResult(task.id, true, finalResponse, {
            metrics: {
                tokensUsed: response.tokensUsed,
                latency: response.latency,
                linesChanged,
                operationsExecuted
            },
            suggestions: [
                operationsExecuted > 0 ? `Executed ${operationsExecuted} file operation(s)` : 'Review generated code for correctness',
                'Run tests after applying changes',
                'Consider adding error handling'
            ]
        });
    }

    private async buildContext(task: AgentTask): Promise<{
        relevantFiles: string[];
        frameworks: string[];
        style: any;
        structureContext: string;
        fullContext: string;
    }> {
        const brainState = projectBrain.getState();

        // Use the new ContextBuilder for comprehensive context
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

        // Format relevant files for backward compatibility
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
        // Prepend project structure context to the task description
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

        const jsonBlockRegex = /```json\s*\n([\s\S]*?)\n```/g;
        let match;

        while ((match = jsonBlockRegex.exec(response)) !== null) {
            try {
                const jsonContent = match[1];
                const parsed = JSON.parse(jsonContent);

                // Handle tool_code format (new)
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
                    }
                }
                // Handle operation format (old)
                else if (parsed.operation && ['create', 'modify', 'delete', 'rename', 'move'].includes(parsed.operation)) {
                    operations.push({
                        type: parsed.operation,
                        path: parsed.path,
                        content: parsed.content,
                        newPath: parsed.newPath
                    });
                } else if (parsed.operation === 'run_script') {
                    operations.push({
                        type: 'run_script',
                        script: parsed.script
                    });
                }
            } catch (error) {
                continue;
            }
        }

        return operations;
    }

    private extractCode(response: string): string {
        const codeBlockMatch = response.match(/```[\w]*\n([\s\S]*?)\n```/);

        if (codeBlockMatch) {
            return codeBlockMatch[1];
        }

        return response;
    }
}

export const coderAgent = new CoderAgent();
