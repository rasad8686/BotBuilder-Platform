import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { NotificationSettings } from '../types';

type ThemeMode = 'light' | 'dark' | 'system';

interface SettingsState {
  theme: ThemeMode;
  language: string;
  notifications: NotificationSettings;
  biometricEnabled: boolean;
  hapticEnabled: boolean;
  autoRefresh: boolean;
  refreshInterval: number;

  // Actions
  setTheme: (theme: ThemeMode) => void;
  setLanguage: (language: string) => void;
  updateNotifications: (settings: Partial<NotificationSettings>) => void;
  setBiometricEnabled: (enabled: boolean) => void;
  setHapticEnabled: (enabled: boolean) => void;
  setAutoRefresh: (enabled: boolean) => void;
  setRefreshInterval: (interval: number) => void;
  resetSettings: () => void;
}

const defaultNotifications: NotificationSettings = {
  pushEnabled: true,
  emailEnabled: true,
  botAlerts: true,
  conversationAlerts: true,
  weeklyReport: true,
};

const defaultSettings = {
  theme: 'system' as ThemeMode,
  language: 'en',
  notifications: defaultNotifications,
  biometricEnabled: false,
  hapticEnabled: true,
  autoRefresh: true,
  refreshInterval: 30000,
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      ...defaultSettings,

      setTheme: (theme: ThemeMode) => set({ theme }),

      setLanguage: (language: string) => set({ language }),

      updateNotifications: (settings: Partial<NotificationSettings>) =>
        set((state) => ({
          notifications: { ...state.notifications, ...settings },
        })),

      setBiometricEnabled: (enabled: boolean) => set({ biometricEnabled: enabled }),

      setHapticEnabled: (enabled: boolean) => set({ hapticEnabled: enabled }),

      setAutoRefresh: (enabled: boolean) => set({ autoRefresh: enabled }),

      setRefreshInterval: (interval: number) => set({ refreshInterval: interval }),

      resetSettings: () => set(defaultSettings),
    }),
    {
      name: 'settings-storage',
      storage: createJSONStorage(() => AsyncStorage),
    }
  )
);
