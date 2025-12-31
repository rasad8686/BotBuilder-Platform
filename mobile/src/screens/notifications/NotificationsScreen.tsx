import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { formatDistanceToNow } from 'date-fns';

import { useTheme, useRefresh } from '../../hooks';
import { Card, EmptyState, Badge } from '../../components/ui';
import type { Activity } from '../../types';

// Mock data for notifications
const mockNotifications: Activity[] = [
  {
    id: '1',
    type: 'bot_error',
    title: 'Bot Error Detected',
    description: 'Sales Bot encountered an error and stopped responding',
    timestamp: new Date(Date.now() - 1000 * 60 * 5).toISOString(),
    botId: '1',
    botName: 'Sales Bot',
  },
  {
    id: '2',
    type: 'escalation',
    title: 'Conversation Escalated',
    description: 'User requested human support',
    timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
    botId: '2',
    botName: 'Support Bot',
    userId: 'user1',
    userName: 'John Doe',
  },
  {
    id: '3',
    type: 'conversation_started',
    title: 'New Conversation',
    description: 'A new conversation started with Support Bot',
    timestamp: new Date(Date.now() - 1000 * 60 * 60).toISOString(),
    botId: '2',
    botName: 'Support Bot',
  },
  {
    id: '4',
    type: 'bot_started',
    title: 'Bot Started',
    description: 'Marketing Bot is now online',
    timestamp: new Date(Date.now() - 1000 * 60 * 60 * 2).toISOString(),
    botId: '3',
    botName: 'Marketing Bot',
  },
];

export function NotificationsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const [notifications, setNotifications] = useState<Activity[]>(mockNotifications);

  const { refreshing, onRefresh } = useRefresh(async () => {
    // Fetch notifications
  });

  const getNotificationIcon = (type: Activity['type']) => {
    switch (type) {
      case 'bot_error':
        return { icon: 'alert-circle', color: theme.error.main, bg: theme.error.light };
      case 'escalation':
        return { icon: 'flag', color: theme.warning.main, bg: theme.warning.light };
      case 'conversation_started':
        return { icon: 'chatbubble', color: theme.primary[500], bg: theme.primary[100] };
      case 'bot_started':
        return { icon: 'play-circle', color: theme.success.main, bg: theme.success.light };
      case 'bot_stopped':
        return { icon: 'stop-circle', color: theme.neutral[500], bg: theme.neutral[200] };
      case 'user_joined':
        return { icon: 'person-add', color: theme.info.main, bg: theme.info.light };
      default:
        return { icon: 'notifications', color: theme.text.secondary, bg: theme.background.secondary };
    }
  };

  const handleClearAll = () => {
    setNotifications([]);
  };

  const renderNotification = ({ item }: { item: Activity }) => {
    const iconConfig = getNotificationIcon(item.type);

    return (
      <Card variant="default" style={styles.notificationCard}>
        <View style={styles.notificationRow}>
          <View style={[styles.iconContainer, { backgroundColor: iconConfig.bg }]}>
            <Ionicons name={iconConfig.icon as any} size={20} color={iconConfig.color} />
          </View>
          <View style={styles.notificationContent}>
            <Text style={[styles.notificationTitle, { color: theme.text.primary }]}>
              {item.title}
            </Text>
            <Text style={[styles.notificationDescription, { color: theme.text.secondary }]}>
              {item.description}
            </Text>
            <View style={styles.notificationMeta}>
              {item.botName && (
                <Badge text={item.botName} variant="default" size="sm" />
              )}
              <Text style={[styles.notificationTime, { color: theme.text.tertiary }]}>
                {formatDistanceToNow(new Date(item.timestamp), { addSuffix: true })}
              </Text>
            </View>
          </View>
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text.primary }]}>Notifications</Text>
        {notifications.length > 0 && (
          <TouchableOpacity onPress={handleClearAll}>
            <Text style={[styles.clearButton, { color: theme.primary[500] }]}>Clear All</Text>
          </TouchableOpacity>
        )}
      </View>

      {/* Notifications List */}
      <FlatList
        data={notifications}
        renderItem={renderNotification}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            icon="notifications-off-outline"
            title="No notifications"
            description="You're all caught up! New notifications will appear here."
          />
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: '600',
    flex: 1,
    textAlign: 'center',
  },
  clearButton: {
    fontSize: 14,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  notificationCard: {
    marginBottom: 8,
  },
  notificationRow: {
    flexDirection: 'row',
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  notificationContent: {
    flex: 1,
    marginLeft: 12,
  },
  notificationTitle: {
    fontSize: 15,
    fontWeight: '600',
  },
  notificationDescription: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  notificationMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  notificationTime: {
    fontSize: 12,
  },
});
