import { useState, useEffect, useRef } from 'react';
import { useVSCode } from '../hooks/useVSCode';
import { useChatStore } from '../stores/chatStore';
import { useAgentStore } from '../stores/agentStore';
import { useModelStore } from '../stores/modelStore';
import { useNotificationStore } from '../stores/notificationStore';

import { useTerminal } from '../hooks/useTerminal';
import { useFileStore } from '../stores/fileStore';
import { ChatHistory } from './ChatHistory';
import { InputArea, type AttachedItem } from './InputArea';
import { HistoryView } from './HistoryView';
import { Settings } from './Settings';
import { Notification } from './Notification';
import { CommandConfirmDialog } from './CommandConfirmDialog';
import { Loader2 } from 'lucide-react';
import { formatLLMMessage } from '../utils/formatLLMMessage';
import { parsePackageJson, detectProjectContext, type CommandIntent, type ProjectScripts } from '../utils/commandDetection';
import { setPlatform } from '../utils/commandAnalyzer';
import {
    parseComposerJson,
    parsePyprojectToml,
    parseRequirementsTxt,
    parsePomXml,
    parseCargoToml,
    parseGemfile,
    parseGoMod,
    mergeProjectScripts
} from '../utils/projectParsers';
import { detectCommandByPattern } from '../utils/commandAnalyzer';
import { buildContextualPrompt } from '../utils/contextBuilder';
import {
    GENERATE_SESSION_ID,
    CHAT_SAVE_DEBOUNCE,
    APP_READY_TIMEOUT,
    TITLE_PREVIEW_LENGTH,
    MESSAGE_PREVIEW_LENGTH,
} from '../constants/defaults';
import type { Message } from '../stores/chatStore';

export const MainApp = () => {
    const { postMessage } = useVSCode();

    const messages = useChatStore(state => state.messages);
    const addMessage = useChatStore(state => state.addMessage);
    const updateMessageCommandId = useChatStore(state => state.updateMessageCommandId);
    const setMessages = useChatStore(state => state.setMessages);
    const updateMessageSteps = useChatStore(state => state.updateMessageSteps);
    const updateMessageContent = useChatStore(state => state.updateMessageContent);
    const sliceMessages = useChatStore(state => state.sliceMessages);
    const chatSessions = useChatStore(state => state.sessions);
    const setSessions = useChatStore(state => state.setSessions);
    const loading = useChatStore(state => state.isLoading);
    const setLoading = useChatStore(state => state.setLoading);
    const currentSessionId = useChatStore(state => state.currentSessionId);
    const setCurrentSessionId = useChatStore(state => state.switchSession);
    const clearMessages = useChatStore(state => state.clearMessages);

    const agentStatus = useAgentStore(state => state.status);
    const setAgentStatus = useAgentStore(state => state.setStatus);

    const selectedModel = useModelStore(state => state.selectedModel);
    const setSelectedModel = useModelStore(state => state.setSelectedModel);
    const providerStatus = useModelStore(state => state.providerStatus);
    const setAllProviderStatus = useModelStore(state => state.setProviderStatus);

    const showNotification = useNotificationStore(state => state.addNotification);

    const { executeCommand, clearCompletedCommands } = useTerminal();

    const availableFiles = useFileStore(state => state.files);
    const setAvailableFiles = useFileStore(state => state.setFiles);

    const [isReady, setIsReady] = useState(false);
    const [editingMessage, setEditingMessage] = useState<string>('');
    const [showHistory, setShowHistory] = useState(false);
    const [showSettings, setShowSettings] = useState(false);
    const [sessionId, setSessionId] = useState<string>(currentSessionId || GENERATE_SESSION_ID());
    const [projectScripts, setProjectScripts] = useState<ProjectScripts>({});
    const [pendingCommand, setPendingCommand] = useState<CommandIntent | null>(null);

    const lastCommandMessageRef = useRef<{ messageId: string; commandId: string } | null>(null);

    useEffect(() => {
        if (currentSessionId) {
            setSessionId(currentSessionId);
        }
    }, [currentSessionId]);


    useEffect(() => {
        const handleMessage = (event: MessageEvent) => {
            const message = event.data;
            switch (message.type) {
                case 'status':
                    if (message.data.files) setAvailableFiles(message.data.files);
                    if (message.data.activeModel) setSelectedModel(message.data.activeModel);
                    if (message.data.providers) setAllProviderStatus(new Map(message.data.providers));
                    if (message.data.platform) setPlatform(message.data.platform);

                    if (!isReady) {
                        setIsReady(true);
                        if (messages.length === 0) {
                            postMessage({ type: 'webviewReady' });
                        }
                    }
                    break;

                case 'queryResponse':
                    console.log('📨 MainApp: Received queryResponse:', {
                        loading: message.data.loading,
                        success: message.data.success,
                        responseLength: message.data.response?.length || 0,
                        hasCommandId: !!message.data.commandId,
                        commandId: message.data.commandId,
                        message: message
                    });

                    if (message.data.loading) {
                        console.log('⏳ MainApp: Setting loading state to true');
                        setLoading(true);
                        setAgentStatus('thinking');
                    } else {
                        console.log('✅ MainApp: Setting loading state to false');
                        setLoading(false);
                        setAgentStatus('idle');

                        if (!message.data.success) {
                            console.log('❌ MainApp: Query failed, showing notification');
                            showNotification(
                                message.data.response || 'An error occurred',
                                'error'
                            );
                        }
                        console.log(' MainApp: Received queryResponse:', message.data);
                        const formattedContent = message.data.success
                            ? formatLLMMessage(message.data.response || '')
                            : `Error: ${message.data.response || 'Unknown error'}`;

                        console.log('💬 MainApp: Adding AI message to chat:', {
                            contentLength: formattedContent?.length,
                            hasCommandId: !!message.data.commandId,
                            commandId: message.data.commandId,
                            message
                        });

                        if (lastCommandMessageRef.current) {
                            updateMessageContent(lastCommandMessageRef.current.messageId, formattedContent);
                            if (message.data.commandId) {
                                updateMessageCommandId(lastCommandMessageRef.current.messageId, message.data.commandId);
                            }
                        } else {
                            addMessage({
                                role: 'ai',
                                content: formattedContent,
                                commandId: message.data.commandId
                            });
                        }

                        console.log('✅ MainApp: AI message added to chat');
                    }
                    break;

                case 'statusUpdate':
                    if (message.data.status) setAgentStatus(message.data.status);
                    break;

                case 'historyList':
                    setSessions(message.data);
                    break;

                case 'loadChat':
                    if (message.data) {
                        const isDifferentSession = sessionId !== message.data.id;
                        const hasNoMessages = messages.length === 0;

                        if (isDifferentSession || hasNoMessages) {
                            setSessionId(message.data.id);
                            setCurrentSessionId(message.data.id);
                            setMessages(
                                (message.data.messages || []).map((msg: Message) => ({
                                    ...msg,
                                    content: msg.role === 'ai' ? formatLLMMessage(msg.content) : msg.content
                                }))
                            );
                            setShowHistory(false);
                            lastCommandMessageRef.current = null;
                        }
                    }
                    break;

                case 'setCurrentSession':
                    if (message.sessionId) {
                        setCurrentSessionId(message.sessionId);
                    }
                    break;

                case 'fileContent':
                    if (message.path && message.content) {
                        let newScripts: ProjectScripts = {};

                        switch (message.path) {
                            case 'package.json':
                                newScripts = parsePackageJson(message.content);
                                break;
                            case 'composer.json':
                                newScripts = parseComposerJson(message.content);
                                break;
                            case 'pyproject.toml':
                                newScripts = parsePyprojectToml(message.content);
                                break;
                            case 'requirements.txt':
                                newScripts = parseRequirementsTxt(message.content);
                                break;
                            case 'pom.xml':
                                newScripts = parsePomXml(message.content);
                                break;
                            case 'Cargo.toml':
                                newScripts = parseCargoToml(message.content);
                                break;
                            case 'Gemfile':
                                newScripts = parseGemfile(message.content);
                                break;
                            case 'go.mod':
                                newScripts = parseGoMod(message.content);
                                break;
                        }

                        setProjectScripts(prev => mergeProjectScripts(prev, newScripts));
                    }
                    break;

                case 'terminalCommandStarted':
                    if (message.commandId && message.command) {
                        if (lastCommandMessageRef.current) {
                            updateMessageCommandId(lastCommandMessageRef.current.messageId, message.commandId);
                        } else if (loading) {
                            const messageId = addMessage({
                                role: 'ai',
                                content: '',
                                commandId: message.commandId,
                                steps: [{
                                    id: 'cmd-exec',
                                    title: 'Executing Terminal Command',
                                    description: message.command,
                                    status: 'running'
                                }]
                            });
                            lastCommandMessageRef.current = { messageId, commandId: message.commandId };
                        }
                    }
                    break;



                case 'terminalStatus':
                    if (message.commandId && message.status) {
                        if (lastCommandMessageRef.current &&
                            lastCommandMessageRef.current.commandId !== message.commandId) {
                            updateMessageCommandId(lastCommandMessageRef.current.messageId, message.commandId);
                            lastCommandMessageRef.current.commandId = message.commandId;
                        }

                        const currentMessages = useChatStore.getState().messages;
                        const msg = currentMessages.find(m => m.commandId === message.commandId);

                        if (msg && msg.steps) {
                            const newSteps = msg.steps.map(step =>
                                step.id === 'cmd-exec' ? { ...step, status: message.status } : step
                            );
                            updateMessageSteps(msg.id, newSteps, msg.thoughtProcess, msg.isThinking);
                        }
                    }
                    break;

                case 'terminalComplete':
                    if (message.commandId) {
                        const status = message.status || 'completed';

                        if (lastCommandMessageRef.current &&
                            lastCommandMessageRef.current.commandId !== message.commandId) {
                            updateMessageCommandId(lastCommandMessageRef.current.messageId, message.commandId);
                            lastCommandMessageRef.current.commandId = message.commandId;
                        }

                        const currentMessages = useChatStore.getState().messages;
                        const msg = currentMessages.find(m => m.commandId === message.commandId);

                        if (msg && msg.steps) {
                            const newSteps = msg.steps.map(step =>
                                step.id === 'cmd-exec' ? { ...step, status: status === 'stopped' ? 'failed' : status } : step
                            );
                            updateMessageSteps(msg.id, newSteps, msg.thoughtProcess, msg.isThinking);
                        }
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
        const projectConfigFiles = [
            'package.json',
            'composer.json',
            'pyproject.toml',
            'requirements.txt',
            'pom.xml',
            'Cargo.toml',
            'Gemfile',
            'go.mod'
        ];

        projectConfigFiles.forEach(configFile => {
            const found = availableFiles.find(f => f.path === configFile);
            if (found) {
                postMessage({ type: 'readFile', path: configFile });
            }
        });
    }, [availableFiles, postMessage]);

    useEffect(() => {
        if (messages?.length > 0) {
            const timeoutId = setTimeout(() => {
                const title = messages[0].content.slice(0, TITLE_PREVIEW_LENGTH) + (messages[0].content?.length > TITLE_PREVIEW_LENGTH ? '...' : '');
                postMessage({
                    type: 'saveChat',
                    session: {
                        id: sessionId,
                        title: title,
                        timestamp: Date.now(),
                        messages,
                        preview: messages[messages?.length - 1].content.slice(0, MESSAGE_PREVIEW_LENGTH)
                    }
                });
            }, CHAT_SAVE_DEBOUNCE);

            return () => clearTimeout(timeoutId);
        }
    }, [messages, sessionId, postMessage]);


    const handleSend = async (text: string, files: AttachedItem[]) => {
        lastCommandMessageRef.current = null;
        addMessage({ role: 'user', content: text });
        setLoading(true);
        setAgentStatus('thinking');

        const projectContext = detectProjectContext(availableFiles, projectScripts);

        // Disable AI command analysis for now - it's causing timeouts
        // Try pattern-based detection first
        // try {
        //     const commandIntent = await analyzeCommandWithAI({
        //         userQuery: text,
        //         projectContext,
        //         availableFiles,
        //         platform
        //     });

        //     if (commandIntent) {
        //         if (commandIntent.requiresConfirmation) {
        //             setPendingCommand(commandIntent);
        //             setLoading(false);
        //             setAgentStatus('idle');
        //         } else {
        //             const commandId = executeCommand(commandIntent.command);
        //             // User message already added
        //             const messageId = addMessage({
        //                 role: 'ai',
        //                 content: '',
        //                 commandId,
        //                 steps: [{
        //                     id: 'cmd-exec',
        //                     title: 'Executing Terminal Command',
        //                     description: commandIntent.command,
        //                     status: 'running'
        //                 }]
        //             });

        //             lastCommandMessageRef.current = { messageId, commandId };
        //             setLoading(false);
        //             setAgentStatus('idle');
        //         }
        //         return;
        //     }
        // } catch (error) {
        //     console.error('❌ AI command analysis failed:', error);
        // }

        const patternCommandIntent = detectCommandByPattern(text, projectContext);

        if (patternCommandIntent) {
            if (patternCommandIntent.requiresConfirmation) {
                setPendingCommand(patternCommandIntent);
                setLoading(false);
                setAgentStatus('idle');
            } else {
                const commandId = executeCommand(patternCommandIntent.command);

                const messageId = addMessage({
                    role: 'ai',
                    content: '',
                    commandId,
                    steps: [{
                        id: 'cmd-exec',
                        title: 'Executing Terminal Command',
                        description: patternCommandIntent.command,
                        status: 'running'
                    }]
                });

                lastCommandMessageRef.current = { messageId, commandId };
                setLoading(false);
                setAgentStatus('idle');
            }
            return;
        }

        const contextualPrompt = buildContextualPrompt(text, messages, projectScripts);

        postMessage({
            type: 'executeQuery',
            query: contextualPrompt.prompt,
            files,
            model: selectedModel,
            context: {
                originalQuery: text,
                references: contextualPrompt.references,
                summary: contextualPrompt.contextSummary
            }
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
            sliceMessages(index);
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

    const handleSettingsClick = () => {
        setShowSettings(true);
    };

    const handleSelectSession = (id: string) => postMessage({ type: 'loadChat', id });
    const handleDeleteSession = (id: string) => postMessage({ type: 'deleteChat', id });
    const handleNewChat = () => {
        clearMessages();
        clearCompletedCommands();
        const newSessionId = GENERATE_SESSION_ID();
        setSessionId(newSessionId);
        setCurrentSessionId(newSessionId);
        setShowHistory(false);
        setEditingMessage('');
        lastCommandMessageRef.current = null;
    };

    const handleConfirmCommand = () => {
        if (pendingCommand) {
            const commandId = executeCommand(pendingCommand.command);
            addMessage({ role: 'user', content: pendingCommand.originalMessage });
            const messageId = addMessage({
                role: 'ai',
                content: '',
                commandId,
                steps: [{
                    id: 'cmd-exec',
                    title: 'Executing Terminal Command',
                    description: pendingCommand.command,
                    status: 'running'
                }]
            });

            lastCommandMessageRef.current = { messageId, commandId };
            setPendingCommand(null);
        }
    };

    const handleCancelCommand = () => {
        setPendingCommand(null);
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

            {showSettings ? (
                <Settings onBack={() => setShowSettings(false)} />
            ) : showHistory ? (
                <HistoryView
                    sessions={chatSessions}
                    onSelectSession={handleSelectSession}
                    onDeleteSession={handleDeleteSession}
                    onClose={() => setShowHistory(false)}
                />
            ) : (
                <>
                    <ChatHistory
                        messages={(messages || []).filter(m => m.role !== 'system') as any}
                        agentStatus={agentStatus}
                        onEdit={handleEdit}
                        onHistoryClick={handleHistoryClick}
                        onSettingsClick={handleSettingsClick}
                        onNewChat={handleNewChat}
                    >
                        {/* Render terminal outputs inside chat history */}
                    </ChatHistory>
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

            {/* Command confirmation dialog */}
            {pendingCommand && (
                <CommandConfirmDialog
                    command={pendingCommand.command}
                    riskLevel={pendingCommand.riskLevel}
                    onConfirm={handleConfirmCommand}
                    onCancel={handleCancelCommand}
                />
            )}


        </div>
    );
};
