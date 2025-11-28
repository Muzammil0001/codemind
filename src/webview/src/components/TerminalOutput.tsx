import { useLayoutEffect, useRef, useState, memo } from 'react';
import { Copy, Check, ExternalLink, ChevronDown, ChevronRight } from 'lucide-react';
import { ansiToHtml, stripAnsi } from '../utils/ansiToHtml';
import { useTerminalStore, type TerminalOutputLine } from '../stores/terminalStore';

interface TerminalOutputProps {
    commandId: string;
    onStop?: (commandId: string) => void;
    onRelocate?: (commandId: string) => void;
}

const TerminalOutputComponent = ({ commandId, onStop, onRelocate }: TerminalOutputProps) => {
    const outputRef = useRef<HTMLDivElement>(null);
    const [copied, setCopied] = useState(false);
    const [isCollapsed, setIsCollapsed] = useState(false);

    const command = useTerminalStore(
        (state) => state.commands[commandId]
    );

    useLayoutEffect(() => {
        if (outputRef.current && command && !isCollapsed) {
            outputRef.current.scrollTop = outputRef.current.scrollHeight;
        }
    }, [command?.output.length, isCollapsed]);

    useLayoutEffect(() => {
        if (command && (command.status === 'completed' || command.status === 'failed' || command.status === 'stopped')) {
            const timer = setTimeout(() => {
                setIsCollapsed(true);
            }, 2000);
            return () => clearTimeout(timer);
        }
    }, [command?.status]);

    if (!command) {
        return null;
    }

    if (command.hidden) {
        return null;
    }

    const isRunning = command.status === 'running';

    const handleCopy = () => {
        const fullOutput = [
            `~/..${command.cwd || ''} $ ${command.command}`,
            '',
            ...command.output.map((line: TerminalOutputLine) => stripAnsi(line.content)),
        ].join('\n');

        navigator.clipboard.writeText(fullOutput);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleCancel = () => {
        if (onStop && isRunning) onStop(command.id);
    };

    const handleRelocate = () => {
        if (onRelocate) onRelocate(command.id);
    };

    const getSimplifiedPath = () => {
        if (!command.cwd) return '';
        const parts = command.cwd.split(/[/\\]/);
        console.log("======>parts", parts);
        return parts[parts.length - 1] || '';
    };

    const getStatusText = () => {
        switch (command.status) {
            case 'running': return 'Running...';
            case 'completed': return 'Completed';
            case 'failed': return 'Failed';
            case 'stopped': return 'Cancelled';
            default: return 'Pending...';
        }
    };

    const getStatusIcon = () => {
        switch (command.status) {
            case 'running': return '⏳';
            case 'completed': return '✓';
            case 'failed': return '✗';
            case 'stopped': return '⊗';
            default: return '○';
        }
    };

    return (
        <div className="terminal-output my-3 rounded-lg border border-zinc-700/50 bg-[#1e1e1e] overflow-hidden shadow-lg">
            <div
                className="flex items-center justify-between px-4 py-2.5 bg-[#2d2d2d] border-b border-zinc-700/50 cursor-pointer hover:bg-[#333333] transition-colors"
                onClick={() => setIsCollapsed(!isCollapsed)}
            >
                <div className="flex items-center gap-2 flex-1 min-w-0">
                    <button className="flex-shrink-0 text-zinc-400 hover:text-zinc-200">
                        {isCollapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
                    </button>
                    <span className="text-zinc-400 text-sm font-mono flex-shrink-0">
                        {getSimplifiedPath() ? `~/.../${getSimplifiedPath()} $` : '$'}
                    </span>
                    <span className="text-zinc-200 text-sm font-mono truncate">
                        {command.command}
                    </span>
                    <span className="flex-shrink-0 ml-2">
                        <span
                            className={`text-xs font-medium px-2 py-0.5 rounded ${isRunning
                                ? 'bg-blue-500/20 text-blue-400'
                                : command.status === 'completed'
                                    ? 'bg-green-500/20 text-green-400'
                                    : command.status === 'failed'
                                        ? 'bg-red-500/20 text-red-400'
                                        : 'bg-yellow-500/20 text-yellow-400'
                                }`}
                        >
                            {getStatusIcon()} {getStatusText()}
                        </span>
                    </span>
                </div>

                <div className="flex items-center gap-2 flex-shrink-0" onClick={(e) => e.stopPropagation()}>
                    <button
                        onClick={handleCopy}
                        className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors"
                        title="Copy Terminal Output"
                    >
                        {copied ? <Check size={16} className="text-green-400" /> : <Copy size={16} className="text-zinc-400" />}
                    </button>

                    {isRunning && onRelocate && (
                        <button
                            onClick={handleRelocate}
                            className="p-1.5 hover:bg-zinc-700/50 rounded transition-colors flex items-center gap-1"
                            title="Open in Main Terminal"
                        >
                            <ExternalLink size={14} className="text-zinc-400" />
                            <span className="text-xs text-zinc-200">Relocate</span>
                        </button>
                    )}

                    {isRunning && (
                        <button
                            onClick={handleCancel}
                            className="px-3 py-1 text-xs text-zinc-300 hover:text-white hover:bg-zinc-700/50 rounded transition-colors"
                        >
                            Cancel
                        </button>
                    )}
                </div>
            </div>

            {!isCollapsed && (
                <div
                    ref={outputRef}
                    className="terminal-content p-4 font-mono text-sm overflow-auto bg-[#1e1e1e]"
                    style={{ maxHeight: '350px', minHeight: '120px' }}
                >
                    {command.output.length === 0 ? (
                        <div className="text-zinc-500 italic">No output...</div>
                    ) : (
                        <div className="flex flex-col gap-0.5">
                            {command.output.map((line: TerminalOutputLine, index: number) => (
                                <div
                                    key={index}
                                    className={`whitespace-pre-wrap break-all leading-relaxed ${line.type === 'stderr' ? 'text-red-400' : 'text-zinc-200'
                                        }`}
                                >
                                    <span dangerouslySetInnerHTML={{ __html: ansiToHtml(line.content) }} />
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export const TerminalOutput = memo(TerminalOutputComponent, (prevProps, nextProps) => {
    return prevProps.commandId === nextProps.commandId &&
        prevProps.onStop === nextProps.onStop &&
        prevProps.onRelocate === nextProps.onRelocate;
});
