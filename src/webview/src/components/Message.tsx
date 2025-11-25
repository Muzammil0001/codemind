import React from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Pencil } from 'lucide-react';
import { markdownComponents } from './MarkdownComponents';

interface MessageProps {
    role: 'user' | 'ai';
    content: string;
    messageIndex?: number;
    onEdit?: (index: number) => void;
}

export const Message: React.FC<MessageProps> = ({ role, content, messageIndex, onEdit }) => {
    console.log("===msg-content=====>>", content);
    const isUser = role === 'user';
    const handleEdit = () => {
        if (onEdit && messageIndex !== undefined) {
            onEdit(messageIndex);
        }
    };

    return (
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
                            ? 'bg-gradient-to-br from-blue-600 to-blue-700 text-white shadow-lg shadow-blue-600/20 px-3 py-3 sm:px-4 sm:py-3.5 md:px-5 md:py-4'
                            : 'bg-zinc-900/80 border border-zinc-800/80 backdrop-blur-sm px-3 py-3 sm:px-4 sm:py-3.5 md:px-5 md:py-4 hover:border-zinc-700/80'
                            }`}
                    >
                        {isUser ? (
                            <div className="text-[15px] leading-relaxed whitespace-pre-wrap text-white break-words">
                                {content}
                            </div>
                        ) : (
                            <div className="prose prose-invert prose-sm max-w-none overflow-hidden">
                                <ReactMarkdown
                                    remarkPlugins={[remarkGfm]}
                                    components={markdownComponents}
                                >
                                    {content}
                                </ReactMarkdown>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
