/**
 * usePushNotifications Hook
 * Custom hook for push notification management
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { AppState } from 'react-native';
import pushService from '../services/pushService';

/**
 * Main push notifications hook
 */
export const usePushNotifications = (options = {}) => {
  const {
    onNotificationReceived,
    onNotificationResponse,
    autoRegister = true,
  } = options;

  const [token, setToken] = useState(null);
  const [permission, setPermission] = useState('undetermined');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const mounted = useRef(true);
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  // Check permission status
  const checkPermission = useCallback(async () => {
    const result = await pushService.getNotificationPermissionStatus();
    if (mounted.current) {
      setPermission(result.status);
    }
    return result;
  }, []);

  // Request permission
  const requestPermission = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await pushService.requestNotificationPermission();

    if (mounted.current) {
      setLoading(false);
      setPermission(result.status);

      if (!result.granted) {
        setError('Permission denied');
      }
    }

    return result;
  }, []);

  // Register for push notifications
  const register = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await pushService.registerForPushNotifications();

    if (mounted.current) {
      setLoading(false);

      if (result.success) {
        setToken(result.token);
      } else {
        setError(result.error);
      }
    }

    return result;
  }, []);

  // Unregister from push notifications
  const unregister = useCallback(async () => {
    setLoading(true);
    setError(null);

    const result = await pushService.unregisterFromPushNotifications();

    if (mounted.current) {
      setLoading(false);

      if (result.success) {
        setToken(null);
      } else {
        setError(result.error);
      }
    }

    return result;
  }, []);

  // Setup listeners
  useEffect(() => {
    mounted.current = true;

    // Notification received listener
    notificationListener.current = pushService.addNotificationReceivedListener(
      (notification) => {
        if (onNotificationReceived) {
          onNotificationReceived(notification);
        }
      }
    );

    // Notification response listener (when user taps)
    responseListener.current = pushService.addNotificationResponseListener(
      (response) => {
        if (onNotificationResponse) {
          onNotificationResponse(response);
        }
      }
    );

    // Check for last notification response (app opened via notification)
    pushService.getLastNotificationResponse().then((result) => {
      if (result.response && onNotificationResponse) {
        onNotificationResponse(result.response);
      }
    });

    // Auto register if enabled
    if (autoRegister) {
      checkPermission().then((result) => {
        if (result.status === 'granted') {
          register();
        }
      });
    } else {
      checkPermission();
    }

    return () => {
      mounted.current = false;

      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [autoRegister, checkPermission, register, onNotificationReceived, onNotificationResponse]);

  // Handle app state changes
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active') {
        // Refresh permission status when app becomes active
        checkPermission();
      }
    });

    return () => {
      subscription.remove();
    };
  }, [checkPermission]);

  return {
    token,
    permission,
    loading,
    error,
    isGranted: permission === 'granted',
    isDenied: permission === 'denied',
    checkPermission,
    requestPermission,
    register,
    unregister,
  };
};

/**
 * Hook for scheduling local notifications
 */
export const useLocalNotifications = () => {
  const [scheduled, setScheduled] = useState([]);
  const [loading, setLoading] = useState(false);

  // Fetch scheduled notifications
  const fetchScheduled = useCallback(async () => {
    setLoading(true);
    const result = await pushService.getScheduledNotifications();
    setLoading(false);

    if (result.success) {
      setScheduled(result.notifications);
    }

    return result;
  }, []);

  // Schedule a notification
  const schedule = useCallback(async (notification) => {
    const result = await pushService.scheduleLocalNotification(notification);

    if (result.success) {
      await fetchScheduled();
    }

    return result;
  }, [fetchScheduled]);

  // Schedule at specific time
  const scheduleAt = useCallback(async (notification, date) => {
    const result = await pushService.scheduleNotificationAtTime({
      ...notification,
      date,
    });

    if (result.success) {
      await fetchScheduled();
    }

    return result;
  }, [fetchScheduled]);

  // Cancel a notification
  const cancel = useCallback(async (identifier) => {
    const result = await pushService.cancelNotification(identifier);

    if (result.success) {
      setScheduled((prev) => prev.filter((n) => n.identifier !== identifier));
    }

    return result;
  }, []);

  // Cancel all notifications
  const cancelAll = useCallback(async () => {
    const result = await pushService.cancelAllNotifications();

    if (result.success) {
      setScheduled([]);
    }

    return result;
  }, []);

  // Initial fetch
  useEffect(() => {
    fetchScheduled();
  }, [fetchScheduled]);

  return {
    scheduled,
    loading,
    schedule,
    scheduleAt,
    cancel,
    cancelAll,
    refresh: fetchScheduled,
  };
};

/**
 * Hook for badge count management
 */
export const useBadgeCount = () => {
  const [count, setCount] = useState(0);

  // Fetch current badge count
  const fetchCount = useCallback(async () => {
    const result = await pushService.getBadgeCount();
    if (result.success) {
      setCount(result.count);
    }
    return result;
  }, []);

  // Set badge count
  const setBadge = useCallback(async (newCount) => {
    const result = await pushService.setBadgeCount(newCount);
    if (result.success) {
      setCount(newCount);
    }
    return result;
  }, []);

  // Increment badge count
  const incrementBadge = useCallback(async () => {
    const newCount = count + 1;
    return setBadge(newCount);
  }, [count, setBadge]);

  // Decrement badge count
  const decrementBadge = useCallback(async () => {
    const newCount = Math.max(0, count - 1);
    return setBadge(newCount);
  }, [count, setBadge]);

  // Clear badge count
  const clearBadge = useCallback(async () => {
    return setBadge(0);
  }, [setBadge]);

  // Initial fetch
  useEffect(() => {
    fetchCount();
  }, [fetchCount]);

  return {
    count,
    setBadge,
    incrementBadge,
    decrementBadge,
    clearBadge,
    refresh: fetchCount,
  };
};

export default {
  usePushNotifications,
  useLocalNotifications,
  useBadgeCount,
};
