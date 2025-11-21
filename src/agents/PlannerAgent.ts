/**
 * Planner Agent - Creates step-by-step execution plans
 */

import { BaseAgent } from './BaseAgent';
import { AgentTask, AgentResult, ExecutionPlan, PlanStep } from '../types';
import { modelRouter } from '../ai/ModelRouter';
import { projectBrain } from '../brain/ProjectBrain';

export class PlannerAgent extends BaseAgent {
    constructor() {
        super('planner', 'Planner Agent');
    }

    async execute(task: AgentTask): Promise<AgentResult> {
        const prompt = this.buildPlanningPrompt(task);

        const response = await modelRouter.generateCompletion({
            prompt,
            systemPrompt: 'You are an expert software architect. Create detailed, safe execution plans.',
            maxTokens: 2000
        }, 'code-generation');

        const plan = this.parsePlan(response.content);

        return this.createResult(task.id, true, JSON.stringify(plan, null, 2), {
            metrics: {
                tokensUsed: response.tokensUsed,
                latency: response.latency,
                linesChanged: 0
            },
            suggestions: [
                'Review the plan before execution',
                'Ensure all dependencies are handled',
                'Consider creating backups for critical files'
            ]
        });
    }

    private buildPlanningPrompt(task: AgentTask): string {
        let prompt = `Create a detailed execution plan for the following task:\n\n`;
        prompt += `Task: ${task.description}\n\n`;

        if (task.context.files.length > 0) {
            prompt += `Affected files:\n`;
            for (const file of task.context.files) {
                prompt += `- ${file}\n`;
            }
            prompt += `\n`;
        }

        // Add project context if available
        const brainState = projectBrain.getState();
        if (brainState) {
            prompt += `Project context:\n`;
            prompt += `- Frameworks: ${brainState.frameworks.map(f => f.name).join(', ')}\n`;
            prompt += `- Total files: ${brainState.fileCount}\n`;
            prompt += `\n`;
        }

        prompt += `Create a step-by-step plan that:\n`;
        prompt += `1. Breaks down the task into clear, actionable steps\n`;
        prompt += `2. Identifies dependencies between steps\n`;
        prompt += `3. Estimates risk level for each step\n`;
        prompt += `4. Suggests which files need to be created, modified, or deleted\n`;
        prompt += `5. Includes verification steps\n\n`;
        prompt += `Format the plan as JSON with the following structure:\n`;
        prompt += `{\n`;
        prompt += `  "steps": [\n`;
        prompt += `    {\n`;
        prompt += `      "id": "step-1",\n`;
        prompt += `      "description": "Description of the step",\n`;
        prompt += `      "action": "file-create" | "file-modify" | "terminal-command" | etc,\n`;
        prompt += `      "dependencies": ["step-id"],\n`;
        prompt += `      "riskLevel": "safe" | "moderate" | "high" | "critical",\n`;
        prompt += `      "estimatedDuration": 1000 // milliseconds\n`;
        prompt += `    }\n`;
        prompt += `  ]\n`;
        prompt += `}\n`;

        return prompt;
    }

    private parsePlan(content: string): ExecutionPlan {
        try {
            // Extract JSON from response
            const jsonMatch = content.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('No JSON found in response');
            }

            const parsed = JSON.parse(jsonMatch[0]);

            const steps: PlanStep[] = parsed.steps.map((step: any) => ({
                id: step.id,
                description: step.description,
                action: step.action,
                dependencies: step.dependencies || [],
                estimatedDuration: step.estimatedDuration || 1000,
                riskLevel: step.riskLevel || 'moderate'
            }));

            const totalDuration = steps.reduce((sum, step) => sum + step.estimatedDuration, 0);
            const maxRisk = this.getMaxRiskLevel(steps);

            return {
                id: `plan-${Date.now()}`,
                steps,
                estimatedDuration: totalDuration,
                riskAssessment: maxRisk,
                requiresApproval: maxRisk === 'high' || maxRisk === 'critical',
                createdAt: Date.now()
            };
        } catch (error) {
            // Fallback: create a simple plan
            return {
                id: `plan-${Date.now()}`,
                steps: [{
                    id: 'step-1',
                    description: 'Execute task',
                    action: 'code-generation' as any,
                    dependencies: [],
                    estimatedDuration: 5000,
                    riskLevel: 'moderate'
                }],
                estimatedDuration: 5000,
                riskAssessment: 'moderate',
                requiresApproval: false,
                createdAt: Date.now()
            };
        }
    }

    private getMaxRiskLevel(steps: PlanStep[]): 'safe' | 'moderate' | 'high' | 'critical' {
        const riskOrder = ['safe', 'moderate', 'high', 'critical'];
        let maxRisk = 'safe';

        for (const step of steps) {
            if (riskOrder.indexOf(step.riskLevel) > riskOrder.indexOf(maxRisk)) {
                maxRisk = step.riskLevel;
            }
        }

        return maxRisk as any;
    }
}

export const plannerAgent = new PlannerAgent();
