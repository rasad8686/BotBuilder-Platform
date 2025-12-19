/**
 * Push Notification Service
 * Handles push notifications registration, scheduling, and handling
 */
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { notificationsAPI } from './api';
import { setPushToken, getPushToken, removePushToken } from '../utils/storage';

// Notification Types
export const NOTIFICATION_TYPES = {
  NEW_MESSAGE: 'new_message',
  BOT_STATUS: 'bot_status',
  SYSTEM_ALERT: 'system_alert',
  TRAINING_COMPLETE: 'training_complete',
  USAGE_ALERT: 'usage_alert',
};

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

/**
 * Check if device can receive push notifications
 */
export const canReceivePushNotifications = () => {
  return Device.isDevice;
};

/**
 * Get Expo push token
 */
export const getExpoPushToken = async () => {
  if (!Device.isDevice) {
    console.log('Push notifications require a physical device');
    return null;
  }

  try {
    // Check existing permissions
    const { status: existingStatus } = await Notifications.getPermissionsAsync();
    let finalStatus = existingStatus;

    // Request permission if not granted
    if (existingStatus !== 'granted') {
      const { status } = await Notifications.requestPermissionsAsync();
      finalStatus = status;
    }

    if (finalStatus !== 'granted') {
      console.log('Push notification permission denied');
      return null;
    }

    // Get project ID from Constants
    const projectId = Constants.expoConfig?.extra?.eas?.projectId ||
                      Constants.easConfig?.projectId;

    // Get push token
    const tokenData = await Notifications.getExpoPushTokenAsync({
      projectId,
    });

    return tokenData.data;
  } catch (error) {
    console.error('Error getting push token:', error);
    return null;
  }
};

/**
 * Register device for push notifications
 */
export const registerForPushNotifications = async () => {
  try {
    const token = await getExpoPushToken();

    if (!token) {
      return { success: false, error: 'Could not get push token' };
    }

    // Store token locally
    await setPushToken(token);

    // Register with backend
    try {
      await notificationsAPI.registerPushToken(token, Platform.OS);
    } catch (apiError) {
      console.warn('Failed to register token with backend:', apiError);
    }

    // Configure Android channel
    if (Platform.OS === 'android') {
      await setupAndroidNotificationChannel();
    }

    return { success: true, token };
  } catch (error) {
    console.error('Error registering for push notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Unregister device from push notifications
 */
export const unregisterFromPushNotifications = async () => {
  try {
    const token = await getPushToken();

    if (token) {
      // Unregister from backend
      try {
        await notificationsAPI.unregisterPushToken(token);
      } catch (apiError) {
        console.warn('Failed to unregister token from backend:', apiError);
      }

      // Remove local token
      await removePushToken();
    }

    return { success: true };
  } catch (error) {
    console.error('Error unregistering from push notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Setup Android notification channel
 */
export const setupAndroidNotificationChannel = async () => {
  if (Platform.OS !== 'android') return;

  // Default channel
  await Notifications.setNotificationChannelAsync('default', {
    name: 'Default',
    importance: Notifications.AndroidImportance.MAX,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6366f1',
  });

  // Messages channel
  await Notifications.setNotificationChannelAsync('messages', {
    name: 'Messages',
    description: 'New message notifications',
    importance: Notifications.AndroidImportance.HIGH,
    vibrationPattern: [0, 250, 250, 250],
    lightColor: '#6366f1',
    sound: 'default',
  });

  // Bot status channel
  await Notifications.setNotificationChannelAsync('bot_status', {
    name: 'Bot Status',
    description: 'Bot status change notifications',
    importance: Notifications.AndroidImportance.DEFAULT,
    lightColor: '#22c55e',
  });

  // System alerts channel
  await Notifications.setNotificationChannelAsync('system', {
    name: 'System Alerts',
    description: 'Important system notifications',
    importance: Notifications.AndroidImportance.HIGH,
    lightColor: '#ef4444',
  });
};

/**
 * Schedule a local notification
 */
export const scheduleLocalNotification = async ({
  title,
  body,
  data = {},
  trigger = null,
  channelId = 'default',
}) => {
  try {
    const notificationContent = {
      title,
      body,
      data,
      sound: true,
      ...(Platform.OS === 'android' && { channelId }),
    };

    const identifier = await Notifications.scheduleNotificationAsync({
      content: notificationContent,
      trigger: trigger || null, // null = immediate
    });

    return { success: true, identifier };
  } catch (error) {
    console.error('Error scheduling notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Schedule a notification for a specific time
 */
export const scheduleNotificationAtTime = async ({
  title,
  body,
  data = {},
  date,
  channelId = 'default',
}) => {
  const seconds = Math.max(1, Math.floor((date.getTime() - Date.now()) / 1000));

  return scheduleLocalNotification({
    title,
    body,
    data,
    trigger: { seconds },
    channelId,
  });
};

/**
 * Cancel a scheduled notification
 */
export const cancelNotification = async (identifier) => {
  try {
    await Notifications.cancelScheduledNotificationAsync(identifier);
    return { success: true };
  } catch (error) {
    console.error('Error canceling notification:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Cancel all scheduled notifications
 */
export const cancelAllNotifications = async () => {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    return { success: true };
  } catch (error) {
    console.error('Error canceling all notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get all scheduled notifications
 */
export const getScheduledNotifications = async () => {
  try {
    const notifications = await Notifications.getAllScheduledNotificationsAsync();
    return { success: true, notifications };
  } catch (error) {
    console.error('Error getting scheduled notifications:', error);
    return { success: false, error: error.message, notifications: [] };
  }
};

/**
 * Set badge count
 */
export const setBadgeCount = async (count) => {
  try {
    await Notifications.setBadgeCountAsync(count);
    return { success: true };
  } catch (error) {
    console.error('Error setting badge count:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get badge count
 */
export const getBadgeCount = async () => {
  try {
    const count = await Notifications.getBadgeCountAsync();
    return { success: true, count };
  } catch (error) {
    console.error('Error getting badge count:', error);
    return { success: false, error: error.message, count: 0 };
  }
};

/**
 * Clear badge count
 */
export const clearBadgeCount = async () => {
  return setBadgeCount(0);
};

/**
 * Handle incoming notification
 */
export const handleNotification = (notification, navigation) => {
  const data = notification.request.content.data;

  if (!data || !data.type) return;

  switch (data.type) {
    case NOTIFICATION_TYPES.NEW_MESSAGE:
      if (data.botId && navigation) {
        navigation.navigate('Chat', { botId: data.botId });
      }
      break;

    case NOTIFICATION_TYPES.BOT_STATUS:
      if (data.botId && navigation) {
        navigation.navigate('BotDetail', { botId: data.botId });
      }
      break;

    case NOTIFICATION_TYPES.TRAINING_COMPLETE:
      if (data.botId && navigation) {
        navigation.navigate('BotDetail', { botId: data.botId });
      }
      break;

    case NOTIFICATION_TYPES.SYSTEM_ALERT:
      // Show in notifications screen
      if (navigation) {
        navigation.navigate('Notifications');
      }
      break;

    default:
      console.log('Unknown notification type:', data.type);
  }
};

/**
 * Add notification received listener
 */
export const addNotificationReceivedListener = (callback) => {
  return Notifications.addNotificationReceivedListener(callback);
};

/**
 * Add notification response listener (when user taps notification)
 */
export const addNotificationResponseListener = (callback) => {
  return Notifications.addNotificationResponseReceivedListener(callback);
};

/**
 * Get notification permission status
 */
export const getNotificationPermissionStatus = async () => {
  try {
    const { status } = await Notifications.getPermissionsAsync();
    return { success: true, status };
  } catch (error) {
    console.error('Error getting permission status:', error);
    return { success: false, error: error.message, status: 'undetermined' };
  }
};

/**
 * Request notification permission
 */
export const requestNotificationPermission = async () => {
  try {
    const { status } = await Notifications.requestPermissionsAsync();
    return { success: true, status, granted: status === 'granted' };
  } catch (error) {
    console.error('Error requesting permission:', error);
    return { success: false, error: error.message, granted: false };
  }
};

/**
 * Dismiss all delivered notifications
 */
export const dismissAllNotifications = async () => {
  try {
    await Notifications.dismissAllNotificationsAsync();
    return { success: true };
  } catch (error) {
    console.error('Error dismissing notifications:', error);
    return { success: false, error: error.message };
  }
};

/**
 * Get last notification response (when app opened via notification)
 */
export const getLastNotificationResponse = async () => {
  try {
    const response = await Notifications.getLastNotificationResponseAsync();
    return { success: true, response };
  } catch (error) {
    console.error('Error getting last notification response:', error);
    return { success: false, error: error.message, response: null };
  }
};

export default {
  NOTIFICATION_TYPES,
  canReceivePushNotifications,
  getExpoPushToken,
  registerForPushNotifications,
  unregisterFromPushNotifications,
  setupAndroidNotificationChannel,
  scheduleLocalNotification,
  scheduleNotificationAtTime,
  cancelNotification,
  cancelAllNotifications,
  getScheduledNotifications,
  setBadgeCount,
  getBadgeCount,
  clearBadgeCount,
  handleNotification,
  addNotificationReceivedListener,
  addNotificationResponseListener,
  getNotificationPermissionStatus,
  requestNotificationPermission,
  dismissAllNotifications,
  getLastNotificationResponse,
};
