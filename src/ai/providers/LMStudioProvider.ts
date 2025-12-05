

import axios from 'axios';
import { BaseProvider } from './BaseProvider';
import { AIRequest, AIResponse } from '../../types';
import { logger } from '../../utils/logger';

export class LMStudioProvider extends BaseProvider {
    constructor(baseUrl: string = 'http://localhost:1234') {
        super('lmstudio', undefined, baseUrl);
        logger.info(`LM Studio provider initializing with base URL: ${baseUrl}`);
    }

    async isAvailable(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.baseUrl}/v1/models`, {
                timeout: 3000
            });
            return response.status === 200;
        } catch (error) {
            logger.warn('LM Studio not available - is it running?');
            return false;
        }
    }

    async generateCompletion(request: AIRequest): Promise<AIResponse> {
        const startTime = Date.now();

        try {
            const response = await axios.post(
                `${this.baseUrl}/v1/chat/completions`,
                {
                    model: request.model || 'local-model',
                    messages: this.buildMessages(request),
                    max_tokens: request.maxTokens || 2048,
                    temperature: request.temperature || 0.7,
                    stream: false
                },
                {
                    timeout: 120000
                }
            );

            const latency = Date.now() - startTime;
            const content = response.data.choices[0].message.content;
            const tokensUsed = response.data.usage?.total_tokens || this.estimateTokens(content);

            logger.info(`LM Studio completion generated in ${latency}ms`);

            return this.createResponse(
                content,
                request.model || 'local-model',
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
        const startTime = Date.now();
        let fullContent = '';

        try {
            const response = await axios.post(
                `${this.baseUrl}/v1/chat/completions`,
                {
                    model: request.model || 'local-model',
                    messages: this.buildMessages(request),
                    max_tokens: request.maxTokens || 2048,
                    temperature: request.temperature || 0.7,
                    stream: true
                },
                {
                    responseType: 'stream',
                    timeout: 120000
                }
            );

            return new Promise((resolve, reject) => {
                response.data.on('data', (chunk: Buffer) => {
                    const lines = chunk.toString().split('\n').filter(line => line.trim());

                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);

                            if (data === '[DONE]') {
                                continue;
                            }

                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices[0]?.delta?.content;

                                if (content) {
                                    fullContent += content;
                                    onChunk(content);
                                }
                            } catch (e) {
                                logger.error('LM Studio streaming failed', e as Error);
                            }
                        }
                    }
                });

                response.data.on('end', () => {
                    const latency = Date.now() - startTime;
                    const tokensUsed = this.estimateTokens(fullContent);

                    resolve(this.createResponse(
                        fullContent,
                        request.model || 'local-model',
                        tokensUsed,
                        latency
                    ));
                });

                response.data.on('error', (error: Error) => {
                    reject(error);
                });
            });
        } catch (error) {
            this.handleError(error, 'streaming');
        }
    }

    private buildMessages(request: AIRequest): any[] {
        const messages: any[] = [];

        if (request.systemPrompt) {
            messages.push({
                role: 'system',
                content: request.systemPrompt
            });
        }

        if (request.context && request.context.length > 0) {
            messages.push({
                role: 'system',
                content: `Context:\n${request.context.join('\n')}`
            });
        }

        messages.push({
            role: 'user',
            content: request.prompt
        });

        return messages;
    }
}
