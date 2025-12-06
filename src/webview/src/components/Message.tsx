import React, { useCallback, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pencil, X, Image as ImageIcon } from 'lucide-react';
import { markdownComponents } from './MarkdownComponents';
import { useTerminal } from '../hooks/useTerminal';
import { TerminalOutput } from './TerminalOutput';
import { useVSCode } from '../hooks/useVSCode';
import { ExecutionSteps, type Step } from './ExecutionSteps';
import { GeneratedImage } from './GeneratedImage';

interface ImageAttachment {
    id: string;
    name: string;
    data: string;
    mimeType: string;
}

interface GeneratedImageItem {
    id: string;
    url?: string;
    prompt: string;
    isLoading: boolean;
}

interface MessageProps {
    role: 'user' | 'ai';
    content: string;
    messageIndex?: number;
    onEdit?: (index: number) => void;
    commandId?: string;
    steps?: Step[];
    thoughtProcess?: string;
    isThinking?: boolean;
    images?: ImageAttachment[];
    generatedImages?: GeneratedImageItem[];
}

export const Message: React.FC<MessageProps> = ({ role, content, messageIndex, onEdit, commandId, steps, thoughtProcess, isThinking, images, generatedImages }) => {
    const { stopCommand } = useTerminal();
    const { postMessage } = useVSCode();
    const isUser = role === 'user';
    const [expandedImage, setExpandedImage] = useState<string | null>(null);

    const handleEdit = () => {
        if (onEdit && messageIndex !== undefined) {
            onEdit(messageIndex);
        }
    };

    const handleRelocate = useCallback((id: string) => {
        postMessage({
            type: 'terminalRelocate',
            commandId: id
        });
    }, [postMessage]);

    const handleSaveImage = (dataUrl: string, filename: string) => {
        const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');

        postMessage({
            type: 'saveImage',
            data: base64Data,
            filename: filename
        });
    };

    return (
        <>
            <div className={`group flex w-full gap-2 sm:gap-3 md:gap-4 animate-fade-in ${isUser ? 'justify-end' : 'justify-start'}`}>
                <div className={`flex-1 min-w-0 ${isUser ? 'max-w-[90%] sm:max-w-2xl ml-auto' : 'max-w-[95%] sm:max-w-3xl'}`}>
                    <div className="relative">
                        {isUser && onEdit && (
                            <button
                                onClick={handleEdit}
                                className="absolute -top-2 -right-2 transition-all duration-200 p-1.5 sm:p-2 bg-zinc-800 hover:bg-zinc-700 rounded-lg shadow-lg z-5"
                                title="Edit message"
                            >
                                <Pencil size={12} className="text-zinc-300 sm:w-3.5 sm:h-3.5" />
                            </button>
                        )}

                        <div
                            className={`rounded-2xl transition-all duration-200 overflow-hidden ${isUser
                                ? 'bg-zinc-800/80 border border-zinc-800 text-white shadow-lg shadow-zinc-800/30 px-3 py-3 sm:px-4 sm:py-3.5 md:px-5 md:py-4'
                                : 'bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-sm px-3 py-3 sm:px-4 sm:py-3.5 md:px-5 md:py-4 hover:border-zinc-700/80'
                                }`}
                        >
                            {isUser ? (
                                <div>
                                    {/* Display attached images */}
                                    {images && images.length > 0 && (
                                        <div className="flex flex-wrap gap-2 mb-3">
                                            {images.map((img) => (
                                                <div
                                                    key={img.id}
                                                    className="relative group/img cursor-pointer"
                                                    onClick={() => setExpandedImage(img.data)}
                                                >
                                                    <img
                                                        src={img.data}
                                                        alt={img.name}
                                                        className="h-20 w-20 object-cover rounded-lg border border-zinc-700 hover:border-blue-500 transition-colors"
                                                    />
                                                    <div className="absolute inset-0 bg-black/50 rounded-lg opacity-0 group-hover/img:opacity-100 transition-opacity flex items-center justify-center">
                                                        <ImageIcon size={20} className="text-white" />
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                    <div className="text-[15px] leading-relaxed whitespace-pre-wrap break-words">
                                        {content}
                                    </div>
                                </div>
                            ) : (
                                <div className="prose prose-invert prose-sm max-w-none overflow-hidden">
                                    {(steps || thoughtProcess) && (
                                        <ExecutionSteps
                                            steps={steps || []}
                                            thoughtProcess={thoughtProcess}
                                            isThinking={isThinking}
                                        />
                                    )}

                                    {generatedImages && generatedImages.length > 0 && (
                                        <div className="grid grid-cols-1 gap-4 mb-4">
                                            {generatedImages.map((img) => (
                                                <GeneratedImage
                                                    key={img.id}
                                                    imageUrl={img.url}
                                                    isLoading={img.isLoading}
                                                    prompt={img.prompt}
                                                    onSave={(filename) => img.url && handleSaveImage(img.url, filename)}
                                                    onCopyToClipboard={() => img.url && navigator.clipboard.writeText(img.url)}
                                                />
                                            ))}
                                        </div>
                                    )}

                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
                                        {content}
                                    </ReactMarkdown>
                                    {commandId && (
                                        <div className="mt-4">
                                            <TerminalOutput commandId={commandId} onStop={stopCommand} onRelocate={handleRelocate} />
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Image preview modal (same as before) */}
            {expandedImage && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
                    onClick={() => setExpandedImage(null)}
                >
                    <div
                        className="relative max-w-4xl max-h-[80vh] rounded-2xl overflow-hidden border border-zinc-700 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={expandedImage}
                            alt="Expanded view"
                            className="w-full h-full object-contain"
                        />
                        <button
                            onClick={() => setExpandedImage(null)}
                            className="absolute top-4 right-4 p-2 bg-zinc-900/80 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}
        </>
    );
};
