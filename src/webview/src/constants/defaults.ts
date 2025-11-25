// Model Configuration
export const DEFAULT_MODEL = 'gemini-pro';

// Notification Configuration
export const MAX_NOTIFICATION_DURATION = 5000;
export const AUTO_HIDE_NOTIFICATION = true;

// Session Configuration
export const GENERATE_SESSION_ID = () => Date.now().toString();
export const CHAT_SAVE_DEBOUNCE = 1000;
export const APP_READY_TIMEOUT = 1000;

// UI Configuration
export const TITLE_PREVIEW_LENGTH = 50;
export const MESSAGE_PREVIEW_LENGTH = 100;

// Initial States
export const INITIAL_AGENT_STATUS = 'idle' as const;
export const INITIAL_LOADING_STATE = false;
export const INITIAL_READY_STATE = false;
