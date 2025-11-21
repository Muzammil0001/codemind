/**
 * Groq AI Provider (Fast inference with free tier)
 */

import axios from 'axios';
import { BaseProvider } from './BaseProvider';
import { AIRequest, AIResponse } from '../../types';
import { logger } from '../../utils/logger';

export class GroqProvider extends BaseProvider {
    private readonly apiUrl = 'https://api.groq.com/openai/v1';

    constructor(apiKey?: string) {
        super('groq', apiKey);
    }

    async isAvailable(): Promise<boolean> {
        if (!this.apiKey) {
            logger.warn('Groq API key not configured');
            return false;
        }

        try {
            const response = await axios.get(`${this.apiUrl}/models`, {
                headers: { 'Authorization': `Bearer ${this.apiKey}` },
                timeout: 5000
            });
            return response.status === 200;
        } catch (error) {
            logger.error('Groq availability check failed', error as Error);
            return false;
        }
    }

    async generateCompletion(request: AIRequest): Promise<AIResponse> {
        const startTime = Date.now();

        try {
            const response = await axios.post(
                `${this.apiUrl}/chat/completions`,
                {
                    model: request.model || 'llama-3.1-70b-versatile',
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

            logger.info(`Groq completion generated in ${latency}ms`);

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
        let firstChunkTime = 0;

        try {
            const response = await axios.post(
                `${this.apiUrl}/chat/completions`,
                {
                    model: request.model || 'llama-3.1-70b-versatile',
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
                                    if (!firstChunkTime) {
                                        firstChunkTime = Date.now();
                                        logger.info(`Groq first chunk received in ${firstChunkTime - startTime}ms`);
                                    }
                                    fullContent += content;
                                    onChunk(content);
                                }
                            } catch (e) {
                                // Ignore parse errors for incomplete chunks
                            }
                        }
                    });
            });

            response.data.on('end', () => {
                const latency = Date.now() - startTime;
                const tokensUsed = this.estimateTokens(fullContent);

                logger.info(`Groq streaming completed in ${latency}ms`);

                resolve(this.createResponse(
                    fullContent,
                    request.model || 'llama-3.1-70b-versatile',
                    tokensUsed,
                    latency
                ));
            });

            response.data.on('error', (error: Error) => {
                reject(error);
            });
        });
    } catch(error) {
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
