import React, { useState, useRef, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNotification } from '../../contexts/NotificationContext';

const TYPE_ICONS = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ'
};

function formatTimeAgo(dateString) {
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffSecs = Math.floor(diffMs / 1000);
  const diffMins = Math.floor(diffSecs / 60);
  const diffHours = Math.floor(diffMins / 60);
  const diffDays = Math.floor(diffHours / 24);

  if (diffSecs < 60) return 'Just now';
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return date.toLocaleDateString();
}

function NotificationItem({ notification, onRead, onDelete }) {
  const typeClasses = {
    success: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
    error: 'bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400',
    warning: 'bg-amber-100 dark:bg-amber-900/30 text-amber-600 dark:text-amber-400',
    info: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400'
  };

  return (
    <div
      onClick={() => !notification.read && onRead(notification.id)}
      className={`flex items-start gap-3 px-4 py-3 border-b border-gray-200 dark:border-slate-700 cursor-pointer transition-colors ${
        notification.read
          ? 'bg-white dark:bg-slate-800 hover:bg-gray-50 dark:hover:bg-slate-700'
          : 'bg-blue-50 dark:bg-blue-900/20 hover:bg-blue-100 dark:hover:bg-blue-900/30'
      }`}
    >
      {/* Icon */}
      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold flex-shrink-0 ${typeClasses[notification.type] || typeClasses.info}`}>
        {TYPE_ICONS[notification.type]}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        {notification.title && (
          <div className={`text-sm text-gray-900 dark:text-gray-100 mb-0.5 ${notification.read ? 'font-medium' : 'font-semibold'}`}>
            {notification.title}
          </div>
        )}
        <div className="text-sm text-gray-600 dark:text-gray-400 leading-snug truncate">
          {notification.message}
        </div>
        <div className="text-xs text-gray-400 dark:text-gray-500 mt-1">
          {formatTimeAgo(notification.createdAt)}
        </div>
      </div>

      {/* Unread indicator */}
      {!notification.read && (
        <div className="w-2 h-2 rounded-full bg-blue-500 flex-shrink-0 mt-1" />
      )}

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation();
          onDelete(notification.id);
        }}
        className="text-gray-400 dark:text-gray-500 hover:text-gray-600 dark:hover:text-gray-300 p-1 text-sm opacity-60 hover:opacity-100 transition-opacity"
      >
        ✕
      </button>
    </div>
  );
}

export default function NotificationCenter() {
  const { t } = useTranslation();
  const { notifications, unreadCount, markAsRead, markAllAsRead, clearAll, deleteNotification } = useNotification();
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef(null);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div ref={dropdownRef} className="relative">
      {/* Bell Icon Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg flex items-center justify-center transition-colors hover:bg-gray-100 dark:hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-purple-400"
        aria-label={t('notifications.openNotifications', 'Open notifications') + (unreadCount > 0 ? `, ${unreadCount} ${t('notifications.unread', 'unread')}` : '')}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        <span className="text-xl" aria-hidden="true">🔔</span>

        {/* Badge */}
        {unreadCount > 0 && (
          <span
            className="absolute top-0.5 right-0.5 min-w-[18px] h-[18px] px-1 bg-red-500 text-white text-xs font-semibold rounded-full flex items-center justify-center"
            aria-hidden="true"
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      {isOpen && (
        <div
          className="absolute top-full right-0 mt-2 w-96 max-h-[480px] bg-white dark:bg-slate-800 rounded-xl shadow-xl border border-gray-200 dark:border-slate-700 overflow-hidden z-[1000] animate-fadeIn"
          role="region"
          aria-label={t('notifications.title', 'Notifications')}
        >
          {/* Header */}
          <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-900">
            <div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">
                {t('notifications.title', 'Notifications')}
              </h3>
              {unreadCount > 0 && (
                <span className="text-xs text-gray-500 dark:text-gray-400">
                  {t('notifications.unreadCount', '{{count}} unread', { count: unreadCount })}
                </span>
              )}
            </div>
            <div className="flex gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={markAllAsRead}
                  className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 px-2 py-1 rounded transition-colors"
                >
                  {t('notifications.markAllRead', 'Mark all read')}
                </button>
              )}
              {notifications.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-sm text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 px-2 py-1 rounded transition-colors"
                >
                  {t('notifications.clearAll', 'Clear all')}
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="max-h-[400px] overflow-y-auto">
            {notifications.length === 0 ? (
              <div className="py-10 px-5 text-center text-gray-400 dark:text-gray-500">
                <div className="text-5xl mb-3 opacity-50">🔔</div>
                <div className="text-sm">
                  {t('notifications.noNotifications', 'No notifications yet')}
                </div>
              </div>
            ) : (
              notifications.map(notification => (
                <NotificationItem
                  key={notification.id}
                  notification={notification}
                  onRead={markAsRead}
                  onDelete={deleteNotification}
                />
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
