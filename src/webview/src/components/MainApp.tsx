import { useState, useEffect } from 'react';
import { useVSCode } from '../hooks/useVSCode';
import { useChat } from '../hooks/useChat';
import { useModel } from '../hooks/useModel';
import { useNotification } from '../hooks/useNotification';
import { ChatHistory } from './ChatHistory';
import { InputArea, type AttachedItem } from './InputArea';
import { HistoryView } from './HistoryView';
import { Notification } from './Notification';
import { Loader2 } from 'lucide-react';
import { formatLLMMessage } from '../utils/formatLLMMessage';
import {
    GENERATE_SESSION_ID,
    CHAT_SAVE_DEBOUNCE,
    APP_READY_TIMEOUT,
    TITLE_PREVIEW_LENGTH,
    MESSAGE_PREVIEW_LENGTH,
} from '../constants/defaults';
import type { Message } from '../contexts/ChatContext';

export const MainApp = () => {
    const { postMessage } = useVSCode();

    const {
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
    } = useChat();

    const {
        selectedModel,
        setSelectedModel,
        providerStatus,
        setAllProviderStatus
    } = useModel();

    const { showNotification } = useNotification();

    // Local UI state that doesn't need to be global
    const [availableFiles, setAvailableFiles] = useState<Array<{ path: string; type: 'file' | 'directory' }>>([]);
    const [isReady, setIsReady] = useState(false);
    const [editingMessage, setEditingMessage] = useState<string>('');
    const [showHistory, setShowHistory] = useState(false);
    const [sessionId, setSessionId] = useState<string>(currentSessionId || GENERATE_SESSION_ID());


    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;

            switch (message.type) {
                case 'status':
                    if (message.data.files) setAvailableFiles(message.data.files);
                    if (message.data.activeModel) setSelectedModel(message.data.activeModel);
                    if (message.data.providers) setAllProviderStatus(new Map(message.data.providers));
                    setIsReady(true);
                    break;

                case 'queryResponse':
                    if (message.data.loading) {
                        setLoading(true);
                        setAgentStatus('thinking');
                    } else {
                        setLoading(false);
                        setAgentStatus('idle');

                        if (!message.data.success) {
                            showNotification(
                                message.data.response || 'An error occurred',
                                'error'
                            );
                        }

                        const formattedContent = message.data.success
                            ? formatLLMMessage(message.data.response)
                            : `Error: ${message.data.response}`;

                        setMessages(prev => [
                            ...prev,
                            { role: 'ai', content: formattedContent, id: Date.now().toString() }
                        ]);
                    }
                    break;

                case 'statusUpdate':
                    if (message.data.status) setAgentStatus(message.data.status);
                    break;

                case 'historyList':
                    setChatSessions(message.data);
                    break;

                case 'loadChat':
                    if (message.data) {
                        setSessionId(message.data.id);
                        setMessages(
                            (message.data.messages || []).map((msg: Message) => ({
                                ...msg,
                                content: msg.role === 'ai' ? formatLLMMessage(msg.content) : msg.content
                            }))
                        );
                        setShowHistory(false);
                    }
                    break;
            }
        };

        window.addEventListener('message', handleMessage);
        postMessage({ type: 'getStatus' });
        setTimeout(() => setIsReady(true), APP_READY_TIMEOUT);

        return () => window.removeEventListener('message', handleMessage);
    }, [postMessage]);

    useEffect(() => {
        if (messages.length > 0) {
            const timeoutId = setTimeout(() => {
                const title = messages[0].content.slice(0, TITLE_PREVIEW_LENGTH) + (messages[0].content.length > TITLE_PREVIEW_LENGTH ? '...' : '');
                postMessage({
                    type: 'saveChat',
                    session: {
                        id: sessionId,
                        title: title,
                        timestamp: Date.now(),
                        messages,
                        preview: messages[messages.length - 1].content.slice(0, MESSAGE_PREVIEW_LENGTH)
                    }
                });
            }, CHAT_SAVE_DEBOUNCE);

            return () => clearTimeout(timeoutId);
        }
    }, [messages, sessionId, postMessage]);

    const handleSend = (text: string, files: AttachedItem[]) => {
        setMessages(prev => [...prev, { role: 'user', content: text, id: Date.now().toString() }]);
        setLoading(true);
        setAgentStatus('thinking');

        postMessage({
            type: 'executeQuery',
            query: text,
            files,
            model: selectedModel
        });
    };

    const handleStop = () => {
        setLoading(false);
        setAgentStatus('idle');
        postMessage({ type: 'stopQuery' });
    };

    const handleEdit = (index: number) => {
        const messageToEdit = messages[index];
        if (messageToEdit && messageToEdit.role === 'user') {
            setMessages(prev => prev.slice(0, index));
            setEditingMessage(messageToEdit.content);
        }
    };

    const handleModelSelect = (model: string) => {
        setSelectedModel(model);

        let provider = '';
        if (model.startsWith('gemini')) provider = 'gemini';
        else if (model.startsWith('gpt')) provider = 'openai';
        else if (model.startsWith('claude')) provider = 'anthropic';
        else if (model.startsWith('deepseek')) provider = 'deepseek';

        if (provider && providerStatus.get(provider) === false) {
            showNotification(
                `Provider ${provider} is not configured or unavailable. Please check your API key.`,
                'error'
            );
        }

        postMessage({ type: 'selectModel', model });
    };

    const handleHistoryClick = () => {
        setShowHistory(!showHistory);
        if (!showHistory) postMessage({ type: 'getHistory' });
    };

    const handleSelectSession = (id: string) => postMessage({ type: 'loadChat', id });
    const handleDeleteSession = (id: string) => postMessage({ type: 'deleteChat', id });
    const handleNewChat = () => {
        clearMessages();
        const newSessionId = GENERATE_SESSION_ID();
        setSessionId(newSessionId);
        setCurrentSessionId(newSessionId);
        setShowHistory(false);
        setEditingMessage('');
    };

    if (!isReady) {
        return (
            <div className="flex items-center justify-center h-screen bg-zinc-950">
                <div className="text-center">
                    <div className="relative mb-6">
                        <div className="absolute inset-0 bg-blue-500 blur-3xl opacity-30 animate-pulse" />
                        <Loader2 size={48} className="relative text-blue-500 animate-spin mx-auto" />
                    </div>
                    <h2 className="text-xl font-bold text-white mb-2">CodeMind AI</h2>
                    <p className="text-sm text-zinc-400">Initializing your workspace...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-screen bg-zinc-950 text-zinc-100 overflow-x-hidden relative">
            <Notification />

            {showHistory ? (
                <HistoryView
                    sessions={chatSessions}
                    onSelectSession={handleSelectSession}
                    onDeleteSession={handleDeleteSession}
                    onClose={() => setShowHistory(false)}
                />
            ) : (
                <>
                    <ChatHistory
                        messages={messages}
                        agentStatus={agentStatus}
                        onEdit={handleEdit}
                        onHistoryClick={handleHistoryClick}
                        onNewChat={handleNewChat}
                    />
                    <InputArea
                        onSend={handleSend}
                        onStop={handleStop}
                        availableFiles={availableFiles}
                        onModelSelect={handleModelSelect}
                        isLoading={loading}
                        editingMessage={editingMessage}
                        onEditComplete={() => setEditingMessage('')}
                    />
                </>
            )}
        </div>
    );
};
