/**
 * Google Gemini AI Provider (Free tier with large context)
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseProvider } from './BaseProvider';
import { AIRequest, AIResponse } from '../../types';
import { logger } from '../../utils/logger';

export class GeminiProvider extends BaseProvider {
    private client?: GoogleGenerativeAI;

    constructor(apiKey?: string) {
        super('gemini', apiKey);
        if (apiKey) {
            this.client = new GoogleGenerativeAI(apiKey);
        }
    }

    async isAvailable(): Promise<boolean> {
        if (!this.apiKey || !this.client) {
            logger.warn('Gemini API key not configured');
            return false;
        }

        try {
            const model = this.client.getGenerativeModel({ model: 'gemini-2.0-flash-exp' });
            await model.generateContent('test');
            return true;
        } catch (error) {
            logger.error('Gemini availability check failed', error as Error);
            return false;
        }
    }

    async generateCompletion(request: AIRequest): Promise<AIResponse> {
        if (!this.client) {
            throw new Error('Gemini client not initialized');
        }

        const startTime = Date.now();

        try {
            const model = this.client.getGenerativeModel({
                model: request.model || 'gemini-2.0-flash-exp'
            });

            const prompt = this.buildPrompt(request);
            const result = await model.generateContent(prompt);
            const response = await result.response;
            const content = response.text();

            const latency = Date.now() - startTime;
            const tokensUsed = this.estimateTokens(content);

            logger.info(`Gemini completion generated in ${latency}ms`);

            return this.createResponse(
                content,
                request.model || 'gemini-2.0-flash-exp',
                tokensUsed,
                latency
            );
        } catch (error) {
            this.handleError(error, 'completion');
        }
    }

    async streamCompletion(
        request: AIRequest,
        onChunk: (chunk: string) => void
    ): Promise<AIResponse> {
        if (!this.client) {
            throw new Error('Gemini client not initialized');
        }

        const startTime = Date.now();
        let fullContent = '';

        try {
            const model = this.client.getGenerativeModel({
                model: request.model || 'gemini-2.0-flash-exp'
            });

            const prompt = this.buildPrompt(request);
            const result = await model.generateContentStream(prompt);

            for await (const chunk of result.stream) {
                const chunkText = chunk.text();
                fullContent += chunkText;
                onChunk(chunkText);
            }

            const latency = Date.now() - startTime;
            const tokensUsed = this.estimateTokens(fullContent);

            logger.info(`Gemini streaming completed in ${latency}ms`);

            return this.createResponse(
                fullContent,
                request.model || 'gemini-2.0-flash-exp',
                tokensUsed,
                latency
            );
        } catch (error) {
            this.handleError(error, 'streaming');
        }
    }
}
