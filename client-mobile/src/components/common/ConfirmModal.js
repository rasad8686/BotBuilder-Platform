/**
 * ConfirmModal Component
 * Confirmation dialogs for delete, logout, and other actions
 */
import React, { useEffect, useRef, useCallback, createContext, useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  Animated,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  TextInput,
} from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Preset configurations for common dialogs
 */
const PRESETS = {
  delete: {
    icon: '!',
    iconColor: '#ef4444',
    iconBg: '#fef2f2',
    title: 'Delete Item?',
    message: 'This action cannot be undone. Are you sure you want to continue?',
    confirmText: 'Delete',
    confirmColor: '#ef4444',
    cancelText: 'Cancel',
  },
  logout: {
    icon: '!',
    iconColor: '#f59e0b',
    iconBg: '#fffbeb',
    title: 'Log Out?',
    message: 'You will need to sign in again to access your account.',
    confirmText: 'Log Out',
    confirmColor: '#f59e0b',
    cancelText: 'Cancel',
  },
  discard: {
    icon: '!',
    iconColor: '#f59e0b',
    iconBg: '#fffbeb',
    title: 'Discard Changes?',
    message: 'You have unsaved changes. Are you sure you want to discard them?',
    confirmText: 'Discard',
    confirmColor: '#ef4444',
    cancelText: 'Keep Editing',
  },
  save: {
    icon: '?',
    iconColor: '#3b82f6',
    iconBg: '#eff6ff',
    title: 'Save Changes?',
    message: 'Do you want to save your changes before leaving?',
    confirmText: 'Save',
    confirmColor: '#22c55e',
    cancelText: "Don't Save",
  },
  confirm: {
    icon: '?',
    iconColor: '#6366f1',
    iconBg: '#e0e7ff',
    title: 'Confirm Action',
    message: 'Are you sure you want to proceed?',
    confirmText: 'Confirm',
    confirmColor: '#6366f1',
    cancelText: 'Cancel',
  },
};

/**
 * Main ConfirmModal Component
 */
export const ConfirmModal = ({
  visible,
  preset,
  icon,
  iconColor,
  iconBg,
  title,
  message,
  confirmText,
  confirmColor,
  cancelText,
  onConfirm,
  onCancel,
  loading = false,
  destructive = false,
  showCancel = true,
  closeOnBackdrop = true,
  hapticFeedback = true,
}) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  // Get preset config if provided
  const presetConfig = preset ? PRESETS[preset] : {};
  const config = {
    icon: icon || presetConfig.icon || '?',
    iconColor: iconColor || presetConfig.iconColor || '#6366f1',
    iconBg: iconBg || presetConfig.iconBg || '#e0e7ff',
    title: title || presetConfig.title || 'Confirm',
    message: message || presetConfig.message || 'Are you sure?',
    confirmText: confirmText || presetConfig.confirmText || 'Confirm',
    confirmColor: confirmColor || presetConfig.confirmColor || '#6366f1',
    cancelText: cancelText || presetConfig.cancelText || 'Cancel',
  };

  // Animation on mount
  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      scaleAnim.setValue(0.8);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleConfirm = () => {
    if (hapticFeedback) {
      try {
        if (destructive) {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        } else {
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        }
      } catch {}
    }
    onConfirm?.();
  };

  const handleCancel = () => {
    if (hapticFeedback) {
      try {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      } catch {}
    }
    onCancel?.();
  };

  const handleBackdrop = () => {
    if (closeOnBackdrop && !loading) {
      handleCancel();
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={handleCancel}
    >
      <Pressable style={styles.overlay} onPress={handleBackdrop}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.container,
              {
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Pressable>
              {/* Icon */}
              <View style={[styles.iconContainer, { backgroundColor: config.iconBg }]}>
                <Text style={[styles.icon, { color: config.iconColor }]}>
                  {config.icon}
                </Text>
              </View>

              {/* Title */}
              <Text style={styles.title}>{config.title}</Text>

              {/* Message */}
              <Text style={styles.message}>{config.message}</Text>

              {/* Buttons */}
              <View style={styles.buttonContainer}>
                {showCancel && (
                  <TouchableOpacity
                    style={[styles.button, styles.cancelButton]}
                    onPress={handleCancel}
                    disabled={loading}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.cancelButtonText}>{config.cancelText}</Text>
                  </TouchableOpacity>
                )}

                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.confirmButton,
                    { backgroundColor: config.confirmColor },
                    loading && styles.buttonDisabled,
                  ]}
                  onPress={handleConfirm}
                  disabled={loading}
                  activeOpacity={0.8}
                >
                  {loading ? (
                    <Text style={styles.confirmButtonText}>...</Text>
                  ) : (
                    <Text style={styles.confirmButtonText}>{config.confirmText}</Text>
                  )}
                </TouchableOpacity>
              </View>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

/**
 * Input Confirm Modal - with text input
 */
export const InputConfirmModal = ({
  visible,
  title = 'Enter Value',
  message,
  placeholder = 'Enter here...',
  initialValue = '',
  confirmText = 'Submit',
  cancelText = 'Cancel',
  onConfirm,
  onCancel,
  validation,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  maxLength,
}) => {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState('');
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      setValue(initialValue);
      setError('');
      Animated.parallel([
        Animated.spring(scaleAnim, {
          toValue: 1,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    }
  }, [visible, initialValue]);

  const handleConfirm = () => {
    if (validation) {
      const validationError = validation(value);
      if (validationError) {
        setError(validationError);
        try {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        } catch {}
        return;
      }
    }
    onConfirm?.(value);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardView}
        >
          <Animated.View
            style={[
              styles.container,
              {
                opacity: opacityAnim,
                transform: [{ scale: scaleAnim }],
              },
            ]}
          >
            <Pressable>
              <Text style={styles.title}>{title}</Text>
              {message && <Text style={styles.message}>{message}</Text>}

              <TextInput
                style={[styles.input, error && styles.inputError]}
                value={value}
                onChangeText={(text) => {
                  setValue(text);
                  setError('');
                }}
                placeholder={placeholder}
                placeholderTextColor="#94a3b8"
                keyboardType={keyboardType}
                autoCapitalize={autoCapitalize}
                maxLength={maxLength}
                autoFocus
              />

              {error && <Text style={styles.errorText}>{error}</Text>}

              <View style={styles.buttonContainer}>
                <TouchableOpacity
                  style={[styles.button, styles.cancelButton]}
                  onPress={onCancel}
                  activeOpacity={0.7}
                >
                  <Text style={styles.cancelButtonText}>{cancelText}</Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[styles.button, styles.confirmButton]}
                  onPress={handleConfirm}
                  activeOpacity={0.8}
                >
                  <Text style={styles.confirmButtonText}>{confirmText}</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </Animated.View>
        </KeyboardAvoidingView>
      </Pressable>
    </Modal>
  );
};

/**
 * Action Sheet Modal
 */
export const ActionSheet = ({
  visible,
  title,
  message,
  actions = [],
  cancelText = 'Cancel',
  onCancel,
}) => {
  const translateY = useRef(new Animated.Value(300)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (visible) {
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacityAnim, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();
    } else {
      translateY.setValue(300);
      opacityAnim.setValue(0);
    }
  }, [visible]);

  const handleAction = (action) => {
    try {
      if (action.destructive) {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      } else {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {}
    action.onPress?.();
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={onCancel}
    >
      <Animated.View style={[styles.sheetOverlay, { opacity: opacityAnim }]}>
        <Pressable style={styles.sheetBackdrop} onPress={onCancel} />

        <Animated.View
          style={[
            styles.sheetContainer,
            { transform: [{ translateY }] },
          ]}
        >
          {/* Header */}
          {(title || message) && (
            <View style={styles.sheetHeader}>
              {title && <Text style={styles.sheetTitle}>{title}</Text>}
              {message && <Text style={styles.sheetMessage}>{message}</Text>}
            </View>
          )}

          {/* Actions */}
          <View style={styles.sheetActions}>
            {actions.map((action, index) => (
              <TouchableOpacity
                key={index}
                style={[
                  styles.sheetAction,
                  index > 0 && styles.sheetActionBorder,
                ]}
                onPress={() => handleAction(action)}
                activeOpacity={0.7}
              >
                {action.icon && (
                  <Text style={styles.sheetActionIcon}>{action.icon}</Text>
                )}
                <Text
                  style={[
                    styles.sheetActionText,
                    action.destructive && styles.sheetActionTextDestructive,
                  ]}
                >
                  {action.label}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Cancel */}
          <TouchableOpacity
            style={styles.sheetCancel}
            onPress={onCancel}
            activeOpacity={0.7}
          >
            <Text style={styles.sheetCancelText}>{cancelText}</Text>
          </TouchableOpacity>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
};

/**
 * Confirm Context for global confirm dialogs
 */
const ConfirmContext = createContext(null);

export const useConfirm = () => {
  const context = useContext(ConfirmContext);
  if (!context) {
    throw new Error('useConfirm must be used within a ConfirmProvider');
  }
  return context;
};

/**
 * Confirm Provider Component
 */
export const ConfirmProvider = ({ children }) => {
  const [config, setConfig] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback((options) => {
    return new Promise((resolve) => {
      resolveRef.current = resolve;
      setConfig({ ...options, visible: true });
    });
  }, []);

  const handleConfirm = () => {
    setConfig(null);
    resolveRef.current?.(true);
  };

  const handleCancel = () => {
    setConfig(null);
    resolveRef.current?.(false);
  };

  // Convenience methods
  const confirmDelete = useCallback((options = {}) => {
    return confirm({ preset: 'delete', ...options });
  }, [confirm]);

  const confirmLogout = useCallback((options = {}) => {
    return confirm({ preset: 'logout', ...options });
  }, [confirm]);

  const confirmDiscard = useCallback((options = {}) => {
    return confirm({ preset: 'discard', ...options });
  }, [confirm]);

  const value = {
    confirm,
    confirmDelete,
    confirmLogout,
    confirmDiscard,
  };

  return (
    <ConfirmContext.Provider value={value}>
      {children}
      {config && (
        <ConfirmModal
          {...config}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
        />
      )}
    </ConfirmContext.Provider>
  );
};

const styles = StyleSheet.create({
  // ConfirmModal
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 24,
  },
  keyboardView: {
    width: '100%',
    alignItems: 'center',
  },
  container: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 24,
    width: '100%',
    maxWidth: 340,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.2,
    shadowRadius: 20,
    elevation: 10,
  },
  iconContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  icon: {
    fontSize: 32,
    fontWeight: '700',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  message: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  buttonContainer: {
    flexDirection: 'row',
    gap: 12,
    width: '100%',
  },
  button: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  cancelButton: {
    backgroundColor: '#f1f5f9',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#64748b',
  },
  confirmButton: {
    backgroundColor: '#6366f1',
  },
  confirmButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  buttonDisabled: {
    opacity: 0.6,
  },

  // InputConfirmModal
  input: {
    width: '100%',
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    color: '#1e293b',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  inputError: {
    borderColor: '#ef4444',
    backgroundColor: '#fef2f2',
  },
  errorText: {
    fontSize: 12,
    color: '#ef4444',
    marginBottom: 16,
    marginTop: -8,
  },

  // ActionSheet
  sheetOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  sheetBackdrop: {
    flex: 1,
  },
  sheetContainer: {
    backgroundColor: '#f8fafc',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingBottom: Platform.OS === 'ios' ? 34 : 16,
    paddingHorizontal: 8,
    paddingTop: 8,
  },
  sheetHeader: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    marginBottom: 8,
    alignItems: 'center',
  },
  sheetTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 4,
  },
  sheetMessage: {
    fontSize: 12,
    color: '#94a3b8',
    textAlign: 'center',
  },
  sheetActions: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    overflow: 'hidden',
  },
  sheetAction: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
  },
  sheetActionBorder: {
    borderTopWidth: 1,
    borderTopColor: '#f1f5f9',
  },
  sheetActionIcon: {
    fontSize: 20,
    marginRight: 12,
  },
  sheetActionText: {
    fontSize: 18,
    fontWeight: '500',
    color: '#3b82f6',
  },
  sheetActionTextDestructive: {
    color: '#ef4444',
  },
  sheetCancel: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: 8,
  },
  sheetCancelText: {
    fontSize: 18,
    fontWeight: '600',
    color: '#3b82f6',
  },
});

export default ConfirmModal;
