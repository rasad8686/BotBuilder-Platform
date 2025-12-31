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
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { Card, Badge, EmptyState, Avatar } from '../../components/ui';
import { cloneService } from '../../services/cloneService';

interface Clone {
  id: string;
  name: string;
  description: string;
  type: 'personality' | 'voice' | 'style';
  status: 'training' | 'ready' | 'failed' | 'draft';
  trainingProgress?: number;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  stats: {
    conversations: number;
    messages: number;
    avgRating: number;
  };
}

export const CloneListScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const [clones, setClones] = useState<Clone[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const fetchClones = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      const response = await cloneService.getClones();
      setClones(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load clones');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchClones();
  }, [fetchClones]);

  const filteredClones = clones.filter(clone => {
    const matchesSearch = clone.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      clone.description?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = !selectedType || clone.type === selectedType;
    return matchesSearch && matchesType;
  });

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'personality': return 'person';
      case 'voice': return 'mic';
      case 'style': return 'brush';
      default: return 'cube';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'personality': return '#8B5CF6';
      case 'voice': return '#EC4899';
      case 'style': return '#F59E0B';
      default: return theme.colors.primary;
    }
  };

  const getStatusBadge = (status: string, progress?: number) => {
    switch (status) {
      case 'ready':
        return <Badge text="Ready" variant="success" />;
      case 'training':
        return (
          <View style={styles.trainingBadge}>
            <ActivityIndicator size="small" color={theme.colors.primary} />
            <Text style={[styles.trainingText, { color: theme.colors.primary }]}>
              {progress ? `${progress}%` : 'Training'}
            </Text>
          </View>
        );
      case 'failed':
        return <Badge text="Failed" variant="danger" />;
      case 'draft':
        return <Badge text="Draft" variant="default" />;
      default:
        return null;
    }
  };

  const renderCloneItem = ({ item }: { item: Clone }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('CloneDetail' as never, { cloneId: item.id } as never)}
    >
      <Card style={styles.cloneCard}>
        <View style={styles.cloneHeader}>
          <View style={styles.avatarContainer}>
            {item.avatar ? (
              <Image source={{ uri: item.avatar }} style={styles.avatar} />
            ) : (
              <Avatar
                name={item.name}
                size={56}
                style={{ backgroundColor: getTypeColor(item.type) }}
              />
            )}
            <View
              style={[
                styles.typeIndicator,
                { backgroundColor: getTypeColor(item.type) },
              ]}
            >
              <Ionicons name={getTypeIcon(item.type) as any} size={12} color="#fff" />
            </View>
          </View>
          <View style={styles.cloneInfo}>
            <Text style={[styles.cloneName, { color: theme.colors.text }]}>
              {item.name}
            </Text>
            <Text style={[styles.cloneDescription, { color: theme.colors.textSecondary }]} numberOfLines={2}>
              {item.description}
            </Text>
            <View style={styles.typeTag}>
              <Text style={[styles.typeText, { color: getTypeColor(item.type) }]}>
                {item.type.charAt(0).toUpperCase() + item.type.slice(1)} Clone
              </Text>
            </View>
          </View>
          {getStatusBadge(item.status, item.trainingProgress)}
        </View>

        {item.status === 'training' && item.trainingProgress && (
          <View style={styles.progressContainer}>
            <View style={[styles.progressBar, { backgroundColor: theme.colors.border }]}>
              <View
                style={[
                  styles.progressFill,
                  {
                    backgroundColor: theme.colors.primary,
                    width: `${item.trainingProgress}%`,
                  },
                ]}
              />
            </View>
          </View>
        )}

        {item.status === 'ready' && (
          <View style={[styles.statsRow, { borderTopColor: theme.colors.border }]}>
            <View style={styles.stat}>
              <Ionicons name="chatbubbles-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {item.stats.conversations}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                chats
              </Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="mail-outline" size={16} color={theme.colors.textSecondary} />
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {item.stats.messages}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                messages
              </Text>
            </View>
            <View style={styles.stat}>
              <Ionicons name="star" size={16} color="#F59E0B" />
              <Text style={[styles.statValue, { color: theme.colors.text }]}>
                {item.stats.avgRating.toFixed(1)}
              </Text>
              <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
                rating
              </Text>
            </View>
          </View>
        )}
      </Card>
    </TouchableOpacity>
  );

  const typeFilters = [
    { key: null, label: 'All' },
    { key: 'personality', label: 'Personality' },
    { key: 'voice', label: 'Voice' },
    { key: 'style', label: 'Style' },
  ];

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Loading clones...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>AI Clones</Text>
        <TouchableOpacity
          style={[styles.addButton, { backgroundColor: theme.colors.primary }]}
          onPress={() => navigation.navigate('CreateClone' as never)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: theme.colors.card }]}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder="Search clones..."
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

      <View style={styles.filtersContainer}>
        {typeFilters.map(filter => (
          <TouchableOpacity
            key={filter.key || 'all'}
            style={[
              styles.filterChip,
              {
                backgroundColor: selectedType === filter.key
                  ? theme.colors.primary
                  : theme.colors.card,
              },
            ]}
            onPress={() => setSelectedType(filter.key)}
          >
            <Text
              style={[
                styles.filterText,
                {
                  color: selectedType === filter.key
                    ? '#fff'
                    : theme.colors.textSecondary,
                },
              ]}
            >
              {filter.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {error ? (
        <EmptyState
          icon="alert-circle"
          title="Error Loading Clones"
          description={error}
          actionLabel="Retry"
          onAction={() => fetchClones()}
        />
      ) : filteredClones.length === 0 ? (
        <EmptyState
          icon="copy-outline"
          title="No Clones"
          description={searchQuery || selectedType ? "No clones match your filters" : "Create your first AI clone to get started"}
          actionLabel="Create Clone"
          onAction={() => navigation.navigate('CreateClone' as never)}
        />
      ) : (
        <FlatList
          data={filteredClones}
          keyExtractor={(item) => item.id}
          renderItem={renderCloneItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchClones(true)}
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
  filtersContainer: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  cloneCard: {
    marginBottom: 12,
    padding: 16,
  },
  cloneHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
  },
  typeIndicator: {
    position: 'absolute',
    bottom: -2,
    right: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#fff',
  },
  cloneInfo: {
    flex: 1,
    marginLeft: 12,
  },
  cloneName: {
    fontSize: 16,
    fontWeight: '600',
  },
  cloneDescription: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  typeTag: {
    marginTop: 6,
  },
  typeText: {
    fontSize: 12,
    fontWeight: '500',
  },
  trainingBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  trainingText: {
    fontSize: 12,
    fontWeight: '500',
  },
  progressContainer: {
    marginTop: 12,
  },
  progressBar: {
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 2,
  },
  statsRow: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: 1,
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
});

export default CloneListScreen;
