

import { AgentTask, AgentResult, AgentType, ExecutionPlan } from '../types';
import { BaseAgent } from './BaseAgent';
import { plannerAgent } from './PlannerAgent';
import { coderAgent } from './CoderAgent';
import { reviewerAgent } from './ReviewerAgent';
import { testAgent } from './TestAgent';
import { documentationAgent } from './DocumentationAgent';
import { imageToCodeAgent } from './ImageToCodeAgent';
import { langChainOrchestrator } from './LangChainOrchestrator';
import { logger } from '../utils/logger';
import PQueue from 'p-queue';
import { configManager } from '../config/settings';

export class AgentOrchestrator {
    private agents: Map<AgentType, BaseAgent> = new Map();
    private taskQueue: PQueue;
    private activeTasks: Map<string, AgentTask> = new Map();

    constructor() {
        this.registerAgents();

        const parallelEnabled = configManager.get('enableParallelExecution', true);
        this.taskQueue = new PQueue({
            concurrency: parallelEnabled ? 3 : 1
        });
    }

    private registerAgents(): void {
        this.agents.set('planner', plannerAgent);
        this.agents.set('coder', coderAgent);
        this.agents.set('reviewer', reviewerAgent);
        this.agents.set('tester', testAgent);
        this.agents.set('documenter', documentationAgent);
        this.agents.set('image-to-code', imageToCodeAgent);
        this.agents.set('langchain', langChainOrchestrator);

        logger.info(`Registered ${this.agents.size} agents`);
    }

    async executeTask(task: AgentTask): Promise<AgentResult> {
        logger.info(`Orchestrator received task: ${task.id} (${task.type})`);

        this.activeTasks.set(task.id, task);

        try {
            task.status = 'running';
            task.startedAt = Date.now();

            const agent = this.agents.get(task.type);

            if (!agent) {
                throw new Error(`No agent available for type: ${task.type}`);
            }

            const result = await this.taskQueue.add(() => agent.run(task)) as AgentResult;

            task.status = 'completed';
            task.completedAt = Date.now();
            task.result = result;

            logger.info(`Orchestrator: Task ${task.id} completed successfully`);
            return result;
        } catch (error) {
            console.error('❌ AgentOrchestrator: Task execution failed', {
                taskId: task.id,
                error: (error as Error).message
            });

            task.status = 'failed';
            task.error = (error as Error).message;

            throw error;
        } finally {
            this.activeTasks.delete(task.id);
        }
    }

    async executePlan(plan: ExecutionPlan): Promise<Map<string, AgentResult>> {
        logger.info(`Executing plan: ${plan.id} with ${plan.steps.length} steps`);

        const results = new Map<string, AgentResult>();
        const completed = new Set<string>();

        while (completed.size < plan.steps.length) {
            const readySteps = plan.steps.filter(step => {
                return !completed.has(step.id) &&
                    step.dependencies.every(dep => completed.has(dep));
            });

            if (readySteps.length === 0) {
                throw new Error('Circular dependency detected in plan');
            }

            const stepPromises = readySteps.map(async (step) => {
                const task: AgentTask = {
                    id: `task-${step.id}`,
                    type: this.getAgentTypeForAction(step.action),
                    description: step.description,
                    context: {
                        files: [],
                        userPrompt: step.description
                    },
                    priority: 1,
                    status: 'pending',
                    createdAt: Date.now()
                };

                const result = await this.executeTask(task);
                results.set(step.id, result);
                completed.add(step.id);
            });

            await Promise.all(stepPromises);
        }

        logger.info(`Plan execution complete: ${completed.size}/${plan.steps.length} steps`);
        return results;
    }

    private getAgentTypeForAction(action: string): AgentType {
        if (action.includes('plan')) {
            return 'planner';
        } else if (action.includes('test')) {
            return 'tester';
        } else if (action.includes('doc')) {
            return 'documenter';
        } else if (action.includes('review')) {
            return 'reviewer';
        } else {
            return 'coder';
        }
    }

    getActiveTasks(): AgentTask[] {
        return Array.from(this.activeTasks.values());
    }

    getQueueSize(): number {
        return this.taskQueue.size;
    }

    getPendingCount(): number {
        return this.taskQueue.pending;
    }

    async waitForAll(): Promise<void> {
        await this.taskQueue.onIdle();
    }

    clearQueue(): void {
        this.taskQueue.clear();
        this.activeTasks.clear();
    }
}

export const agentOrchestrator = new AgentOrchestrator();
