/**
 * Authentication Service
 * Handles biometric auth and secure authentication
 */
import * as LocalAuthentication from 'expo-local-authentication';
import {
  setAuthToken,
  getAuthToken,
  removeAuthToken,
  setUserData,
  getUserData,
  removeUserData,
} from '../utils/storage';
import { authAPI } from './api';

/**
 * Check if device supports biometric authentication
 */
export const checkBiometricSupport = async () => {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    return {
      supported: compatible && enrolled,
      types: types.map(type => {
        switch (type) {
          case LocalAuthentication.AuthenticationType.FINGERPRINT:
            return 'fingerprint';
          case LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION:
            return 'face';
          case LocalAuthentication.AuthenticationType.IRIS:
            return 'iris';
          default:
            return 'unknown';
        }
      }),
    };
  } catch (error) {
    console.error('Biometric check error:', error);
    return { supported: false, types: [] };
  }
};

/**
 * Authenticate with biometrics
 */
export const authenticateWithBiometrics = async (promptMessage = 'Authenticate to continue') => {
  try {
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel: 'Cancel',
      disableDeviceFallback: false,
      fallbackLabel: 'Use passcode',
    });

    return {
      success: result.success,
      error: result.error,
    };
  } catch (error) {
    console.error('Biometric auth error:', error);
    return {
      success: false,
      error: error.message,
    };
  }
};

/**
 * Login with email and password
 */
export const login = async (email, password) => {
  try {
    const response = await authAPI.login(email, password);
    const { token, user } = response.data;

    await setAuthToken(token);
    await setUserData(user);

    return { success: true, user };
  } catch (error) {
    const message = error.response?.data?.message || 'Login failed';
    return { success: false, error: message };
  }
};

/**
 * Register new user
 */
export const register = async (data) => {
  try {
    const response = await authAPI.register(data);
    const { token, user } = response.data;

    await setAuthToken(token);
    await setUserData(user);

    return { success: true, user };
  } catch (error) {
    const message = error.response?.data?.message || 'Registration failed';
    return { success: false, error: message };
  }
};

/**
 * Logout user
 */
export const logout = async () => {
  try {
    await removeAuthToken();
    await removeUserData();
    return { success: true };
  } catch (error) {
    console.error('Logout error:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Check if user is authenticated
 */
export const isAuthenticated = async () => {
  const token = await getAuthToken();
  return !!token;
};

/**
 * Get current user from storage
 */
export const getCurrentUser = async () => {
  return await getUserData();
};

/**
 * Refresh user data from server
 */
export const refreshUserData = async () => {
  try {
    const response = await authAPI.getProfile();
    const user = response.data.user || response.data;
    await setUserData(user);
    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Request password reset
 */
export const forgotPassword = async (email) => {
  try {
    await authAPI.forgotPassword(email);
    return { success: true };
  } catch (error) {
    const message = error.response?.data?.message || 'Failed to send reset email';
    return { success: false, error: message };
  }
};
