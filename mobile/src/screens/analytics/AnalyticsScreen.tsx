import React, { useEffect, useState } from 'react';
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
import { LineChart, BarChart, PieChart } from 'react-native-chart-kit';

import { useAnalyticsStore, useBotStore, dateRangePresets } from '../../store';
import { useTheme, useRefresh } from '../../hooks';
import { Card, Badge } from '../../components/ui';

const { width } = Dimensions.get('window');

export function AnalyticsScreen() {
  const theme = useTheme();
  const { data, fetchAnalytics, isLoading, dateRange, setDateRange, setSelectedBot, selectedBotId } = useAnalyticsStore();
  const { bots } = useBotStore();

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBotPicker, setShowBotPicker] = useState(false);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const { refreshing, onRefresh } = useRefresh(fetchAnalytics);

  const chartConfig = {
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
  };

  const formatNumber = (num: number) => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toString();
  };

  const overviewStats = [
    {
      label: 'Total Conversations',
      value: data?.overview?.totalConversations || 0,
      change: data?.overview?.conversationGrowth || 0,
      icon: 'chatbubbles',
      color: theme.primary[500],
    },
    {
      label: 'Total Messages',
      value: data?.overview?.totalMessages || 0,
      change: data?.overview?.messageGrowth || 0,
      icon: 'mail',
      color: theme.secondary[500],
    },
    {
      label: 'Active Users',
      value: data?.overview?.activeUsers || 0,
      icon: 'people',
      color: theme.info.main,
    },
    {
      label: 'Satisfaction',
      value: `${(data?.overview?.satisfactionScore || 0).toFixed(1)}`,
      icon: 'star',
      color: theme.warning.main,
    },
  ];

  const conversationData = {
    labels: data?.conversationsByDay?.slice(-7).map((d) => d.label || d.date.slice(-2)) || ['', '', '', '', '', '', ''],
    datasets: [
      {
        data: data?.conversationsByDay?.slice(-7).map((d) => d.value) || [0, 0, 0, 0, 0, 0, 0],
      },
    ],
  };

  const satisfactionData = [
    {
      name: 'Excellent',
      population: data?.userSatisfaction?.excellent || 0,
      color: theme.success.main,
      legendFontColor: theme.text.secondary,
    },
    {
      name: 'Good',
      population: data?.userSatisfaction?.good || 0,
      color: theme.info.main,
      legendFontColor: theme.text.secondary,
    },
    {
      name: 'Average',
      population: data?.userSatisfaction?.average || 0,
      color: theme.warning.main,
      legendFontColor: theme.text.secondary,
    },
    {
      name: 'Poor',
      population: data?.userSatisfaction?.poor || 0,
      color: theme.error.main,
      legendFontColor: theme.text.secondary,
    },
  ].filter((d) => d.population > 0);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text.primary }]}>Analytics</Text>
        <TouchableOpacity
          style={[styles.exportButton, { backgroundColor: theme.primary[500] }]}
        >
          <Ionicons name="download-outline" size={20} color={theme.white} />
        </TouchableOpacity>
      </View>

      <ScrollView
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Filters */}
        <View style={styles.filtersRow}>
          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: theme.background.secondary }]}
            onPress={() => setShowDatePicker(!showDatePicker)}
          >
            <Ionicons name="calendar-outline" size={16} color={theme.text.secondary} />
            <Text style={[styles.filterText, { color: theme.text.primary }]}>
              {dateRange.label}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.text.tertiary} />
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.filterButton, { backgroundColor: theme.background.secondary }]}
            onPress={() => setShowBotPicker(!showBotPicker)}
          >
            <Ionicons name="cube-outline" size={16} color={theme.text.secondary} />
            <Text style={[styles.filterText, { color: theme.text.primary }]}>
              {selectedBotId ? bots.find((b) => b.id === selectedBotId)?.name : 'All Bots'}
            </Text>
            <Ionicons name="chevron-down" size={16} color={theme.text.tertiary} />
          </TouchableOpacity>
        </View>

        {/* Date Range Picker */}
        {showDatePicker && (
          <Card variant="outlined" style={styles.pickerCard}>
            {dateRangePresets.map((preset) => (
              <TouchableOpacity
                key={preset.label}
                style={[
                  styles.pickerItem,
                  dateRange.label === preset.label && { backgroundColor: theme.primary[50] },
                ]}
                onPress={() => {
                  setDateRange(preset);
                  setShowDatePicker(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    { color: dateRange.label === preset.label ? theme.primary[600] : theme.text.primary },
                  ]}
                >
                  {preset.label}
                </Text>
                {dateRange.label === preset.label && (
                  <Ionicons name="checkmark" size={20} color={theme.primary[500]} />
                )}
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Bot Picker */}
        {showBotPicker && (
          <Card variant="outlined" style={styles.pickerCard}>
            <TouchableOpacity
              style={[
                styles.pickerItem,
                !selectedBotId && { backgroundColor: theme.primary[50] },
              ]}
              onPress={() => {
                setSelectedBot(null);
                setShowBotPicker(false);
              }}
            >
              <Text
                style={[
                  styles.pickerItemText,
                  { color: !selectedBotId ? theme.primary[600] : theme.text.primary },
                ]}
              >
                All Bots
              </Text>
              {!selectedBotId && <Ionicons name="checkmark" size={20} color={theme.primary[500]} />}
            </TouchableOpacity>
            {bots.map((bot) => (
              <TouchableOpacity
                key={bot.id}
                style={[
                  styles.pickerItem,
                  selectedBotId === bot.id && { backgroundColor: theme.primary[50] },
                ]}
                onPress={() => {
                  setSelectedBot(bot.id);
                  setShowBotPicker(false);
                }}
              >
                <Text
                  style={[
                    styles.pickerItemText,
                    { color: selectedBotId === bot.id ? theme.primary[600] : theme.text.primary },
                  ]}
                >
                  {bot.name}
                </Text>
                {selectedBotId === bot.id && (
                  <Ionicons name="checkmark" size={20} color={theme.primary[500]} />
                )}
              </TouchableOpacity>
            ))}
          </Card>
        )}

        {/* Overview Stats */}
        <View style={styles.statsGrid}>
          {overviewStats.map((stat, index) => (
            <Card key={index} variant="elevated" style={styles.statCard}>
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

        {/* Conversations Chart */}
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
          Conversations Trend
        </Text>
        <Card variant="outlined" padding="sm">
          <LineChart
            data={conversationData}
            width={width - 64}
            height={200}
            chartConfig={chartConfig}
            bezier
            style={styles.chart}
          />
        </Card>

        {/* Response Time */}
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
          Performance Metrics
        </Text>
        <Card variant="outlined">
          <View style={styles.metricRow}>
            <View style={styles.metricInfo}>
              <Text style={[styles.metricLabel, { color: theme.text.secondary }]}>
                Average Response Time
              </Text>
              <Text style={[styles.metricValue, { color: theme.text.primary }]}>
                {(data?.overview?.avgResponseTime || 0).toFixed(2)}s
              </Text>
            </View>
            <View style={[styles.metricIndicator, { backgroundColor: theme.success.light }]}>
              <Ionicons name="time" size={16} color={theme.success.dark} />
            </View>
          </View>
          <View style={styles.divider} />
          <View style={styles.metricRow}>
            <View style={styles.metricInfo}>
              <Text style={[styles.metricLabel, { color: theme.text.secondary }]}>
                Active Bots
              </Text>
              <Text style={[styles.metricValue, { color: theme.text.primary }]}>
                {data?.overview?.activeBots || 0}
              </Text>
            </View>
            <View style={[styles.metricIndicator, { backgroundColor: theme.primary[100] }]}>
              <Ionicons name="cube" size={16} color={theme.primary[600]} />
            </View>
          </View>
        </Card>

        {/* Satisfaction Distribution */}
        {satisfactionData.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              Satisfaction Distribution
            </Text>
            <Card variant="outlined" padding="sm">
              <PieChart
                data={satisfactionData}
                width={width - 64}
                height={180}
                chartConfig={chartConfig}
                accessor="population"
                backgroundColor="transparent"
                paddingLeft="15"
                absolute
              />
            </Card>
          </>
        )}

        {/* Top Performers */}
        {data?.botPerformance && data.botPerformance.length > 0 && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>
              Bot Performance
            </Text>
            <Card variant="outlined">
              {data.botPerformance.slice(0, 5).map((bot, index) => (
                <View
                  key={bot.botId}
                  style={[
                    styles.performanceRow,
                    index < data.botPerformance.length - 1 && styles.performanceRowBorder,
                  ]}
                >
                  <View style={styles.performanceInfo}>
                    <Text style={[styles.performanceName, { color: theme.text.primary }]}>
                      {bot.botName}
                    </Text>
                    <View style={styles.performanceStats}>
                      <Text style={[styles.performanceStat, { color: theme.text.secondary }]}>
                        {bot.conversations} chats
                      </Text>
                      <Text style={[styles.performanceStat, { color: theme.text.tertiary }]}>
                        {bot.avgResponseTime.toFixed(1)}s avg
                      </Text>
                    </View>
                  </View>
                  <Badge
                    text={`${bot.satisfaction.toFixed(1)}`}
                    variant={bot.satisfaction >= 4 ? 'success' : bot.satisfaction >= 3 ? 'warning' : 'error'}
                  />
                </View>
              ))}
            </Card>
          </>
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
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  exportButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  filtersRow: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: 16,
  },
  filterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 10,
    gap: 6,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  pickerCard: {
    marginBottom: 16,
  },
  pickerItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
  },
  pickerItemText: {
    fontSize: 14,
    fontWeight: '500',
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
    textAlign: 'center',
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
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
    marginTop: 8,
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
  metricInfo: {
    flex: 1,
  },
  metricLabel: {
    fontSize: 12,
  },
  metricValue: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 2,
  },
  metricIndicator: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
  },
  performanceRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
  },
  performanceRowBorder: {
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  performanceInfo: {
    flex: 1,
  },
  performanceName: {
    fontSize: 14,
    fontWeight: '500',
  },
  performanceStats: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 2,
  },
  performanceStat: {
    fontSize: 12,
  },
  bottomPadding: {
    height: 100,
  },
});
