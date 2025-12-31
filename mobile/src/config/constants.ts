// API Configuration
export const API_URL = __DEV__
  ? 'http://localhost:3000/api'
  : 'https://api.botbuilder.com/api';

export const WS_URL = __DEV__
  ? 'ws://localhost:3000'
  : 'wss://api.botbuilder.com';

// App Configuration
export const APP_NAME = 'BotBuilder';
export const APP_VERSION = '1.0.0';

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  SETTINGS: 'settings',
  BIOMETRIC_CREDENTIALS: 'biometric_credentials',
  PUSH_TOKEN: 'push_token',
  ONBOARDING_COMPLETE: 'onboarding_complete',
};

// Pagination
export const PAGE_SIZE = 20;
export const MESSAGES_PAGE_SIZE = 50;

// Timeouts
export const API_TIMEOUT = 30000;
export const SOCKET_TIMEOUT = 10000;
export const REFRESH_INTERVAL = 30000;

// Validation
export const VALIDATION = {
  EMAIL_REGEX: /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i,
  PASSWORD_MIN_LENGTH: 8,
  NAME_MIN_LENGTH: 2,
  NAME_MAX_LENGTH: 50,
  BOT_NAME_MIN_LENGTH: 3,
  BOT_NAME_MAX_LENGTH: 100,
};

// Bot Platforms
export const BOT_PLATFORMS = [
  { id: 'telegram', name: 'Telegram', icon: 'send' },
  { id: 'discord', name: 'Discord', icon: 'message-circle' },
  { id: 'slack', name: 'Slack', icon: 'slack' },
  { id: 'whatsapp', name: 'WhatsApp', icon: 'phone' },
  { id: 'web', name: 'Web Chat', icon: 'globe' },
  { id: 'custom', name: 'Custom', icon: 'code' },
] as const;

// Bot Statuses
export const BOT_STATUSES = [
  { id: 'active', name: 'Active', color: '#22c55e' },
  { id: 'inactive', name: 'Inactive', color: '#737373' },
  { id: 'error', name: 'Error', color: '#ef4444' },
  { id: 'maintenance', name: 'Maintenance', color: '#eab308' },
] as const;

// Conversation Statuses
export const CONVERSATION_STATUSES = [
  { id: 'active', name: 'Active', color: '#22c55e' },
  { id: 'pending', name: 'Pending', color: '#eab308' },
  { id: 'escalated', name: 'Escalated', color: '#ef4444' },
  { id: 'closed', name: 'Closed', color: '#737373' },
] as const;

// Languages
export const LANGUAGES = [
  { id: 'en', name: 'English' },
  { id: 'az', name: 'Azərbaycan' },
  { id: 'ru', name: 'Русский' },
  { id: 'tr', name: 'Türkçe' },
] as const;

// Date Formats
export const DATE_FORMAT = 'MMM dd, yyyy';
export const TIME_FORMAT = 'HH:mm';
export const DATETIME_FORMAT = 'MMM dd, yyyy HH:mm';
