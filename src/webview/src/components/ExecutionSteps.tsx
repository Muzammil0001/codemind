import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Loader2, FileText, CheckCircle2, Circle } from 'lucide-react';

export interface Step {
    id: string;
    title: string;
    description?: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    details?: string;
}

interface ExecutionStepsProps {
    steps: Step[];
    isThinking?: boolean;
    thoughtProcess?: string;
}

export const ExecutionSteps: React.FC<ExecutionStepsProps> = ({ steps, isThinking, thoughtProcess }) => {
    const [isExpanded, setIsExpanded] = useState(true);
    const [isThinkingExpanded, setIsThinkingExpanded] = useState(true);

    if ((!steps || steps?.length === 0) && !thoughtProcess) return null;

    return (
        <div className="my-4 rounded-xl border border-zinc-800/60 bg-zinc-900/40 overflow-hidden">
            <div
                className="flex items-center justify-between px-4 py-2 bg-zinc-900/60 border-b border-zinc-800/60 cursor-pointer hover:bg-zinc-800/60 transition-colors"
                onClick={() => setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-2">
                    <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Execution Plan</span>
                </div>
                {isExpanded ? <ChevronDown size={14} className="text-zinc-500" /> : <ChevronRight size={14} className="text-zinc-500" />}
            </div>

            {isExpanded && (
                <div className="p-2 space-y-1">
                    {steps?.map((step) => (
                        <div key={step.id} className="group">
                            <div className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-zinc-800/40 transition-colors">
                                <div className="flex-shrink-0">
                                    {step.status === 'running' && <Loader2 size={16} className="text-blue-400 animate-spin" />}
                                    {step.status === 'completed' && <CheckCircle2 size={16} className="text-green-400" />}
                                    {step.status === 'failed' && <div className="w-4 h-4 rounded-full border-2 border-red-400 flex items-center justify-center"><div className="w-2 h-0.5 bg-red-400" /></div>}
                                    {step.status === 'pending' && <Circle size={16} className="text-zinc-600" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className={`text-sm font-medium ${step.status === 'running' ? 'text-blue-400' :
                                        step.status === 'completed' ? 'text-zinc-300' :
                                            step.status === 'failed' ? 'text-red-400' :
                                                'text-zinc-500'
                                        }`}>
                                        {step.title}
                                    </div>
                                    {step.description && (
                                        <div className="text-xs text-zinc-500 truncate mt-0.5">
                                            {step.description}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>
                    ))}

                    {(thoughtProcess || isThinking) && (
                        <div className="mt-2 pt-2 border-t border-zinc-800/60">
                            <div
                                className="flex items-center gap-2 px-3 py-2 cursor-pointer hover:bg-zinc-800/40 rounded-lg transition-colors"
                                onClick={() => setIsThinkingExpanded(!isThinkingExpanded)}
                            >
                                {isThinking ? (
                                    <Loader2 size={14} className="text-purple-400 animate-spin" />
                                ) : (
                                    <FileText size={14} className="text-purple-400" />
                                )}
                                <span className="text-xs font-medium text-purple-400">
                                    {isThinking ? 'Thinking...' : 'Thoughts'}
                                </span>
                                <div className="ml-auto">
                                    {isThinkingExpanded ? <ChevronDown size={14} className="text-zinc-600" /> : <ChevronRight size={14} className="text-zinc-600" />}
                                </div>
                            </div>

                            {isThinkingExpanded && thoughtProcess && (
                                <div className="px-3 py-2 ml-2 border-l-2 border-zinc-800">
                                    <div className="text-sm text-zinc-400 whitespace-pre-wrap font-mono leading-relaxed max-h-60 overflow-y-auto custom-scrollbar">
                                        {thoughtProcess}
                                    </div>
                                </div>
                            )}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
