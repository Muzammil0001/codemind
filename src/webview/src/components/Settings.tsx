

import { ArrowLeft, Settings as SettingsIcon, Eye, EyeOff } from 'lucide-react';
import { useState, useEffect } from 'react';
import { useVSCode } from '../hooks/useVSCode';
import { AVAILABLE_MODELS, DEFAULT_MODEL } from '../config/models';

interface SettingsProps {
    onBack: () => void;
}

interface ConfigSettings {
    primaryModel: string;
    turboMode: boolean;
    enableAutoFallback: boolean;
    cacheEmbeddings: boolean;
    enableLocalModels: boolean;
    apiKeys: {
        groq: string;
        deepseek: string;
        gemini: string;
        openai: string;
        anthropic: string;
    };
}

export const Settings: React.FC<SettingsProps> = ({ onBack }) => {
    const { postMessage } = useVSCode();
    const [settings, setSettings] = useState<ConfigSettings>({
        primaryModel: DEFAULT_MODEL,
        turboMode: false,
        enableAutoFallback: true,
        cacheEmbeddings: true,
        enableLocalModels: false,
        apiKeys: {
            groq: '',
            deepseek: '',
            gemini: '',
            openai: '',
            anthropic: ''
        }
    });

    const [showApiKeys, setShowApiKeys] = useState<Record<keyof typeof settings.apiKeys, boolean>>({
        groq: false,
        deepseek: false,
        gemini: false,
        openai: false,
        anthropic: false
    });

    useEffect(() => {
        postMessage({ type: 'getSettings' });

        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            if (message.type === 'currentSettings') {
                setSettings(prev => ({
                    ...prev,
                    ...message.data
                }));
            }
        };

        window.addEventListener('message', handleMessage);
        return () => window.removeEventListener('message', handleMessage);
    }, [postMessage]);

    const handleSave = () => {
        postMessage({
            type: 'updateSettings',
            settings: {
                primaryModel: settings.primaryModel,
                turboMode: settings.turboMode,
                enableAutoFallback: settings.enableAutoFallback,
                cacheEmbeddings: settings.cacheEmbeddings,
                enableLocalModels: settings.enableLocalModels,
                apiKeys: settings.apiKeys
            }
        });
        onBack();
    };

    const handleAPIKeyChange = (provider: keyof typeof settings.apiKeys, value: string) => {
        setSettings(prev => ({
            ...prev,
            apiKeys: {
                ...prev.apiKeys,
                [provider]: value
            }
        }));
    };

    const toggleApiKeyVisibility = (provider: keyof typeof settings.apiKeys) => {
        setShowApiKeys(prev => ({
            ...prev,
            [provider]: !prev[provider]
        }));
    };

    return (
        <div className="flex flex-col h-full bg-zinc-950 text-zinc-100">
            <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky top-0 z-10">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-500/10 rounded-lg">
                        <SettingsIcon size={20} className="text-blue-400" />
                    </div>
                    <div>
                        <h2 className="text-lg font-semibold text-white">Settings</h2>
                        <p className="text-xs text-zinc-400">Configure CodeMind AI</p>
                    </div>
                </div>
                <button
                    onClick={onBack}
                    className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                >
                    <ArrowLeft size={20} />
                </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-8 max-w-3xl mx-auto w-full">
                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800 pb-2">Model Configuration</h3>

                    <div>
                        <label className="block text-xs text-zinc-400 mb-2">Primary Model</label>
                        <select
                            value={settings.primaryModel}
                            onChange={(e) => setSettings({ ...settings, primaryModel: e.target.value })}
                            className="w-full px-3 py-2 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                            {AVAILABLE_MODELS.map(model => (
                                <option key={model.value} value={model.value}>
                                    {model.label}
                                    {model.badge ? ` (${model.badge})` : ''}
                                </option>
                            ))}
                        </select>
                        <p className="text-xs text-zinc-500 mt-1">
                            Current: {AVAILABLE_MODELS.find(m => m.value === settings.primaryModel)?.label || 'None'}
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex items-start gap-3 cursor-pointer p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={settings.turboMode}
                                onChange={(e) => setSettings({ ...settings, turboMode: e.target.checked })}
                                className="mt-1 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
                            />
                            <div>
                                <span className="text-sm text-zinc-300 font-medium">Turbo Mode</span>
                                <p className="text-xs text-zinc-500 mt-0.5">Prefer faster models for quick responses</p>
                            </div>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={settings.enableAutoFallback}
                                onChange={(e) => setSettings({ ...settings, enableAutoFallback: e.target.checked })}
                                className="mt-1 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
                            />
                            <div>
                                <span className="text-sm text-zinc-300 font-medium">Auto Fallback</span>
                                <p className="text-xs text-zinc-500 mt-0.5">Automatically use alternative models if primary fails</p>
                            </div>
                        </label>
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800 pb-2">API Keys</h3>
                    <p className="text-xs text-zinc-500">Configure API keys for different providers. Changes require extension reload.</p>

                    <div className="space-y-3">
                        {(['gemini', 'openai', 'anthropic', 'deepseek', 'groq'] as const).map((provider) => (
                            <div key={provider}>
                                <label className="block text-xs text-zinc-400 mb-2 capitalize">
                                    {provider === 'gemini' ? 'Google Gemini' :
                                        provider === 'openai' ? 'OpenAI' :
                                            provider === 'anthropic' ? 'Anthropic (Claude)' :
                                                provider === 'deepseek' ? 'DeepSeek' :
                                                    'Groq'} API Key
                                </label>
                                <div className="relative">
                                    <input
                                        type={showApiKeys[provider] ? 'text' : 'password'}
                                        value={settings.apiKeys[provider]}
                                        onChange={(e) => handleAPIKeyChange(provider, e.target.value)}
                                        placeholder={`Enter ${provider} API key...`}
                                        className="w-full px-3 py-2 pr-10 bg-zinc-900 border border-zinc-700 rounded-lg text-sm text-white placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                    <button
                                        type="button"
                                        onClick={() => toggleApiKeyVisibility(provider)}
                                        className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-zinc-400 hover:text-white transition-colors"
                                        aria-label={showApiKeys[provider] ? 'Hide API key' : 'Show API key'}
                                    >
                                        {showApiKeys[provider] ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <h3 className="text-sm font-semibold text-zinc-300 border-b border-zinc-800 pb-2">Performance</h3>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <label className="flex items-start gap-3 cursor-pointer p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={settings.cacheEmbeddings}
                                onChange={(e) => setSettings({ ...settings, cacheEmbeddings: e.target.checked })}
                                className="mt-1 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
                            />
                            <div>
                                <span className="text-sm text-zinc-300 font-medium">Cache Responses</span>
                                <p className="text-xs text-zinc-500 mt-0.5">Cache AI responses for faster repeated queries</p>
                            </div>
                        </label>

                        <label className="flex items-start gap-3 cursor-pointer p-3 bg-zinc-900/50 rounded-lg border border-zinc-800/50 hover:border-zinc-700 transition-colors">
                            <input
                                type="checkbox"
                                checked={settings.enableLocalModels}
                                onChange={(e) => setSettings({ ...settings, enableLocalModels: e.target.checked })}
                                className="mt-1 w-4 h-4 rounded border-zinc-600 bg-zinc-800 text-blue-500 focus:ring-2 focus:ring-blue-500"
                            />
                            <div>
                                <span className="text-sm text-zinc-300 font-medium">Enable Local Models</span>
                                <p className="text-xs text-zinc-500 mt-0.5">Use Ollama or LM Studio for local inference</p>
                            </div>
                        </label>
                    </div>
                </div>
            </div>

            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800 bg-zinc-900/50 backdrop-blur-sm sticky bottom-0">
                <button
                    onClick={onBack}
                    className="px-4 py-2 text-sm text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                >
                    Cancel
                </button>
                <button
                    onClick={handleSave}
                    className="px-4 py-2 text-sm bg-blue-500 hover:bg-blue-600 text-white rounded-lg transition-colors shadow-lg shadow-blue-500/20"
                >
                    Save Changes
                </button>
            </div>
        </div>
    );
};
