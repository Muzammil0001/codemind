import React from 'react';
import { File, Folder, Zap } from 'lucide-react';

interface Suggestion {
    text: string;
    type: 'file' | 'directory' | 'command';
}

interface SuggestionPopupProps {
    isVisible: boolean;
    suggestions: Suggestion[];
    selectedIndex: number;
    onSelect: (suggestion: Suggestion) => void;
}

export const SuggestionPopup: React.FC<SuggestionPopupProps> = ({
    isVisible,
    suggestions,
    selectedIndex,
    onSelect,
}) => {
    if (!isVisible || suggestions.length === 0) return null;

    return (
        <div className="absolute bottom-full left-0 right-0 mb-2 bg-zinc-900 border border-zinc-800 rounded-xl shadow-2xl overflow-hidden z-50 backdrop-blur-xl">
            <div className="max-h-64 overflow-y-auto">
                {suggestions.map((suggestion, index) => (
                    <div
                        key={index}
                        className={`flex items-center gap-3 px-4 py-3 cursor-pointer text-sm transition-all duration-150 ${index === selectedIndex
                            ? 'bg-blue-600 text-white'
                            : 'text-zinc-300 hover:bg-zinc-800'
                            }`}
                        onClick={() => onSelect(suggestion)}
                    >
                        <div className={`flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center ${index === selectedIndex
                            ? 'bg-white/20'
                            : suggestion.type === 'file'
                                ? 'bg-blue-500/10 text-blue-400'
                                : suggestion.type === 'directory'
                                    ? 'bg-yellow-500/10 text-yellow-400'
                                    : 'bg-purple-500/10 text-purple-400'
                            }`}>
                            {suggestion.type === 'file' ? (
                                <File size={16} />
                            ) : suggestion.type === 'directory' ? (
                                <Folder size={16} />
                            ) : (
                                <Zap size={16} />
                            )}
                        </div>
                        <span className="flex-1 font-medium truncate">{suggestion.text}</span>
                        {suggestion.type === 'command' && (
                            <span className={`text-xs px-2 py-0.5 rounded ${index === selectedIndex ? 'bg-white/20' : 'bg-zinc-800 text-zinc-400'
                                }`}>
                                Command
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
};
