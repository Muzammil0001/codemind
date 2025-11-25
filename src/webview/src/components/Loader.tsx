import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoaderProps {
    text?: string;
    size?: number;
}

export const Loader: React.FC<LoaderProps> = ({ text = 'Loading...', size = 24 }) => {
    return (
        <div className="flex items-center justify-center gap-3 p-8">
            <Loader2 size={size} className="animate-spin text-blue-500" />
            <span className="text-zinc-400 text-sm">{text}</span>
        </div>
    );
};
