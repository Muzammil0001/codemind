import React, { useRef, useEffect } from 'react';

interface ChatTextAreaProps {
    value: string;
    onChange: (value: string) => void;
    onKeyDown: (e: React.KeyboardEvent) => void;
    onPaste: (e: React.ClipboardEvent<HTMLTextAreaElement>) => void;
    disabled: boolean;
    placeholder?: string;
}

export const ChatTextArea: React.FC<ChatTextAreaProps> = ({
    value,
    onChange,
    onKeyDown,
    onPaste,
    disabled,
    placeholder = "Ask anything about your code... (Type @ for files, / for commands, paste files)"
}) => {
    const textareaRef = useRef<HTMLTextAreaElement>(null);

    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = Math.min(textareaRef.current.scrollHeight, 200) + 'px';
        }
    }, [value]);

    useEffect(() => {
        if (value && textareaRef.current) {
            textareaRef.current.focus();
        }
    }, [value]);

    return (
        <textarea
        ref={textareaRef}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onKeyDown={onKeyDown}
        onPaste={onPaste}
        placeholder={placeholder}
        disabled={disabled}
        rows={1}
        className="w-full bg-transparent ring-none outline-none! focus:outline-none text-zinc-100 placeholder:text-zinc-500 resize-none min-h-[60px] max-h-[200px] text-[15px] leading-relaxed disabled:opacity-50"
    />    
    );
};
