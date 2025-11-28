import React, { useState, useRef, useEffect } from 'react';
import { SuggestionPopup } from './SuggestionPopup';
import { AttachedFiles } from './AttachedFiles';
import { ModelSelector } from './ModelSelector';
import { FileAttachmentButtons } from './FileAttachmentButtons';
import { SendStopButton } from './SendStopButton';
import { ChatTextArea } from './ChatTextArea';
import { DEFAULT_MODEL } from '../config/models';

export interface AttachedItem {
    id: string;
    name: string;
    type: 'file' | 'image';
    data?: string;
}

interface InputAreaProps {
    onSend: (text: string, files: AttachedItem[]) => void;
    onStop: () => void;
    availableFiles: Array<{ path: string; type: 'file' | 'directory' }>;
    onModelSelect: (model: string) => void;
    isLoading?: boolean;
    editingMessage?: string;
    onEditComplete?: () => void;
}

export const InputArea: React.FC<InputAreaProps> = ({
    onSend,
    onStop,
    availableFiles,
    onModelSelect,
    isLoading = false,
    editingMessage,
    onEditComplete
}) => {
    const [input, setInput] = useState('');
    const [attachedFiles, setAttachedFiles] = useState<AttachedItem[]>([]);
    const [suggestions, setSuggestions] = useState<Array<{ text: string; type: 'file' | 'directory' | 'command' }>>([]);
    const [showSuggestions, setShowSuggestions] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL);

    const fileInputRef = useRef<HTMLInputElement>(null);
    const imageInputRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        if (editingMessage) {
            setInput(editingMessage);
            onEditComplete?.();
        }
    }, [editingMessage, onEditComplete]);

    const handleInputChange = (value: string) => {
        setInput(value);

        const cursorPosition = value.length;
        const textBeforeCursor = value.substring(0, cursorPosition);

        const atMatch = textBeforeCursor.match(/@([\w\-\.\/]*)$/);
        if (atMatch) {
            const query = atMatch[1].toLowerCase();

            const matches = availableFiles
                .filter((item) => {
                    const itemPath = item.path.toLowerCase();
                    const fileName = item.path.split('/').pop()?.toLowerCase() || '';

                    return itemPath.includes(query) || fileName.includes(query);
                })
                .slice(0, 10)
                .map((item) => ({
                    text: item.path,
                    type: item.type === 'directory' ? 'directory' as const : 'file' as const
                }));

            if (matches.length > 0) {
                setSuggestions(matches);
                setShowSuggestions(true);
                setSelectedIndex(0);
                return;
            }
        }

        const slashMatch = textBeforeCursor.match(/^\/(\w*)$/);
        if (slashMatch) {
            const query = slashMatch[1].toLowerCase();
            const commands = ['explain', 'refactor', 'test', 'doc', 'review', 'optimize'];
            const matches = commands
                .filter((c) => c.startsWith(query))
                .map((c) => ({ text: c, type: 'command' as const }));

            if (matches.length > 0) {
                setSuggestions(matches);
                setShowSuggestions(true);
                setSelectedIndex(0);
                return;
            }
        }

        setShowSuggestions(false);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (showSuggestions) {
            if (e.key === 'ArrowDown') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev + 1) % suggestions.length);
            } else if (e.key === 'ArrowUp') {
                e.preventDefault();
                setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
            } else if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                selectSuggestion(suggestions[selectedIndex]);
            } else if (e.key === 'Escape') {
                setShowSuggestions(false);
            }
            return;
        }

        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSend();
        }
    };

    const selectSuggestion = (suggestion: { text: string; type: 'file' | 'directory' | 'command' }) => {
        let newText = input;

        if (suggestion.type === 'file' || suggestion.type === 'directory') {
            newText = input.replace(/@([\w\-\.\/]*)$/, '@' + suggestion.text + ' ');
            if (suggestion.type === 'file' && !attachedFiles.find(f => f.name === suggestion.text)) {
                setAttachedFiles(prev => [...prev, {
                    id: Date.now().toString() + Math.random(),
                    name: suggestion.text,
                    type: 'file'
                }]);
            }
        } else {
            newText = input.replace(/^\/(\w*)$/, '/' + suggestion.text + ' ');
        }

        setInput(newText);
        setShowSuggestions(false);
    };

    const handleSend = () => {
        if (!input.trim() && attachedFiles.length === 0) return;
        onSend(input, attachedFiles);
        setInput('');
        setAttachedFiles([]);
    };

    const handleFileSelect = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        for (let file of Array.from(files)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const fileContent = e.target?.result as string;
                setAttachedFiles(prev => [...prev, {
                    id: Date.now().toString() + Math.random(),
                    name: file.name,
                    type: 'file',
                    data: fileContent
                }]);
            };
            reader.readAsText(file);
        }
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        if (!files) return;

        for (let file of Array.from(files)) {
            const reader = new FileReader();
            reader.onload = (e) => {
                const imageData = e.target?.result as string;
                setAttachedFiles(prev => [...prev, {
                    id: Date.now().toString() + Math.random(),
                    name: file.name,
                    type: 'image',
                    data: imageData
                }]);
            };
            reader.readAsDataURL(file);
        }
        if (imageInputRef.current) imageInputRef.current.value = '';
    };

    const handleImagePaste = (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
        const items = event.clipboardData?.items;
        if (!items) return;

        for (let item of Array.from(items)) {
            if (item.type.indexOf('image') !== -1) {
                const file = item.getAsFile();
                if (file) {
                    const reader = new FileReader();
                    reader.onload = (e) => {
                        const imageData = e.target?.result as string;
                        setAttachedFiles(prev => [...prev, {
                            id: Date.now().toString() + Math.random(),
                            name: file.name || `image-${Date.now()}`,
                            type: 'image',
                            data: imageData
                        }]);
                    };
                    reader.readAsDataURL(file);
                    event.preventDefault();
                }
            }
        }
    };

    const removeFile = (id: string) => {
        setAttachedFiles((prev) => prev.filter((f) => f.id !== id));
    };

    const handleModelChange = (model: string) => {
        setSelectedModel(model);
        onModelSelect(model);
    };

    return (
        <div className="border-t border-zinc-800/50 bg-gradient-to-b from-zinc-950 to-black backdrop-blur-xl sticky bottom-0">
            <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-3 sm:py-4 md:py-6">
                <div className="relative">
                    <SuggestionPopup
                        isVisible={showSuggestions}
                        suggestions={suggestions}
                        selectedIndex={selectedIndex}
                        onSelect={selectSuggestion}
                    />

                    <div className="relative bg-zinc-900/80 border border-zinc-800 rounded-2xl shadow-2xl transition-all duration-200 backdrop-blur-sm">
                        {attachedFiles.length > 0 && (
                            <AttachedFiles files={attachedFiles} onRemove={removeFile} />
                        )}
                        <div className="p-4">
                            <ChatTextArea
                                value={input}
                                onChange={handleInputChange}
                                onKeyDown={handleKeyDown}
                                onPaste={handleImagePaste}
                                disabled={isLoading}
                            />
                        </div>

                        <div className="flex justify-between items-center px-4 pb-4 pt-2 border-t border-zinc-800/50">
                            <div className="flex items-center gap-1">
                                <FileAttachmentButtons
                                    onFileClick={() => fileInputRef.current?.click()}
                                    onImageClick={() => imageInputRef.current?.click()}
                                />

                                <ModelSelector
                                    selectedModel={selectedModel}
                                    onModelSelect={handleModelChange}
                                />
                            </div>

                            <SendStopButton
                                isLoading={isLoading}
                                disabled={!input.trim() && attachedFiles.length === 0}
                                onSend={handleSend}
                                onStop={onStop}
                            />
                        </div>
                    </div>

                    <div className="mt-3 text-center">
                        <p className="text-[8px] lg:text-xs text-zinc-500">
                            CodeMind AI can make mistakes. Consider checking important information.
                        </p>
                    </div>
                </div>
            </div>

            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept=".js,.ts,.jsx,.tsx,.py,.java,.go,.rs,.c,.cpp,.rb,.php,.html,.css,.json,.xml,.sql,.sh,.txt,.md"
                onChange={handleFileSelect}
                className="hidden"
            />

            <input
                ref={imageInputRef}
                type="file"
                multiple
                accept="image/*"
                onChange={handleImageSelect}
                className="hidden"
            />
        </div>
    );
};
