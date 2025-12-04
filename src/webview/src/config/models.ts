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
        label: 'Gemini Pro',
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
        value: 'groq-llama-3.1-70b',
        label: 'LLaMA 3.1 70B',
        badge: 'Fast',
        provider: 'groq',
        apiKeyRequired: true,
    },
    {
        value: 'groq-mixtral-8x7b',
        label: 'Mixtral 8x7B',
        badge: null,
        provider: 'groq',
        apiKeyRequired: true,
    },
    {
        value: 'groq-llama-3.1-8b',
        label: 'LLaMA 3.1 8B',
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
