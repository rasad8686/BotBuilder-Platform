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
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { Card, Badge, Avatar, Button } from '../../components/ui';
import { cloneService } from '../../services/cloneService';

interface CloneDetail {
  id: string;
  name: string;
  description: string;
  type: 'personality' | 'voice' | 'style';
  status: 'training' | 'ready' | 'failed' | 'draft';
  trainingProgress?: number;
  avatar?: string;
  createdAt: string;
  updatedAt: string;
  config: {
    personality?: {
      traits: string[];
      tone: string;
      formality: number;
    };
    voice?: {
      provider: string;
      voiceId: string;
      speed: number;
      pitch: number;
    };
    style?: {
      writingStyle: string;
      vocabulary: string;
      emoticons: boolean;
    };
  };
  stats: {
    conversations: number;
    messages: number;
    avgRating: number;
    responseTime: number;
  };
  trainingData?: {
    samples: number;
    lastUpdated: string;
  };
}

export const CloneDetailScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute();
  const { cloneId } = route.params as { cloneId: string };

  const [clone, setClone] = useState<CloneDetail | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'overview' | 'config' | 'test'>('overview');
  const [testMessage, setTestMessage] = useState('');
  const [testResponse, setTestResponse] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchClone = useCallback(async () => {
    try {
      setIsLoading(true);
      setError(null);
      const data = await cloneService.getClone(cloneId);
      setClone(data);
    } catch (err: any) {
      setError(err.message || 'Failed to load clone');
    } finally {
      setIsLoading(false);
    }
  }, [cloneId]);

  useEffect(() => {
    fetchClone();
  }, [fetchClone]);

  const handleTest = async () => {
    if (!testMessage.trim()) return;

    try {
      setIsTesting(true);
      setTestResponse(null);
      const response = await cloneService.testClone(cloneId, testMessage);
      setTestResponse(response.message);
    } catch (err: any) {
      Alert.alert('Error', err.message || 'Failed to test clone');
    } finally {
      setIsTesting(false);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Clone',
      'Are you sure you want to delete this clone? This action cannot be undone.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            try {
              await cloneService.deleteClone(cloneId);
              navigation.goBack();
            } catch (err: any) {
              Alert.alert('Error', err.message || 'Failed to delete clone');
            }
          },
        },
      ]
    );
  };

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

  if (isLoading) {
    return (
      <View style={[styles.centered, { backgroundColor: theme.colors.background }]}>
        <ActivityIndicator size="large" color={theme.colors.primary} />
      </View>
    );
  }

  if (error || !clone) {
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
            {error || 'Clone not found'}
          </Text>
          <Button title="Go Back" onPress={() => navigation.goBack()} />
        </View>
      </SafeAreaView>
    );
  }

  const renderOverviewTab = () => (
    <View style={styles.tabContent}>
      {/* Stats */}
      <Card style={styles.statsCard}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Statistics</Text>
        <View style={styles.statsGrid}>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {clone.stats.conversations}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Conversations
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {clone.stats.messages}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Messages
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {clone.stats.avgRating.toFixed(1)}
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Rating
            </Text>
          </View>
          <View style={styles.statItem}>
            <Text style={[styles.statNumber, { color: theme.colors.primary }]}>
              {clone.stats.responseTime}ms
            </Text>
            <Text style={[styles.statLabel, { color: theme.colors.textSecondary }]}>
              Avg Response
            </Text>
          </View>
        </View>
      </Card>

      {/* Training Data */}
      {clone.trainingData && (
        <Card style={styles.trainingCard}>
          <View style={styles.trainingHeader}>
            <Ionicons name="document-text" size={24} color={theme.colors.primary} />
            <View style={styles.trainingInfo}>
              <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
                Training Data
              </Text>
              <Text style={[styles.trainingSubtext, { color: theme.colors.textSecondary }]}>
                {clone.trainingData.samples} samples
              </Text>
            </View>
            <TouchableOpacity
              style={[styles.updateButton, { backgroundColor: theme.colors.primary + '20' }]}
            >
              <Ionicons name="refresh" size={18} color={theme.colors.primary} />
              <Text style={[styles.updateButtonText, { color: theme.colors.primary }]}>
                Update
              </Text>
            </TouchableOpacity>
          </View>
        </Card>
      )}

      {/* Quick Actions */}
      <Card style={styles.actionsCard}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Actions</Text>
        <View style={styles.actionsGrid}>
          <TouchableOpacity
            style={[styles.actionItem, { backgroundColor: theme.colors.card }]}
            onPress={() => setActiveTab('test')}
          >
            <Ionicons name="chatbubble" size={24} color={theme.colors.primary} />
            <Text style={[styles.actionText, { color: theme.colors.text }]}>Test Chat</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionItem, { backgroundColor: theme.colors.card }]}
            onPress={() => navigation.navigate('CloneSettings' as never, { cloneId } as never)}
          >
            <Ionicons name="settings" size={24} color={theme.colors.primary} />
            <Text style={[styles.actionText, { color: theme.colors.text }]}>Settings</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionItem, { backgroundColor: theme.colors.card }]}
          >
            <Ionicons name="share" size={24} color={theme.colors.primary} />
            <Text style={[styles.actionText, { color: theme.colors.text }]}>Share</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.actionItem, { backgroundColor: theme.colors.card }]}
          >
            <Ionicons name="download" size={24} color={theme.colors.primary} />
            <Text style={[styles.actionText, { color: theme.colors.text }]}>Export</Text>
          </TouchableOpacity>
        </View>
      </Card>
    </View>
  );

  const renderConfigTab = () => (
    <View style={styles.tabContent}>
      {clone.type === 'personality' && clone.config.personality && (
        <Card style={styles.configCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>
            Personality Settings
          </Text>
          <View style={styles.configItem}>
            <Text style={[styles.configLabel, { color: theme.colors.textSecondary }]}>Tone</Text>
            <Text style={[styles.configValue, { color: theme.colors.text }]}>
              {clone.config.personality.tone}
            </Text>
          </View>
          <View style={styles.configItem}>
            <Text style={[styles.configLabel, { color: theme.colors.textSecondary }]}>
              Formality
            </Text>
            <View style={styles.formalityBar}>
              <View
                style={[
                  styles.formalityFill,
                  {
                    width: `${clone.config.personality.formality * 100}%`,
                    backgroundColor: theme.colors.primary,
                  },
                ]}
              />
            </View>
          </View>
          <View style={styles.configItem}>
            <Text style={[styles.configLabel, { color: theme.colors.textSecondary }]}>Traits</Text>
            <View style={styles.traitsContainer}>
              {clone.config.personality.traits.map((trait, index) => (
                <View
                  key={index}
                  style={[styles.traitChip, { backgroundColor: theme.colors.primary + '20' }]}
                >
                  <Text style={[styles.traitText, { color: theme.colors.primary }]}>{trait}</Text>
                </View>
              ))}
            </View>
          </View>
        </Card>
      )}

      {clone.type === 'voice' && clone.config.voice && (
        <Card style={styles.configCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Voice Settings</Text>
          <View style={styles.configItem}>
            <Text style={[styles.configLabel, { color: theme.colors.textSecondary }]}>Provider</Text>
            <Text style={[styles.configValue, { color: theme.colors.text }]}>
              {clone.config.voice.provider}
            </Text>
          </View>
          <View style={styles.configItem}>
            <Text style={[styles.configLabel, { color: theme.colors.textSecondary }]}>Speed</Text>
            <Text style={[styles.configValue, { color: theme.colors.text }]}>
              {clone.config.voice.speed}x
            </Text>
          </View>
          <View style={styles.configItem}>
            <Text style={[styles.configLabel, { color: theme.colors.textSecondary }]}>Pitch</Text>
            <Text style={[styles.configValue, { color: theme.colors.text }]}>
              {clone.config.voice.pitch}
            </Text>
          </View>
        </Card>
      )}

      {clone.type === 'style' && clone.config.style && (
        <Card style={styles.configCard}>
          <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Style Settings</Text>
          <View style={styles.configItem}>
            <Text style={[styles.configLabel, { color: theme.colors.textSecondary }]}>
              Writing Style
            </Text>
            <Text style={[styles.configValue, { color: theme.colors.text }]}>
              {clone.config.style.writingStyle}
            </Text>
          </View>
          <View style={styles.configItem}>
            <Text style={[styles.configLabel, { color: theme.colors.textSecondary }]}>
              Vocabulary
            </Text>
            <Text style={[styles.configValue, { color: theme.colors.text }]}>
              {clone.config.style.vocabulary}
            </Text>
          </View>
          <View style={styles.configItem}>
            <Text style={[styles.configLabel, { color: theme.colors.textSecondary }]}>
              Use Emoticons
            </Text>
            <Text style={[styles.configValue, { color: theme.colors.text }]}>
              {clone.config.style.emoticons ? 'Yes' : 'No'}
            </Text>
          </View>
        </Card>
      )}
    </View>
  );

  const renderTestTab = () => (
    <View style={styles.tabContent}>
      <Card style={styles.testCard}>
        <Text style={[styles.sectionTitle, { color: theme.colors.text }]}>Test Your Clone</Text>
        <Text style={[styles.testDescription, { color: theme.colors.textSecondary }]}>
          Send a message to see how your clone responds
        </Text>

        <View style={[styles.inputContainer, { borderColor: theme.colors.border }]}>
          <TextInput
            style={[styles.testInput, { color: theme.colors.text }]}
            placeholder="Type a message..."
            placeholderTextColor={theme.colors.textSecondary}
            value={testMessage}
            onChangeText={setTestMessage}
            multiline
          />
          <TouchableOpacity
            style={[
              styles.sendButton,
              { backgroundColor: testMessage.trim() ? theme.colors.primary : theme.colors.border },
            ]}
            onPress={handleTest}
            disabled={!testMessage.trim() || isTesting}
          >
            {isTesting ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <Ionicons name="send" size={18} color="#fff" />
            )}
          </TouchableOpacity>
        </View>

        {testResponse && (
          <View style={[styles.responseContainer, { backgroundColor: theme.colors.card }]}>
            <View style={styles.responseHeader}>
              <Avatar name={clone.name} size={32} />
              <Text style={[styles.responseName, { color: theme.colors.text }]}>{clone.name}</Text>
            </View>
            <Text style={[styles.responseText, { color: theme.colors.text }]}>{testResponse}</Text>
          </View>
        )}
      </Card>
    </View>
  );

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Clone Details</Text>
        <TouchableOpacity onPress={handleDelete}>
          <Ionicons name="trash-outline" size={24} color={theme.colors.error} />
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Clone Info */}
        <View style={styles.cloneInfo}>
          <View style={styles.avatarLarge}>
            {clone.avatar ? (
              <Image source={{ uri: clone.avatar }} style={styles.avatarImage} />
            ) : (
              <Avatar
                name={clone.name}
                size={80}
                style={{ backgroundColor: getTypeColor(clone.type) }}
              />
            )}
            <View
              style={[
                styles.typeIndicatorLarge,
                { backgroundColor: getTypeColor(clone.type) },
              ]}
            >
              <Ionicons name={getTypeIcon(clone.type) as any} size={16} color="#fff" />
            </View>
          </View>
          <Text style={[styles.cloneName, { color: theme.colors.text }]}>{clone.name}</Text>
          <Text style={[styles.cloneDescription, { color: theme.colors.textSecondary }]}>
            {clone.description}
          </Text>
          <Badge
            text={clone.status.charAt(0).toUpperCase() + clone.status.slice(1)}
            variant={clone.status === 'ready' ? 'success' : clone.status === 'training' ? 'warning' : 'default'}
          />
        </View>

        {/* Tabs */}
        <View style={[styles.tabs, { borderBottomColor: theme.colors.border }]}>
          {(['overview', 'config', 'test'] as const).map(tab => (
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

        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'config' && renderConfigTab()}
        {activeTab === 'test' && renderTestTab()}
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
  cloneInfo: {
    alignItems: 'center',
    padding: 20,
  },
  avatarLarge: {
    position: 'relative',
    marginBottom: 12,
  },
  avatarImage: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  typeIndicatorLarge: {
    position: 'absolute',
    bottom: -4,
    right: -4,
    width: 28,
    height: 28,
    borderRadius: 14,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#fff',
  },
  cloneName: {
    fontSize: 24,
    fontWeight: 'bold',
    marginBottom: 4,
  },
  cloneDescription: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 12,
    paddingHorizontal: 20,
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
  statsCard: {
    padding: 16,
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
  },
  statItem: {
    width: '50%',
    padding: 8,
    alignItems: 'center',
  },
  statNumber: {
    fontSize: 24,
    fontWeight: 'bold',
  },
  statLabel: {
    fontSize: 12,
    marginTop: 4,
  },
  trainingCard: {
    padding: 16,
    marginBottom: 12,
  },
  trainingHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  trainingInfo: {
    flex: 1,
    marginLeft: 12,
  },
  trainingSubtext: {
    fontSize: 12,
  },
  updateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    gap: 4,
  },
  updateButtonText: {
    fontSize: 12,
    fontWeight: '500',
  },
  actionsCard: {
    padding: 16,
    marginBottom: 12,
  },
  actionsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  actionItem: {
    width: '47%',
    padding: 16,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionText: {
    fontSize: 13,
    marginTop: 8,
    fontWeight: '500',
  },
  configCard: {
    padding: 16,
    marginBottom: 12,
  },
  configItem: {
    marginBottom: 16,
  },
  configLabel: {
    fontSize: 12,
    marginBottom: 4,
  },
  configValue: {
    fontSize: 16,
  },
  formalityBar: {
    height: 8,
    backgroundColor: '#E5E7EB',
    borderRadius: 4,
    overflow: 'hidden',
  },
  formalityFill: {
    height: '100%',
    borderRadius: 4,
  },
  traitsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  traitChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
  },
  traitText: {
    fontSize: 12,
    fontWeight: '500',
  },
  testCard: {
    padding: 16,
  },
  testDescription: {
    fontSize: 14,
    marginBottom: 16,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    borderWidth: 1,
    borderRadius: 12,
    padding: 8,
  },
  testInput: {
    flex: 1,
    fontSize: 16,
    maxHeight: 100,
    paddingHorizontal: 8,
  },
  sendButton: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  responseContainer: {
    marginTop: 16,
    padding: 12,
    borderRadius: 12,
  },
  responseHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  responseName: {
    fontSize: 14,
    fontWeight: '600',
    marginLeft: 8,
  },
  responseText: {
    fontSize: 14,
    lineHeight: 20,
  },
});

export default CloneDetailScreen;
