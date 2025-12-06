import OpenAI from 'openai';
import { BaseProvider } from './BaseProvider';
import { AIRequest, AIResponse } from '../../types';
import { logger } from '../../utils/logger';
import { MODEL_CONFIGS } from '../../config/models';

type Message = { role: 'user' | 'ai'; content: string };

export class OpenAIProvider extends BaseProvider {
    private client?: OpenAI;

    constructor(apiKey?: string) {
        const trimmedKey = apiKey?.trim();
        super('openai', trimmedKey);

        if (trimmedKey) {
            logger.info(`OpenAI provider initializing with API key: ${trimmedKey.substring(0, 10)}...`);
            logger.info('✓ OpenAI provider is available');
            this.client = new OpenAI({ apiKey: trimmedKey });
        } else {
            logger.warn('OpenAI provider initialized without API key');
        }
    }

    async isAvailable(): Promise<boolean> {
        if (!this.apiKey || !this.client) return false;
        return this.apiKey.startsWith('sk-');
    }

    private resolveModel(requestedModel?: string): string {
        if (!requestedModel) return 'gpt-4o-mini';

        if (MODEL_CONFIGS[requestedModel]) {
            return requestedModel;
        }

        switch (requestedModel) {
            case 'chatgpt-3.5':
            case 'gpt-3.5-turbo':
                return 'gpt-3.5';
            case 'chatgpt-4o':
            case 'gpt-4o':
            case 'gpt-4o-mini':
                return 'gpt-4o-mini';
            case 'chatgpt-4.1':
            case 'gpt-4.1-turbo':
                return 'gpt-4.1';
            default:
                return 'gpt-4o-mini';
        }
    }

    private buildMessages(request: AIRequest): any[] {
        const textContent = this.buildPrompt(request);

        if (request.images && request.images.length > 0) {
            const content: any[] = [];

            for (const image of request.images) {
                let imageUrl = image.data;

                if (!imageUrl.startsWith('data:')) {
                    imageUrl = `data:${image.mimeType};base64,${image.data}`;
                }

                content.push({
                    type: 'image_url',
                    image_url: {
                        url: imageUrl,
                        detail: 'auto'
                    }
                });
            }

            // Add text content
            content.push({
                type: 'text',
                text: textContent
            });

            logger.info(`OpenAI: Added ${request.images.length} image(s) to request`);

            return [{
                role: 'user',
                content: content
            }];
        }

        return [{
            role: 'user',
            content: textContent
        }];
    }

    async generateCompletion(request: AIRequest): Promise<AIResponse> {
        if (!this.client) throw new Error('OpenAI client not initialized');

        const startTime = Date.now();
        const modelName = this.resolveModel(request.model);

        const completion = await this.client.chat.completions.create({
            model: modelName,
            messages: this.buildMessages(request),
            max_tokens: request.maxTokens
        });

        const content = (completion.choices[0].message as any)?.content || '';
        const latency = Date.now() - startTime;
        const tokensUsed = this.estimateTokens(content);

        logger.info(`OpenAI completion generated in ${latency}ms using ${modelName}${request.images?.length ? ` with ${request.images.length} image(s)` : ''}`);

        return this.createResponse(content, modelName, tokensUsed, latency);
    }

    async streamCompletion(request: AIRequest, onChunk: (chunk: string) => void): Promise<AIResponse> {
        if (!this.client) throw new Error('OpenAI client not initialized');

        const startTime = Date.now();
        const modelName = this.resolveModel(request.model);
        let fullContent = '';

        const stream = await this.client.chat.completions.create({
            model: modelName,
            messages: this.buildMessages(request),
            max_tokens: request.maxTokens,
            stream: true
        });

        for await (const chunk of stream as any) {
            for (const choice of chunk.choices) {
                const text = choice.delta?.content || '';
                fullContent += text;
                if (text) onChunk(text);
            }
        }

        const latency = Date.now() - startTime;
        const tokensUsed = this.estimateTokens(fullContent);

        logger.info(`OpenAI streaming completed in ${latency}ms using ${modelName}${request.images?.length ? ` with ${request.images.length} image(s)` : ''}`);

        return this.createResponse(fullContent, modelName, tokensUsed, latency);
    }
}
