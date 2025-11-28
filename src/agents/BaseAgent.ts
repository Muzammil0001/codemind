

import { AgentTask, AgentResult, AgentType } from '../types';
import { logger } from '../utils/logger';
import { performanceMonitor } from '../utils/performance';

export abstract class BaseAgent {
    protected type: AgentType;
    protected name: string;

    constructor(type: AgentType, name: string) {
        this.type = type;
        this.name = name;
    }

    abstract execute(task: AgentTask): Promise<AgentResult>;

    async run(task: AgentTask): Promise<AgentResult> {
        logger.info(`${this.name} starting task: ${task.description}`);

        try {
            const result = await performanceMonitor.measure(
                `agent-${this.type}-${task.id}`,
                () => this.execute(task)
            );

            logger.info(`${this.name} completed task: ${task.id}`);
            return result;
        } catch (error) {
            logger.error(`${this.name} failed task: ${task.id}`, error as Error);

            return {
                taskId: task.id,
                success: false,
                output: '',
                filesModified: [],
                filesCreated: [],
                filesDeleted: [],
                suggestions: [],
                warnings: [(error as Error).message],
                metrics: {
                    tokensUsed: 0,
                    latency: 0,
                    linesChanged: 0
                }
            };
        }
    }

    getType(): AgentType {
        return this.type;
    }

    getName(): string {
        return this.name;
    }

    protected createResult(
        taskId: string,
        success: boolean,
        output: string,
        options: Partial<AgentResult> = {}
    ): AgentResult {
        return {
            taskId,
            success,
            output,
            filesModified: options.filesModified || [],
            filesCreated: options.filesCreated || [],
            filesDeleted: options.filesDeleted || [],
            suggestions: options.suggestions || [],
            warnings: options.warnings || [],
            metrics: options.metrics || {
                tokensUsed: 0,
                latency: 0,
                linesChanged: 0
            }
        };
    }
}
