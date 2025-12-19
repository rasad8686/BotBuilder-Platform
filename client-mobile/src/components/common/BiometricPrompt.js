/**
 * BiometricPrompt Component
 * Biometric authentication UI modal
 */
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ActivityIndicator,
  Animated,
  Easing,
} from 'react-native';
import { useBiometric } from '../../hooks/useBiometric';

/**
 * Biometric icon animation component
 */
const BiometricIcon = ({ type, label, animating }) => {
  const [scaleAnim] = useState(new Animated.Value(1));

  useEffect(() => {
    if (animating) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scaleAnim, {
            toValue: 1.1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(scaleAnim, {
            toValue: 1,
            duration: 500,
            easing: Easing.inOut(Easing.ease),
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      scaleAnim.setValue(1);
    }
  }, [animating, scaleAnim]);

  const getIcon = () => {
    switch (type) {
      case 'faceId':
        return '😊';
      case 'fingerprint':
        return '👆';
      case 'iris':
        return '👁️';
      default:
        return '🔐';
    }
  };

  return (
    <Animated.View
      style={[
        styles.iconContainer,
        { transform: [{ scale: scaleAnim }] },
      ]}
    >
      <Text style={styles.biometricIcon}>{getIcon()}</Text>
      {animating && (
        <View style={styles.iconRing} />
      )}
    </Animated.View>
  );
};

/**
 * Main BiometricPrompt component
 */
export const BiometricPrompt = ({
  visible,
  onSuccess,
  onCancel,
  onError,
  title = 'Authenticate',
  subtitle,
  cancelText = 'Cancel',
  showCancel = true,
}) => {
  const {
    biometricType,
    biometricLabel,
    authenticate,
    authenticating,
    error,
  } = useBiometric();

  const [status, setStatus] = useState('idle'); // idle, authenticating, success, error

  // Handle authentication
  const handleAuthenticate = async () => {
    setStatus('authenticating');

    const result = await authenticate(title);

    if (result.success) {
      setStatus('success');
      setTimeout(() => {
        onSuccess?.();
      }, 500);
    } else {
      setStatus('error');
      onError?.(result.error);
    }
  };

  // Auto-authenticate when modal opens
  useEffect(() => {
    if (visible && status === 'idle') {
      handleAuthenticate();
    }
  }, [visible]);

  // Reset status when modal closes
  useEffect(() => {
    if (!visible) {
      setStatus('idle');
    }
  }, [visible]);

  // Handle retry
  const handleRetry = () => {
    setStatus('idle');
    handleAuthenticate();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onCancel}
    >
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Icon */}
          <BiometricIcon
            type={biometricType}
            label={biometricLabel}
            animating={status === 'authenticating'}
          />

          {/* Title */}
          <Text style={styles.title}>{title}</Text>

          {/* Subtitle */}
          <Text style={styles.subtitle}>
            {subtitle || `Use ${biometricLabel} to continue`}
          </Text>

          {/* Status */}
          {status === 'authenticating' && (
            <View style={styles.statusContainer}>
              <ActivityIndicator color="#6366f1" />
              <Text style={styles.statusText}>Authenticating...</Text>
            </View>
          )}

          {status === 'success' && (
            <View style={styles.statusContainer}>
              <Text style={styles.successIcon}>✓</Text>
              <Text style={styles.statusText}>Success!</Text>
            </View>
          )}

          {status === 'error' && (
            <View style={styles.statusContainer}>
              <Text style={styles.errorIcon}>!</Text>
              <Text style={styles.errorText}>{error || 'Authentication failed'}</Text>
              <TouchableOpacity style={styles.retryButton} onPress={handleRetry}>
                <Text style={styles.retryText}>Try Again</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Cancel Button */}
          {showCancel && status !== 'success' && (
            <TouchableOpacity
              style={styles.cancelButton}
              onPress={onCancel}
              disabled={status === 'authenticating'}
            >
              <Text style={styles.cancelText}>{cancelText}</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

/**
 * Compact biometric button for inline use
 */
export const BiometricButton = ({
  onSuccess,
  onError,
  label,
  disabled = false,
  style,
}) => {
  const {
    biometricType,
    biometricLabel,
    icon,
    authenticate,
    authenticating,
    canUseBiometric,
  } = useBiometric();

  const handlePress = async () => {
    const result = await authenticate();

    if (result.success) {
      onSuccess?.();
    } else {
      onError?.(result.error);
    }
  };

  if (!canUseBiometric) return null;

  return (
    <TouchableOpacity
      style={[styles.biometricButton, disabled && styles.buttonDisabled, style]}
      onPress={handlePress}
      disabled={disabled || authenticating}
      activeOpacity={0.7}
    >
      {authenticating ? (
        <ActivityIndicator color="#6366f1" size="small" />
      ) : (
        <>
          <Text style={styles.buttonIcon}>{icon}</Text>
          <Text style={styles.buttonLabel}>
            {label || `Use ${biometricLabel}`}
          </Text>
        </>
      )}
    </TouchableOpacity>
  );
};

/**
 * Biometric toggle setting item
 */
export const BiometricToggle = ({ style }) => {
  const {
    isSupported,
    isEnrolled,
    isEnabled,
    biometricLabel,
    icon,
    toggle,
    loading,
  } = useBiometric();

  if (!isSupported || !isEnrolled) return null;

  return (
    <TouchableOpacity
      style={[styles.toggleContainer, style]}
      onPress={toggle}
      disabled={loading}
      activeOpacity={0.7}
    >
      <View style={styles.toggleIcon}>
        <Text style={styles.toggleEmoji}>{icon}</Text>
      </View>
      <View style={styles.toggleContent}>
        <Text style={styles.toggleTitle}>Use {biometricLabel}</Text>
        <Text style={styles.toggleSubtitle}>
          {isEnabled ? 'Enabled' : 'Quick and secure access'}
        </Text>
      </View>
      <View style={[styles.toggleSwitch, isEnabled && styles.toggleSwitchOn]}>
        <View style={[styles.toggleThumb, isEnabled && styles.toggleThumbOn]} />
      </View>
    </TouchableOpacity>
  );
};

/**
 * Lock screen overlay
 */
export const LockScreen = ({
  visible,
  onUnlock,
  title = 'App Locked',
  subtitle = 'Authenticate to unlock',
}) => {
  const { biometricLabel, icon, authenticate, authenticating } = useBiometric();

  const handleUnlock = async () => {
    const result = await authenticate('Unlock App');
    if (result.success) {
      onUnlock?.();
    }
  };

  if (!visible) return null;

  return (
    <View style={styles.lockScreen}>
      <View style={styles.lockContent}>
        <View style={styles.lockIconContainer}>
          <Text style={styles.lockIcon}>🔒</Text>
        </View>

        <Text style={styles.lockTitle}>{title}</Text>
        <Text style={styles.lockSubtitle}>{subtitle}</Text>

        <TouchableOpacity
          style={styles.unlockButton}
          onPress={handleUnlock}
          disabled={authenticating}
          activeOpacity={0.8}
        >
          {authenticating ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Text style={styles.unlockIcon}>{icon}</Text>
              <Text style={styles.unlockText}>Unlock with {biometricLabel}</Text>
            </>
          )}
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  // BiometricPrompt
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 24,
    padding: 32,
    alignItems: 'center',
    width: '100%',
    maxWidth: 320,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
    position: 'relative',
  },
  biometricIcon: {
    fontSize: 40,
  },
  iconRing: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    borderWidth: 2,
    borderColor: '#6366f1',
    opacity: 0.5,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  subtitle: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    marginBottom: 24,
  },
  statusContainer: {
    alignItems: 'center',
    marginBottom: 16,
  },
  statusText: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 8,
  },
  successIcon: {
    fontSize: 32,
    color: '#22c55e',
  },
  errorIcon: {
    fontSize: 32,
    color: '#ef4444',
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#fef2f2',
    textAlign: 'center',
    lineHeight: 40,
  },
  errorText: {
    fontSize: 14,
    color: '#ef4444',
    marginTop: 8,
    textAlign: 'center',
  },
  retryButton: {
    marginTop: 12,
    paddingVertical: 8,
    paddingHorizontal: 20,
    backgroundColor: '#6366f1',
    borderRadius: 8,
  },
  retryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  cancelButton: {
    paddingVertical: 12,
    paddingHorizontal: 24,
  },
  cancelText: {
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b',
  },

  // BiometricButton
  biometricButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 24,
    backgroundColor: '#f0f9ff',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#6366f1',
    gap: 10,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonIcon: {
    fontSize: 20,
  },
  buttonLabel: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
  },

  // BiometricToggle
  toggleContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  toggleIcon: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  toggleEmoji: {
    fontSize: 22,
  },
  toggleContent: {
    flex: 1,
  },
  toggleTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  toggleSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  toggleSwitch: {
    width: 50,
    height: 30,
    borderRadius: 15,
    backgroundColor: '#e2e8f0',
    padding: 3,
    justifyContent: 'center',
  },
  toggleSwitchOn: {
    backgroundColor: '#6366f1',
  },
  toggleThumb: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: '#ffffff',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleThumbOn: {
    alignSelf: 'flex-end',
  },

  // LockScreen
  lockScreen: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#f8fafc',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  lockContent: {
    alignItems: 'center',
    padding: 32,
  },
  lockIconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  lockIcon: {
    fontSize: 48,
  },
  lockTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  lockSubtitle: {
    fontSize: 16,
    color: '#64748b',
    marginBottom: 32,
  },
  unlockButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#6366f1',
    paddingVertical: 16,
    paddingHorizontal: 32,
    borderRadius: 14,
    gap: 10,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  unlockIcon: {
    fontSize: 20,
  },
  unlockText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default BiometricPrompt;
