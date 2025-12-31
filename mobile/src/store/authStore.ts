import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as SecureStore from 'expo-secure-store';
import * as LocalAuthentication from 'expo-local-authentication';
import type { User, LoginCredentials, RegisterCredentials } from '../types';
import { authService } from '../services/authService';

interface AuthState {
  user: User | null;
  token: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  biometricAvailable: boolean;
  biometricType: string | null;

  // Actions
  login: (credentials: LoginCredentials) => Promise<boolean>;
  register: (credentials: RegisterCredentials) => Promise<boolean>;
  logout: () => Promise<void>;
  refreshAuth: () => Promise<boolean>;
  checkBiometricAvailability: () => Promise<void>;
  authenticateWithBiometric: () => Promise<boolean>;
  updateUser: (user: Partial<User>) => void;
  clearError: () => void;
  setLoading: (loading: boolean) => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      token: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,
      biometricAvailable: false,
      biometricType: null,

      login: async (credentials: LoginCredentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.login(credentials);
          if (response.success && response.data) {
            const { user, token, refreshToken } = response.data;

            // Store tokens securely
            await SecureStore.setItemAsync('token', token);
            await SecureStore.setItemAsync('refreshToken', refreshToken);

            // Store credentials for biometric if remember me
            if (credentials.rememberMe) {
              await SecureStore.setItemAsync(
                'biometricCredentials',
                JSON.stringify({ email: credentials.email, password: credentials.password })
              );
            }

            set({
              user,
              token,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });
            return true;
          } else {
            set({ error: response.error || 'Login failed', isLoading: false });
            return false;
          }
        } catch (error) {
          set({ error: 'Network error', isLoading: false });
          return false;
        }
      },

      register: async (credentials: RegisterCredentials) => {
        set({ isLoading: true, error: null });
        try {
          const response = await authService.register(credentials);
          if (response.success && response.data) {
            const { user, token, refreshToken } = response.data;

            await SecureStore.setItemAsync('token', token);
            await SecureStore.setItemAsync('refreshToken', refreshToken);

            set({
              user,
              token,
              refreshToken,
              isAuthenticated: true,
              isLoading: false,
            });
            return true;
          } else {
            set({ error: response.error || 'Registration failed', isLoading: false });
            return false;
          }
        } catch (error) {
          set({ error: 'Network error', isLoading: false });
          return false;
        }
      },

      logout: async () => {
        set({ isLoading: true });
        try {
          await authService.logout();
        } catch {
          // Ignore logout errors
        }

        // Clear secure storage
        await SecureStore.deleteItemAsync('token');
        await SecureStore.deleteItemAsync('refreshToken');

        set({
          user: null,
          token: null,
          refreshToken: null,
          isAuthenticated: false,
          isLoading: false,
          error: null,
        });
      },

      refreshAuth: async () => {
        const refreshToken = await SecureStore.getItemAsync('refreshToken');
        if (!refreshToken) return false;

        try {
          const response = await authService.refreshToken(refreshToken);
          if (response.success && response.data) {
            const { token, refreshToken: newRefreshToken } = response.data;

            await SecureStore.setItemAsync('token', token);
            await SecureStore.setItemAsync('refreshToken', newRefreshToken);

            set({ token, refreshToken: newRefreshToken });
            return true;
          }
        } catch {
          // Token refresh failed
        }

        await get().logout();
        return false;
      },

      checkBiometricAvailability: async () => {
        const compatible = await LocalAuthentication.hasHardwareAsync();
        const enrolled = await LocalAuthentication.isEnrolledAsync();
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

        let biometricType = null;
        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          biometricType = 'Face ID';
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          biometricType = 'Fingerprint';
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          biometricType = 'Iris';
        }

        set({
          biometricAvailable: compatible && enrolled,
          biometricType,
        });
      },

      authenticateWithBiometric: async () => {
        const { biometricAvailable } = get();
        if (!biometricAvailable) return false;

        try {
          const result = await LocalAuthentication.authenticateAsync({
            promptMessage: 'Authenticate to continue',
            fallbackLabel: 'Use password',
            cancelLabel: 'Cancel',
            disableDeviceFallback: false,
          });

          if (result.success) {
            // Get stored credentials
            const storedCredentials = await SecureStore.getItemAsync('biometricCredentials');
            if (storedCredentials) {
              const credentials = JSON.parse(storedCredentials);
              return await get().login(credentials);
            }
          }
        } catch {
          // Biometric auth failed
        }

        return false;
      },

      updateUser: (updates: Partial<User>) => {
        const { user } = get();
        if (user) {
          set({ user: { ...user, ...updates } });
        }
      },

      clearError: () => set({ error: null }),

      setLoading: (loading: boolean) => set({ isLoading: loading }),
    }),
    {
      name: 'auth-storage',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({
        user: state.user,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
