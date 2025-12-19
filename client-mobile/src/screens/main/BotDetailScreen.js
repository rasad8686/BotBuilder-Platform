/**
 * Bot Detail Screen
 * View and edit bot details
 */
import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  Switch,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useBots } from '../../contexts/BotContext';
import { StatCard } from '../../components/main';
import { AuthButton } from '../../components/auth';

const BotDetailScreen = ({ navigation, route }) => {
  const { botId, bot: initialBot } = route.params || {};
  const { fetchBot, updateBot, deleteBot, selectedBot } = useBots();

  const [bot, setBot] = useState(initialBot || null);
  const [loading, setLoading] = useState(!initialBot);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);

  // Edit form state
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    isActive: true,
  });

  useEffect(() => {
    if (!initialBot && botId) {
      loadBot();
    } else if (initialBot) {
      setFormData({
        name: initialBot.name,
        description: initialBot.description || '',
        isActive: initialBot.status === 'active',
      });
    }
  }, [botId, initialBot]);

  const loadBot = async () => {
    setLoading(true);
    const result = await fetchBot(botId);
    setLoading(false);

    if (result.success) {
      setBot(result.bot);
      setFormData({
        name: result.bot.name,
        description: result.bot.description || '',
        isActive: result.bot.status === 'active',
      });
    } else {
      Alert.alert('Error', result.error);
      navigation.goBack();
    }
  };

  const handleSave = async () => {
    if (!formData.name.trim()) {
      Alert.alert('Error', 'Bot name is required');
      return;
    }

    setSaving(true);
    const result = await updateBot(bot.id, {
      name: formData.name.trim(),
      description: formData.description.trim(),
      status: formData.isActive ? 'active' : 'inactive',
    });
    setSaving(false);

    if (result.success) {
      setBot(result.bot);
      setEditing(false);
      Alert.alert('Success', 'Bot updated successfully!');
    } else {
      Alert.alert('Error', result.error);
    }
  };

  const handleDelete = () => {
    Alert.alert(
      'Delete Bot',
      `Are you sure you want to delete "${bot.name}"? This action cannot be undone.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete',
          style: 'destructive',
          onPress: async () => {
            const result = await deleteBot(bot.id);
            if (result.success) {
              navigation.goBack();
            } else {
              Alert.alert('Error', result.error);
            }
          },
        },
      ]
    );
  };

  const handleChat = () => {
    navigation.navigate('Chat', { bot });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color="#6366f1" />
        </View>
      </SafeAreaView>
    );
  }

  if (!bot) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <Text style={styles.errorText}>Bot not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Bot Details</Text>
        <TouchableOpacity
          onPress={() => setEditing(!editing)}
          style={styles.editButton}
        >
          <Text style={styles.editIcon}>{editing ? '✕' : '✏️'}</Text>
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        {/* Bot Icon & Name */}
        <View style={styles.botHeader}>
          <View style={styles.botIcon}>
            <Text style={styles.botEmoji}>🤖</Text>
          </View>
          {editing ? (
            <TextInput
              style={styles.nameInput}
              value={formData.name}
              onChangeText={(v) => setFormData(prev => ({ ...prev, name: v }))}
              placeholder="Bot name"
              placeholderTextColor="#94a3b8"
            />
          ) : (
            <Text style={styles.botName}>{bot.name}</Text>
          )}
          <View style={styles.statusBadge}>
            <View style={[
              styles.statusDot,
              { backgroundColor: bot.status === 'active' ? '#22c55e' : '#94a3b8' }
            ]} />
            <Text style={styles.statusText}>
              {bot.status === 'active' ? 'Active' : 'Inactive'}
            </Text>
          </View>
        </View>

        {/* Description */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Description</Text>
          {editing ? (
            <TextInput
              style={styles.descriptionInput}
              value={formData.description}
              onChangeText={(v) => setFormData(prev => ({ ...prev, description: v }))}
              placeholder="What does this bot do?"
              placeholderTextColor="#94a3b8"
              multiline
              numberOfLines={3}
            />
          ) : (
            <Text style={styles.description}>
              {bot.description || 'No description'}
            </Text>
          )}
        </View>

        {/* Stats */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Statistics</Text>
          <View style={styles.statsGrid}>
            <StatCard
              icon="💬"
              label="Messages"
              value={bot.messageCount || 0}
              size="small"
            />
            <StatCard
              icon="👥"
              label="Users"
              value={bot.userCount || 0}
              size="small"
            />
          </View>
          <View style={styles.statsGrid}>
            <StatCard
              icon="📊"
              label="Accuracy"
              value={`${bot.accuracy || 0}%`}
              size="small"
            />
            <StatCard
              icon="⏱️"
              label="Avg Response"
              value={`${bot.avgResponseTime || 0}s`}
              size="small"
            />
          </View>
        </View>

        {/* Settings */}
        {editing && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>
            <View style={styles.settingRow}>
              <View>
                <Text style={styles.settingLabel}>Active Status</Text>
                <Text style={styles.settingDescription}>
                  Enable or disable this bot
                </Text>
              </View>
              <Switch
                value={formData.isActive}
                onValueChange={(v) => setFormData(prev => ({ ...prev, isActive: v }))}
                trackColor={{ false: '#e2e8f0', true: '#a5b4fc' }}
                thumbColor={formData.isActive ? '#6366f1' : '#ffffff'}
              />
            </View>
          </View>
        )}

        {/* Actions */}
        <View style={styles.actions}>
          {editing ? (
            <AuthButton
              title="Save Changes"
              onPress={handleSave}
              loading={saving}
            />
          ) : (
            <>
              <AuthButton
                title="Chat with Bot"
                onPress={handleChat}
                icon={<Text>💬</Text>}
              />
              <TouchableOpacity
                style={styles.deleteButton}
                onPress={handleDelete}
              >
                <Text style={styles.deleteButtonText}>Delete Bot</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  errorText: {
    fontSize: 16,
    color: '#64748b',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
    backgroundColor: '#ffffff',
  },
  backButton: {
    padding: 4,
  },
  backIcon: {
    fontSize: 28,
    color: '#1e293b',
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  editButton: {
    padding: 4,
  },
  editIcon: {
    fontSize: 20,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  botHeader: {
    alignItems: 'center',
    marginBottom: 32,
  },
  botIcon: {
    width: 100,
    height: 100,
    borderRadius: 30,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  botEmoji: {
    fontSize: 48,
  },
  botName: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  nameInput: {
    fontSize: 26,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
    borderBottomWidth: 2,
    borderBottomColor: '#6366f1',
    paddingBottom: 4,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#f1f5f9',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    marginRight: 6,
  },
  statusText: {
    fontSize: 13,
    fontWeight: '500',
    color: '#64748b',
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  description: {
    fontSize: 15,
    color: '#64748b',
    lineHeight: 22,
  },
  descriptionInput: {
    backgroundColor: '#ffffff',
    borderWidth: 1,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 15,
    color: '#1e293b',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  statsGrid: {
    flexDirection: 'row',
    gap: 12,
    marginBottom: 12,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  settingDescription: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  actions: {
    marginTop: 16,
    gap: 12,
  },
  deleteButton: {
    height: 48,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: '#ef4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  deleteButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ef4444',
  },
});

export default BotDetailScreen;
