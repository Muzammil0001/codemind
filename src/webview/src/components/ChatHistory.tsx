import React, { useEffect, useRef } from 'react';
import { Message } from './Message';
import { StatusIndicator } from './StatusIndicator';
import { Brain, History, Plus, Settings } from 'lucide-react';

type AgentStatus = 'idle' | 'thinking' | 'planning' | 'running' | 'executing';

interface ChatHistoryProps {
    messages: Array<{ role: 'user' | 'ai'; content: string, commandId?: string }>;
    agentStatus: AgentStatus;
    onEdit: (index: number) => void;
    onHistoryClick?: () => void;
    onSettingsClick?: () => void;
    onNewChat?: () => void;
}

export const ChatHistory: React.FC<ChatHistoryProps & { children?: React.ReactNode }> = ({ messages, agentStatus, onEdit, onHistoryClick, onSettingsClick, onNewChat, children }) => {
    const bottomRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, children]);

    return (
        <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-500/5 via-transparent to-transparent pointer-events-none" />

            <div className="sticky top-0 z-10 backdrop-blur-xl bg-zinc-950/80 border-b border-zinc-800/50">
                <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-2 sm:py-3 md:py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 sm:gap-3">
                            <div className="relative">
                                <div className="absolute inset-0 bg-blue-500 blur-xl opacity-30 animate-pulse" />
                                <div className="relative w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br from-blue-500 via-blue-600 to-indigo-600 flex items-center justify-center shadow-lg">
                                    <Brain size={20} className="text-white sm:w-6 sm:h-6" />
                                </div>
                            </div>
                            <div>
                                <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-white">
                                    CodeMind AI
                                </h1>
                                <p className="text-xs sm:text-sm text-zinc-400 font-medium">
                                    Intelligent code assistant powered by AI
                                </p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={onNewChat}
                                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                title="New Chat"
                            >
                                <Plus size={20} />
                            </button>
                            <button
                                onClick={onHistoryClick}
                                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                title="Chat History"
                            >
                                <History size={20} />
                            </button>
                            <button
                                onClick={onSettingsClick}
                                className="p-2 text-zinc-400 hover:text-white hover:bg-zinc-800 rounded-lg transition-colors"
                                title="Settings"
                            >
                                <Settings size={20} />
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-3 sm:px-4 md:px-6 py-4 sm:py-6 md:py-8 space-y-4 sm:space-y-6">
                {messages.map((msg, index) => (
                    <Message key={index} role={msg.role} content={msg.content} messageIndex={index} onEdit={onEdit} commandId={msg.commandId} />
                ))}
                {agentStatus !== 'idle' && (
                    <StatusIndicator status={agentStatus} />
                )}
                {children}
                <div ref={bottomRef} />
            </div>
        </div>
    );
};
