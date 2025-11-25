export interface ModelConfig {
    value: string;
    label: string;
    badge: 'Recommended' | 'Fast' | 'Coding' | null;
    provider: 'openai' | 'google' | 'anthropic' | 'deepseek' | 'groq';
    apiKeyRequired: boolean;
}

export const AVAILABLE_MODELS: readonly ModelConfig[] = [
    {
        value: 'chatgpt-4o',
        label: 'GPT-4o',
        badge: 'Recommended',
        provider: 'openai',
        apiKeyRequired: true,
    },
    {
        value: 'chatgpt-3.5',
        label: 'GPT-3.5',
        badge: null,
        provider: 'openai',
        apiKeyRequired: true,
    },
    // {
    //     value: 'gemini-flash',
    //     label: 'Gemini 2.5 Flash',
    //     badge: 'Fast',
    //     provider: 'google',
    //     apiKeyRequired: true,
    // },
    {
        value: 'gemini-pro',
        label: 'Gemini 2.0 Pro',
        badge: null,
        provider: 'google',
        apiKeyRequired: true,
    },
    {
        value: 'claude-sonnet',
        label: 'Claude 3.5 Sonnet',
        badge: null,
        provider: 'anthropic',
        apiKeyRequired: true,
    },
    {
        value: 'deepseek-coder',
        label: 'DeepSeek V3',
        badge: 'Coding',
        provider: 'deepseek',
        apiKeyRequired: true,
    },
    {
        value: 'groq-llama-3.1-70b',
        label: 'Groq Llama 3.1 70B',
        badge: null,
        provider: 'groq',
        apiKeyRequired: true,
    },
] as const;

export const DEFAULT_MODEL = 'gemini-pro';

export const getModelLabel = (modelValue: string): string => {
    return AVAILABLE_MODELS.find(m => m.value === modelValue)?.label || 'Select Model';
};

export const getModelConfig = (modelValue: string): ModelConfig | undefined => {
    return AVAILABLE_MODELS.find(m => m.value === modelValue);
};
