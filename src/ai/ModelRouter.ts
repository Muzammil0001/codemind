

import { BaseProvider } from './providers/BaseProvider';
import { GroqProvider } from './providers/GroqProvider';
import { DeepSeekProvider } from './providers/DeepSeekProvider';
import { GeminiProvider } from './providers/GeminiProvider';
import { OpenAIProvider } from './providers/OpenAIProvider';
import { OllamaProvider } from './providers/OllamaProvider';
import { LMStudioProvider } from './providers/LMStudioProvider';
import { AIRequest, AIResponse, ModelCapability, ModelProvider } from '../types';
import { configManager } from '../config/settings';
import { getModelConfig, getFastestModel, getLongestContextModel } from '../config/models';
import { logger } from '../utils/logger';
import { responseCache } from '../utils/cache';
import { performanceMonitor } from '../utils/performance';

export interface ModelSelection {
    provider: BaseProvider;
    modelId: string;
    reason: string;
}

export class ModelRouter {
    private providers: Map<ModelProvider, BaseProvider> = new Map();
    private availabilityCache: Map<ModelProvider, { available: boolean; checkedAt: number }> = new Map();
    private readonly AVAILABILITY_CACHE_TTL = 60000;

    constructor() {
        this.initializeProviders();
    }

    private initializeProviders(): void {
        const config = configManager.getConfig();

        if (config.apiKeys.groq) {
            this.providers.set('groq', new GroqProvider(config.apiKeys.groq));
        }

        if (config.apiKeys.deepseek) {
            this.providers.set('deepseek', new DeepSeekProvider(config.apiKeys.deepseek));
        }

        if (config.apiKeys.gemini) {
            this.providers.set('gemini', new GeminiProvider(config.apiKeys.gemini));
        }

        if (config.apiKeys.openai) {
            this.providers.set('openai', new OpenAIProvider(config.apiKeys.openai));
        }

        if (config.enableLocalModels) {
            this.providers.set('ollama', new OllamaProvider(config.ollamaUrl));
            this.providers.set('lmstudio', new LMStudioProvider(config.lmstudioUrl));
        }

        logger.info(`Initialized ${this.providers.size} AI providers`);
    }

    async selectModel(
        capability?: ModelCapability,
        preferFast: boolean = false,
        preferLongContext: boolean = false
    ): Promise<ModelSelection> {
        const config = configManager.getConfig();

        if (config.turboMode) {
            preferFast = true;
        }

        const primaryModelId = config.primaryModel;
        const primaryConfig = getModelConfig(primaryModelId);

        if (primaryConfig) {
            const provider = this.providers.get(primaryConfig.provider);

            if (provider && await this.isProviderAvailable(primaryConfig.provider)) {
                if (!capability || primaryConfig.capabilities.includes(capability)) {
                    return {
                        provider,
                        modelId: primaryModelId,
                        reason: 'Primary model configured by user'
                    };
                }
            }
        }

        if (config.enableAutoFallback) {
            return await this.intelligentSelection(capability, preferFast, preferLongContext);
        }

        throw new Error('Primary model unavailable and auto-fallback is disabled');
    }

    private async intelligentSelection(
        capability?: ModelCapability,
        preferFast: boolean = false,
        preferLongContext: boolean = false
    ): Promise<ModelSelection> {
        let targetModel;

        if (preferLongContext) {
            targetModel = getLongestContextModel(capability);
        } else if (preferFast) {
            targetModel = getFastestModel(capability);
        } else {
            targetModel = getFastestModel(capability);
        }

        const provider = this.providers.get(targetModel.provider);

        if (provider && await this.isProviderAvailable(targetModel.provider)) {
            return {
                provider,
                modelId: targetModel.id,
                reason: preferFast ? 'Fastest available model' :
                    preferLongContext ? 'Longest context available' :
                        'Best balanced model'
            };
        }

        for (const [providerType, providerInstance] of this.providers.entries()) {
            if (await this.isProviderAvailable(providerType)) {
                const modelConfig = getModelConfig(`${providerType}-default`);
                if (modelConfig && (!capability || modelConfig.capabilities.includes(capability))) {
                    return {
                        provider: providerInstance,
                        modelId: modelConfig.id,
                        reason: 'Fallback to available provider'
                    };
                }
            }
        }

        throw new Error('No available AI providers found');
    }

    private async isProviderAvailable(provider: ModelProvider): Promise<boolean> {
        const cached = this.availabilityCache.get(provider);

        if (cached && Date.now() - cached.checkedAt < this.AVAILABILITY_CACHE_TTL) {
            return cached.available;
        }

        const providerInstance = this.providers.get(provider);

        if (!providerInstance) {
            return false;
        }

        try {
            const available = await providerInstance.isAvailable();
            this.availabilityCache.set(provider, {
                available,
                checkedAt: Date.now()
            });
            return available;
        } catch (error) {
            logger.error(`Provider availability check failed for ${provider}`, error as Error);
            return false;
        }
    }

    async generateCompletion(
        request: AIRequest,
        capability?: ModelCapability
    ): Promise<AIResponse> {
        const cacheKey = this.getCacheKey(request);
        const cached = responseCache.get(cacheKey);

        if (cached && configManager.getConfig().cacheEmbeddings) {
            logger.info('Returning cached response');
            return JSON.parse(cached);
        }

        let selection: ModelSelection;

        if (request.model) {
            const modelConfig = getModelConfig(request.model);
            if (!modelConfig) {
                throw new Error(`Invalid model ID: ${request.model}`);
            }

            const provider = this.providers.get(modelConfig.provider);
            if (!provider) {
                throw new Error(`Provider ${modelConfig.provider} not initialized. Please check your API key.`);
            }

            if (!await this.isProviderAvailable(modelConfig.provider)) {
                throw new Error(`Model ${request.model} is currently unavailable. Check your connection or API key.`);
            }

            selection = {
                provider,
                modelId: request.model,
                reason: 'Explicitly requested'
            };
        } else {
            selection = await this.selectModel(
                capability,
                configManager.isTurboMode(),
                request.context && request.context.length > 100
            );
        }

        logger.info(`Selected model: ${selection.modelId} (${selection.reason})`);

        const response = await performanceMonitor.measure(
            `ai-completion-${selection.modelId}`,
            async () => {
                const fullRequest = { ...request, model: selection.modelId };
                return await selection.provider.generateCompletion(fullRequest);
            }
        );

        if (configManager.getConfig().cacheEmbeddings) {
            responseCache.set(cacheKey, JSON.stringify(response));
        }

        return response;
    }

    async streamCompletion(
        request: AIRequest,
        onChunk: (chunk: string) => void,
        capability?: ModelCapability
    ): Promise<AIResponse> {
        const selection = await this.selectModel(
            capability,
            configManager.isTurboMode(),
            request.context && request.context.length > 100
        );

        logger.info(`Streaming with model: ${selection.modelId} (${selection.reason})`);

        const fullRequest = { ...request, model: selection.modelId };
        return await performanceMonitor.measure(
            `ai-stream-${selection.modelId}`,
            async () => {
                return await selection.provider.streamCompletion(fullRequest, onChunk);
            }
        );
    }

    getAvailableProviders(): ModelProvider[] {
        return Array.from(this.providers.keys());
    }

    async getProviderStatus(): Promise<Map<ModelProvider, boolean>> {
        const status = new Map<ModelProvider, boolean>();

        for (const provider of this.providers.keys()) {
            status.set(provider, await this.isProviderAvailable(provider));
        }

        return status;
    }

    refreshProviders(): void {
        this.providers.clear();
        this.availabilityCache.clear();
        this.initializeProviders();
        logger.info('Providers refreshed');
    }

    private getCacheKey(request: AIRequest): string {
        return `${request.prompt}-${request.systemPrompt || ''}-${(request.context || []).join('-')}`;
    }
}

export const modelRouter = new ModelRouter();
