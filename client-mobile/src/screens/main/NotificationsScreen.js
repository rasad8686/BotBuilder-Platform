/**
 * Notifications Screen
 * Display and manage notifications
 */
import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNotifications } from '../../contexts/NotificationContext';
import { timeAgo } from '../../utils/helpers';
import { NOTIFICATION_TYPES } from '../../services/pushService';

// Notification type icons
const TYPE_ICONS = {
  [NOTIFICATION_TYPES.NEW_MESSAGE]: '💬',
  [NOTIFICATION_TYPES.BOT_STATUS]: '🤖',
  [NOTIFICATION_TYPES.SYSTEM_ALERT]: '🔔',
  [NOTIFICATION_TYPES.TRAINING_COMPLETE]: '✅',
  [NOTIFICATION_TYPES.USAGE_ALERT]: '📊',
  default: '📌',
};

const NotificationItem = ({ notification, onPress, onDelete, onMarkRead }) => {
  const icon = TYPE_ICONS[notification.data?.type] || TYPE_ICONS.default;
  const isUnread = !notification.read;

  const handleLongPress = () => {
    Alert.alert(
      'Notification',
      'Choose an action',
      [
        { text: 'Cancel', style: 'cancel' },
        !notification.read && {
          text: 'Mark as Read',
          onPress: () => onMarkRead(notification.id),
        },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: () => onDelete(notification.id),
        },
      ].filter(Boolean)
    );
  };

  return (
    <TouchableOpacity
      style={[styles.notificationItem, isUnread && styles.unreadItem]}
      onPress={() => onPress(notification)}
      onLongPress={handleLongPress}
      activeOpacity={0.7}
    >
      <View style={[styles.iconContainer, isUnread && styles.unreadIcon]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>

      <View style={styles.content}>
        <View style={styles.header}>
          <Text style={[styles.title, isUnread && styles.unreadText]} numberOfLines={1}>
            {notification.title}
          </Text>
          {isUnread && <View style={styles.unreadDot} />}
        </View>
        <Text style={styles.body} numberOfLines={2}>
          {notification.body}
        </Text>
        <Text style={styles.time}>{timeAgo(notification.createdAt)}</Text>
      </View>

      <TouchableOpacity
        style={styles.deleteButton}
        onPress={() => onDelete(notification.id)}
        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
      >
        <Text style={styles.deleteIcon}>×</Text>
      </TouchableOpacity>
    </TouchableOpacity>
  );
};

const EmptyNotifications = () => (
  <View style={styles.emptyContainer}>
    <View style={styles.emptyIcon}>
      <Text style={styles.emptyEmoji}>🔔</Text>
    </View>
    <Text style={styles.emptyTitle}>No Notifications</Text>
    <Text style={styles.emptyText}>
      You're all caught up! New notifications will appear here.
    </Text>
  </View>
);

const NotificationsScreen = ({ navigation }) => {
  const {
    notifications,
    unreadCount,
    loading,
    refreshing,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    clearAll,
    refresh,
  } = useNotifications();

  const [filter, setFilter] = useState('all'); // all, unread, read

  // Filter notifications
  const filteredNotifications = notifications.filter((n) => {
    if (filter === 'unread') return !n.read;
    if (filter === 'read') return n.read;
    return true;
  });

  // Handle notification press
  const handlePress = useCallback(async (notification) => {
    // Mark as read
    if (!notification.read) {
      await markAsRead(notification.id);
    }

    // Navigate based on type
    const data = notification.data || {};

    switch (data.type) {
      case NOTIFICATION_TYPES.NEW_MESSAGE:
        if (data.botId) {
          navigation.navigate('Chat', { botId: data.botId });
        }
        break;

      case NOTIFICATION_TYPES.BOT_STATUS:
      case NOTIFICATION_TYPES.TRAINING_COMPLETE:
        if (data.botId) {
          navigation.navigate('BotDetail', { botId: data.botId });
        }
        break;

      default:
        // Show notification details
        Alert.alert(notification.title, notification.body);
    }
  }, [markAsRead, navigation]);

  // Handle delete
  const handleDelete = useCallback(async (id) => {
    await deleteNotification(id);
  }, [deleteNotification]);

  // Handle mark as read
  const handleMarkRead = useCallback(async (id) => {
    await markAsRead(id);
  }, [markAsRead]);

  // Handle mark all as read
  const handleMarkAllRead = useCallback(() => {
    if (unreadCount === 0) return;

    Alert.alert(
      'Mark All as Read',
      `Mark ${unreadCount} notification${unreadCount > 1 ? 's' : ''} as read?`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Mark All', onPress: markAllAsRead },
      ]
    );
  }, [unreadCount, markAllAsRead]);

  // Handle clear all
  const handleClearAll = useCallback(() => {
    if (notifications.length === 0) return;

    Alert.alert(
      'Clear All Notifications',
      'This will delete all notifications. This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear All',
          style: 'destructive',
          onPress: clearAll,
        },
      ]
    );
  }, [notifications.length, clearAll]);

  const renderItem = useCallback(({ item }) => (
    <NotificationItem
      notification={item}
      onPress={handlePress}
      onDelete={handleDelete}
      onMarkRead={handleMarkRead}
    />
  ), [handlePress, handleDelete, handleMarkRead]);

  const keyExtractor = useCallback((item) => item.id.toString(), []);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.headerContainer}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Notifications</Text>
        <View style={styles.headerActions}>
          {unreadCount > 0 && (
            <TouchableOpacity
              onPress={handleMarkAllRead}
              style={styles.headerAction}
            >
              <Text style={styles.headerActionText}>Read All</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Filters */}
      <View style={styles.filterContainer}>
        {['all', 'unread', 'read'].map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.filterChip, filter === f && styles.filterChipActive]}
            onPress={() => setFilter(f)}
          >
            <Text style={[styles.filterText, filter === f && styles.filterTextActive]}>
              {f === 'all' ? 'All' : f === 'unread' ? `Unread (${unreadCount})` : 'Read'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Notifications List */}
      {loading && notifications.length === 0 ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      ) : (
        <FlatList
          data={filteredNotifications}
          renderItem={renderItem}
          keyExtractor={keyExtractor}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={refresh}
              tintColor="#6366f1"
            />
          }
          ListEmptyComponent={<EmptyNotifications />}
          ItemSeparatorComponent={() => <View style={styles.separator} />}
        />
      )}

      {/* Clear All Button */}
      {notifications.length > 0 && (
        <TouchableOpacity
          style={styles.clearAllButton}
          onPress={handleClearAll}
        >
          <Text style={styles.clearAllText}>Clear All Notifications</Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  backButton: {
    padding: 4,
  },
  backIcon: {
    fontSize: 28,
    color: '#1e293b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  headerActions: {
    flexDirection: 'row',
  },
  headerAction: {
    padding: 4,
  },
  headerActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6366f1',
  },
  filterContainer: {
    flexDirection: 'row',
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: '#ffffff',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: 16,
    backgroundColor: '#f1f5f9',
  },
  filterChipActive: {
    backgroundColor: '#6366f1',
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  filterTextActive: {
    color: '#ffffff',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  listContent: {
    padding: 16,
    flexGrow: 1,
  },
  notificationItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 14,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 1,
  },
  unreadItem: {
    backgroundColor: '#f0f9ff',
    borderLeftWidth: 3,
    borderLeftColor: '#6366f1',
  },
  iconContainer: {
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  unreadIcon: {
    backgroundColor: '#e0e7ff',
  },
  icon: {
    fontSize: 20,
  },
  content: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 4,
  },
  title: {
    fontSize: 15,
    fontWeight: '500',
    color: '#1e293b',
    flex: 1,
  },
  unreadText: {
    fontWeight: '600',
  },
  unreadDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#6366f1',
    marginLeft: 8,
  },
  body: {
    fontSize: 14,
    color: '#64748b',
    lineHeight: 20,
    marginBottom: 6,
  },
  time: {
    fontSize: 12,
    color: '#94a3b8',
  },
  deleteButton: {
    padding: 4,
    marginLeft: 8,
  },
  deleteIcon: {
    fontSize: 22,
    color: '#94a3b8',
    fontWeight: '300',
  },
  separator: {
    height: 10,
  },
  emptyContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
    paddingHorizontal: 32,
  },
  emptyIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyEmoji: {
    fontSize: 40,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
    marginBottom: 8,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
  },
  clearAllButton: {
    margin: 16,
    padding: 14,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#ef4444',
    alignItems: 'center',
  },
  clearAllText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ef4444',
  },
});

export default NotificationsScreen;
