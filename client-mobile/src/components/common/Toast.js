/**
 * Toast Component
 * Success/error/info/warning toast messages with animations
 */
import React, { useEffect, useRef, useCallback, createContext, useContext, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
  Vibration,
} from 'react-native';
import * as Haptics from 'expo-haptics';

// Toast Types
const TOAST_TYPES = {
  success: {
    backgroundColor: '#22c55e',
    icon: 'OK',
    defaultTitle: 'Success',
  },
  error: {
    backgroundColor: '#ef4444',
    icon: '!',
    defaultTitle: 'Error',
  },
  warning: {
    backgroundColor: '#f59e0b',
    icon: '!',
    defaultTitle: 'Warning',
  },
  info: {
    backgroundColor: '#3b82f6',
    icon: 'i',
    defaultTitle: 'Info',
  },
};

/**
 * Single Toast Component
 */
export const Toast = ({
  visible,
  type = 'info',
  title,
  message,
  duration = 3000,
  onHide,
  position = 'top',
  showIcon = true,
  showClose = true,
  hapticFeedback = true,
}) => {
  const translateY = useRef(new Animated.Value(position === 'top' ? -100 : 100)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const progress = useRef(new Animated.Value(0)).current;

  const config = TOAST_TYPES[type] || TOAST_TYPES.info;

  // Trigger haptic feedback
  const triggerHaptic = useCallback(() => {
    if (!hapticFeedback) return;

    try {
      switch (type) {
        case 'success':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          break;
        case 'error':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
          break;
        case 'warning':
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
          break;
        default:
          Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
      }
    } catch {
      // Haptics not available
      if (type === 'error') {
        Vibration.vibrate(100);
      }
    }
  }, [type, hapticFeedback]);

  useEffect(() => {
    if (visible) {
      triggerHaptic();

      // Show animation
      Animated.parallel([
        Animated.spring(translateY, {
          toValue: 0,
          friction: 8,
          tension: 40,
          useNativeDriver: true,
        }),
        Animated.timing(opacity, {
          toValue: 1,
          duration: 200,
          useNativeDriver: true,
        }),
      ]).start();

      // Progress bar animation
      progress.setValue(0);
      Animated.timing(progress, {
        toValue: 1,
        duration,
        useNativeDriver: false,
      }).start();

      // Auto hide
      const timer = setTimeout(() => {
        hideToast();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const hideToast = () => {
    Animated.parallel([
      Animated.timing(translateY, {
        toValue: position === 'top' ? -100 : 100,
        duration: 200,
        useNativeDriver: true,
      }),
      Animated.timing(opacity, {
        toValue: 0,
        duration: 200,
        useNativeDriver: true,
      }),
    ]).start(() => {
      onHide?.();
    });
  };

  if (!visible) return null;

  const progressWidth = progress.interpolate({
    inputRange: [0, 1],
    outputRange: ['0%', '100%'],
  });

  return (
    <Animated.View
      style={[
        styles.container,
        position === 'top' ? styles.containerTop : styles.containerBottom,
        {
          backgroundColor: config.backgroundColor,
          transform: [{ translateY }],
          opacity,
        },
      ]}
    >
      <View style={styles.content}>
        {showIcon && (
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>{config.icon}</Text>
          </View>
        )}

        <View style={styles.textContainer}>
          <Text style={styles.title}>{title || config.defaultTitle}</Text>
          {message && <Text style={styles.message}>{message}</Text>}
        </View>

        {showClose && (
          <TouchableOpacity
            style={styles.closeButton}
            onPress={hideToast}
            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
          >
            <Text style={styles.closeIcon}>X</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Progress bar */}
      <View style={styles.progressContainer}>
        <Animated.View
          style={[
            styles.progressBar,
            { width: progressWidth },
          ]}
        />
      </View>
    </Animated.View>
  );
};

/**
 * Toast Context for global toast management
 */
const ToastContext = createContext(null);

export const useToast = () => {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error('useToast must be used within a ToastProvider');
  }
  return context;
};

/**
 * Toast Provider Component
 */
export const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = useState([]);
  const toastId = useRef(0);

  const show = useCallback((options) => {
    const id = ++toastId.current;
    const toast = {
      id,
      visible: true,
      type: 'info',
      duration: 3000,
      position: 'top',
      ...options,
    };

    setToasts((prev) => [...prev, toast]);

    return id;
  }, []);

  const hide = useCallback((id) => {
    setToasts((prev) =>
      prev.map((toast) =>
        toast.id === id ? { ...toast, visible: false } : toast
      )
    );

    // Remove from array after animation
    setTimeout(() => {
      setToasts((prev) => prev.filter((toast) => toast.id !== id));
    }, 300);
  }, []);

  const hideAll = useCallback(() => {
    setToasts((prev) =>
      prev.map((toast) => ({ ...toast, visible: false }))
    );

    setTimeout(() => {
      setToasts([]);
    }, 300);
  }, []);

  // Convenience methods
  const success = useCallback((message, options = {}) => {
    return show({ type: 'success', message, ...options });
  }, [show]);

  const error = useCallback((message, options = {}) => {
    return show({ type: 'error', message, ...options });
  }, [show]);

  const warning = useCallback((message, options = {}) => {
    return show({ type: 'warning', message, ...options });
  }, [show]);

  const info = useCallback((message, options = {}) => {
    return show({ type: 'info', message, ...options });
  }, [show]);

  const value = {
    show,
    hide,
    hideAll,
    success,
    error,
    warning,
    info,
  };

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastContainer toasts={toasts} onHide={hide} />
    </ToastContext.Provider>
  );
};

/**
 * Toast Container - renders all active toasts
 */
const ToastContainer = ({ toasts, onHide }) => {
  const topToasts = toasts.filter((t) => t.position === 'top');
  const bottomToasts = toasts.filter((t) => t.position === 'bottom');

  return (
    <>
      <View style={styles.toastContainerTop} pointerEvents="box-none">
        {topToasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onHide={() => onHide(toast.id)}
          />
        ))}
      </View>

      <View style={styles.toastContainerBottom} pointerEvents="box-none">
        {bottomToasts.map((toast) => (
          <Toast
            key={toast.id}
            {...toast}
            onHide={() => onHide(toast.id)}
          />
        ))}
      </View>
    </>
  );
};

/**
 * Snackbar - bottom toast variant with action
 */
export const Snackbar = ({
  visible,
  message,
  action,
  onAction,
  onDismiss,
  duration = 4000,
}) => {
  const translateY = useRef(new Animated.Value(100)).current;

  useEffect(() => {
    if (visible) {
      Animated.spring(translateY, {
        toValue: 0,
        friction: 8,
        useNativeDriver: true,
      }).start();

      const timer = setTimeout(() => {
        handleDismiss();
      }, duration);

      return () => clearTimeout(timer);
    }
  }, [visible]);

  const handleDismiss = () => {
    Animated.timing(translateY, {
      toValue: 100,
      duration: 200,
      useNativeDriver: true,
    }).start(() => {
      onDismiss?.();
    });
  };

  const handleAction = () => {
    onAction?.();
    handleDismiss();
  };

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.snackbar,
        { transform: [{ translateY }] },
      ]}
    >
      <Text style={styles.snackbarText}>{message}</Text>
      {action && (
        <TouchableOpacity onPress={handleAction}>
          <Text style={styles.snackbarAction}>{action}</Text>
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

/**
 * Inline Alert Component
 */
export const Alert = ({
  type = 'info',
  title,
  message,
  onClose,
  showIcon = true,
  style,
}) => {
  const config = TOAST_TYPES[type] || TOAST_TYPES.info;

  const getBackgroundColor = () => {
    switch (type) {
      case 'success':
        return '#f0fdf4';
      case 'error':
        return '#fef2f2';
      case 'warning':
        return '#fffbeb';
      case 'info':
        return '#eff6ff';
      default:
        return '#f1f5f9';
    }
  };

  const getBorderColor = () => {
    switch (type) {
      case 'success':
        return '#bbf7d0';
      case 'error':
        return '#fecaca';
      case 'warning':
        return '#fde68a';
      case 'info':
        return '#bfdbfe';
      default:
        return '#e2e8f0';
    }
  };

  const getTextColor = () => {
    switch (type) {
      case 'success':
        return '#166534';
      case 'error':
        return '#991b1b';
      case 'warning':
        return '#92400e';
      case 'info':
        return '#1e40af';
      default:
        return '#475569';
    }
  };

  return (
    <View
      style={[
        styles.alert,
        {
          backgroundColor: getBackgroundColor(),
          borderColor: getBorderColor(),
        },
        style,
      ]}
    >
      {showIcon && (
        <View
          style={[
            styles.alertIconContainer,
            { backgroundColor: config.backgroundColor },
          ]}
        >
          <Text style={styles.alertIcon}>{config.icon}</Text>
        </View>
      )}

      <View style={styles.alertContent}>
        {title && (
          <Text style={[styles.alertTitle, { color: getTextColor() }]}>
            {title}
          </Text>
        )}
        <Text style={[styles.alertMessage, { color: getTextColor() }]}>
          {message}
        </Text>
      </View>

      {onClose && (
        <TouchableOpacity
          style={styles.alertClose}
          onPress={onClose}
          hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
        >
          <Text style={[styles.alertCloseIcon, { color: getTextColor() }]}>
            X
          </Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  // Toast
  container: {
    marginHorizontal: 16,
    marginVertical: 8,
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 5,
  },
  containerTop: {
    marginTop: Platform.OS === 'ios' ? 50 : 10,
  },
  containerBottom: {
    marginBottom: Platform.OS === 'ios' ? 34 : 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
  },
  iconContainer: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  icon: {
    fontSize: 16,
    fontWeight: '700',
    color: '#ffffff',
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  message: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 2,
  },
  closeButton: {
    width: 24,
    height: 24,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  closeIcon: {
    fontSize: 14,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.8)',
  },
  progressContainer: {
    height: 3,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
  },
  progressBar: {
    height: '100%',
    backgroundColor: 'rgba(255, 255, 255, 0.5)',
  },

  // Toast Container
  toastContainerTop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },
  toastContainerBottom: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    zIndex: 9999,
  },

  // Snackbar
  snackbar: {
    position: 'absolute',
    bottom: Platform.OS === 'ios' ? 34 : 16,
    left: 16,
    right: 16,
    backgroundColor: '#1e293b',
    borderRadius: 8,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  snackbarText: {
    flex: 1,
    fontSize: 14,
    color: '#ffffff',
  },
  snackbarAction: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
    marginLeft: 16,
    textTransform: 'uppercase',
  },

  // Alert
  alert: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  alertIconContainer: {
    width: 24,
    height: 24,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  alertIcon: {
    fontSize: 12,
    fontWeight: '700',
    color: '#ffffff',
  },
  alertContent: {
    flex: 1,
  },
  alertTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 4,
  },
  alertMessage: {
    fontSize: 13,
    lineHeight: 20,
  },
  alertClose: {
    marginLeft: 12,
  },
  alertCloseIcon: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default Toast;
