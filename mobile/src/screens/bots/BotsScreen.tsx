import React, { useEffect, useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  RefreshControl,
  TouchableOpacity,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useBotStore, selectFilteredBots } from '../../store';
import { useTheme, useRefresh, useDebounce } from '../../hooks';
import { Card, Avatar, Badge, EmptyState } from '../../components/ui';
import type { RootStackParamList, Bot } from '../../types';
import { BOT_PLATFORMS, BOT_STATUSES } from '../../config/constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function BotsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const {
    bots,
    fetchBots,
    isLoading,
    searchQuery,
    setSearchQuery,
    filter,
    setFilter,
    startBot,
    stopBot,
  } = useBotStore();

  const [showFilters, setShowFilters] = useState(false);
  const debouncedSearch = useDebounce(searchQuery, 300);

  const filteredBots = selectFilteredBots(useBotStore.getState());

  useEffect(() => {
    fetchBots();
  }, [fetchBots]);

  const { refreshing, onRefresh } = useRefresh(fetchBots);

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

  const getPlatformIcon = (platform: Bot['platform']) => {
    switch (platform) {
      case 'telegram':
        return 'send';
      case 'discord':
        return 'logo-discord';
      case 'slack':
        return 'logo-slack';
      case 'whatsapp':
        return 'logo-whatsapp';
      case 'web':
        return 'globe';
      default:
        return 'code';
    }
  };

  const handleToggleBot = async (bot: Bot) => {
    if (bot.status === 'active') {
      await stopBot(bot.id);
    } else {
      await startBot(bot.id);
    }
  };

  const renderBotItem = ({ item: bot }: { item: Bot }) => (
    <Card
      variant="elevated"
      style={styles.botCard}
      onPress={() => navigation.navigate('BotDetail', { botId: bot.id })}
    >
      <View style={styles.botRow}>
        <Avatar
          source={bot.avatar}
          name={bot.name}
          size="lg"
          statusIndicator={bot.status === 'active' ? 'online' : 'offline'}
        />
        <View style={styles.botInfo}>
          <Text style={[styles.botName, { color: theme.text.primary }]}>{bot.name}</Text>
          <View style={styles.botMeta}>
            <Ionicons
              name={getPlatformIcon(bot.platform) as any}
              size={14}
              color={theme.text.tertiary}
            />
            <Text style={[styles.botPlatform, { color: theme.text.secondary }]}>
              {bot.platform}
            </Text>
            <View
              style={[styles.statusDot, { backgroundColor: getStatusColor(bot.status) }]}
            />
            <Text style={[styles.statusText, { color: theme.text.secondary }]}>
              {bot.status}
            </Text>
          </View>
          <View style={styles.statsRow}>
            <View style={styles.stat}>
              <Ionicons name="chatbubble-outline" size={12} color={theme.text.tertiary} />
              <Text style={[styles.statText, { color: theme.text.tertiary }]}>
                {bot.stats.totalConversations}
              </Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="mail-outline" size={12} color={theme.text.tertiary} />
              <Text style={[styles.statText, { color: theme.text.tertiary }]}>
                {bot.stats.totalMessages}
              </Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="time-outline" size={12} color={theme.text.tertiary} />
              <Text style={[styles.statText, { color: theme.text.tertiary }]}>
                {bot.stats.avgResponseTime.toFixed(1)}s
              </Text>
            </View>
          </View>
        </View>
        <View style={styles.botActions}>
          <TouchableOpacity
            style={[
              styles.toggleButton,
              {
                backgroundColor:
                  bot.status === 'active' ? theme.error.light : theme.success.light,
              },
            ]}
            onPress={() => handleToggleBot(bot)}
          >
            <Ionicons
              name={bot.status === 'active' ? 'stop' : 'play'}
              size={16}
              color={bot.status === 'active' ? theme.error.dark : theme.success.dark}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.settingsButton, { backgroundColor: theme.background.secondary }]}
            onPress={() => navigation.navigate('BotSettings', { botId: bot.id })}
          >
            <Ionicons name="settings-outline" size={16} color={theme.text.secondary} />
          </TouchableOpacity>
        </View>
      </View>
    </Card>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.text.primary }]}>My Bots</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.primary[500] }]}
        >
          <Ionicons name="add" size={24} color={theme.white} />
        </TouchableOpacity>
      </View>

      {/* Search & Filter */}
      <View style={styles.searchContainer}>
        <View
          style={[styles.searchInput, { backgroundColor: theme.input.background }]}
        >
          <Ionicons name="search" size={20} color={theme.text.tertiary} />
          <TextInput
            style={[styles.searchText, { color: theme.text.primary }]}
            placeholder="Search bots..."
            placeholderTextColor={theme.input.placeholder}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color={theme.text.tertiary} />
            </TouchableOpacity>
          )}
        </View>
        <TouchableOpacity
          style={[
            styles.filterButton,
            {
              backgroundColor: showFilters ? theme.primary[500] : theme.background.secondary,
            },
          ]}
          onPress={() => setShowFilters(!showFilters)}
        >
          <Ionicons
            name="options"
            size={20}
            color={showFilters ? theme.white : theme.text.secondary}
          />
        </TouchableOpacity>
      </View>

      {/* Filters */}
      {showFilters && (
        <View style={[styles.filtersContainer, { backgroundColor: theme.background.secondary }]}>
          <Text style={[styles.filterLabel, { color: theme.text.secondary }]}>Status</Text>
          <View style={styles.filterChips}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    filter.status === null ? theme.primary[500] : theme.background.tertiary,
                },
              ]}
              onPress={() => setFilter({ status: null })}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: filter.status === null ? theme.white : theme.text.secondary },
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {BOT_STATUSES.map((status) => (
              <TouchableOpacity
                key={status.id}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      filter.status === status.id
                        ? theme.primary[500]
                        : theme.background.tertiary,
                  },
                ]}
                onPress={() => setFilter({ status: status.id })}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color:
                        filter.status === status.id ? theme.white : theme.text.secondary,
                    },
                  ]}
                >
                  {status.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          <Text style={[styles.filterLabel, { color: theme.text.secondary }]}>Platform</Text>
          <View style={styles.filterChips}>
            <TouchableOpacity
              style={[
                styles.filterChip,
                {
                  backgroundColor:
                    filter.platform === null ? theme.primary[500] : theme.background.tertiary,
                },
              ]}
              onPress={() => setFilter({ platform: null })}
            >
              <Text
                style={[
                  styles.filterChipText,
                  { color: filter.platform === null ? theme.white : theme.text.secondary },
                ]}
              >
                All
              </Text>
            </TouchableOpacity>
            {BOT_PLATFORMS.map((platform) => (
              <TouchableOpacity
                key={platform.id}
                style={[
                  styles.filterChip,
                  {
                    backgroundColor:
                      filter.platform === platform.id
                        ? theme.primary[500]
                        : theme.background.tertiary,
                  },
                ]}
                onPress={() => setFilter({ platform: platform.id })}
              >
                <Text
                  style={[
                    styles.filterChipText,
                    {
                      color:
                        filter.platform === platform.id ? theme.white : theme.text.secondary,
                    },
                  ]}
                >
                  {platform.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      )}

      {/* Bots List */}
      <FlatList
        data={filteredBots}
        renderItem={renderBotItem}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.listContent}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
        ListEmptyComponent={
          <EmptyState
            icon="cube-outline"
            title={searchQuery ? 'No bots found' : 'No bots yet'}
            description={
              searchQuery
                ? 'Try adjusting your search or filters'
                : 'Create your first bot to get started'
            }
            actionLabel={searchQuery ? undefined : 'Create Bot'}
            onAction={searchQuery ? undefined : () => {}}
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
    fontSize: 28,
    fontWeight: '700',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  searchInput: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    height: 44,
    borderRadius: 12,
    gap: 8,
  },
  searchText: {
    flex: 1,
    fontSize: 16,
  },
  filterButton: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filtersContainer: {
    paddingHorizontal: 16,
    paddingVertical: 12,
    marginHorizontal: 16,
    marginBottom: 12,
    borderRadius: 12,
  },
  filterLabel: {
    fontSize: 12,
    fontWeight: '500',
    marginBottom: 8,
    marginTop: 8,
  },
  filterChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  filterChipText: {
    fontSize: 12,
    fontWeight: '500',
  },
  listContent: {
    padding: 16,
    paddingBottom: 100,
  },
  botCard: {
    marginBottom: 12,
  },
  botRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  botInfo: {
    flex: 1,
    marginLeft: 12,
  },
  botName: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 4,
  },
  botMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 6,
  },
  botPlatform: {
    fontSize: 12,
    marginLeft: 4,
    textTransform: 'capitalize',
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginLeft: 8,
    marginRight: 4,
  },
  statusText: {
    fontSize: 12,
    textTransform: 'capitalize',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 11,
  },
  botActions: {
    gap: 8,
  },
  toggleButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingsButton: {
    width: 32,
    height: 32,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
