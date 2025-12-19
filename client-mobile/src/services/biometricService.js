/**
 * Biometric Authentication Service
 * Handles Face ID, Touch ID, and Fingerprint authentication
 */
import * as LocalAuthentication from 'expo-local-authentication';
import { Platform } from 'react-native';
import { setBiometricEnabled, getBiometricEnabled } from '../utils/storage';

// Biometric Types
export const BIOMETRIC_TYPES = {
  FINGERPRINT: 'fingerprint',
  FACE_ID: 'faceId',
  IRIS: 'iris',
  NONE: 'none',
};

// Authentication Result Types
export const AUTH_RESULT = {
  SUCCESS: 'success',
  CANCELLED: 'cancelled',
  FAILED: 'failed',
  NOT_ENROLLED: 'not_enrolled',
  NOT_AVAILABLE: 'not_available',
  ERROR: 'error',
};

/**
 * Check if device has biometric hardware
 */
export const hasHardwareAsync = async () => {
  try {
    const compatible = await LocalAuthentication.hasHardwareAsync();
    return { success: true, hasHardware: compatible };
  } catch (error) {
    console.error('Error checking biometric hardware:', error);
    return { success: false, hasHardware: false, error: error.message };
  }
};

/**
 * Check if biometric authentication is enrolled
 */
export const isEnrolledAsync = async () => {
  try {
    const enrolled = await LocalAuthentication.isEnrolledAsync();
    return { success: true, isEnrolled: enrolled };
  } catch (error) {
    console.error('Error checking biometric enrollment:', error);
    return { success: false, isEnrolled: false, error: error.message };
  }
};

/**
 * Get supported authentication types
 */
export const getSupportedAuthTypes = async () => {
  try {
    const types = await LocalAuthentication.supportedAuthenticationTypesAsync();
    return { success: true, types };
  } catch (error) {
    console.error('Error getting supported auth types:', error);
    return { success: false, types: [], error: error.message };
  }
};

/**
 * Get biometric type string (Face ID / Touch ID / Fingerprint)
 */
export const getBiometricType = async () => {
  try {
    const { types } = await getSupportedAuthTypes();

    if (!types || types.length === 0) {
      return { success: true, type: BIOMETRIC_TYPES.NONE, label: 'None' };
    }

    // Check for Face ID (iOS) or Facial Recognition (Android)
    if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
      return {
        success: true,
        type: BIOMETRIC_TYPES.FACE_ID,
        label: Platform.OS === 'ios' ? 'Face ID' : 'Face Recognition',
      };
    }

    // Check for Touch ID (iOS) or Fingerprint (Android)
    if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
      return {
        success: true,
        type: BIOMETRIC_TYPES.FINGERPRINT,
        label: Platform.OS === 'ios' ? 'Touch ID' : 'Fingerprint',
      };
    }

    // Check for Iris scanner (some Android devices)
    if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
      return {
        success: true,
        type: BIOMETRIC_TYPES.IRIS,
        label: 'Iris Scanner',
      };
    }

    return { success: true, type: BIOMETRIC_TYPES.NONE, label: 'None' };
  } catch (error) {
    console.error('Error getting biometric type:', error);
    return { success: false, type: BIOMETRIC_TYPES.NONE, label: 'None', error: error.message };
  }
};

/**
 * Check full biometric support (hardware + enrollment)
 */
export const checkBiometricSupport = async () => {
  try {
    const { hasHardware } = await hasHardwareAsync();

    if (!hasHardware) {
      return {
        success: true,
        isSupported: false,
        isEnrolled: false,
        type: BIOMETRIC_TYPES.NONE,
        label: 'Not Available',
        reason: 'Device does not have biometric hardware',
      };
    }

    const { isEnrolled } = await isEnrolledAsync();

    if (!isEnrolled) {
      return {
        success: true,
        isSupported: true,
        isEnrolled: false,
        type: BIOMETRIC_TYPES.NONE,
        label: 'Not Configured',
        reason: 'Biometric authentication is not set up on this device',
      };
    }

    const { type, label } = await getBiometricType();

    return {
      success: true,
      isSupported: true,
      isEnrolled: true,
      type,
      label,
      reason: null,
    };
  } catch (error) {
    console.error('Error checking biometric support:', error);
    return {
      success: false,
      isSupported: false,
      isEnrolled: false,
      type: BIOMETRIC_TYPES.NONE,
      label: 'Error',
      reason: error.message,
    };
  }
};

/**
 * Authenticate with biometric
 */
export const authenticateWithBiometric = async (options = {}) => {
  const {
    promptMessage = 'Authenticate to continue',
    cancelLabel = 'Cancel',
    fallbackLabel = 'Use Password',
    disableDeviceFallback = false,
  } = options;

  try {
    // Check support first
    const support = await checkBiometricSupport();

    if (!support.isSupported) {
      return {
        success: false,
        result: AUTH_RESULT.NOT_AVAILABLE,
        error: support.reason,
      };
    }

    if (!support.isEnrolled) {
      return {
        success: false,
        result: AUTH_RESULT.NOT_ENROLLED,
        error: support.reason,
      };
    }

    // Authenticate
    const result = await LocalAuthentication.authenticateAsync({
      promptMessage,
      cancelLabel,
      fallbackLabel,
      disableDeviceFallback,
    });

    if (result.success) {
      return {
        success: true,
        result: AUTH_RESULT.SUCCESS,
      };
    }

    // Handle failure
    if (result.error === 'user_cancel') {
      return {
        success: false,
        result: AUTH_RESULT.CANCELLED,
        error: 'Authentication cancelled by user',
      };
    }

    return {
      success: false,
      result: AUTH_RESULT.FAILED,
      error: result.error || 'Authentication failed',
    };
  } catch (error) {
    console.error('Error during biometric authentication:', error);
    return {
      success: false,
      result: AUTH_RESULT.ERROR,
      error: error.message,
    };
  }
};

/**
 * Quick biometric authentication (simplified)
 */
export const quickAuthenticate = async (message) => {
  const result = await authenticateWithBiometric({
    promptMessage: message || 'Verify your identity',
    disableDeviceFallback: true,
  });

  return result.success;
};

/**
 * Check if biometric is enabled for the app
 */
export const isBiometricEnabled = async () => {
  try {
    const enabled = await getBiometricEnabled();
    return { success: true, enabled: !!enabled };
  } catch (error) {
    console.error('Error checking biometric enabled status:', error);
    return { success: false, enabled: false, error: error.message };
  }
};

/**
 * Enable biometric authentication for the app
 */
export const enableBiometric = async () => {
  try {
    // Check support first
    const support = await checkBiometricSupport();

    if (!support.isSupported || !support.isEnrolled) {
      return {
        success: false,
        error: support.reason || 'Biometric not available',
      };
    }

    // Verify with biometric before enabling
    const auth = await authenticateWithBiometric({
      promptMessage: 'Verify to enable biometric login',
    });

    if (!auth.success) {
      return {
        success: false,
        error: auth.error || 'Verification failed',
      };
    }

    // Enable in storage
    await setBiometricEnabled(true);

    return { success: true };
  } catch (error) {
    console.error('Error enabling biometric:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Disable biometric authentication for the app
 */
export const disableBiometric = async () => {
  try {
    await setBiometricEnabled(false);
    return { success: true };
  } catch (error) {
    console.error('Error disabling biometric:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Toggle biometric authentication
 */
export const toggleBiometric = async () => {
  try {
    const { enabled } = await isBiometricEnabled();

    if (enabled) {
      return disableBiometric();
    } else {
      return enableBiometric();
    }
  } catch (error) {
    console.error('Error toggling biometric:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get security level of biometric
 */
export const getSecurityLevel = async () => {
  try {
    const level = await LocalAuthentication.getEnrolledLevelAsync();

    const levels = {
      [LocalAuthentication.SecurityLevel.NONE]: 'none',
      [LocalAuthentication.SecurityLevel.SECRET]: 'secret',
      [LocalAuthentication.SecurityLevel.BIOMETRIC_WEAK]: 'weak',
      [LocalAuthentication.SecurityLevel.BIOMETRIC_STRONG]: 'strong',
    };

    return {
      success: true,
      level: levels[level] || 'unknown',
      rawLevel: level,
    };
  } catch (error) {
    console.error('Error getting security level:', error);
    return { success: false, level: 'unknown', error: error.message };
  }
};

/**
 * Get biometric icon based on type
 */
export const getBiometricIcon = (type) => {
  switch (type) {
    case BIOMETRIC_TYPES.FACE_ID:
      return '😊';
    case BIOMETRIC_TYPES.FINGERPRINT:
      return '👆';
    case BIOMETRIC_TYPES.IRIS:
      return '👁️';
    default:
      return '🔐';
  }
};

/**
 * Get biometric description
 */
export const getBiometricDescription = async () => {
  const support = await checkBiometricSupport();

  if (!support.isSupported) {
    return 'Biometric authentication is not available on this device';
  }

  if (!support.isEnrolled) {
    return `Please set up ${support.label} in your device settings to use biometric login`;
  }

  return `Use ${support.label} for quick and secure access`;
};

export default {
  BIOMETRIC_TYPES,
  AUTH_RESULT,
  hasHardwareAsync,
  isEnrolledAsync,
  getSupportedAuthTypes,
  getBiometricType,
  checkBiometricSupport,
  authenticateWithBiometric,
  quickAuthenticate,
  isBiometricEnabled,
  enableBiometric,
  disableBiometric,
  toggleBiometric,
  getSecurityLevel,
  getBiometricIcon,
  getBiometricDescription,
};
