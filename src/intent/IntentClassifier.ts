

import { IntentPipeline, IntentResult } from './IntentPipeline';
import { logger } from '../utils/logger';

export class IntentClassifier {
    private pipeline: IntentPipeline;

    constructor() {
        this.pipeline = new IntentPipeline();
    }

    async classify(query: string, context?: any): Promise<IntentResult> {
        try {
            logger.info(`Classifying intent for query: ${query}`);

            const result = await this.pipeline.analyze(query);

            if (context) {
                result.metadata = {
                    ...result.metadata,
                    context
                };
            }

            logger.info(`Detected intent: ${result.intent} (${result.confidence})`);
            return result;

        } catch (error) {
            logger.error('Intent classification failed', error as Error);
            return {
                intent: 'unknown',
                confidence: 0,
                entities: {},
                originalQuery: query
            };
        }
    }
}

export const intentClassifier = new IntentClassifier();
