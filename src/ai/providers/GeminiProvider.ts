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
            // Use gemini-2.5-flash as default if not specified or if legacy model is requested
            let modelName = request.model;
            if (!modelName || modelName === 'gemini-pro' || modelName === 'gemini-pro-vision' || modelName === 'gemini-1.5-flash') {
                modelName = 'gemini-2.5-flash';
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

            logger.info(`Gemini completion generated in ${latency}ms using ${modelName}`);

            return this.createResponse(
                content,
                modelName,
                tokensUsed,
                latency
            );
        } catch (error) {
            this.handleError(error, 'completion');
            throw error;
        }
    }

    async streamCompletion(
        request: AIRequest,
        onChunk: (chunk: string) => void,
        signal?: AbortSignal
    ): Promise<AIResponse> {
        if (!this.client) {
            throw new Error('Gemini client not initialized');
        }

        const startTime = Date.now();
        let fullContent = '';

        try {
            // Use gemini-2.5-flash as default if not specified or if legacy model is requested
            let modelName = request.model;
            if (!modelName || modelName === 'gemini-pro' || modelName === 'gemini-pro-vision' || modelName === 'gemini-1.5-flash') {
                modelName = 'gemini-2.5-flash';
            }

            const model = this.client.getGenerativeModel({
                model: modelName
            });

            const prompt = this.buildPrompt(request);
            const result = await model.generateContentStream(prompt);

            for await (const chunk of result.stream) {
                // Check if request was aborted
                if (signal?.aborted) {
                    logger.info('Gemini streaming cancelled by user');
                    throw new Error('Request cancelled');
                }

                const chunkText = chunk.text();
                fullContent += chunkText;
                onChunk(chunkText);
            }

            const latency = Date.now() - startTime;
            const tokensUsed = this.estimateTokens(fullContent);

            logger.info(`Gemini streaming completed in ${latency}ms using ${modelName}`);

            return this.createResponse(
                fullContent,
                modelName,
                tokensUsed,
                latency
            );
        } catch (error) {
            this.handleError(error, 'streaming');
            throw error;
        }
    }
}
