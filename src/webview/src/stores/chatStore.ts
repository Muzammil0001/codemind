import { create } from 'zustand';

export interface Message {
    id: string;
    role: 'user' | 'ai' | 'system';
    content: string;
    timestamp: number;
    commandId?: string;
    context?: {
        files?: string[];
        selection?: string;
    };
}

export interface ChatSession {
    id: string;
    title: string;
    messages: Message[];
    timestamp: number; // Changed from createdAt for compatibility
    preview: string;   // Added for compatibility
    updatedAt: number;
}

interface ChatState {
    sessions: ChatSession[];
    currentSessionId: string | null;
    messages: Message[];
    isLoading: boolean;
    error: string | null;

    // Actions
    addMessage: (message: Omit<Message, 'id' | 'timestamp'>) => string;
    updateMessageCommandId: (messageId: string, commandId: string) => void;
    setMessages: (messages: Message[]) => void;
    sliceMessages: (index: number) => void;
    setSessions: (sessions: ChatSession[]) => void;
    setLoading: (loading: boolean) => void;
    setError: (error: string | null) => void;
    createSession: () => void;
    switchSession: (sessionId: string) => void;
    deleteSession: (sessionId: string) => void;
    clearMessages: () => void;
}

export const useChatStore = create<ChatState>((set, get) => ({
    sessions: [],
    currentSessionId: null,
    messages: [],
    isLoading: false,
    error: null,

    addMessage: (message) => {
        const newMessage: Message = {
            ...message,
            id: Date.now().toString(),
            timestamp: Date.now()
        };

        set((state) => {
            const updatedMessages = [...state.messages, newMessage];

            // Update current session if exists
            let updatedSessions = state.sessions;
            if (state.currentSessionId) {
                updatedSessions = state.sessions.map(s =>
                    s.id === state.currentSessionId
                        ? {
                            ...s,
                            messages: updatedMessages,
                            updatedAt: Date.now(),
                            preview: updatedMessages[updatedMessages.length - 1].content.slice(0, 50)
                        }
                        : s
                );
            }

            return {
                messages: updatedMessages,
                sessions: updatedSessions
            };
        });

        return newMessage.id;
    },

    updateMessageCommandId: (messageId, commandId) => {
        set((state) => {
            const updatedMessages = state.messages.map(msg =>
                msg.id === messageId
                    ? { ...msg, commandId }
                    : msg
            );

            // Update current session if exists
            let updatedSessions = state.sessions;
            if (state.currentSessionId) {
                updatedSessions = state.sessions.map(s =>
                    s.id === state.currentSessionId
                        ? { ...s, messages: updatedMessages }
                        : s
                );
            }

            return {
                messages: updatedMessages,
                sessions: updatedSessions
            };
        });
    },

    setMessages: (messages) => set({ messages }),

    sliceMessages: (index) => set((state) => ({
        messages: state.messages.slice(0, index)
    })),

    setSessions: (sessions) => set({ sessions }),

    setLoading: (loading) => set({ isLoading: loading }),
    setError: (error) => set({ error }),

    createSession: () => {
        const newSession: ChatSession = {
            id: Date.now().toString(),
            title: 'New Chat',
            messages: [],
            timestamp: Date.now(),
            updatedAt: Date.now(),
            preview: 'New conversation'
        };

        set((state) => ({
            sessions: [newSession, ...state.sessions],
            currentSessionId: newSession.id,
            messages: []
        }));
    },

    switchSession: (sessionId) => {
        const session = get().sessions.find(s => s.id === sessionId);
        if (session) {
            set({
                currentSessionId: sessionId,
                messages: session.messages
            });
        }
    },

    deleteSession: (sessionId) => {
        set((state) => ({
            sessions: state.sessions.filter(s => s.id !== sessionId),
            currentSessionId: state.currentSessionId === sessionId ? null : state.currentSessionId,
            messages: state.currentSessionId === sessionId ? [] : state.messages
        }));
    },

    clearMessages: () => set({ messages: [] })
}));
