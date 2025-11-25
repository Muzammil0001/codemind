import React, { createContext, useState, useCallback, type ReactNode } from 'react';

export interface Message {
    role: 'user' | 'ai';
    content: string;
    id: string;
}

export interface ChatSession {
    id: string;
    title: string;
    timestamp: number;
    messages: Message[];
    preview: string;
}

interface ChatContextType {
    messages: Message[];
    setMessages: React.Dispatch<React.SetStateAction<Message[]>>;
    chatSessions: ChatSession[];
    setChatSessions: React.Dispatch<React.SetStateAction<ChatSession[]>>;
    loading: boolean;
    setLoading: (loading: boolean) => void;
    agentStatus: 'idle' | 'thinking' | 'planning' | 'executing';
    setAgentStatus: (status: 'idle' | 'thinking' | 'planning' | 'executing') => void;
    currentSessionId: string | null;
    setCurrentSessionId: (id: string | null) => void;
    clearMessages: () => void;
}

export const ChatContext = createContext<ChatContextType | undefined>(undefined);

export const ChatProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [chatSessions, setChatSessions] = useState<ChatSession[]>([]);
    const [loading, setLoading] = useState(false);
    const [agentStatus, setAgentStatus] = useState<'idle' | 'thinking' | 'planning' | 'executing'>('idle');
    const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);

    const clearMessages = useCallback(() => {
        setMessages([]);
        setCurrentSessionId(null);
    }, []);

    return (
        <ChatContext.Provider value={{
            messages,
            setMessages,
            chatSessions,
            setChatSessions,
            loading,
            setLoading,
            agentStatus,
            setAgentStatus,
            currentSessionId,
            setCurrentSessionId,
            clearMessages
        }}>
            {children}
        </ChatContext.Provider>
    );
};
