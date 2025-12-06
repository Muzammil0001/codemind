

import { GoogleGenerativeAI } from '@google/generative-ai';
import { BaseProvider } from './BaseProvider';
import { AIRequest, AIResponse } from '../../types';
import { logger } from '../../utils/logger';

export class GeminiProvider extends BaseProvider {
    private client?: GoogleGenerativeAI;

    constructor(apiKey?: string) {
        const trimmedKey = apiKey?.trim();

        super('google', trimmedKey);

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
            let modelName = request.model;
            if (!modelName || modelName === 'gemini-pro' || modelName === 'gemini-pro-vision' || modelName === 'gemini-1.5-flash') {
                modelName = 'gemini-2.0-flash';
            }

            const model = this.client.getGenerativeModel({
                model: modelName
            });

            const parts: any[] = [];

            if (request.images && request.images.length > 0) {
                for (const image of request.images) {
                    let base64Data = image.data;
                    let mimeType = image.mimeType;

                    if (base64Data.startsWith('data:')) {
                        const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
                        if (matches) {
                            mimeType = matches[1];
                            base64Data = matches[2];
                        }
                    }

                    parts.push({
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    });
                }
                logger.info(`Gemini: Added ${request.images.length} image(s) to request`);
            }

            const textPrompt = this.buildPrompt(request);
            parts.push({ text: textPrompt });

            const result = await model.generateContent(parts);
            const response = await result.response;
            const content = response.text();

            const latency = Date.now() - startTime;
            const tokensUsed = this.estimateTokens(content);

            logger.info(`Gemini completion generated in ${latency}ms using ${modelName}${request.images?.length ? ` with ${request.images.length} image(s)` : ''}`);

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
            let modelName = request.model;
            // Use gemini-2.0-flash which supports vision by default
            if (!modelName || modelName === 'gemini-pro' || modelName === 'gemini-pro-vision' || modelName === 'gemini-1.5-flash') {
                modelName = 'gemini-2.0-flash';
            }

            const model = this.client.getGenerativeModel({
                model: modelName
            });

            const parts: any[] = [];

            if (request.images && request.images.length > 0) {
                for (const image of request.images) {
                    let base64Data = image.data;
                    let mimeType = image.mimeType;

                    if (base64Data.startsWith('data:')) {
                        const matches = base64Data.match(/^data:([^;]+);base64,(.+)$/);
                        if (matches) {
                            mimeType = matches[1];
                            base64Data = matches[2];
                        }
                    }

                    parts.push({
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data
                        }
                    });
                }
                logger.info(`Gemini streaming: Added ${request.images.length} image(s) to request`);
            }

            const textPrompt = this.buildPrompt(request);
            parts.push({ text: textPrompt });

            const result = await model.generateContentStream(parts);

            for await (const chunk of result.stream) {
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

            logger.info(`Gemini streaming completed in ${latency}ms using ${modelName}${request.images?.length ? ` with ${request.images.length} image(s)` : ''}`);

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
