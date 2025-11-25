import React, { useState, useEffect, useRef } from 'react';
import { Check, Copy } from 'lucide-react';
import hljs from 'highlight.js';
import 'highlight.js/styles/github-dark.css';

interface CodeBlockProps {
    code: string;
    language: string;
}

export const CodeBlock: React.FC<CodeBlockProps> = ({ code, language }) => {
    const [copied, setCopied] = useState(false);
    const codeRef = useRef<HTMLElement>(null);

    useEffect(() => {
        if (codeRef.current) {
            hljs.highlightElement(codeRef.current);
        }
    }, [code, language]);

    const handleCopy = async () => {
        await navigator.clipboard.writeText(code);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <div className="my-4 rounded-xl overflow-hidden border border-zinc-800 bg-zinc-950 shadow-2xl max-w-full">
            <div className="flex items-center justify-between px-4 py-3 bg-zinc-900/60 border-b border-zinc-800 backdrop-blur-sm">
                <span className="text-xs text-zinc-400 font-semibold tracking-wide uppercase">
                    {language || 'code'}
                </span>
                <button
                    onClick={handleCopy}
                    className="flex items-center gap-2 px-3 py-1.5 text-xs rounded-lg bg-zinc-800/50 hover:bg-zinc-700/50 text-zinc-300 hover:text-white transition-all duration-200 font-medium"
                >
                    {copied ? (
                        <>
                            <Check size={14} className="text-emerald-400" />
                            <span className="text-emerald-400">Copied!</span>
                        </>
                    ) : (
                        <>
                            <Copy size={14} />
                            <span>Copy</span>
                        </>
                    )}
                </button>
            </div>
            <pre className="p-5 overflow-x-auto text-sm leading-relaxed bg-zinc-950">
                <code ref={codeRef} className={`language-${language}`}>
                    {code}
                </code>
            </pre>
        </div>
    );
};
