

import nlp from 'compromise';
import { distance } from 'fuzzball';
import { modelRouter } from '../ai/ModelRouter';
import { logger } from '../utils/logger';

export interface IntentResult {
    intent: string;
    confidence: number;
    entities: Record<string, any>;
    originalQuery: string;
    metadata?: any;
}

export class IntentPipeline {
    private intents = [
        'build_project',
        'run_test',
        'install_dependency',
        'create_file',
        'edit_file',
        'delete_file',
        'explain_code',
        'search_code',
        'refactor_code',
        'git_commit'
    ];

    private synonyms: Record<string, string[]> = {
        'build': ['compile', 'make', 'bundle', 'package'],
        'test': ['check', 'verify', 'spec', 'unit'],
        'install': ['add', 'get', 'download', 'fetch'],
        'create': ['new', 'make', 'generate', 'add'],
        'edit': ['change', 'modify', 'update', 'fix', 'patch'],
        'delete': ['remove', 'rm', 'destroy', 'clear'],
        'explain': ['describe', 'what is', 'how to', 'understand'],
        'search': ['find', 'locate', 'where is', 'look for']
    };

    async analyze(query: string): Promise<IntentResult> {
        try {
            const doc = nlp(query);
            const normalized = doc.normalize().text();

            const keywordIntent = this.detectByKeywords(normalized);
            if (keywordIntent && keywordIntent.confidence > 0.8) {
                return keywordIntent;
            }

            return await this.detectWithLLM(query);

        } catch (error) {
            logger.error('Intent analysis failed', error as Error);
            return {
                intent: 'unknown',
                confidence: 0,
                entities: {},
                originalQuery: query
            };
        }
    }

    private detectByKeywords(query: string): IntentResult | null {
        const words = query.toLowerCase().split(' ');

        for (const [action, synonyms] of Object.entries(this.synonyms)) {
            if (words.some(w => w === action || synonyms.includes(w))) {
                const intent = this.mapActionToIntent(action);
                if (intent) {
                    return {
                        intent,
                        confidence: 0.85,
                        entities: this.extractEntities(query),
                        originalQuery: query
                    };
                }
            }
        }
        return null;
    }

    private mapActionToIntent(action: string): string | null {
        const map: Record<string, string> = {
            'build': 'build_project',
            'test': 'run_test',
            'install': 'install_dependency',
            'create': 'create_file',
            'edit': 'edit_file',
            'delete': 'delete_file',
            'explain': 'explain_code',
            'search': 'search_code'
        };
        return map[action] || null;
    }

    private extractEntities(query: string): Record<string, any> {
        const doc = nlp(query);
        return {
            files: doc.match('#FileName').out('array'),
            paths: doc.match('#Path').out('array'),
            commands: doc.match('#Command').out('array')
        };
    }

    private async detectWithLLM(query: string): Promise<IntentResult> {
        const prompt = `Analyze the user's coding request and determine the intent.
        
Available Intents:
${this.intents.join(', ')}

Query: "${query}"

Respond with JSON:
{
    "intent": "string",
    "confidence": number,
    "entities": {
        "files": [],
        "commands": [],
        "libraries": []
    }
}`;

        const response = await modelRouter.generateCompletion({
            prompt,
            temperature: 0.1,
            maxTokens: 200
        });

        try {
            const jsonMatch = response.content.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                const result = JSON.parse(jsonMatch[0]);
                return {
                    ...result,
                    originalQuery: query
                };
            }
        } catch (e) {
            logger.error('Failed to parse LLM intent response', e as Error);
        }

        return {
            intent: 'unknown',
            confidence: 0,
            entities: {},
            originalQuery: query
        };
    }
}
