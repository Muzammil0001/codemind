import React, { createContext, useState, useCallback, type ReactNode } from 'react';
import { AUTO_HIDE_NOTIFICATION, MAX_NOTIFICATION_DURATION } from '../constants/defaults';

interface NotificationState {
    show: boolean;
    message: string;
    type: 'error' | 'info';
}

interface NotificationContextType {
    notification: NotificationState;
    showNotification: (message: string, type?: 'error' | 'info') => void;
    hideNotification: () => void;
}

export const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export const NotificationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
    const [notification, setNotification] = useState<NotificationState>({
        show: false,
        message: '',
        type: 'info'
    });

    const showNotification = useCallback((message: string, type: 'error' | 'info' = 'info') => {
        setNotification({ show: true, message, type });

        if (AUTO_HIDE_NOTIFICATION) {
            setTimeout(() => {
                setNotification(prev => ({ ...prev, show: false }));
            }, MAX_NOTIFICATION_DURATION);
        }
    }, []);

    const hideNotification = useCallback(() => {
        setNotification(prev => ({ ...prev, show: false }));
    }, []);

    return (
        <NotificationContext.Provider value={{ notification, showNotification, hideNotification }}>
            {children}
        </NotificationContext.Provider>
    );
};
