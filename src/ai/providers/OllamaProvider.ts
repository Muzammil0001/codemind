/**
 * Ollama Local LLM Provider
 */

import axios from 'axios';
import { BaseProvider } from './BaseProvider';
import { AIRequest, AIResponse } from '../../types';
import { logger } from '../../utils/logger';

export class OllamaProvider extends BaseProvider {
    constructor(baseUrl: string = 'http://localhost:11434') {
        super('ollama', undefined, baseUrl);
    }

    async isAvailable(): Promise<boolean> {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`, {
                timeout: 3000
            });
            return response.status === 200 && response.data.models?.length > 0;
        } catch (error) {
            logger.warn('Ollama not available - is it running?');
            return false;
        }
    }

    async getAvailableModels(): Promise<string[]> {
        try {
            const response = await axios.get(`${this.baseUrl}/api/tags`);
            return response.data.models.map((m: any) => m.name);
        } catch (error) {
            logger.error('Failed to fetch Ollama models', error as Error);
            return [];
        }
    }

    async generateCompletion(request: AIRequest): Promise<AIResponse> {
        const startTime = Date.now();

        try {
            const response = await axios.post(
                `${this.baseUrl}/api/generate`,
                {
                    model: request.model || 'llama3.1',
                    prompt: this.buildPrompt(request),
                    stream: false,
                    options: {
                        temperature: request.temperature || 0.7,
                        num_predict: request.maxTokens || 2048
                    }
                },
                {
                    timeout: 120000 // Local models can be slower
                }
            );

            const latency = Date.now() - startTime;
            const content = response.data.response;
            const tokensUsed = this.estimateTokens(content);

            logger.info(`Ollama completion generated in ${latency}ms`);

            return this.createResponse(
                content,
                request.model || 'llama3.1',
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
                `${this.baseUrl}/api/generate`,
                {
                    model: request.model || 'llama3.1',
                    prompt: this.buildPrompt(request),
                    stream: true,
                    options: {
                        temperature: request.temperature || 0.7,
                        num_predict: request.maxTokens || 2048
                    }
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
                        try {
                            const parsed = JSON.parse(line);
                            if (parsed.response) {
                                fullContent += parsed.response;
                                onChunk(parsed.response);
                            }
                        } catch (e) {
                            // Ignore parse errors
                        }
                    }
                });

                response.data.on('end', () => {
                    const latency = Date.now() - startTime;
                    const tokensUsed = this.estimateTokens(fullContent);

                    resolve(this.createResponse(
                        fullContent,
                        request.model || 'llama3.1',
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
}
