

import axios from 'axios';
import { BaseProvider } from './BaseProvider';
import { AIRequest, AIResponse } from '../../types';
import { logger } from '../../utils/logger';

export class DeepSeekProvider extends BaseProvider {
    private readonly apiUrl = 'https://api.deepseek.com/v1';

    constructor(apiKey?: string) {
        const trimmedKey = apiKey?.trim();
        super('deepseek', trimmedKey);
        if (trimmedKey) {
            logger.info(`DeepSeek provider initializing with API key: ${trimmedKey.substring(0, 10)}...`);
            logger.info('✓ DeepSeek provider is available');
        } else {
            logger.warn('DeepSeek provider initialized without API key');
        }
    }

    async isAvailable(): Promise<boolean> {
        if (!this.apiKey) {
            logger.warn('DeepSeek API key not configured');
            return false;
        }

        try {
            const response = await axios.get(`${this.apiUrl}/models`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` },
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            logger.error('DeepSeek availability check failed', error as Error);
            return false;
        }
    }

    async generateCompletion(request: AIRequest): Promise<AIResponse> {
        const startTime = Date.now();

        try {
            const response = await axios.post(
                `${this.apiUrl}/chat/completions`,
                {
                    model: request.model || 'deepseek-coder',
                    messages: this.buildMessages(request),
                    max_tokens: request.maxTokens || 2048,
                    temperature: request.temperature || 0.7,
                    stream: false
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 60000
                }
            );

            const latency = Date.now() - startTime;
            const content = response.data.choices[0].message.content;
            const tokensUsed = response.data.usage?.total_tokens || this.estimateTokens(content);

            logger.info(`DeepSeek completion generated in ${latency}ms`);

            return this.createResponse(
                content,
                response.data.model,
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
                `${this.apiUrl}/chat/completions`,
                {
                    model: request.model || 'deepseek-coder',
                    messages: this.buildMessages(request),
                    max_tokens: request.maxTokens || 2048,
                    temperature: request.temperature || 0.7,
                    stream: true
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    responseType: 'stream',
                    timeout: 60000
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
                                logger.error('Error parsing DeepSeek response', e);
                            }
                        }
                    }
                });

                response.data.on('end', () => {
                    const latency = Date.now() - startTime;
                    const tokensUsed = this.estimateTokens(fullContent);

                    resolve(this.createResponse(
                        fullContent,
                        request.model || 'deepseek-coder',
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
