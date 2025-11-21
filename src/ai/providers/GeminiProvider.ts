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
        // Trim whitespace from API key (common copy-paste issue)
        const trimmedKey = apiKey?.trim();

        super('gemini', trimmedKey);

        if (trimmedKey) {
            logger.info(`Gemini provider initializing with API key: ${trimmedKey.substring(0, 10)}...`);
            this.client = new GoogleGenerativeAI(trimmedKey);
        } else {
            logger.warn('Gemini provider initialized without API key');
        }
    }

    async isAvailable(): Promise<boolean> {
        logger.info('Checking Gemini provider availability...');

        if (!this.apiKey) {
            logger.warn('Gemini API key not configured (apiKey is undefined or empty)');
            return false;
        }

        if (!this.client) {
            logger.warn('Gemini client not initialized');
            return false;
        }

        // Simple check - just verify client is initialized
        // Don't make actual API calls in availability check as it's too aggressive
        try {
            logger.info(`Gemini API key length: ${this.apiKey.length}`);
            logger.info(`Gemini API key starts with: ${this.apiKey.substring(0, 4)}`);

            // Verify API key format (should start with 'AIza')
            if (!this.apiKey.startsWith('AIza')) {
                logger.error(`Gemini API key format invalid - starts with "${this.apiKey.substring(0, 4)}" but should start with "AIza"`);
                return false;
            }

            logger.info('✓ Gemini provider is available');
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
            // Handle legacy model name from settings
            let modelName = request.model || 'gemini-pro';
            if (modelName === 'gemini-pro-vision') {
                modelName = 'gemini-pro';
            }

            const model = this.client.getGenerativeModel({
                model: modelName
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
                request.model || 'gemini-pro',
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
                model: request.model || 'gemini-pro'
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
                request.model || 'gemini-pro',
                tokensUsed,
                latency
            );
        } catch (error) {
            this.handleError(error, 'streaming');
        }
    }
}
