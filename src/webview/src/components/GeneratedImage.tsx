import React, { useState } from 'react';
import { ExternalLink, X, Loader2, Image as ImageIcon, Save, Copy, Check } from 'lucide-react';

interface GeneratedImageProps {
    imageUrl?: string; // Base64 data URI or URL
    isLoading?: boolean;
    prompt?: string;
    onSave?: (filename: string) => void;
    onCopyToClipboard?: () => void;
    width?: number;
    height?: number;
}

export const GeneratedImage: React.FC<GeneratedImageProps> = ({
    imageUrl,
    isLoading = false,
    prompt,
    onSave,
    onCopyToClipboard,
    width = 512,
    height = 512
}) => {
    const [expanded, setExpanded] = useState(false);
    const [copied, setCopied] = useState(false);
    const [showSaveDialog, setShowSaveDialog] = useState(false);
    const [filename, setFilename] = useState('generated-image');

    const handleCopy = async () => {
        if (onCopyToClipboard) {
            onCopyToClipboard();
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleSave = () => {
        if (onSave) {
            onSave(`${filename}.webp`);
            setShowSaveDialog(false);
        }
    };

    // Loading skeleton
    if (isLoading) {
        return (
            <div className="relative rounded-xl overflow-hidden border border-zinc-700/50 bg-zinc-800/50">
                <div
                    className="animate-pulse bg-gradient-to-br from-zinc-700 via-zinc-600 to-zinc-700"
                    style={{ width: Math.min(width, 400), height: Math.min(height, 400) }}
                >
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
                        <div className="relative">
                            <Loader2 size={32} className="text-blue-400 animate-spin" />
                            <div className="absolute inset-0 bg-blue-400/20 blur-xl animate-pulse rounded-full" />
                        </div>
                        <div className="text-center">
                            <p className="text-sm font-medium text-zinc-300">Generating Image...</p>
                            {prompt && (
                                <p className="text-xs text-zinc-500 mt-1 max-w-[200px] truncate">
                                    {prompt}
                                </p>
                            )}
                        </div>
                        {/* Shimmer effect */}
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer" />
                    </div>
                </div>
            </div>
        );
    }

    if (!imageUrl) {
        return null;
    }

    return (
        <>
            <div className="group relative rounded-xl overflow-hidden border border-zinc-700/50 bg-zinc-800/50 transition-all hover:border-blue-500/50">
                {/* Image */}
                <img
                    src={imageUrl}
                    alt={prompt || 'Generated image'}
                    className="w-full h-auto max-w-[400px] cursor-pointer transition-transform hover:scale-[1.02]"
                    onClick={() => setExpanded(true)}
                />

                {/* Hover overlay with actions */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity">
                    <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                        {/* Prompt preview */}
                        {prompt && (
                            <p className="text-xs text-zinc-300 truncate max-w-[60%]">
                                {prompt}
                            </p>
                        )}

                        {/* Action buttons */}
                        <div className="flex items-center gap-1">
                            <button
                                onClick={handleCopy}
                                className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors"
                                title="Copy to clipboard"
                            >
                                {copied ? <Check size={14} /> : <Copy size={14} />}
                            </button>
                            <button
                                onClick={() => setShowSaveDialog(true)}
                                className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors"
                                title="Save to project"
                            >
                                <Save size={14} />
                            </button>
                            <button
                                onClick={() => setExpanded(true)}
                                className="p-1.5 bg-zinc-800/80 hover:bg-zinc-700 rounded-lg text-zinc-300 hover:text-white transition-colors"
                                title="Expand"
                            >
                                <ExternalLink size={14} />
                            </button>
                        </div>
                    </div>
                </div>

                {/* Generation badge */}
                <div className="absolute top-2 left-2 px-2 py-1 bg-gradient-to-r from-purple-500/80 to-blue-500/80 rounded-full">
                    <div className="flex items-center gap-1">
                        <ImageIcon size={10} className="text-white" />
                        <span className="text-[10px] font-medium text-white">AI Generated</span>
                    </div>
                </div>
            </div>

            {/* Expanded view modal */}
            {expanded && (
                <div
                    className="fixed inset-0 bg-black/90 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
                    onClick={() => setExpanded(false)}
                >
                    <div
                        className="relative max-w-4xl max-h-[90vh] rounded-2xl overflow-hidden bg-zinc-900 border border-zinc-700 shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <img
                            src={imageUrl}
                            alt={prompt || 'Generated image'}
                            className="w-full h-full object-contain max-h-[80vh]"
                        />

                        {/* Bottom bar */}
                        <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 to-transparent">
                            <div className="flex items-center justify-between">
                                {prompt && (
                                    <p className="text-sm text-zinc-300 max-w-[70%]">{prompt}</p>
                                )}
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={handleCopy}
                                        className="px-3 py-1.5 bg-zinc-800 hover:bg-zinc-700 rounded-lg text-sm text-zinc-300 hover:text-white transition-colors flex items-center gap-1.5"
                                    >
                                        {copied ? <Check size={14} /> : <Copy size={14} />}
                                        {copied ? 'Copied!' : 'Copy'}
                                    </button>
                                    <button
                                        onClick={() => setShowSaveDialog(true)}
                                        className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white transition-colors flex items-center gap-1.5"
                                    >
                                        <Save size={14} />
                                        Save to Project
                                    </button>
                                </div>
                            </div>
                        </div>

                        <button
                            onClick={() => setExpanded(false)}
                            className="absolute top-4 right-4 p-2 bg-zinc-900/80 hover:bg-zinc-800 rounded-lg text-zinc-300 hover:text-white transition-all"
                        >
                            <X size={20} />
                        </button>
                    </div>
                </div>
            )}

            {/* Save dialog */}
            {showSaveDialog && (
                <div
                    className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4 backdrop-blur-sm"
                    onClick={() => setShowSaveDialog(false)}
                >
                    <div
                        className="bg-zinc-900 border border-zinc-700 rounded-2xl p-6 w-full max-w-md shadow-2xl"
                        onClick={(e) => e.stopPropagation()}
                    >
                        <h3 className="text-lg font-semibold text-white mb-4">Save Image to Project</h3>

                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-zinc-400 mb-2">
                                    Filename
                                </label>
                                <div className="flex items-center gap-2">
                                    <input
                                        type="text"
                                        value={filename}
                                        onChange={(e) => setFilename(e.target.value)}
                                        className="flex-1 px-3 py-2 bg-zinc-800 border border-zinc-700 rounded-lg text-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Enter filename"
                                    />
                                    <span className="text-zinc-500 text-sm">.webp</span>
                                </div>
                            </div>

                            <p className="text-xs text-zinc-500">
                                Image will be saved to appropriate assets folder based on your project structure (public/, assets/, images/, etc.)
                            </p>
                        </div>

                        <div className="flex items-center justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowSaveDialog(false)}
                                className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleSave}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 rounded-lg text-sm text-white transition-colors"
                            >
                                Save Image
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
