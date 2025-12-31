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
import { Card, Badge, EmptyState } from '../../components/ui';
import { pluginService } from '../../services/pluginService';

interface Plugin {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category: string;
  version: string;
  author: string;
  rating: number;
  downloads: number;
  price: number;
  isInstalled: boolean;
  isEnabled: boolean;
  tags: string[];
}

const categories = [
  { key: null, label: 'All', icon: 'grid' },
  { key: 'ai', label: 'AI', icon: 'bulb' },
  { key: 'integration', label: 'Integration', icon: 'link' },
  { key: 'analytics', label: 'Analytics', icon: 'bar-chart' },
  { key: 'productivity', label: 'Productivity', icon: 'flash' },
  { key: 'security', label: 'Security', icon: 'shield' },
];

export const PluginsScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const [plugins, setPlugins] = useState<Plugin[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [showInstalled, setShowInstalled] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchPlugins = useCallback(async (showRefresh = false) => {
    try {
      if (showRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      const response = showInstalled
        ? await pluginService.getInstalledPlugins()
        : await pluginService.getMarketplacePlugins({ category: selectedCategory || undefined });

      setPlugins(response.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load plugins');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, [showInstalled, selectedCategory]);

  useEffect(() => {
    fetchPlugins();
  }, [fetchPlugins]);

  const filteredPlugins = plugins.filter(plugin =>
    plugin.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plugin.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
    plugin.tags?.some(tag => tag.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  const handleInstall = async (pluginId: string) => {
    try {
      await pluginService.installPlugin(pluginId);
      fetchPlugins();
    } catch (err: any) {
      setError(err.message || 'Failed to install plugin');
    }
  };

  const handleToggle = async (pluginId: string, enabled: boolean) => {
    try {
      await pluginService.togglePlugin(pluginId, enabled);
      setPlugins(prev =>
        prev.map(p => (p.id === pluginId ? { ...p, isEnabled: enabled } : p))
      );
    } catch (err: any) {
      setError(err.message || 'Failed to toggle plugin');
    }
  };

  const renderStars = (rating: number) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-outline'}
          size={12}
          color="#F59E0B"
        />
      );
    }
    return stars;
  };

  const formatDownloads = (count: number) => {
    if (count >= 1000000) return `${(count / 1000000).toFixed(1)}M`;
    if (count >= 1000) return `${(count / 1000).toFixed(1)}K`;
    return count.toString();
  };

  const renderPluginItem = ({ item }: { item: Plugin }) => (
    <TouchableOpacity
      onPress={() => navigation.navigate('PluginDetail' as never, { pluginId: item.id } as never)}
    >
      <Card style={styles.pluginCard}>
        <View style={styles.pluginHeader}>
          {item.icon ? (
            <Image source={{ uri: item.icon }} style={styles.pluginIcon} />
          ) : (
            <View style={[styles.pluginIconPlaceholder, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="extension-puzzle" size={24} color="#fff" />
            </View>
          )}
          <View style={styles.pluginInfo}>
            <View style={styles.pluginNameRow}>
              <Text style={[styles.pluginName, { color: theme.colors.text }]} numberOfLines={1}>
                {item.name}
              </Text>
              {item.isInstalled && (
                <Badge
                  text={item.isEnabled ? 'Active' : 'Inactive'}
                  variant={item.isEnabled ? 'success' : 'default'}
                  size="small"
                />
              )}
            </View>
            <Text style={[styles.pluginAuthor, { color: theme.colors.textSecondary }]}>
              by {item.author}
            </Text>
            <View style={styles.ratingRow}>
              <View style={styles.stars}>{renderStars(item.rating)}</View>
              <Text style={[styles.ratingText, { color: theme.colors.textSecondary }]}>
                ({item.rating.toFixed(1)})
              </Text>
              <Text style={[styles.downloads, { color: theme.colors.textSecondary }]}>
                {formatDownloads(item.downloads)} downloads
              </Text>
            </View>
          </View>
        </View>

        <Text style={[styles.pluginDescription, { color: theme.colors.textSecondary }]} numberOfLines={2}>
          {item.description}
        </Text>

        <View style={styles.tagsContainer}>
          {item.tags?.slice(0, 3).map((tag, index) => (
            <View
              key={index}
              style={[styles.tag, { backgroundColor: theme.colors.primary + '15' }]}
            >
              <Text style={[styles.tagText, { color: theme.colors.primary }]}>{tag}</Text>
            </View>
          ))}
        </View>

        <View style={styles.pluginFooter}>
          <Text style={[styles.price, { color: item.price === 0 ? theme.colors.success : theme.colors.text }]}>
            {item.price === 0 ? 'Free' : `$${item.price.toFixed(2)}`}
          </Text>
          {item.isInstalled ? (
            <TouchableOpacity
              style={[
                styles.toggleButton,
                { backgroundColor: item.isEnabled ? theme.colors.error + '15' : theme.colors.primary + '15' },
              ]}
              onPress={() => handleToggle(item.id, !item.isEnabled)}
            >
              <Text
                style={[
                  styles.toggleButtonText,
                  { color: item.isEnabled ? theme.colors.error : theme.colors.primary },
                ]}
              >
                {item.isEnabled ? 'Disable' : 'Enable'}
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[styles.installButton, { backgroundColor: theme.colors.primary }]}
              onPress={() => handleInstall(item.id)}
            >
              <Ionicons name="download" size={16} color="#fff" />
              <Text style={styles.installButtonText}>Install</Text>
            </TouchableOpacity>
          )}
        </View>
      </Card>
    </TouchableOpacity>
  );

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
        <Text style={[styles.loadingText, { color: theme.colors.textSecondary }]}>
          Loading plugins...
        </Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <Text style={[styles.title, { color: theme.colors.text }]}>Plugins</Text>
        <View style={styles.headerActions}>
          <TouchableOpacity
            style={[
              styles.filterToggle,
              { backgroundColor: showInstalled ? theme.colors.primary : theme.colors.card },
            ]}
            onPress={() => setShowInstalled(!showInstalled)}
          >
            <Ionicons
              name="checkmark-circle"
              size={18}
              color={showInstalled ? '#fff' : theme.colors.textSecondary}
            />
            <Text
              style={[
                styles.filterToggleText,
                { color: showInstalled ? '#fff' : theme.colors.textSecondary },
              ]}
            >
              Installed
            </Text>
          </TouchableOpacity>
        </View>
      </View>

      <View style={[styles.searchContainer, { backgroundColor: theme.colors.card }]}>
        <Ionicons name="search" size={20} color={theme.colors.textSecondary} />
        <TextInput
          style={[styles.searchInput, { color: theme.colors.text }]}
          placeholder="Search plugins..."
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

      {!showInstalled && (
        <FlatList
          horizontal
          data={categories}
          keyExtractor={(item) => item.key || 'all'}
          renderItem={({ item }) => (
            <TouchableOpacity
              style={[
                styles.categoryChip,
                {
                  backgroundColor: selectedCategory === item.key
                    ? theme.colors.primary
                    : theme.colors.card,
                },
              ]}
              onPress={() => setSelectedCategory(item.key)}
            >
              <Ionicons
                name={item.icon as any}
                size={16}
                color={selectedCategory === item.key ? '#fff' : theme.colors.textSecondary}
              />
              <Text
                style={[
                  styles.categoryText,
                  {
                    color: selectedCategory === item.key ? '#fff' : theme.colors.textSecondary,
                  },
                ]}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          )}
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categoriesContainer}
        />
      )}

      {error ? (
        <EmptyState
          icon="alert-circle"
          title="Error Loading Plugins"
          description={error}
          actionLabel="Retry"
          onAction={() => fetchPlugins()}
        />
      ) : filteredPlugins.length === 0 ? (
        <EmptyState
          icon="extension-puzzle-outline"
          title={showInstalled ? 'No Installed Plugins' : 'No Plugins Found'}
          description={
            showInstalled
              ? 'Browse the marketplace to find plugins'
              : searchQuery
              ? 'No plugins match your search'
              : 'No plugins available in this category'
          }
          actionLabel={showInstalled ? 'Browse Marketplace' : undefined}
          onAction={showInstalled ? () => setShowInstalled(false) : undefined}
        />
      ) : (
        <FlatList
          data={filteredPlugins}
          keyExtractor={(item) => item.id}
          renderItem={renderPluginItem}
          contentContainerStyle={styles.listContent}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={() => fetchPlugins(true)}
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
  headerActions: {
    flexDirection: 'row',
  },
  filterToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 4,
  },
  filterToggleText: {
    fontSize: 13,
    fontWeight: '500',
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
  categoriesContainer: {
    paddingHorizontal: 16,
    marginBottom: 12,
    gap: 8,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 20,
    marginRight: 8,
    gap: 6,
  },
  categoryText: {
    fontSize: 13,
    fontWeight: '500',
  },
  listContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  pluginCard: {
    marginBottom: 12,
    padding: 16,
  },
  pluginHeader: {
    flexDirection: 'row',
    marginBottom: 10,
  },
  pluginIcon: {
    width: 48,
    height: 48,
    borderRadius: 10,
  },
  pluginIconPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pluginInfo: {
    flex: 1,
    marginLeft: 12,
  },
  pluginNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  pluginName: {
    fontSize: 16,
    fontWeight: '600',
    flex: 1,
  },
  pluginAuthor: {
    fontSize: 12,
    marginTop: 2,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  stars: {
    flexDirection: 'row',
    gap: 2,
  },
  ratingText: {
    fontSize: 11,
  },
  downloads: {
    fontSize: 11,
    marginLeft: 8,
  },
  pluginDescription: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 10,
  },
  tagsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  tag: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 11,
    fontWeight: '500',
  },
  pluginFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  price: {
    fontSize: 16,
    fontWeight: '600',
  },
  installButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    gap: 6,
  },
  installButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  toggleButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
  },
  toggleButtonText: {
    fontSize: 14,
    fontWeight: '600',
  },
});

export default PluginsScreen;
