import React from 'react';
import { AlertCircle, X } from 'lucide-react';
import { useNotification } from '../hooks/useNotification';

export const Notification: React.FC = () => {
    const { notification, hideNotification } = useNotification();

    if (!notification.show) return null;

    return (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-md px-4">
            <div className={`flex items-center gap-3 p-4 rounded-lg shadow-lg border ${notification.type === 'error'
                ? 'bg-red-900/90 border-red-700 text-red-100'
                : 'bg-blue-900/90 border-blue-700 text-blue-100'
                } backdrop-blur-sm`}>
                <AlertCircle size={20} className="flex-shrink-0 mt-0.5" />
                <p className="text-sm font-medium flex-1 line-clamp-3 break-words">
                    {notification.message}
                </p>
                <button
                    onClick={hideNotification}
                    className="flex-shrink-0 p-1 hover:bg-white/10 rounded-full transition-colors"
                >
                    <X size={16} className="flex-shrink-0" />
                </button>
            </div>
        </div>
    );
};
