import React, { useState, useCallback, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { Card, Badge, EmptyState, Avatar } from '../../components/ui';
import { voiceService } from '../../services/voiceService';

interface VoiceBot {
  id: string;
  name: string;
  description: string;
  status: 'active' | 'inactive' | 'busy';
  phoneNumber?: string;
  provider: 'twilio' | 'vonage' | 'custom';
  language: string;
  voiceType: string;
  totalCalls: number;
  avgCallDuration: number;
  lastCallAt?: string;
}

export const VoiceBotsScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const [bots, setBots] = useState<VoiceBot[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [error, setError] = useState<string | null>(null);

  const fetchVoiceBots = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      const response = await voiceService.getVoiceBots();
      setBots(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load voice bots');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchVoiceBots();
  }, [fetchVoiceBots]);

  const filteredBots = bots.filter(bot =>
    bot.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    bot.description?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return theme.colors.success;
      case 'busy': return theme.colors.warning;
      default: return theme.colors.textSecondary;
    }
  };

  const formatDuration = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}m ${secs}s`;
  };

  const renderBotItem = ({ item }: { item: VoiceBot }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('VoiceBotDetail' as never, { botId: item.id } as never)}
    >
      <Card style={styles.botCard}>
        <View style={styles.botHeader}>
          <Avatar
            name={item.name}
            size={50}
            style={{ backgroundColor: theme.colors.primary }}
          />
          <View style={styles.botInfo}>
            <Text style={[styles.botName, { color: theme.colors.text }]}>
              {item.name}
            </Text>
            <Text style={[styles.botDescription, { color: theme.colors.textSecondary }]} numberOfLines={1}>
              {item.description}
            </Text>
          </View>
          <Badge
            text={item.status}
            variant={item.status === 'active' ? 'success' : item.status === 'busy' ? 'warning' : 'default'}
          />
        </View>

        {item.phoneNumber && (
          <View style={[styles.phoneRow, { borderTopColor: theme.colors.border }]}>
            <Ionicons name="call" size={16} color={theme.colors.primary} />
            <Text style={[styles.phoneNumber, { color: theme.colors.text }]}>
              {item.phoneNumber}
            </Text>
          </View>
        )}

        <View style={styles.statsRow}>
          <View style={styles.stat}>
            <Ionicons name="call-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {item.totalCalls}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              calls
            </Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="time-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {formatDuration(item.avgCallDuration)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              avg
            </Text>
          </View>
          <View style={styles.stat}>
            <Ionicons name="globe-outline" size={16} color={theme.colors.textSecondary} />
            <Text style={[styles.statValue, { color: theme.colors.text }]}>
              {item.language.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.primary + '20' }]}
            onPress={() => navigation.navigate('VoiceCall' as never, { botId: item.id } as never)}
          >
            <Ionicons name="call" size={18} color={theme.colors.primary} />
            <Text style={[styles.actionText, { color: theme.colors.primary }]}>Test Call</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionButton, { backgroundColor: theme.colors.background }]}
            onPress={() => navigation.navigate('VoiceBotSettings' as never, { botId: item.id } as never)}
          >
            <Ionicons name="settings-outline" size={18} color={theme.colors.textSecondary} />
            <Text style={[styles.actionText, { color: theme.colors.textSecondary }]}>Settings</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Loading voice bots...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Voice Bots</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigation.navigate('CreateVoiceBot' as never)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: theme.colors.card }]}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder="Search voice bots..."
          placeholderTextColor={theme.colors.textSecondary}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <TouchableOpacity onPress={() => setSearchQuery('')}>
            <Ionicons name="close-circle" size={20} color={theme.colors.textSecondary} />
          </TouchableOpacity>
        )}
      </View>

      {error ? (
        <EmptyState
          icon="alert-circle"
          title="Error Loading Bots"
          description={error}
          actionLabel="Retry"
          onAction={() => fetchVoiceBots()}
        />
      ) : filteredBots.length === 0 ? (
        <EmptyState
          icon="mic-off"
          title="No Voice Bots"
          description={searchQuery ? "No bots match your search" : "Create your first voice bot to get started"}
          actionLabel="Create Voice Bot"
          onAction={() => navigation.navigate('CreateVoiceBot' as never)}
        />
      ) : (
        <FlatList
          data={filteredBots}
          keyExtractor={(item) => item.id}
          renderItem={renderBotItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchVoiceBots(true)}
              colors={[theme.colors.primary]}
              tintColor={theme.colors.primary}
            />
          }
          showsVerticalScrollIndicator={false}
        />
      )}
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centered: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
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
    fontWeight: 'bold',
  },
  addButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: 16,
    marginBottom: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
  },
  searchInput: {
    flex: 1,
    marginLeft: 8,
    fontSize: 16,
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  botCard: {
    marginBottom: 12,
    padding: 16,
  },
  botHeader: {
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
  },
  botDescription: {
    fontSize: 13,
    marginTop: 2,
  },
  phoneRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
  },
  phoneNumber: {
    marginLeft: 8,
    fontSize: 14,
    fontWeight: '500',
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statValue: {
    fontSize: 14,
    fontWeight: '600',
  },
  statLabel: {
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    gap: 6,
  },
  actionText: {
    fontSize: 14,
    fontWeight: '500',
  },
});

export default VoiceBotsScreen;
