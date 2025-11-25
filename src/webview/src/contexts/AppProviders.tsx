import React, { type ReactNode } from 'react';
import { NotificationProvider } from './NotificationContext';
import { ModelProvider } from './ModelContext';
import { ChatProvider } from './ChatContext';

export const AppProviders: React.FC<{ children: ReactNode }> = ({ children }) => {
    return (
        <NotificationProvider>
            <ModelProvider>
                <ChatProvider>
                    {children}
                </ChatProvider>
            </ModelProvider>
        </NotificationProvider>
    );
};
