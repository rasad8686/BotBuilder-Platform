import React, { useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  RefreshControl,
  TouchableOpacity,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuthStore, useBotStore, useConversationStore, useAnalyticsStore } from '../../store';
import { useTheme, useRefresh } from '../../hooks';
import { Card, Avatar, Badge, EmptyState } from '../../components/ui';
import type { RootStackParamList, Bot, Activity } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
const { width } = Dimensions.get('window');

export function DashboardScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const user = useAuthStore((state) => state.user);
  const { bots, fetchBots, isLoading: botsLoading } = useBotStore();
  const { conversations, fetchConversations, unreadCount } = useConversationStore();
  const { data: analytics, fetchAnalytics } = useAnalyticsStore();

  const loadData = useCallback(async () => {
    await Promise.all([
      fetchBots(),
      fetchConversations(1, true),
      fetchAnalytics(),
    ]);
  }, [fetchBots, fetchConversations, fetchAnalytics]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const { refreshing, onRefresh } = useRefresh(loadData);

  const activeBots = bots.filter((bot) => bot.status === 'active').length;
  const totalBots = bots.length;

  const stats = [
    {
      label: 'Active Bots',
      value: activeBots,
      total: totalBots,
      icon: 'cube',
      color: theme.success.main,
    },
    {
      label: 'Conversations',
      value: analytics?.overview?.totalConversations || 0,
      change: analytics?.overview?.conversationGrowth || 0,
      icon: 'chatbubbles',
      color: theme.primary[500],
    },
    {
      label: 'Messages',
      value: analytics?.overview?.totalMessages || 0,
      change: analytics?.overview?.messageGrowth || 0,
      icon: 'mail',
      color: theme.secondary[500],
    },
    {
      label: 'Avg Response',
      value: `${(analytics?.overview?.avgResponseTime || 0).toFixed(1)}s`,
      icon: 'time',
      color: theme.warning.main,
    },
  ];

  const getStatusColor = (status: Bot['status']) => {
    switch (status) {
      case 'active':
        return theme.success.main;
      case 'inactive':
        return theme.neutral[400];
      case 'error':
        return theme.error.main;
      case 'maintenance':
        return theme.warning.main;
      default:
        return theme.neutral[400];
    }
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <ScrollView
        style={styles.scrollView}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
      >
        {/* Header */}
        <LinearGradient
          colors={[theme.primary[600], theme.primary[500]]}
          style={styles.header}
        >
          <View style={styles.headerContent}>
            <View style={styles.headerLeft}>
              <Text style={[styles.greeting, { color: theme.primary[100] }]}>
                Welcome back,
              </Text>
              <Text style={[styles.userName, { color: theme.white }]}>
                {user?.name || 'User'}
              </Text>
            </View>
            <TouchableOpacity
              style={styles.notificationButton}
              onPress={() => navigation.navigate('Notifications')}
            >
              <Ionicons name="notifications-outline" size={24} color={theme.white} />
              {unreadCount > 0 && (
                <Badge
                  count={unreadCount}
                  variant="error"
                  size="sm"
                  style={styles.notificationBadge}
                />
              )}
            </TouchableOpacity>
          </View>
        </LinearGradient>

        {/* Stats Grid */}
        <View style={styles.statsContainer}>
          <View style={styles.statsGrid}>
            {stats.map((stat, index) => (
              <Card
                key={index}
                variant="elevated"
                style={styles.statCard}
              >
                <View style={[styles.statIcon, { backgroundColor: `${stat.color}20` }]}>
                  <Ionicons name={stat.icon as any} size={20} color={stat.color} />
                </View>
                <Text style={[styles.statValue, { color: theme.text.primary }]}>
                  {typeof stat.value === 'number' ? formatNumber(stat.value) : stat.value}
                </Text>
                <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                  {stat.label}
                </Text>
                {stat.change !== undefined && (
                  <View style={styles.changeRow}>
                    <Ionicons
                      name={stat.change >= 0 ? 'trending-up' : 'trending-down'}
                      size={12}
                      color={stat.change >= 0 ? theme.success.main : theme.error.main}
                    />
                    <Text
                      style={[
                        styles.changeText,
                        { color: stat.change >= 0 ? theme.success.main : theme.error.main },
                      ]}
                    >
                      {Math.abs(stat.change)}%
                    </Text>
                  </View>
                )}
              </Card>
            ))}
          </View>
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
            Quick Actions
          </Text>
          <View style={styles.actionsRow}>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.primary[500] }]}
              onPress={() => navigation.navigate('Bots')}
            >
              <Ionicons name="add" size={24} color={theme.white} />
              <Text style={[styles.actionText, { color: theme.white }]}>New Bot</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.secondary[500] }]}
              onPress={() => navigation.navigate('Conversations')}
            >
              <Ionicons name="chatbubble" size={24} color={theme.white} />
              <Text style={[styles.actionText, { color: theme.white }]}>Chat</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.actionButton, { backgroundColor: theme.info.main }]}
              onPress={() => navigation.navigate('Analytics')}
            >
              <Ionicons name="stats-chart" size={24} color={theme.white} />
              <Text style={[styles.actionText, { color: theme.white }]}>Analytics</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* My Bots */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              My Bots
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Bots')}>
              <Text style={[styles.seeAll, { color: theme.primary[500] }]}>See All</Text>
            </TouchableOpacity>
          </View>

          {bots.length === 0 ? (
            <EmptyState
              icon="cube-outline"
              title="No bots yet"
              description="Create your first bot to get started"
              actionLabel="Create Bot"
              onAction={() => navigation.navigate('Bots')}
              style={styles.emptyState}
            />
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.botsScroll}
            >
              {bots.slice(0, 5).map((bot) => (
                <Card
                  key={bot.id}
                  variant="elevated"
                  style={styles.botCard}
                  onPress={() => navigation.navigate('BotDetail', { botId: bot.id })}
                >
                  <View style={styles.botHeader}>
                    <Avatar
                      source={bot.avatar}
                      name={bot.name}
                      size="md"
                      statusIndicator={bot.status === 'active' ? 'online' : 'offline'}
                    />
                    <View
                      style={[
                        styles.botStatusDot,
                        { backgroundColor: getStatusColor(bot.status) },
                      ]}
                    />
                  </View>
                  <Text
                    style={[styles.botName, { color: theme.text.primary }]}
                    numberOfLines={1}
                  >
                    {bot.name}
                  </Text>
                  <Text style={[styles.botPlatform, { color: theme.text.secondary }]}>
                    {bot.platform}
                  </Text>
                  <View style={styles.botStats}>
                    <View style={styles.botStat}>
                      <Ionicons name="chatbubble-outline" size={12} color={theme.text.tertiary} />
                      <Text style={[styles.botStatText, { color: theme.text.tertiary }]}>
                        {formatNumber(bot.stats.totalConversations)}
                      </Text>
                    </View>
                  </View>
                </Card>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Recent Conversations */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              Recent Conversations
            </Text>
            <TouchableOpacity onPress={() => navigation.navigate('Conversations')}>
              <Text style={[styles.seeAll, { color: theme.primary[500] }]}>See All</Text>
            </TouchableOpacity>
          </View>

          {conversations.length === 0 ? (
            <Card variant="outlined" padding="lg">
              <Text style={[styles.emptyText, { color: theme.text.secondary }]}>
                No recent conversations
              </Text>
            </Card>
          ) : (
            conversations.slice(0, 3).map((conversation) => (
              <Card
                key={conversation.id}
                variant="default"
                style={styles.conversationCard}
                onPress={() =>
                  navigation.navigate('ConversationDetail', {
                    conversationId: conversation.id,
                  })
                }
              >
                <View style={styles.conversationRow}>
                  <Avatar
                    source={conversation.userAvatar}
                    name={conversation.userName}
                    size="md"
                  />
                  <View style={styles.conversationInfo}>
                    <View style={styles.conversationHeader}>
                      <Text
                        style={[styles.conversationName, { color: theme.text.primary }]}
                        numberOfLines={1}
                      >
                        {conversation.userName}
                      </Text>
                      <Text style={[styles.conversationTime, { color: theme.text.tertiary }]}>
                        {new Date(conversation.lastMessageAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </Text>
                    </View>
                    <Text
                      style={[styles.conversationPreview, { color: theme.text.secondary }]}
                      numberOfLines={1}
                    >
                      {conversation.lastMessage?.content || 'No messages'}
                    </Text>
                  </View>
                  {conversation.unreadCount > 0 && (
                    <Badge count={conversation.unreadCount} variant="primary" size="sm" />
                  )}
                </View>
              </Card>
            ))
          )}
        </View>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 40,
    borderBottomLeftRadius: 24,
    borderBottomRightRadius: 24,
  },
  headerContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerLeft: {
    flex: 1,
  },
  greeting: {
    fontSize: 14,
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
  },
  notificationButton: {
    position: 'relative',
    padding: 8,
  },
  notificationBadge: {
    position: 'absolute',
    top: 4,
    right: 4,
  },
  statsContainer: {
    marginTop: -24,
    paddingHorizontal: 16,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  statCard: {
    width: (width - 48) / 2,
    marginBottom: 12,
    alignItems: 'center',
  },
  statIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  changeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  changeText: {
    fontSize: 10,
    fontWeight: '500',
    marginLeft: 2,
  },
  section: {
    marginTop: 24,
    paddingHorizontal: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  seeAll: {
    fontSize: 14,
    fontWeight: '500',
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  actionButton: {
    flex: 1,
    marginHorizontal: 4,
    paddingVertical: 16,
    borderRadius: 16,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 12,
    fontWeight: '500',
    marginTop: 4,
  },
  botsScroll: {
    paddingRight: 16,
  },
  botCard: {
    width: 140,
    marginRight: 12,
    alignItems: 'center',
  },
  botHeader: {
    position: 'relative',
    marginBottom: 8,
  },
  botStatusDot: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 12,
    height: 12,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: 'white',
  },
  botName: {
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  botPlatform: {
    fontSize: 12,
    textTransform: 'capitalize',
    marginTop: 2,
  },
  botStats: {
    flexDirection: 'row',
    marginTop: 8,
  },
  botStat: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  botStatText: {
    fontSize: 11,
    marginLeft: 4,
  },
  conversationCard: {
    marginBottom: 8,
  },
  conversationRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  conversationInfo: {
    flex: 1,
    marginLeft: 12,
  },
  conversationHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  conversationName: {
    fontSize: 14,
    fontWeight: '600',
    flex: 1,
  },
  conversationTime: {
    fontSize: 12,
    marginLeft: 8,
  },
  conversationPreview: {
    fontSize: 13,
    marginTop: 2,
  },
  emptyState: {
    paddingVertical: 40,
  },
  emptyText: {
    textAlign: 'center',
    fontSize: 14,
  },
  bottomPadding: {
    height: 100,
  },
});
