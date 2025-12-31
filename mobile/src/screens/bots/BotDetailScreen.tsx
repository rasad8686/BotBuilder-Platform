import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  RefreshControl,
  Alert,
  Dimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LineChart } from 'react-native-chart-kit';

import { useBotStore } from '../../store';
import { useTheme, useRefresh, useBotSocket } from '../../hooks';
import { Card, Avatar, Badge, Button } from '../../components/ui';
import type { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;
type RouteProps = RouteProp<RootStackParamList, 'BotDetail'>;

const { width } = Dimensions.get('window');

export function BotDetailScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const route = useRoute<RouteProps>();
  const { botId } = route.params;

  const { selectedBot, fetchBot, startBot, stopBot, deleteBot, isLoading } = useBotStore();
  const { status: socketStatus } = useBotSocket(botId);

  const [activeTab, setActiveTab] = useState<'overview' | 'stats' | 'logs'>('overview');

  useEffect(() => {
    fetchBot(botId);
  }, [botId, fetchBot]);

  const { refreshing, onRefresh } = useRefresh(() => fetchBot(botId));

  const bot = selectedBot;

  const handleToggleBot = async () => {
    if (!bot) return;

    if (bot.status === 'active') {
      await stopBot(bot.id);
    } else {
      await startBot(bot.id);
    }
  };

  const handleDeleteBot = () => {
    Alert.alert(
      'Delete Bot',
      `Are you sure you want to delete "${bot?.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const success = await deleteBot(botId);
            if (success) {
              navigation.goBack();
            }
          },
        },
      ]
    );
  };

  const getStatusColor = (status: string) => {
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

  if (!bot) {
    return null;
  }

  const chartData = {
    labels: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
    datasets: [
      {
        data: [45, 62, 78, 55, 89, 92, 75],
        color: () => theme.primary[500],
        strokeWidth: 2,
      },
    ],
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.background.secondary }]}
            onPress={() => navigation.navigate('BotSettings', { botId })}
          >
            <Ionicons name="settings-outline" size={20} color={theme.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerButton, { backgroundColor: theme.error.light }]}
            onPress={handleDeleteBot}
          >
            <Ionicons name="trash-outline" size={20} color={theme.error.dark} />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Bot Info */}
        <View style={styles.botInfo}>
          <Avatar source={bot.avatar} name={bot.name} size="xl" />
          <Text style={[styles.botName, { color: theme.text.primary }]}>{bot.name}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.statusBadge, { backgroundColor: `${getStatusColor(bot.status)}20` }]}>
              <View style={[styles.statusDot, { backgroundColor: getStatusColor(bot.status) }]} />
              <Text style={[styles.statusText, { color: getStatusColor(bot.status) }]}>
                {bot.status}
              </Text>
            </View>
            <Badge text={bot.platform} variant="primary" size="sm" />
          </View>
          {bot.description && (
            <Text style={[styles.description, { color: theme.text.secondary }]}>
              {bot.description}
            </Text>
          )}
        </View>

        {/* Quick Actions */}
        <View style={styles.actionsRow}>
          <Button
            title={bot.status === 'active' ? 'Stop Bot' : 'Start Bot'}
            onPress={handleToggleBot}
            variant={bot.status === 'active' ? 'danger' : 'primary'}
            icon={
              <Ionicons
                name={bot.status === 'active' ? 'stop' : 'play'}
                size={20}
                color={theme.white}
              />
            }
            style={styles.actionButton}
          />
          <Button
            title="Test"
            onPress={() => {}}
            variant="outline"
            icon={<Ionicons name="flask-outline" size={20} color={theme.primary[500]} />}
            style={styles.actionButton}
          />
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderBottomColor: theme.border.light }]}>
          {(['overview', 'stats', 'logs'] as const).map((tab) => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeTab === tab && { borderBottomColor: theme.primary[500], borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? theme.primary[500] : theme.text.secondary },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab Content */}
        {activeTab === 'overview' && (
          <View style={styles.tabContent}>
            {/* Stats Cards */}
            <View style={styles.statsGrid}>
              <Card variant="outlined" style={styles.statCard}>
                <Ionicons name="chatbubbles" size={24} color={theme.primary[500]} />
                <Text style={[styles.statValue, { color: theme.text.primary }]}>
                  {bot.stats.totalConversations}
                </Text>
                <Text style={[styles.statLabel, { color: theme.text.secondary }]}>
                  Conversations
                </Text>
              </Card>
              <Card variant="outlined" style={styles.statCard}>
                <Ionicons name="mail" size={24} color={theme.secondary[500]} />
                <Text style={[styles.statValue, { color: theme.text.primary }]}>
                  {bot.stats.totalMessages}
                </Text>
                <Text style={[styles.statLabel, { color: theme.text.secondary }]}>Messages</Text>
              </Card>
              <Card variant="outlined" style={styles.statCard}>
                <Ionicons name="time" size={24} color={theme.warning.main} />
                <Text style={[styles.statValue, { color: theme.text.primary }]}>
                  {bot.stats.avgResponseTime.toFixed(1)}s
                </Text>
                <Text style={[styles.statLabel, { color: theme.text.secondary }]}>Avg Response</Text>
              </Card>
              <Card variant="outlined" style={styles.statCard}>
                <Ionicons name="star" size={24} color={theme.success.main} />
                <Text style={[styles.statValue, { color: theme.text.primary }]}>
                  {bot.stats.satisfactionScore.toFixed(1)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.text.secondary }]}>Satisfaction</Text>
              </Card>
            </View>

            {/* Configuration */}
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Configuration</Text>
            <Card variant="outlined" style={styles.configCard}>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text.secondary }]}>AI Model</Text>
                <Text style={[styles.configValue, { color: theme.text.primary }]}>
                  {bot.config.aiModel || 'Not set'}
                </Text>
              </View>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text.secondary }]}>AI Enabled</Text>
                <Badge
                  text={bot.config.aiEnabled ? 'Yes' : 'No'}
                  variant={bot.config.aiEnabled ? 'success' : 'default'}
                  size="sm"
                />
              </View>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text.secondary }]}>Language</Text>
                <Text style={[styles.configValue, { color: theme.text.primary }]}>
                  {bot.config.language}
                </Text>
              </View>
              <View style={styles.configRow}>
                <Text style={[styles.configLabel, { color: theme.text.secondary }]}>Timezone</Text>
                <Text style={[styles.configValue, { color: theme.text.primary }]}>
                  {bot.config.timezone}
                </Text>
              </View>
            </Card>
          </View>
        )}

        {activeTab === 'stats' && (
          <View style={styles.tabContent}>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              Conversations (Last 7 days)
            </Text>
            <Card variant="outlined" padding="sm">
              <LineChart
                data={chartData}
                width={width - 64}
                height={200}
                chartConfig={{
                  backgroundColor: theme.card.background,
                  backgroundGradientFrom: theme.card.background,
                  backgroundGradientTo: theme.card.background,
                  decimalPlaces: 0,
                  color: () => theme.primary[500],
                  labelColor: () => theme.text.tertiary,
                  style: { borderRadius: 16 },
                  propsForDots: {
                    r: '4',
                    strokeWidth: '2',
                    stroke: theme.primary[600],
                  },
                }}
                bezier
                style={styles.chart}
              />
            </Card>

            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              Performance Metrics
            </Text>
            <Card variant="outlined">
              <View style={styles.metricRow}>
                <Text style={[styles.metricLabel, { color: theme.text.secondary }]}>
                  Uptime
                </Text>
                <Text style={[styles.metricValue, { color: theme.success.main }]}>
                  {bot.stats.uptime}%
                </Text>
              </View>
              <View style={styles.metricRow}>
                <Text style={[styles.metricLabel, { color: theme.text.secondary }]}>
                  Active Conversations
                </Text>
                <Text style={[styles.metricValue, { color: theme.text.primary }]}>
                  {bot.stats.activeConversations}
                </Text>
              </View>
            </Card>
          </View>
        )}

        {activeTab === 'logs' && (
          <View style={styles.tabContent}>
            <Card variant="outlined">
              <Text style={[styles.logsPlaceholder, { color: theme.text.secondary }]}>
                Bot activity logs will appear here...
              </Text>
            </Card>
          </View>
        )}

        <View style={styles.bottomPadding} />
      </ScrollView>
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
  },
  headerButton: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  botInfo: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  botName: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 6,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
    textTransform: 'capitalize',
  },
  description: {
    fontSize: 14,
    textAlign: 'center',
    marginTop: 12,
    paddingHorizontal: 24,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 24,
  },
  actionButton: {
    flex: 1,
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginBottom: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '500',
  },
  tabContent: {
    flex: 1,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    width: (width - 44) / 2,
    alignItems: 'center',
    paddingVertical: 16,
  },
  statValue: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 8,
  },
  statLabel: {
    fontSize: 12,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  configCard: {
    marginBottom: 24,
  },
  configRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  configLabel: {
    fontSize: 14,
  },
  configValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  chart: {
    borderRadius: 12,
    marginVertical: 8,
  },
  metricRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  metricLabel: {
    fontSize: 14,
  },
  metricValue: {
    fontSize: 16,
    fontWeight: '600',
  },
  logsPlaceholder: {
    textAlign: 'center',
    paddingVertical: 40,
  },
  bottomPadding: {
    height: 100,
  },
});
