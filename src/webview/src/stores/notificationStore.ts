import { create } from 'zustand';

export interface Notification {
    id: string;
    message: string;
    type: 'info' | 'success' | 'warning' | 'error';
    duration?: number;
}

interface NotificationState {
    notifications: Notification[];

    addNotification: (message: string, type?: Notification['type'], duration?: number) => void;
    removeNotification: (id: string) => void;
    clearNotifications: () => void;
}

export const useNotificationStore = create<NotificationState>((set) => ({
    notifications: [],

    addNotification: (message, type = 'info', duration = 3000) => {
        const id = Date.now().toString() + Math.random();
        set((state) => ({
            notifications: [...state.notifications, { id, message, type, duration }]
        }));

        if (duration > 0) {
            setTimeout(() => {
                set((state) => ({
                    notifications: state.notifications.filter(n => n.id !== id)
                }));
            }, duration);
        }
    },

    removeNotification: (id) => set((state) => ({
        notifications: state.notifications.filter(n => n.id !== id)
    })),

    clearNotifications: () => set({ notifications: [] })
}));
