/**
 * AI Model configurations and capabilities
 */

import { ModelConfig, ModelProvider, ModelCapability } from '../types';

export const MODEL_CONFIGS: Record<string, ModelConfig> = {
    // Groq Models (Fast & Free)
    'groq-llama-3.1-70b': {
        id: 'groq-llama-3.1-70b',
        provider: 'groq',
        name: 'LLaMA 3.1 70B',
        contextWindow: 8192,
        capabilities: ['code-generation', 'code-completion', 'explanation', 'refactoring', 'documentation'],
        costPerToken: 0,
        averageLatency: 150,
        isLocal: false,
        requiresApiKey: true
    },
    'groq-mixtral-8x7b': {
        id: 'groq-mixtral-8x7b',
        provider: 'groq',
        name: 'Mixtral 8x7B',
        contextWindow: 32768,
        capabilities: ['code-generation', 'code-review', 'explanation', 'refactoring'],
        costPerToken: 0,
        averageLatency: 180,
        isLocal: false,
        requiresApiKey: true
    },
    'groq-llama-3.1-8b': {
        id: 'groq-llama-3.1-8b',
        provider: 'groq',
        name: 'LLaMA 3.1 8B (Fast)',
        contextWindow: 8192,
        capabilities: ['code-completion', 'explanation'],
        costPerToken: 0,
        averageLatency: 80,
        isLocal: false,
        requiresApiKey: true
    },

    // DeepSeek Models (Code-Specialized & Free)
    'deepseek-coder': {
        id: 'deepseek-coder',
        provider: 'deepseek',
        name: 'DeepSeek Coder',
        contextWindow: 16384,
        capabilities: ['code-generation', 'code-completion', 'code-review', 'refactoring', 'testing'],
        costPerToken: 0,
        averageLatency: 200,
        isLocal: false,
        requiresApiKey: true
    },
    'deepseek-chat': {
        id: 'deepseek-chat',
        provider: 'deepseek',
        name: 'DeepSeek Chat',
        contextWindow: 32768,
        capabilities: ['explanation', 'documentation', 'code-review'],
        costPerToken: 0,
        averageLatency: 220,
        isLocal: false,
        requiresApiKey: true
    },

    // Google Gemini Models (Free Tier)
    'gemini-flash-2.0': {
        id: 'gemini-flash-2.0',
        provider: 'gemini',
        name: 'Gemini 2.0 Flash',
        contextWindow: 1000000,
        capabilities: ['code-generation', 'code-review', 'explanation', 'refactoring', 'documentation', 'image-to-code'],
        costPerToken: 0,
        averageLatency: 250,
        isLocal: false,
        requiresApiKey: true
    },
    'gemini-flash-lite': {
        id: 'gemini-flash-lite',
        provider: 'gemini',
        name: 'Gemini Flash Lite',
        contextWindow: 32768,
        capabilities: ['code-completion', 'explanation'],
        costPerToken: 0,
        averageLatency: 150,
        isLocal: false,
        requiresApiKey: true
    },

    // OpenAI Models (Free Tier)
    'openai-gpt-4o-mini': {
        id: 'openai-gpt-4o-mini',
        provider: 'openai',
        name: 'GPT-4o Mini',
        contextWindow: 128000,
        capabilities: ['code-generation', 'code-review', 'explanation', 'refactoring', 'documentation'],
        costPerToken: 0,
        averageLatency: 300,
        isLocal: false,
        requiresApiKey: true
    },

    // Anthropic Models (Free Tier)
    'claude-haiku': {
        id: 'claude-haiku',
        provider: 'anthropic',
        name: 'Claude Haiku',
        contextWindow: 200000,
        capabilities: ['code-generation', 'code-review', 'explanation', 'refactoring', 'documentation'],
        costPerToken: 0,
        averageLatency: 280,
        isLocal: false,
        requiresApiKey: true
    },

    // Local Models
    'ollama-local': {
        id: 'ollama-local',
        provider: 'ollama',
        name: 'Ollama (Local)',
        contextWindow: 8192,
        capabilities: ['code-generation', 'code-completion', 'explanation'],
        costPerToken: 0,
        averageLatency: 500,
        isLocal: true,
        requiresApiKey: false
    },
    'lmstudio-local': {
        id: 'lmstudio-local',
        provider: 'lmstudio',
        name: 'LM Studio (Local)',
        contextWindow: 8192,
        capabilities: ['code-generation', 'code-completion', 'explanation'],
        costPerToken: 0,
        averageLatency: 500,
        isLocal: true,
        requiresApiKey: false
    }
};

export function getModelConfig(modelId: string): ModelConfig | undefined {
    return MODEL_CONFIGS[modelId];
}

export function getModelsByProvider(provider: ModelProvider): ModelConfig[] {
    return Object.values(MODEL_CONFIGS).filter(m => m.provider === provider);
}

export function getModelsByCapability(capability: ModelCapability): ModelConfig[] {
    return Object.values(MODEL_CONFIGS).filter(m =>
        m.capabilities.includes(capability)
    );
}

export function getFastestModel(capability?: ModelCapability): ModelConfig {
    let models = Object.values(MODEL_CONFIGS);

    if (capability) {
        models = models.filter(m => m.capabilities.includes(capability));
    }

    return models.reduce((fastest, current) =>
        current.averageLatency < fastest.averageLatency ? current : fastest
    );
}

export function getLongestContextModel(capability?: ModelCapability): ModelConfig {
    let models = Object.values(MODEL_CONFIGS);

    if (capability) {
        models = models.filter(m => m.capabilities.includes(capability));
    }

    return models.reduce((longest, current) =>
        current.contextWindow > longest.contextWindow ? current : longest
    );
}

export function getLocalModels(): ModelConfig[] {
    return Object.values(MODEL_CONFIGS).filter(m => m.isLocal);
}

export function getCloudModels(): ModelConfig[] {
    return Object.values(MODEL_CONFIGS).filter(m => !m.isLocal);
}

export function getAllModelIds(): string[] {
    return Object.keys(MODEL_CONFIGS);
}
