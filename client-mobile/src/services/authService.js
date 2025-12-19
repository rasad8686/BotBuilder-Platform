/**
 * Authentication Service
 * API calls for authentication operations
 */
import * as LocalAuthentication from 'expo-local-authentication';
import api from './api';
import {
  setAuthToken,
  getAuthToken,
  removeAuthToken,
  setUserData,
  getUserData,
  removeUserData,
  secureStorage,
} from '../utils/storage';

const BIOMETRIC_KEY = 'biometric_enabled';
const SAVED_EMAIL_KEY = 'saved_email';

/**
 * Login with email and password
 */
export const login = async (email, password, rememberMe = false) => {
  try {
    const response = await api.post('/api/auth/login', { email, password });
    const { token, user } = response.data;

    await setAuthToken(token);
    await setUserData(user);

    if (rememberMe) {
      await secureStorage.set(SAVED_EMAIL_KEY, email);
    }

    return { success: true, user, token };
  } catch (error) {
    const message = error.response?.data?.message ||
                   error.response?.data?.error ||
                   'Login failed. Please try again.';
    return { success: false, error: message };
  }
};

/**
 * Register new user
 */
export const register = async ({ name, email, password }) => {
  try {
    const response = await api.post('/api/auth/register', {
      name,
      email,
      password,
    });
    const { token, user } = response.data;

    await setAuthToken(token);
    await setUserData(user);

    return { success: true, user, token };
  } catch (error) {
    const message = error.response?.data?.message ||
                   error.response?.data?.error ||
                   'Registration failed. Please try again.';
    return { success: false, error: message };
  }
};

/**
 * Request password reset
 */
export const forgotPassword = async (email) => {
  try {
    await api.post('/api/auth/forgot-password', { email });
    return { success: true };
  } catch (error) {
    const message = error.response?.data?.message ||
                   'Failed to send reset email. Please try again.';
    return { success: false, error: message };
  }
};

/**
 * Verify OTP code
 */
export const verifyCode = async (email, code) => {
  try {
    const response = await api.post('/api/auth/verify-code', { email, code });
    const { token, resetToken } = response.data;
    return { success: true, token, resetToken };
  } catch (error) {
    const message = error.response?.data?.message ||
                   'Invalid verification code.';
    return { success: false, error: message };
  }
};

/**
 * Reset password with token
 */
export const resetPassword = async (resetToken, newPassword) => {
  try {
    await api.post('/api/auth/reset-password', {
      token: resetToken,
      password: newPassword,
    });
    return { success: true };
  } catch (error) {
    const message = error.response?.data?.message ||
                   'Failed to reset password.';
    return { success: false, error: message };
  }
};

/**
 * Resend verification code
 */
export const resendCode = async (email) => {
  try {
    await api.post('/api/auth/resend-code', { email });
    return { success: true };
  } catch (error) {
    const message = error.response?.data?.message ||
                   'Failed to resend code.';
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
    const response = await api.get('/api/auth/me');
    const user = response.data.user || response.data;
    await setUserData(user);
    return { success: true, user };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

/**
 * Get saved email for login
 */
export const getSavedEmail = async () => {
  return await secureStorage.get(SAVED_EMAIL_KEY);
};

// ===============================
// Biometric Authentication
// ===============================

/**
 * Check biometric support
 */
export const checkBiometricSupport = async () => {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

    let biometricType = null;
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      biometricType = 'face';
    } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      biometricType = 'fingerprint';
    }

    return {
      supported: compatible && enrolled,
      type: biometricType,
      types,
    };
  } catch (error) {
    console.error('Biometric check error:', error);
    return { supported: false, type: null, types: [] };
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
 * Enable biometric login
 */
export const enableBiometricLogin = async () => {
  await secureStorage.set(BIOMETRIC_KEY, 'true');
};

/**
 * Disable biometric login
 */
export const disableBiometricLogin = async () => {
  await secureStorage.remove(BIOMETRIC_KEY);
};

/**
 * Check if biometric login is enabled
 */
export const isBiometricLoginEnabled = async () => {
  const value = await secureStorage.get(BIOMETRIC_KEY);
  return value === 'true';
};

/**
 * Login with biometrics (uses stored session)
 */
export const loginWithBiometrics = async () => {
  try {
    // Check if biometric is enabled
    const enabled = await isBiometricLoginEnabled();
    if (!enabled) {
      return { success: false, error: 'Biometric login is not enabled' };
    }

    // Authenticate with biometrics
    const authResult = await authenticateWithBiometrics('Sign in to BotBuilder');
    if (!authResult.success) {
      return { success: false, error: authResult.error || 'Authentication failed' };
    }

    // Check for existing session
    const token = await getAuthToken();
    const user = await getUserData();

    if (token && user) {
      // Verify token is still valid
      try {
        const response = await api.get('/api/auth/me');
        const refreshedUser = response.data.user || response.data;
        await setUserData(refreshedUser);
        return { success: true, user: refreshedUser };
      } catch {
        // Token expired, need to re-login
        await logout();
        return { success: false, error: 'Session expired. Please login again.' };
      }
    }

    return { success: false, error: 'No stored session found' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};

export default {
  login,
  register,
  forgotPassword,
  verifyCode,
  resetPassword,
  resendCode,
  logout,
  isAuthenticated,
  getCurrentUser,
  refreshUserData,
  getSavedEmail,
  checkBiometricSupport,
  authenticateWithBiometrics,
  enableBiometricLogin,
  disableBiometricLogin,
  isBiometricLoginEnabled,
  loginWithBiometrics,
};
