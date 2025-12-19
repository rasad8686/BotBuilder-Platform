/**
 * Notification Context
 * Manages notification state, unread count, and notification list
 */
import React, { createContext, useContext, useState, useEffect, useCallback, useRef } from 'react';
import { notificationsAPI } from '../services/api';
import pushService from '../services/pushService';
import { storage } from '../utils/storage';

const NotificationContext = createContext(null);

const NOTIFICATIONS_CACHE_KEY = 'notifications_cache';

export const NotificationProvider = ({ children }) => {
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState(null);

  const mounted = useRef(true);
  const notificationListener = useRef(null);

  // Load cached notifications
  const loadCached = useCallback(async () => {
    try {
      const cached = await storage.get(NOTIFICATIONS_CACHE_KEY);
      if (cached && mounted.current) {
        setNotifications(cached.notifications || []);
        setUnreadCount(cached.unreadCount || 0);
      }
    } catch (err) {
      console.error('Error loading cached notifications:', err);
    }
  }, []);

  // Save to cache
  const saveToCache = useCallback(async (notifs, count) => {
    try {
      await storage.set(NOTIFICATIONS_CACHE_KEY, {
        notifications: notifs,
        unreadCount: count,
        timestamp: Date.now(),
      });
    } catch (err) {
      console.error('Error saving notifications cache:', err);
    }
  }, []);

  // Fetch notifications from API
  const fetchNotifications = useCallback(async (isRefresh = false) => {
    if (!mounted.current) return;

    setLoading(!isRefresh);
    setRefreshing(isRefresh);
    setError(null);

    try {
      const response = await notificationsAPI.getAll();
      const data = response.data;

      if (mounted.current) {
        const notifs = data.notifications || data || [];
        const count = notifs.filter(n => !n.read).length;

        setNotifications(notifs);
        setUnreadCount(count);
        await saveToCache(notifs, count);

        // Update badge count
        await pushService.setBadgeCount(count);
      }
    } catch (err) {
      if (mounted.current) {
        setError(err.message || 'Failed to fetch notifications');
      }
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [saveToCache]);

  // Add new notification (from push)
  const addNotification = useCallback((notification) => {
    if (!mounted.current) return;

    const newNotif = {
      id: notification.id || Date.now().toString(),
      title: notification.title,
      body: notification.body,
      data: notification.data || {},
      read: false,
      createdAt: notification.createdAt || new Date().toISOString(),
    };

    setNotifications(prev => [newNotif, ...prev]);
    setUnreadCount(prev => prev + 1);

    // Update badge
    pushService.setBadgeCount(unreadCount + 1);
  }, [unreadCount]);

  // Mark notification as read
  const markAsRead = useCallback(async (notificationId) => {
    if (!mounted.current) return { success: false };

    try {
      // Optimistic update
      setNotifications(prev =>
        prev.map(n =>
          n.id === notificationId ? { ...n, read: true } : n
        )
      );

      const wasUnread = notifications.find(n => n.id === notificationId && !n.read);
      if (wasUnread) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        await pushService.setBadgeCount(Math.max(0, unreadCount - 1));
      }

      // API call
      await notificationsAPI.markAsRead(notificationId);

      return { success: true };
    } catch (err) {
      // Revert on error
      fetchNotifications();
      return { success: false, error: err.message };
    }
  }, [notifications, unreadCount, fetchNotifications]);

  // Mark all as read
  const markAllAsRead = useCallback(async () => {
    if (!mounted.current) return { success: false };

    try {
      // Optimistic update
      setNotifications(prev => prev.map(n => ({ ...n, read: true })));
      setUnreadCount(0);
      await pushService.setBadgeCount(0);

      // API call
      await notificationsAPI.markAllAsRead();

      return { success: true };
    } catch (err) {
      // Revert on error
      fetchNotifications();
      return { success: false, error: err.message };
    }
  }, [fetchNotifications]);

  // Delete notification
  const deleteNotification = useCallback(async (notificationId) => {
    if (!mounted.current) return { success: false };

    try {
      const notif = notifications.find(n => n.id === notificationId);

      // Optimistic update
      setNotifications(prev => prev.filter(n => n.id !== notificationId));

      if (notif && !notif.read) {
        setUnreadCount(prev => Math.max(0, prev - 1));
        await pushService.setBadgeCount(Math.max(0, unreadCount - 1));
      }

      // API call
      await notificationsAPI.delete(notificationId);

      return { success: true };
    } catch (err) {
      // Revert on error
      fetchNotifications();
      return { success: false, error: err.message };
    }
  }, [notifications, unreadCount, fetchNotifications]);

  // Clear all notifications
  const clearAll = useCallback(async () => {
    if (!mounted.current) return { success: false };

    try {
      // Optimistic update
      setNotifications([]);
      setUnreadCount(0);
      await pushService.setBadgeCount(0);
      await storage.remove(NOTIFICATIONS_CACHE_KEY);

      // Note: API endpoint for clearing all might not exist
      // Implement if available

      return { success: true };
    } catch (err) {
      fetchNotifications();
      return { success: false, error: err.message };
    }
  }, [fetchNotifications]);

  // Get unread count from API
  const refreshUnreadCount = useCallback(async () => {
    try {
      const response = await notificationsAPI.getUnreadCount();
      const count = response.data.count || 0;

      if (mounted.current) {
        setUnreadCount(count);
        await pushService.setBadgeCount(count);
      }

      return { success: true, count };
    } catch (err) {
      return { success: false, error: err.message };
    }
  }, []);

  // Handle incoming push notification
  const handlePushNotification = useCallback((notification) => {
    const { title, body, data } = notification.request.content;

    addNotification({
      id: notification.request.identifier,
      title,
      body,
      data,
      createdAt: new Date().toISOString(),
    });
  }, [addNotification]);

  // Setup push notification listener
  useEffect(() => {
    mounted.current = true;

    // Load cached first
    loadCached();

    // Then fetch fresh data
    fetchNotifications();

    // Listen for incoming notifications
    notificationListener.current = pushService.addNotificationReceivedListener(
      handlePushNotification
    );

    return () => {
      mounted.current = false;

      if (notificationListener.current) {
        notificationListener.current.remove();
      }
    };
  }, [loadCached, fetchNotifications, handlePushNotification]);

  // Filter helpers
  const getUnreadNotifications = useCallback(() => {
    return notifications.filter(n => !n.read);
  }, [notifications]);

  const getReadNotifications = useCallback(() => {
    return notifications.filter(n => n.read);
  }, [notifications]);

  const getNotificationsByType = useCallback((type) => {
    return notifications.filter(n => n.data?.type === type);
  }, [notifications]);

  const value = {
    // State
    notifications,
    unreadCount,
    loading,
    refreshing,
    error,

    // Actions
    fetchNotifications,
    addNotification,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refreshUnreadCount,

    // Helpers
    getUnreadNotifications,
    getReadNotifications,
    getNotificationsByType,

    // Refresh
    refresh: () => fetchNotifications(true),
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotifications must be used within a NotificationProvider');
  }
  return context;
};

export default NotificationContext;
