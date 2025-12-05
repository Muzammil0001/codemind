export interface ModelConfig {
    value: string;
    label: string;
    badge: 'Recommended' | 'Fast' | 'Coding' | 'Advanced' | 'Local' | null;
    provider: | 'groq' | 'deepseek' | 'google' | 'openai' | 'anthropic' | 'xai' | 'ollama' | 'lmstudio';
    apiKeyRequired: boolean;
}

export const AVAILABLE_MODELS: readonly ModelConfig[] = [
    {
        value: 'gpt-4o-mini',
        label: 'GPT-4o Mini',
        badge: 'Recommended',
        provider: 'openai',
        apiKeyRequired: true,
    },
    {
        value: 'gpt-4.1',
        label: 'GPT-4.1',
        badge: 'Advanced',
        provider: 'openai',
        apiKeyRequired: true,
    },
    {
        value: 'gemini-pro',
        label: 'Gemini 2.0 Pro (Free)',
        badge: null,
        provider: 'google',
        apiKeyRequired: true,
    },
    {
        value: 'claude-haiku',
        label: 'Claude Haiku',
        badge: null,
        provider: 'anthropic',
        apiKeyRequired: true,
    },
    {
        value: 'deepseek-coder',
        label: 'DeepSeek Coder',
        badge: 'Coding',
        provider: 'deepseek',
        apiKeyRequired: true,
    },
    {
        value: 'deepseek-chat',
        label: 'DeepSeek Chat',
        badge: null,
        provider: 'deepseek',
        apiKeyRequired: true,
    },
    {
        value: 'llama-3.1-8b-instant',
        label: 'Groq LLaMA 3.1 8B (Free)',
        badge: 'Fast',
        provider: 'groq',
        apiKeyRequired: true,
    },
    {
        value: 'ollama-local',
        label: 'Ollama (Local)',
        badge: 'Local',
        provider: 'ollama',
        apiKeyRequired: false,
    },
    {
        value: 'lmstudio-local',
        label: 'LM Studio (Local)',
        badge: 'Local',
        provider: 'lmstudio',
        apiKeyRequired: false,
    }
] as const;

export const DEFAULT_MODEL = 'gemini-pro';

export const getModelLabel = (modelValue: string): string => {
    return AVAILABLE_MODELS.find(m => m.value === modelValue)?.label || 'Select Model';
};

export const getModelConfig = (modelValue: string): ModelConfig | undefined => {
    return AVAILABLE_MODELS.find(m => m.value === modelValue);
};
