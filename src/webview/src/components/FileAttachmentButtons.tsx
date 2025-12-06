import React from 'react';
import { Paperclip, Image as ImageIcon, ImageOff } from 'lucide-react';

interface FileAttachmentButtonsProps {
    onFileClick: () => void;
    onImageClick: () => void;
    visionEnabled?: boolean;
}

export const FileAttachmentButtons: React.FC<FileAttachmentButtonsProps> = ({
    onFileClick,
    onImageClick,
    visionEnabled = true
}) => {
    return (
        <div className="flex items-center gap-1">
            <button
                onClick={onFileClick}
                className="p-2 hover:bg-zinc-800 rounded-lg text-zinc-400 hover:text-zinc-200 transition-all duration-200"
                title="Attach files"
            >
                <Paperclip size={18} />
            </button>

            <div className="relative group">
                <button
                    onClick={visionEnabled ? onImageClick : undefined}
                    className={`p-2 rounded-lg transition-all duration-200 ${visionEnabled
                        ? 'hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 cursor-pointer'
                        : 'text-zinc-600 cursor-not-allowed opacity-50'
                        }`}
                    title={visionEnabled ? "Attach images for vision analysis" : "Current model doesn't support image upload"}
                    disabled={!visionEnabled}
                >
                    {visionEnabled ? (
                        <ImageIcon size={18} />
                    ) : (
                        <ImageOff size={18} />
                    )}
                </button>

                {!visionEnabled && (
                    <div className="absolute bottom-full left-0 mb-2 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 pointer-events-none z-50 whitespace-nowrap">
                        <p className="text-xs text-zinc-300 font-medium">Image upload not supported</p>
                        <p className="text-xs text-zinc-500 mt-0.5">Switch to a vision model (GPT-4o, Gemini, Claude)</p>
                        <div className="absolute top-full left-4 -translate-x-1/2 -mt-1">
                            <div className="border-4 border-transparent border-t-zinc-700"></div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};
