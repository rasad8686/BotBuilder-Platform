/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { io } from 'socket.io-client';

const NotificationContext = createContext();

const NOTIFICATION_TYPES = {
  SUCCESS: 'success',
  ERROR: 'error',
  WARNING: 'warning',
  INFO: 'info'
};

const STORAGE_KEY = 'botbuilder_notifications';
const MAX_NOTIFICATIONS = 50;

export function NotificationProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const socketRef = useRef(null);

  // Load notifications from localStorage on mount
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        setNotifications(parsed);
        setUnreadCount(parsed.filter(n => !n.read).length);
      }
    } catch (err) {
      // Silent fail
    }
  }, []);

  // Save notifications to localStorage
  const saveNotifications = useCallback((notifs) => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(notifs.slice(0, MAX_NOTIFICATIONS)));
    } catch (err) {
      // Silent fail
    }
  }, []);

  // Connect to Socket.IO for real-time notifications
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) return;

    const serverUrl = window.location.hostname === 'localhost'
      ? 'http://localhost:5000'
      : window.location.origin;

    try {
      socketRef.current = io(serverUrl, {
        path: '/ws',
        transports: ['polling'],
        upgrade: false,
        auth: { token }
      });

      socketRef.current.on('connect', () => {
        socketRef.current.emit('notifications:subscribe');
      });

      // Real-time notification events
      socketRef.current.on('notification:new', (data) => {
        addNotification({
          type: data.type || NOTIFICATION_TYPES.INFO,
          title: data.title,
          message: data.message,
          data: data.data
        });
      });

      socketRef.current.on('notification:bot_status', (data) => {
        addNotification({
          type: data.online ? NOTIFICATION_TYPES.SUCCESS : NOTIFICATION_TYPES.WARNING,
          title: data.online ? 'Bot Online' : 'Bot Offline',
          message: `${data.botName} is now ${data.online ? 'online' : 'offline'}`,
          data: { botId: data.botId }
        });
      });

      socketRef.current.on('notification:workflow_complete', (data) => {
        addNotification({
          type: data.success ? NOTIFICATION_TYPES.SUCCESS : NOTIFICATION_TYPES.ERROR,
          title: data.success ? 'Workflow Completed' : 'Workflow Failed',
          message: data.message || `Workflow "${data.workflowName}" has ${data.success ? 'completed' : 'failed'}`,
          data: { workflowId: data.workflowId }
        });
      });

      socketRef.current.on('notification:message_received', (data) => {
        addNotification({
          type: NOTIFICATION_TYPES.INFO,
          title: 'New Message',
          message: `New message received on ${data.botName}`,
          data: { botId: data.botId, messageId: data.messageId }
        });
      });

    } catch (err) {
      // Silent fail
    }

    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Add a toast notification
  const showToast = useCallback((type, message, duration = 5000) => {
    const id = Date.now() + Math.random();
    const toast = { id, type, message, duration };

    setToasts(prev => [...prev, toast]);

    if (duration > 0) {
      setTimeout(() => {
        setToasts(prev => prev.filter(t => t.id !== id));
      }, duration);
    }

    return id;
  }, []);

  // Remove a toast
  const removeToast = useCallback((id) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  }, []);

  // Shorthand toast methods
  const success = useCallback((message, duration) => showToast(NOTIFICATION_TYPES.SUCCESS, message, duration), [showToast]);
  const error = useCallback((message, duration) => showToast(NOTIFICATION_TYPES.ERROR, message, duration), [showToast]);
  const warning = useCallback((message, duration) => showToast(NOTIFICATION_TYPES.WARNING, message, duration), [showToast]);
  const info = useCallback((message, duration) => showToast(NOTIFICATION_TYPES.INFO, message, duration), [showToast]);

  // Add a persistent notification
  const addNotification = useCallback((notification) => {
    const newNotification = {
      id: Date.now() + Math.random(),
      type: notification.type || NOTIFICATION_TYPES.INFO,
      title: notification.title,
      message: notification.message,
      data: notification.data,
      read: false,
      createdAt: new Date().toISOString()
    };

    setNotifications(prev => {
      const updated = [newNotification, ...prev].slice(0, MAX_NOTIFICATIONS);
      saveNotifications(updated);
      return updated;
    });
    setUnreadCount(prev => prev + 1);

    // Also show as toast if specified
    if (notification.showToast !== false) {
      showToast(notification.type, notification.message || notification.title);
    }

    return newNotification.id;
  }, [saveNotifications, showToast]);

  // Mark notification as read
  const markAsRead = useCallback((id) => {
    setNotifications(prev => {
      const updated = prev.map(n =>
        n.id === id ? { ...n, read: true } : n
      );
      saveNotifications(updated);
      return updated;
    });
    setUnreadCount(prev => Math.max(0, prev - 1));
  }, [saveNotifications]);

  // Mark all notifications as read
  const markAllAsRead = useCallback(() => {
    setNotifications(prev => {
      const updated = prev.map(n => ({ ...n, read: true }));
      saveNotifications(updated);
      return updated;
    });
    setUnreadCount(0);
  }, [saveNotifications]);

  // Clear all notifications
  const clearAll = useCallback(() => {
    setNotifications([]);
    setUnreadCount(0);
    localStorage.removeItem(STORAGE_KEY);
  }, []);

  // Delete a specific notification
  const deleteNotification = useCallback((id) => {
    setNotifications(prev => {
      const notification = prev.find(n => n.id === id);
      const updated = prev.filter(n => n.id !== id);
      saveNotifications(updated);
      if (notification && !notification.read) {
        setUnreadCount(c => Math.max(0, c - 1));
      }
      return updated;
    });
  }, [saveNotifications]);

  const value = {
    // Toast notifications
    toasts,
    showToast,
    removeToast,
    success,
    error,
    warning,
    info,

    // Persistent notifications
    notifications,
    unreadCount,
    addNotification,
    markAsRead,
    markAllAsRead,
    clearAll,
    deleteNotification,

    // Types
    NOTIFICATION_TYPES
  };

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotification() {
  const context = useContext(NotificationContext);
  if (!context) {
    throw new Error('useNotification must be used within a NotificationProvider');
  }
  return context;
}

export { NOTIFICATION_TYPES };
export default NotificationContext;
