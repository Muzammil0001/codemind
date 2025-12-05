import React from 'react';
import { ChevronDown, AlertTriangle } from 'lucide-react';
import { AVAILABLE_MODELS, getModelLabel } from '../config/models';
import { useModelStore } from '../stores/modelStore';

interface ModelSelectorProps {
    selectedModel: string;
    onModelSelect: (model: string) => void;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ selectedModel, onModelSelect }) => {
    const [showDropdown, setShowDropdown] = React.useState(false);
    const providerStatus = useModelStore(state => state.providerStatus);

    const isModelAvailable = (provider: string) => {
        if (provider === 'ollama' || provider === 'lmstudio') return true;
        return providerStatus.get(provider) !== false;
    };

    return (
        <div className="relative">
            <button
                onClick={() => setShowDropdown(!showDropdown)}
                className="flex items-center gap-2 px-3 py-2 bg-zinc-800/50 hover:bg-zinc-700/50 text-xs text-zinc-300 outline-none cursor-pointer rounded-lg border border-zinc-700/50 hover:border-zinc-600 transition-all duration-200 font-medium"
            >
                <span className="max-w-[120px] truncate">
                    {getModelLabel(selectedModel)}
                </span>
                <ChevronDown size={14} className={`transition-transform ${showDropdown ? 'rotate-180' : ''}`} />
            </button>

            {showDropdown && (
                <div className="absolute bottom-full mb-2 left-0 bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl z-50 min-w-[280px] backdrop-blur-xl max-h-[400px] overflow-y-auto">
                    {AVAILABLE_MODELS.map((model, index) => {
                        const available = isModelAvailable(model.provider);
                        const isPaidAndMissingKey = !available && model.apiKeyRequired;

                        return (
                            <button
                                key={model.value}
                                disabled={!available}
                                onClick={() => {
                                    if (available) {
                                        onModelSelect(model.value);
                                        setShowDropdown(false);
                                    }
                                }}
                                className={`w-full text-left px-4 py-2.5 text-sm transition-all duration-150 flex items-center justify-between group ${selectedModel === model.value
                                    ? 'bg-blue-600 text-white'
                                    : !available
                                        ? 'opacity-50 cursor-not-allowed bg-zinc-900/50'
                                        : 'text-zinc-300 hover:bg-zinc-800'
                                    } ${index === 0 ? 'rounded-t-lg' : ''} ${index === AVAILABLE_MODELS.length - 1 ? 'rounded-b-lg' : ''}`}
                            >
                                <div className="flex flex-col gap-0.5">
                                    <div className="flex items-center gap-2">
                                        <span>{model.label}</span>
                                        {!available && (
                                            <AlertTriangle size={12} className="text-yellow-500" />
                                        )}
                                    </div>
                                    {!available && (
                                        <span className="text-[10px] text-yellow-500/80">
                                            {isPaidAndMissingKey ? 'API Key Required' : 'Unavailable'}
                                        </span>
                                    )}
                                </div>

                                {model.badge && available && (
                                    <span className={`text-xs px-2 py-0.5 rounded ${selectedModel === model.value
                                        ? 'bg-white/20'
                                        : model.badge === 'Recommended'
                                            ? 'bg-blue-500/20 text-blue-400'
                                            : model.badge === 'Fast'
                                                ? 'bg-green-500/20 text-green-400'
                                                : 'bg-purple-500/20 text-purple-400'
                                        }`}>
                                        {model.badge}
                                    </span>
                                )}
                            </button>
                        )
                    })}
                </div>
            )}
        </div>
    );
};
