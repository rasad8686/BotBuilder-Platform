/**
 * useBiometric Hook
 * Custom hook for biometric authentication
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import biometricService from '../services/biometricService';

/**
 * Main biometric authentication hook
 */
export const useBiometric = (options = {}) => {
  const { autoCheck = true } = options;

  const [isSupported, setIsSupported] = useState(false);
  const [isEnrolled, setIsEnrolled] = useState(false);
  const [isEnabled, setIsEnabled] = useState(false);
  const [biometricType, setBiometricType] = useState(null);
  const [biometricLabel, setBiometricLabel] = useState('');
  const [loading, setLoading] = useState(false);
  const [authenticating, setAuthenticating] = useState(false);
  const [error, setError] = useState(null);

  const mounted = useRef(true);

  // Check biometric support
  const checkSupport = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await biometricService.checkBiometricSupport();

    if (mounted.current) {
      setLoading(false);
      setIsSupported(result.isSupported);
      setIsEnrolled(result.isEnrolled);
      setBiometricType(result.type);
      setBiometricLabel(result.label);

      if (!result.success) {
        setError(result.reason);
      }
    }

    return result;
  }, []);

  // Check if enabled in app
  const checkEnabled = useCallback(async () => {
    const result = await biometricService.isBiometricEnabled();

    if (mounted.current) {
      setIsEnabled(result.enabled);
    }

    return result;
  }, []);

  // Authenticate
  const authenticate = useCallback(async (promptMessage) => {
    setAuthenticating(true);
    setError(null);

    const result = await biometricService.authenticateWithBiometric({
      promptMessage: promptMessage || `Authenticate with ${biometricLabel}`,
    });

    if (mounted.current) {
      setAuthenticating(false);

      if (!result.success) {
        setError(result.error);
      }
    }

    return result;
  }, [biometricLabel]);

  // Quick authenticate
  const quickAuth = useCallback(async (message) => {
    setAuthenticating(true);

    const success = await biometricService.quickAuthenticate(message);

    if (mounted.current) {
      setAuthenticating(false);
    }

    return success;
  }, []);

  // Enable biometric for app
  const enable = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await biometricService.enableBiometric();

    if (mounted.current) {
      setLoading(false);

      if (result.success) {
        setIsEnabled(true);
      } else {
        setError(result.error);
      }
    }

    return result;
  }, []);

  // Disable biometric for app
  const disable = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await biometricService.disableBiometric();

    if (mounted.current) {
      setLoading(false);

      if (result.success) {
        setIsEnabled(false);
      } else {
        setError(result.error);
      }
    }

    return result;
  }, []);

  // Toggle biometric
  const toggle = useCallback(async () => {
    if (isEnabled) {
      return disable();
    } else {
      return enable();
    }
  }, [isEnabled, enable, disable]);

  // Initial checks
  useEffect(() => {
    mounted.current = true;

    if (autoCheck) {
      checkSupport();
      checkEnabled();
    }

    return () => {
      mounted.current = false;
    };
  }, [autoCheck, checkSupport, checkEnabled]);

  // Re-check on app state change
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Re-check support when app becomes active (user might have changed settings)
        checkSupport();
        checkEnabled();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkSupport, checkEnabled]);

  // Get icon for current biometric type
  const icon = biometricService.getBiometricIcon(biometricType);

  // Can use biometric (supported + enrolled + enabled)
  const canUseBiometric = isSupported && isEnrolled && isEnabled;

  // Available for setup (supported + enrolled but not enabled)
  const availableForSetup = isSupported && isEnrolled && !isEnabled;

  return {
    // State
    isSupported,
    isEnrolled,
    isEnabled,
    biometricType,
    biometricLabel,
    icon,
    loading,
    authenticating,
    error,

    // Computed
    canUseBiometric,
    availableForSetup,

    // Methods
    checkSupport,
    checkEnabled,
    authenticate,
    quickAuth,
    enable,
    disable,
    toggle,
  };
};

/**
 * Hook for biometric-protected actions
 */
export const useBiometricProtection = (action, options = {}) => {
  const { promptMessage = 'Authenticate to continue', enabled = true } = options;

  const { canUseBiometric, authenticate, authenticating, error } = useBiometric();

  const executeWithProtection = useCallback(async (...args) => {
    if (!enabled || !canUseBiometric) {
      // Execute without biometric
      return action(...args);
    }

    // Authenticate first
    const result = await authenticate(promptMessage);

    if (result.success) {
      return action(...args);
    }

    // Return null or throw based on preference
    return null;
  }, [enabled, canUseBiometric, authenticate, promptMessage, action]);

  return {
    execute: executeWithProtection,
    loading: authenticating,
    error,
    isProtected: enabled && canUseBiometric,
  };
};

/**
 * Hook for app lock with biometric
 */
export const useAppLock = (options = {}) => {
  const {
    lockOnBackground = true,
    lockTimeout = 0, // 0 = immediate, or milliseconds
  } = options;

  const [isLocked, setIsLocked] = useState(false);
  const { canUseBiometric, authenticate, authenticating } = useBiometric();

  const backgroundTimeRef = useRef(null);

  // Unlock the app
  const unlock = useCallback(async () => {
    if (!canUseBiometric) {
      setIsLocked(false);
      return { success: true };
    }

    const result = await authenticate('Unlock BotBuilder');

    if (result.success) {
      setIsLocked(false);
    }

    return result;
  }, [canUseBiometric, authenticate]);

  // Lock the app
  const lock = useCallback(() => {
    if (canUseBiometric) {
      setIsLocked(true);
    }
  }, [canUseBiometric]);

  // Handle app state changes
  useEffect(() => {
    if (!lockOnBackground || !canUseBiometric) return;

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        backgroundTimeRef.current = Date.now();
      } else if (nextAppState === 'active') {
        if (backgroundTimeRef.current) {
          const elapsed = Date.now() - backgroundTimeRef.current;

          if (elapsed >= lockTimeout) {
            setIsLocked(true);
          }

          backgroundTimeRef.current = null;
        }
      }
    });

    return () => {
      subscription.remove();
    };
  }, [lockOnBackground, lockTimeout, canUseBiometric]);

  return {
    isLocked,
    isUnlocking: authenticating,
    lock,
    unlock,
    canUseBiometric,
  };
};

export default {
  useBiometric,
  useBiometricProtection,
  useAppLock,
};
