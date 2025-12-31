import React, { useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Alert,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { Card, Badge, Button } from '../../components/ui';
import { pluginService } from '../../services/pluginService';

interface PluginDetail {
  id: string;
  name: string;
  description: string;
  longDescription: string;
  icon?: string;
  screenshots?: string[];
  category: string;
  version: string;
  author: string;
  authorUrl?: string;
  website?: string;
  rating: number;
  reviewCount: number;
  downloads: number;
  price: number;
  isInstalled: boolean;
  isEnabled: boolean;
  tags: string[];
  permissions: string[];
  changelog: Array<{
    version: string;
    date: string;
    changes: string[];
  }>;
  requirements: {
    minVersion: string;
    platforms: string[];
  };
}

interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
}

export const PluginDetailScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { pluginId } = route.params as { pluginId: string };

  const [plugin, setPlugin] = useState<PluginDetail | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isInstalling, setIsInstalling] = useState(false);
  const [activeTab, setActiveTab] = useState<'about' | 'reviews' | 'changelog'>('about');
  const [error, setError] = useState<string | null>(null);

  const fetchPlugin = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const [pluginData, reviewsData] = await Promise.all([
        pluginService.getPlugin(pluginId),
        pluginService.getPluginReviews(pluginId),
      ]);
      setPlugin(pluginData);
      setReviews(reviewsData.data || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load plugin');
    } finally {
      setIsLoading(false);
    }
  }, [pluginId]);

  useEffect(() => {
    fetchPlugin();
  }, [fetchPlugin]);

  const handleInstall = async () => {
    if (!plugin) return;

    try {
      setIsInstalling(true);
      await pluginService.installPlugin(pluginId);
      setPlugin({ ...plugin, isInstalled: true, isEnabled: true });
      Alert.alert('Success', `${plugin.name} has been installed successfully!`);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to install plugin');
    } finally {
      setIsInstalling(false);
    }
  };

  const handleUninstall = async () => {
    if (!plugin) return;

    Alert.alert(
      'Uninstall Plugin',
      `Are you sure you want to uninstall ${plugin.name}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Uninstall',
          style: 'destructive',
          onPress: async () => {
            try {
              await pluginService.uninstallPlugin(pluginId);
              setPlugin({ ...plugin, isInstalled: false, isEnabled: false });
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to uninstall plugin');
            }
          },
        },
      ]
    );
  };

  const handleToggle = async () => {
    if (!plugin) return;

    try {
      await pluginService.togglePlugin(pluginId, !plugin.isEnabled);
      setPlugin({ ...plugin, isEnabled: !plugin.isEnabled });
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to toggle plugin');
    }
  };

  const renderStars = (rating: number, size = 16) => {
    const stars = [];
    for (let i = 1; i <= 5; i++) {
      stars.push(
        <Ionicons
          key={i}
          name={i <= rating ? 'star' : i - 0.5 <= rating ? 'star-half' : 'star-outline'}
          size={size}
          color="#F59E0B"
        />
      );
    }
    return stars;
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  const renderAboutTab = () => (
    <View style={styles.tabContent}>
      <Card style={styles.descriptionCard}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>About</Text>
        <Text style={[styles.longDescription, { color: theme.colors.textSecondary }]}>
          {plugin?.longDescription}
        </Text>
      </Card>

      {plugin?.permissions && plugin.permissions.length > 0 && (
        <Card style={styles.permissionsCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Permissions</Text>
          {plugin.permissions.map((permission, index) => (
            <View key={index} style={styles.permissionItem}>
              <Ionicons name="checkmark-circle" size={18} color={theme.colors.primary} />
              <Text style={[styles.permissionText, { color: theme.colors.text }]}>
                {permission}
              </Text>
            </View>
          ))}
        </Card>
      )}

      <Card style={styles.infoCard}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Information</Text>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Version</Text>
          <Text style={[styles.infoValue, { color: theme.colors.text }]}>{plugin?.version}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Category</Text>
          <Text style={[styles.infoValue, { color: theme.colors.text }]}>{plugin?.category}</Text>
        </View>
        <View style={styles.infoRow}>
          <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Author</Text>
          <TouchableOpacity
            onPress={() => plugin?.authorUrl && Linking.openURL(plugin.authorUrl)}
            disabled={!plugin?.authorUrl}
          >
            <Text
              style={[
                styles.infoValue,
                { color: plugin?.authorUrl ? theme.colors.primary : theme.colors.text },
              ]}
            >
              {plugin?.author}
            </Text>
          </TouchableOpacity>
        </View>
        {plugin?.website && (
          <View style={styles.infoRow}>
            <Text style={[styles.infoLabel, { color: theme.colors.textSecondary }]}>Website</Text>
            <TouchableOpacity onPress={() => Linking.openURL(plugin.website!)}>
              <Text style={[styles.infoValue, { color: theme.colors.primary }]}>
                Visit Website
              </Text>
            </TouchableOpacity>
          </View>
        )}
      </Card>
    </View>
  );

  const renderReviewsTab = () => (
    <View style={styles.tabContent}>
      <Card style={styles.ratingSummary}>
        <View style={styles.ratingMain}>
          <Text style={[styles.ratingBig, { color: theme.colors.text }]}>
            {plugin?.rating.toFixed(1)}
          </Text>
          <View style={styles.ratingStars}>{renderStars(plugin?.rating || 0, 20)}</View>
          <Text style={[styles.reviewCount, { color: theme.colors.textSecondary }]}>
            {plugin?.reviewCount} reviews
          </Text>
        </View>
      </Card>

      {reviews.length === 0 ? (
        <View style={styles.noReviews}>
          <Ionicons name="chatbubble-outline" size={48} color={theme.colors.textSecondary} />
          <Text style={[styles.noReviewsText, { color: theme.colors.textSecondary }]}>
            No reviews yet
          </Text>
        </View>
      ) : (
        reviews.map(review => (
          <Card key={review.id} style={styles.reviewCard}>
            <View style={styles.reviewHeader}>
              <Text style={[styles.reviewAuthor, { color: theme.colors.text }]}>
                {review.author}
              </Text>
              <View style={styles.reviewStars}>{renderStars(review.rating, 12)}</View>
            </View>
            <Text style={[styles.reviewDate, { color: theme.colors.textSecondary }]}>
              {formatDate(review.date)}
            </Text>
            <Text style={[styles.reviewComment, { color: theme.colors.text }]}>
              {review.comment}
            </Text>
          </Card>
        ))
      )}
    </View>
  );

  const renderChangelogTab = () => (
    <View style={styles.tabContent}>
      {plugin?.changelog?.map((entry, index) => (
        <Card key={index} style={styles.changelogCard}>
          <View style={styles.changelogHeader}>
            <Badge text={`v${entry.version}`} variant="primary" />
            <Text style={[styles.changelogDate, { color: theme.colors.textSecondary }]}>
              {formatDate(entry.date)}
            </Text>
          </View>
          {entry.changes.map((change, i) => (
            <View key={i} style={styles.changeItem}>
              <Text style={[styles.changeBullet, { color: theme.colors.primary }]}>•</Text>
              <Text style={[styles.changeText, { color: theme.colors.text }]}>{change}</Text>
            </View>
          ))}
        </Card>
      ))}
    </View>
  );

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !plugin) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => navigation.goBack()}>
            <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
          </TouchableOpacity>
        </View>
        <View style={styles.centered}>
          <Ionicons name="alert-circle" size={48} color={theme.colors.error} />
          <Text style={[styles.errorText, { color: theme.colors.text }]}>
            {error || 'Plugin not found'}
          </Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Plugin Details</Text>
        <TouchableOpacity>
          <Ionicons name="share-outline" size={24} color={theme.colors.text} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Plugin Header */}
        <View style={styles.pluginHeader}>
          {plugin.icon ? (
            <Image source={{ uri: plugin.icon }} style={styles.pluginIcon} />
          ) : (
            <View style={[styles.pluginIconPlaceholder, { backgroundColor: theme.colors.primary }]}>
              <Ionicons name="extension-puzzle" size={40} color="#fff" />
            </View>
          )}
          <Text style={[styles.pluginName, { color: theme.colors.text }]}>{plugin.name}</Text>
          <Text style={[styles.pluginAuthor, { color: theme.colors.textSecondary }]}>
            by {plugin.author}
          </Text>
          <View style={styles.ratingRow}>
            {renderStars(plugin.rating)}
            <Text style={[styles.ratingText, { color: theme.colors.textSecondary }]}>
              {plugin.rating.toFixed(1)} ({plugin.reviewCount} reviews)
            </Text>
          </View>
          <View style={styles.tagsRow}>
            {plugin.tags?.slice(0, 3).map((tag, index) => (
              <View
                key={index}
                style={[styles.tag, { backgroundColor: theme.colors.primary + '15' }]}
              >
                <Text style={[styles.tagText, { color: theme.colors.primary }]}>{tag}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionButtons}>
          {plugin.isInstalled ? (
            <>
              <TouchableOpacity
                style={[
                  styles.actionButton,
                  { backgroundColor: plugin.isEnabled ? theme.colors.error : theme.colors.primary },
                ]}
                onPress={handleToggle}
              >
                <Ionicons
                  name={plugin.isEnabled ? 'pause' : 'play'}
                  size={20}
                  color="#fff"
                />
                <Text style={styles.actionButtonText}>
                  {plugin.isEnabled ? 'Disable' : 'Enable'}
                </Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButtonOutline, { borderColor: theme.colors.error }]}
                onPress={handleUninstall}
              >
                <Ionicons name="trash-outline" size={20} color={theme.colors.error} />
                <Text style={[styles.actionButtonOutlineText, { color: theme.colors.error }]}>
                  Uninstall
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <TouchableOpacity
              style={[styles.installButton, { backgroundColor: theme.colors.primary }]}
              onPress={handleInstall}
              disabled={isInstalling}
            >
              {isInstalling ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <>
                  <Ionicons name="download" size={20} color="#fff" />
                  <Text style={styles.installButtonText}>
                    {plugin.price === 0 ? 'Install Free' : `Install - $${plugin.price.toFixed(2)}`}
                  </Text>
                </>
              )}
            </TouchableOpacity>
          )}
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderBottomColor: theme.colors.border }]}>
          {(['about', 'reviews', 'changelog'] as const).map(tab => (
            <TouchableOpacity
              key={tab}
              style={[
                styles.tab,
                activeTab === tab && { borderBottomColor: theme.colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => setActiveTab(tab)}
            >
              <Text
                style={[
                  styles.tabText,
                  { color: activeTab === tab ? theme.colors.primary : theme.colors.textSecondary },
                ]}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {activeTab === 'about' && renderAboutTab()}
        {activeTab === 'reviews' && renderReviewsTab()}
        {activeTab === 'changelog' && renderChangelogTab()}
      </ScrollView>
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
    padding: 20,
  },
  errorText: {
    fontSize: 16,
    marginVertical: 12,
    textAlign: 'center',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  pluginHeader: {
    alignItems: 'center',
    padding: 20,
  },
  pluginIcon: {
    width: 80,
    height: 80,
    borderRadius: 16,
    marginBottom: 12,
  },
  pluginIconPlaceholder: {
    width: 80,
    height: 80,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 12,
  },
  pluginName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  pluginAuthor: {
    fontSize: 14,
    marginBottom: 8,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 12,
  },
  ratingText: {
    fontSize: 13,
  },
  tagsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  tag: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  tagText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionButtons: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    gap: 12,
    marginBottom: 20,
  },
  installButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  installButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    gap: 8,
  },
  actionButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  actionButtonOutline: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  actionButtonOutlineText: {
    fontSize: 16,
    fontWeight: '600',
  },
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    marginHorizontal: 16,
  },
  tab: {
    flex: 1,
    paddingVertical: 12,
    alignItems: 'center',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
  },
  tabContent: {
    padding: 16,
  },
  descriptionCard: {
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 8,
  },
  longDescription: {
    fontSize: 14,
    lineHeight: 22,
  },
  permissionsCard: {
    padding: 16,
    marginBottom: 12,
  },
  permissionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 8,
  },
  permissionText: {
    fontSize: 14,
  },
  infoCard: {
    padding: 16,
    marginBottom: 12,
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 8,
  },
  infoLabel: {
    fontSize: 14,
  },
  infoValue: {
    fontSize: 14,
    fontWeight: '500',
  },
  ratingSummary: {
    padding: 20,
    marginBottom: 12,
    alignItems: 'center',
  },
  ratingMain: {
    alignItems: 'center',
  },
  ratingBig: {
    fontSize: 48,
    fontWeight: 'bold',
  },
  ratingStars: {
    flexDirection: 'row',
    marginTop: 8,
  },
  reviewCount: {
    marginTop: 4,
    fontSize: 14,
  },
  noReviews: {
    alignItems: 'center',
    padding: 40,
  },
  noReviewsText: {
    marginTop: 12,
    fontSize: 16,
  },
  reviewCard: {
    padding: 16,
    marginBottom: 12,
  },
  reviewHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  reviewAuthor: {
    fontSize: 14,
    fontWeight: '600',
  },
  reviewStars: {
    flexDirection: 'row',
  },
  reviewDate: {
    fontSize: 12,
    marginTop: 4,
  },
  reviewComment: {
    fontSize: 14,
    lineHeight: 20,
    marginTop: 8,
  },
  changelogCard: {
    padding: 16,
    marginBottom: 12,
  },
  changelogHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginBottom: 12,
  },
  changelogDate: {
    fontSize: 12,
  },
  changeItem: {
    flexDirection: 'row',
    marginTop: 6,
  },
  changeBullet: {
    fontSize: 14,
    marginRight: 8,
  },
  changeText: {
    flex: 1,
    fontSize: 14,
    lineHeight: 20,
  },
});

export default PluginDetailScreen;
