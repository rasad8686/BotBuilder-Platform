/**
 * BiometricButton Component
 * Face ID / Touch ID / Fingerprint authentication button
 */
import React, { useEffect, useState } from 'react';
import {
  TouchableOpacity,
  Text,
  StyleSheet,
  View,
  Platform,
  ActivityIndicator,
} from 'react-native';
import * as LocalAuthentication from 'expo-local-authentication';

const BiometricButton = ({
  onPress,
  disabled = false,
  loading = false,
  style = {},
}) => {
  const [biometricType, setBiometricType] = useState(null);
  const [isSupported, setIsSupported] = useState(false);

  useEffect(() => {
    checkBiometricSupport();
  }, []);

  const checkBiometricSupport = async () => {
    try {
      const compatible = await LocalAuthentication.hasHardwareAsync();
      const enrolled = await LocalAuthentication.isEnrolledAsync();

      if (compatible && enrolled) {
        setIsSupported(true);
        const types = await LocalAuthentication.supportedAuthenticationTypesAsync();

        if (types.includes(LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION)) {
          setBiometricType('face');
        } else if (types.includes(LocalAuthentication.AuthenticationType.FINGERPRINT)) {
          setBiometricType('fingerprint');
        } else if (types.includes(LocalAuthentication.AuthenticationType.IRIS)) {
          setBiometricType('iris');
        }
      }
    } catch (error) {
      console.log('Biometric check error:', error);
    }
  };

  if (!isSupported || !biometricType) {
    return null;
  }

  const getIcon = () => {
    switch (biometricType) {
      case 'face':
        return Platform.OS === 'ios' ? '👤' : '😊';
      case 'fingerprint':
        return '👆';
      case 'iris':
        return '👁️';
      default:
        return '🔐';
    }
  };

  const getLabel = () => {
    switch (biometricType) {
      case 'face':
        return Platform.OS === 'ios' ? 'Sign in with Face ID' : 'Sign in with Face Recognition';
      case 'fingerprint':
        return Platform.OS === 'ios' ? 'Sign in with Touch ID' : 'Sign in with Fingerprint';
      case 'iris':
        return 'Sign in with Iris';
      default:
        return 'Sign in with Biometrics';
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, disabled && styles.disabled, style]}
      onPress={onPress}
      disabled={disabled || loading}
      activeOpacity={0.7}
    >
      {loading ? (
        <ActivityIndicator color="#6366f1" size="small" />
      ) : (
        <>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{getIcon()}</Text>
          </View>
          <Text style={styles.label}>{getLabel()}</Text>
        </>
      )}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 14,
    paddingVertical: 16,
    paddingHorizontal: 24,
    gap: 12,
  },
  disabled: {
    opacity: 0.5,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 18,
  },
  label: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
  },
});

export default BiometricButton;
