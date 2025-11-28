

import { AlertTriangle, Terminal, X } from 'lucide-react';

interface CommandConfirmDialogProps {
    command: string;
    riskLevel: 'safe' | 'moderate' | 'dangerous';
    onConfirm: () => void;
    onCancel: () => void;
}

export function CommandConfirmDialog({
    command,
    riskLevel,
    onConfirm,
    onCancel
}: CommandConfirmDialogProps) {
    const getRiskColor = () => {
        switch (riskLevel) {
            case 'dangerous':
                return 'text-red-400 bg-red-500/10 border-red-500/50';
            case 'moderate':
                return 'text-yellow-400 bg-yellow-500/10 border-yellow-500/50';
            default:
                return 'text-blue-400 bg-blue-500/10 border-blue-500/50';
        }
    };

    const getRiskMessage = () => {
        switch (riskLevel) {
            case 'dangerous':
                return 'This command is potentially dangerous and may cause data loss or system issues.';
            case 'moderate':
                return 'This command will make changes to your system or project.';
            default:
                return 'This command will be executed in your terminal.';
        }
    };

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 animate-fadeIn">
            <div className="bg-zinc-900 border border-zinc-800 rounded-lg shadow-2xl max-w-md w-full mx-4 animate-slideUp">
                <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-800">
                    <div className="flex items-center gap-2">
                        <AlertTriangle size={20} className={getRiskColor().split(' ')[0]} />
                        <h3 className="text-lg font-semibold text-zinc-100">
                            Confirm Command Execution
                        </h3>
                    </div>
                    <button
                        onClick={onCancel}
                        className="text-zinc-400 hover:text-zinc-100 transition-colors"
                    >
                        <X size={20} />
                    </button>
                </div>

                <div className="px-6 py-4 space-y-4">
                    <div className={`p-3 rounded border ${getRiskColor()}`}>
                        <p className="text-sm">
                            {getRiskMessage()}
                        </p>
                    </div>

                    <div>
                        <label className="text-sm text-zinc-400 mb-2 block">
                            Command to execute:
                        </label>
                        <div className="bg-zinc-950 border border-zinc-800 rounded px-4 py-3 font-mono text-sm">
                            <div className="flex items-start gap-2">
                                <Terminal size={16} className="text-zinc-500 mt-0.5 flex-shrink-0" />
                                <code className="text-zinc-100 break-all">{command}</code>
                            </div>
                        </div>
                    </div>

                    {riskLevel === 'dangerous' && (
                        <div className="bg-red-950/30 border border-red-900/50 rounded p-3">
                            <p className="text-sm text-red-300 font-medium">
                                ⚠️ Please review this command carefully before proceeding.
                            </p>
                        </div>
                    )}
                </div>

                <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-zinc-800">
                    <button
                        onClick={onCancel}
                        className="px-4 py-2 text-sm font-medium text-zinc-300 hover:text-zinc-100 
                                 bg-zinc-800 hover:bg-zinc-700 rounded transition-colors"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={onConfirm}
                        className={`px-4 py-2 text-sm font-medium rounded transition-colors ${riskLevel === 'dangerous'
                            ? 'bg-red-600 hover:bg-red-700 text-white'
                            : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                    >
                        {riskLevel === 'dangerous' ? 'Execute Anyway' : 'Execute Command'}
                    </button>
                </div>
            </div>
        </div>
    );
}
