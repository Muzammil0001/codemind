/**
 * Base AI Provider interface
 */

import { AIRequest, AIResponse, ModelProvider } from '../../types';

export abstract class BaseProvider {
    protected provider: ModelProvider;
    protected apiKey?: string;
    protected baseUrl?: string;

    constructor(provider: ModelProvider, apiKey?: string, baseUrl?: string) {
        this.provider = provider;
        this.apiKey = apiKey;
        this.baseUrl = baseUrl;
    }

    abstract isAvailable(): Promise<boolean>;

    abstract generateCompletion(request: AIRequest): Promise<AIResponse>;

    abstract streamCompletion(
        request: AIRequest,
        onChunk: (chunk: string) => void,
        signal?: AbortSignal
    ): Promise<AIResponse>;

    protected createResponse(
        content: string,
        model: string,
        tokensUsed: number,
        latency: number,
        cached: boolean = false
    ): AIResponse {
        return {
            content,
            model,
            provider: this.provider,
            tokensUsed,
            latency,
            cached
        };
    }

    protected estimateTokens(text: string): number {
        // Rough estimation: ~4 characters per token
        return Math.ceil(text.length / 4);
    }

    protected buildPrompt(request: AIRequest): string {
        let prompt = '';

        if (request.systemPrompt) {
            prompt += `System: ${request.systemPrompt}\n\n`;
        }

        if (request.context && request.context.length > 0) {
            prompt += `Context:\n${request.context.join('\n')}\n\n`;
        }

        prompt += `User: ${request.prompt}`;

        return prompt;
    }

    protected handleError(error: any, operation: string): never {
        const message = error.response?.data?.error?.message || error.message || 'Unknown error';
        throw new Error(`${this.provider} ${operation} failed: ${message}`);
    }
}
