/**
 * Storage Utilities
 * AsyncStorage and SecureStore helpers for data persistence
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import { STORAGE_KEYS } from '../config/constants';

/**
 * Secure storage for sensitive data (tokens, credentials)
 */
export const secureStorage = {
  async set(key, value) {
    try {
      await SecureStore.setItemAsync(key, value);
      return true;
    } catch (error) {
      console.error('SecureStore set error:', error);
      return false;
    }
  },

  async get(key) {
    try {
      return await SecureStore.getItemAsync(key);
    } catch (error) {
      console.error('SecureStore get error:', error);
      return null;
    }
  },

  async remove(key) {
    try {
      await SecureStore.deleteItemAsync(key);
      return true;
    } catch (error) {
      console.error('SecureStore remove error:', error);
      return false;
    }
  },
};

/**
 * Regular storage for non-sensitive data
 */
export const storage = {
  async set(key, value) {
    try {
      const jsonValue = JSON.stringify(value);
      await AsyncStorage.setItem(key, jsonValue);
      return true;
    } catch (error) {
      console.error('AsyncStorage set error:', error);
      return false;
    }
  },

  async get(key) {
    try {
      const jsonValue = await AsyncStorage.getItem(key);
      return jsonValue != null ? JSON.parse(jsonValue) : null;
    } catch (error) {
      console.error('AsyncStorage get error:', error);
      return null;
    }
  },

  async remove(key) {
    try {
      await AsyncStorage.removeItem(key);
      return true;
    } catch (error) {
      console.error('AsyncStorage remove error:', error);
      return false;
    }
  },

  async clear() {
    try {
      await AsyncStorage.clear();
      return true;
    } catch (error) {
      console.error('AsyncStorage clear error:', error);
      return false;
    }
  },

  async getAllKeys() {
    try {
      return await AsyncStorage.getAllKeys();
    } catch (error) {
      console.error('AsyncStorage getAllKeys error:', error);
      return [];
    }
  },

  async multiGet(keys) {
    try {
      const result = await AsyncStorage.multiGet(keys);
      return result.reduce((acc, [key, value]) => {
        acc[key] = value ? JSON.parse(value) : null;
        return acc;
      }, {});
    } catch (error) {
      console.error('AsyncStorage multiGet error:', error);
      return {};
    }
  },

  async multiSet(items) {
    try {
      const pairs = Object.entries(items).map(([key, value]) => [
        key,
        JSON.stringify(value),
      ]);
      await AsyncStorage.multiSet(pairs);
      return true;
    } catch (error) {
      console.error('AsyncStorage multiSet error:', error);
      return false;
    }
  },

  async multiRemove(keys) {
    try {
      await AsyncStorage.multiRemove(keys);
      return true;
    } catch (error) {
      console.error('AsyncStorage multiRemove error:', error);
      return false;
    }
  },
};

// ============================================
// Auth Token Helpers
// ============================================
export const setAuthToken = (token) =>
  secureStorage.set(STORAGE_KEYS.AUTH_TOKEN, token);

export const getAuthToken = () =>
  secureStorage.get(STORAGE_KEYS.AUTH_TOKEN);

export const removeAuthToken = () =>
  secureStorage.remove(STORAGE_KEYS.AUTH_TOKEN);

// ============================================
// Refresh Token Helpers
// ============================================
export const setRefreshToken = (token) =>
  secureStorage.set(STORAGE_KEYS.REFRESH_TOKEN, token);

export const getRefreshToken = () =>
  secureStorage.get(STORAGE_KEYS.REFRESH_TOKEN);

export const removeRefreshToken = () =>
  secureStorage.remove(STORAGE_KEYS.REFRESH_TOKEN);

// ============================================
// User Data Helpers
// ============================================
export const setUserData = (user) =>
  storage.set(STORAGE_KEYS.USER_DATA, user);

export const getUserData = () =>
  storage.get(STORAGE_KEYS.USER_DATA);

export const removeUserData = () =>
  storage.remove(STORAGE_KEYS.USER_DATA);

// ============================================
// Bots Cache Helpers
// ============================================
export const setBotsCache = (bots) =>
  storage.set(STORAGE_KEYS.BOTS_CACHE, {
    data: bots,
    timestamp: Date.now(),
  });

export const getBotsCache = async () => {
  const cache = await storage.get(STORAGE_KEYS.BOTS_CACHE);
  if (!cache) return null;

  // Cache expires after 5 minutes
  const CACHE_DURATION = 5 * 60 * 1000;
  if (Date.now() - cache.timestamp > CACHE_DURATION) {
    await storage.remove(STORAGE_KEYS.BOTS_CACHE);
    return null;
  }

  return cache.data;
};

export const clearBotsCache = () =>
  storage.remove(STORAGE_KEYS.BOTS_CACHE);

// ============================================
// Chat Cache Helpers
// ============================================
export const setChatCache = (botId, messages) =>
  storage.set(`${STORAGE_KEYS.CHAT_CACHE}_${botId}`, {
    data: messages,
    timestamp: Date.now(),
  });

export const getChatCache = async (botId) => {
  const cache = await storage.get(`${STORAGE_KEYS.CHAT_CACHE}_${botId}`);
  if (!cache) return null;

  // Chat cache expires after 1 hour
  const CACHE_DURATION = 60 * 60 * 1000;
  if (Date.now() - cache.timestamp > CACHE_DURATION) {
    await storage.remove(`${STORAGE_KEYS.CHAT_CACHE}_${botId}`);
    return null;
  }

  return cache.data;
};

export const clearChatCache = (botId) =>
  storage.remove(`${STORAGE_KEYS.CHAT_CACHE}_${botId}`);

export const clearAllChatCache = async () => {
  const keys = await storage.getAllKeys();
  const chatKeys = keys.filter(key => key.startsWith(STORAGE_KEYS.CHAT_CACHE));
  await storage.multiRemove(chatKeys);
};

// ============================================
// Settings Helpers
// ============================================
export const setSettings = (settings) =>
  storage.set(STORAGE_KEYS.SETTINGS, settings);

export const getSettings = () =>
  storage.get(STORAGE_KEYS.SETTINGS);

export const updateSettings = async (updates) => {
  const current = await getSettings() || {};
  return storage.set(STORAGE_KEYS.SETTINGS, { ...current, ...updates });
};

// ============================================
// Push Token Helpers
// ============================================
export const setPushToken = (token) =>
  storage.set(STORAGE_KEYS.PUSH_TOKEN, token);

export const getPushToken = () =>
  storage.get(STORAGE_KEYS.PUSH_TOKEN);

export const removePushToken = () =>
  storage.remove(STORAGE_KEYS.PUSH_TOKEN);

// ============================================
// Biometric Helpers
// ============================================
export const setBiometricEnabled = (enabled) =>
  secureStorage.set(STORAGE_KEYS.BIOMETRIC_ENABLED, enabled ? 'true' : 'false');

export const getBiometricEnabled = async () => {
  const value = await secureStorage.get(STORAGE_KEYS.BIOMETRIC_ENABLED);
  return value === 'true';
};

// ============================================
// Theme Helpers
// ============================================
export const setTheme = (theme) =>
  storage.set(STORAGE_KEYS.THEME, theme);

export const getTheme = () =>
  storage.get(STORAGE_KEYS.THEME);

// ============================================
// Last Sync Helpers
// ============================================
export const setLastSync = (entity, timestamp = Date.now()) =>
  storage.set(`${STORAGE_KEYS.LAST_SYNC}_${entity}`, timestamp);

export const getLastSync = (entity) =>
  storage.get(`${STORAGE_KEYS.LAST_SYNC}_${entity}`);

// ============================================
// Clear All Auth Data
// ============================================
export const clearAuthData = async () => {
  await Promise.all([
    removeAuthToken(),
    removeRefreshToken(),
    removeUserData(),
  ]);
};

// ============================================
// Clear All App Data
// ============================================
export const clearAllData = async () => {
  await Promise.all([
    clearAuthData(),
    clearBotsCache(),
    clearAllChatCache(),
    storage.remove(STORAGE_KEYS.SETTINGS),
    storage.remove(STORAGE_KEYS.PUSH_TOKEN),
  ]);
};

export { STORAGE_KEYS };
