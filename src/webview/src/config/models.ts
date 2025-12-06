export interface ModelConfig {
    value: string;
    label: string;
    badge: 'Recommended' | 'Fast' | 'Coding' | 'Advanced' | 'Local' | 'Vision' | null;
    provider: | 'groq' | 'deepseek' | 'google' | 'openai' | 'anthropic' | 'xai' | 'ollama' | 'lmstudio';
    apiKeyRequired: boolean;
    supportsVision: boolean; 
    supportsImageGeneration: boolean; 
}

export const AVAILABLE_MODELS: readonly ModelConfig[] = [
    {
        value: 'gpt-4o-mini',
        label: 'GPT-4o Mini',
        badge: 'Recommended',
        provider: 'openai',
        apiKeyRequired: true,
        supportsVision: true,
        supportsImageGeneration: false, 
    },
    {
        value: 'gpt-4.1',
        label: 'GPT-4.1',
        badge: 'Advanced',
        provider: 'openai',
        apiKeyRequired: true,
        supportsVision: true, // GPT-4.1 supports vision
        supportsImageGeneration: false,
    },
    {
        value: 'gemini-pro',
        label: 'Gemini 2.0 Pro (Free)',
        badge: 'Vision',
        provider: 'google',
        apiKeyRequired: true,
        supportsVision: true, // Gemini supports vision
        supportsImageGeneration: true, // Gemini can generate images via Imagen
    },
    {
        value: 'claude-haiku',
        label: 'Claude Haiku',
        badge: null,
        provider: 'anthropic',
        apiKeyRequired: true,
        supportsVision: true, // Claude 3 Haiku supports vision
        supportsImageGeneration: false,
    },
    {
        value: 'deepseek-coder',
        label: 'DeepSeek Coder',
        badge: 'Coding',
        provider: 'deepseek',
        apiKeyRequired: true,
        supportsVision: false, // DeepSeek Coder is text-only
        supportsImageGeneration: false,
    },
    {
        value: 'deepseek-chat',
        label: 'DeepSeek Chat',
        badge: null,
        provider: 'deepseek',
        apiKeyRequired: true,
        supportsVision: false, // DeepSeek Chat is text-only
        supportsImageGeneration: false,
    },
    {
        value: 'llama-3.1-8b-instant',
        label: 'Groq LLaMA 3.1 8B (Free)',
        badge: 'Fast',
        provider: 'groq',
        apiKeyRequired: true,
        supportsVision: false, // LLaMA 3.1 8B doesn't support vision
        supportsImageGeneration: false,
    },
    {
        value: 'ollama-local',
        label: 'Ollama (Local)',
        badge: 'Local',
        provider: 'ollama',
        apiKeyRequired: false,
        supportsVision: false, // Depends on model, default to false
        supportsImageGeneration: false,
    },
    {
        value: 'lmstudio-local',
        label: 'LM Studio (Local)',
        badge: 'Local',
        provider: 'lmstudio',
        apiKeyRequired: false,
        supportsVision: false, // Depends on model, default to false
        supportsImageGeneration: false,
    }
] as const;

export const DEFAULT_MODEL = 'gemini-pro';

export const getModelLabel = (modelValue: string): string => {
    return AVAILABLE_MODELS.find(m => m.value === modelValue)?.label || 'Select Model';
};

export const getModelConfig = (modelValue: string): ModelConfig | undefined => {
    return AVAILABLE_MODELS.find(m => m.value === modelValue);
};

export const modelSupportsVision = (modelValue: string): boolean => {
    return AVAILABLE_MODELS.find(m => m.value === modelValue)?.supportsVision ?? false;
};

export const modelSupportsImageGeneration = (modelValue: string): boolean => {
    return AVAILABLE_MODELS.find(m => m.value === modelValue)?.supportsImageGeneration ?? false;
};
