/**
 * Authentication Context
 * Provides auth state and methods throughout the app
 */
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import authService from '../services/authService';
import { registerForPushNotifications } from '../services/notifications';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [biometricInfo, setBiometricInfo] = useState({
    supported: false,
    type: null,
    enabled: false,
  });

  // Initialize auth state
  useEffect(() => {
    initializeAuth();
  }, []);

  const initializeAuth = async () => {
    try {
      // Check if user is authenticated
      const authenticated = await authService.isAuthenticated();

      if (authenticated) {
        // Get stored user data
        const userData = await authService.getCurrentUser();
        setUser(userData);

        // Refresh user data from server
        const refreshResult = await authService.refreshUserData();
        if (refreshResult.success) {
          setUser(refreshResult.user);
        }
      }

      // Check biometric support
      const biometricSupport = await authService.checkBiometricSupport();
      const biometricEnabled = await authService.isBiometricLoginEnabled();

      setBiometricInfo({
        supported: biometricSupport.supported,
        type: biometricSupport.type,
        enabled: biometricEnabled,
      });
    } catch (error) {
      console.error('Auth initialization error:', error);
    } finally {
      setLoading(false);
    }
  };

  /**
   * Login with email and password
   */
  const login = useCallback(async (email, password, rememberMe = false) => {
    const result = await authService.login(email, password, rememberMe);

    if (result.success) {
      setUser(result.user);
      // Register for push notifications after login
      await registerForPushNotifications();
    }

    return result;
  }, []);

  /**
   * Register new user
   */
  const register = useCallback(async (data) => {
    const result = await authService.register(data);

    if (result.success) {
      setUser(result.user);
      await registerForPushNotifications();
    }

    return result;
  }, []);

  /**
   * Logout user
   */
  const logout = useCallback(async () => {
    const result = await authService.logout();

    if (result.success) {
      setUser(null);
    }

    return result;
  }, []);

  /**
   * Request password reset
   */
  const forgotPassword = useCallback(async (email) => {
    return await authService.forgotPassword(email);
  }, []);

  /**
   * Verify OTP code
   */
  const verifyCode = useCallback(async (email, code) => {
    return await authService.verifyCode(email, code);
  }, []);

  /**
   * Reset password
   */
  const resetPassword = useCallback(async (token, newPassword) => {
    return await authService.resetPassword(token, newPassword);
  }, []);

  /**
   * Resend verification code
   */
  const resendCode = useCallback(async (email) => {
    return await authService.resendCode(email);
  }, []);

  /**
   * Login with biometrics
   */
  const loginWithBiometrics = useCallback(async () => {
    if (!biometricInfo.supported || !biometricInfo.enabled) {
      return { success: false, error: 'Biometric login not available' };
    }

    const result = await authService.loginWithBiometrics();

    if (result.success) {
      setUser(result.user);
    }

    return result;
  }, [biometricInfo]);

  /**
   * Enable biometric login
   */
  const enableBiometricLogin = useCallback(async () => {
    await authService.enableBiometricLogin();
    setBiometricInfo(prev => ({ ...prev, enabled: true }));
  }, []);

  /**
   * Disable biometric login
   */
  const disableBiometricLogin = useCallback(async () => {
    await authService.disableBiometricLogin();
    setBiometricInfo(prev => ({ ...prev, enabled: false }));
  }, []);

  /**
   * Update user data
   */
  const updateUser = useCallback((userData) => {
    setUser(userData);
  }, []);

  /**
   * Refresh user from server
   */
  const refreshUser = useCallback(async () => {
    const result = await authService.refreshUserData();
    if (result.success) {
      setUser(result.user);
    }
    return result;
  }, []);

  /**
   * Get saved email
   */
  const getSavedEmail = useCallback(async () => {
    return await authService.getSavedEmail();
  }, []);

  const value = {
    // State
    user,
    loading,
    isAuthenticated: !!user,
    biometricSupported: biometricInfo.supported,
    biometricType: biometricInfo.type,
    biometricEnabled: biometricInfo.enabled,

    // Auth methods
    login,
    register,
    logout,
    forgotPassword,
    verifyCode,
    resetPassword,
    resendCode,

    // Biometric methods
    loginWithBiometrics,
    enableBiometricLogin,
    disableBiometricLogin,

    // User methods
    updateUser,
    refreshUser,
    getSavedEmail,
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
