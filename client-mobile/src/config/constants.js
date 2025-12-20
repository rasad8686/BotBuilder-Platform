/**
 * App Configuration Constants
 */

// Environment detection
export const IS_DEV = __DEV__;
export const IS_PROD = !__DEV__;

// API Configuration
export const API_CONFIG = {
  BASE_URL: IS_DEV
    ? 'http://192.168.0.105:5000'
    : 'https://botbuilder-platform.onrender.com',
  WS_URL: IS_DEV
    ? 'ws://192.168.0.105:5000'
    : 'wss://botbuilder-platform.onrender.com',
  TIMEOUT: 30000,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY: 1000,
};

// App Configuration
export const APP_CONFIG = {
  NAME: 'BotBuilder',
  VERSION: '1.0.0',
  BUILD: '1',
  BUNDLE_ID: 'com.botbuilder.mobile',
};

// Storage Keys
export const STORAGE_KEYS = {
  AUTH_TOKEN: 'auth_token',
  REFRESH_TOKEN: 'refresh_token',
  USER_DATA: 'user_data',
  BOTS_CACHE: 'bots_cache',
  CHAT_CACHE: 'chat_cache',
  SETTINGS: 'app_settings',
  PUSH_TOKEN: 'push_token',
  BIOMETRIC_ENABLED: 'biometric_enabled',
  THEME: 'theme',
  LANGUAGE: 'language',
  LAST_SYNC: 'last_sync',
};

// Theme Colors
export const COLORS = {
  primary: '#6366f1',
  primaryLight: '#a5b4fc',
  primaryDark: '#4f46e5',
  secondary: '#f59e0b',
  success: '#22c55e',
  warning: '#f59e0b',
  error: '#ef4444',
  info: '#3b82f6',

  // Neutrals
  white: '#ffffff',
  black: '#000000',
  gray50: '#f8fafc',
  gray100: '#f1f5f9',
  gray200: '#e2e8f0',
  gray300: '#cbd5e1',
  gray400: '#94a3b8',
  gray500: '#64748b',
  gray600: '#475569',
  gray700: '#334155',
  gray800: '#1e293b',
  gray900: '#0f172a',

  // Backgrounds
  background: '#f8fafc',
  card: '#ffffff',
  border: '#f1f5f9',

  // Text
  text: '#1e293b',
  textSecondary: '#64748b',
  textMuted: '#94a3b8',
};

// Typography
export const FONTS = {
  sizes: {
    xs: 11,
    sm: 13,
    base: 15,
    md: 16,
    lg: 18,
    xl: 20,
    '2xl': 24,
    '3xl': 28,
    '4xl': 32,
  },
  weights: {
    normal: '400',
    medium: '500',
    semibold: '600',
    bold: '700',
  },
};

// Spacing
export const SPACING = {
  xs: 4,
  sm: 8,
  md: 12,
  base: 16,
  lg: 20,
  xl: 24,
  '2xl': 32,
  '3xl': 40,
};

// Border Radius
export const RADIUS = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  full: 9999,
};

// Chat Configuration
export const CHAT_CONFIG = {
  MAX_MESSAGE_LENGTH: 2000,
  TYPING_TIMEOUT: 3000,
  RECONNECT_INTERVAL: 5000,
  MAX_RECONNECT_ATTEMPTS: 5,
  MESSAGE_BATCH_SIZE: 50,
};

// Bot Configuration
export const BOT_CONFIG = {
  NAME_MAX_LENGTH: 50,
  DESCRIPTION_MAX_LENGTH: 500,
  MAX_BOTS_FREE: 3,
  MAX_BOTS_PRO: 10,
  MAX_BOTS_ENTERPRISE: 100,
};

// Analytics Periods
export const ANALYTICS_PERIODS = [
  { key: '24h', label: 'Last 24 Hours' },
  { key: '7d', label: 'Last 7 Days' },
  { key: '30d', label: 'Last 30 Days' },
  { key: '90d', label: 'Last 90 Days' },
];

// Bot Status
export const BOT_STATUS = {
  ACTIVE: 'active',
  INACTIVE: 'inactive',
  TRAINING: 'training',
  ERROR: 'error',
};

// Message Types
export const MESSAGE_TYPES = {
  TEXT: 'text',
  IMAGE: 'image',
  FILE: 'file',
  BUTTON: 'button',
  CARD: 'card',
};

// Notification Types
export const NOTIFICATION_TYPES = {
  BOT_MESSAGE: 'bot_message',
  BOT_STATUS: 'bot_status',
  SYSTEM: 'system',
  PROMO: 'promo',
};

// Error Messages
export const ERROR_MESSAGES = {
  NETWORK_ERROR: 'Unable to connect. Please check your internet connection.',
  SERVER_ERROR: 'Something went wrong. Please try again later.',
  UNAUTHORIZED: 'Session expired. Please login again.',
  NOT_FOUND: 'The requested resource was not found.',
  VALIDATION_ERROR: 'Please check your input and try again.',
  RATE_LIMIT: 'Too many requests. Please wait a moment.',
};

// Success Messages
export const SUCCESS_MESSAGES = {
  LOGIN: 'Welcome back!',
  REGISTER: 'Account created successfully!',
  LOGOUT: 'You have been logged out.',
  PROFILE_UPDATE: 'Profile updated successfully!',
  BOT_CREATED: 'Bot created successfully!',
  BOT_UPDATED: 'Bot updated successfully!',
  BOT_DELETED: 'Bot deleted successfully!',
  PASSWORD_CHANGED: 'Password changed successfully!',
};

export default {
  API_CONFIG,
  APP_CONFIG,
  STORAGE_KEYS,
  COLORS,
  FONTS,
  SPACING,
  RADIUS,
  CHAT_CONFIG,
  BOT_CONFIG,
  ANALYTICS_PERIODS,
  BOT_STATUS,
  MESSAGE_TYPES,
  ERROR_MESSAGES,
  SUCCESS_MESSAGES,
};
