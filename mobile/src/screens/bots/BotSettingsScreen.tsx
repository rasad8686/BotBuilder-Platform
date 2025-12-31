import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Switch,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation, useRoute, RouteProp } from '@react-navigation/native';
import Slider from '@react-native-community/slider';

import { useBotStore } from '../../store';
import { useTheme } from '../../hooks';
import { Card, Input, Button } from '../../components/ui';
import type { RootStackParamList, BotConfig } from '../../types';

type RouteProps = RouteProp<RootStackParamList, 'BotSettings'>;

export function BotSettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const route = useRoute<RouteProps>();
  const { botId } = route.params;

  const { selectedBot, fetchBot, updateBot, updateBotConfig, isLoading } = useBotStore();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [config, setConfig] = useState<Partial<BotConfig>>({});
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    fetchBot(botId);
  }, [botId, fetchBot]);

  useEffect(() => {
    if (selectedBot) {
      setName(selectedBot.name);
      setDescription(selectedBot.description || '');
      setConfig(selectedBot.config);
    }
  }, [selectedBot]);

  const handleSave = async () => {
    const success = await updateBot(botId, { name, description });
    if (config) {
      await updateBotConfig(botId, config);
    }
    if (success) {
      Alert.alert('Success', 'Settings saved successfully');
      setHasChanges(false);
    }
  };

  const handleConfigChange = (key: keyof BotConfig, value: unknown) => {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setHasChanges(true);
  };

  if (!selectedBot) {
    return null;
  }

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text.primary }]}>Bot Settings</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* General Settings */}
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>General</Text>
        <Card variant="outlined" style={styles.section}>
          <Input
            label="Bot Name"
            value={name}
            onChangeText={(text) => {
              setName(text);
              setHasChanges(true);
            }}
            placeholder="Enter bot name"
          />
          <Input
            label="Description"
            value={description}
            onChangeText={(text) => {
              setDescription(text);
              setHasChanges(true);
            }}
            placeholder="Enter bot description"
            multiline
            numberOfLines={3}
          />
        </Card>

        {/* AI Settings */}
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>AI Configuration</Text>
        <Card variant="outlined" style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={[styles.settingLabel, { color: theme.text.primary }]}>
                AI Enabled
              </Text>
              <Text style={[styles.settingDescription, { color: theme.text.secondary }]}>
                Enable AI-powered responses
              </Text>
            </View>
            <Switch
              value={config.aiEnabled ?? false}
              onValueChange={(value) => handleConfigChange('aiEnabled', value)}
              trackColor={{ false: theme.neutral[300], true: theme.primary[500] }}
              thumbColor={theme.white}
            />
          </View>

          {config.aiEnabled && (
            <>
              <View style={styles.divider} />

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.text.primary }]}>
                    Temperature: {(config.temperature ?? 0.7).toFixed(1)}
                  </Text>
                  <Text style={[styles.settingDescription, { color: theme.text.secondary }]}>
                    Higher values make output more random
                  </Text>
                </View>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={0}
                maximumValue={2}
                step={0.1}
                value={config.temperature ?? 0.7}
                onValueChange={(value) => handleConfigChange('temperature', value)}
                minimumTrackTintColor={theme.primary[500]}
                maximumTrackTintColor={theme.neutral[300]}
                thumbTintColor={theme.primary[500]}
              />

              <View style={styles.divider} />

              <View style={styles.settingRow}>
                <View style={styles.settingInfo}>
                  <Text style={[styles.settingLabel, { color: theme.text.primary }]}>
                    Max Tokens: {config.maxTokens ?? 500}
                  </Text>
                  <Text style={[styles.settingDescription, { color: theme.text.secondary }]}>
                    Maximum length of AI responses
                  </Text>
                </View>
              </View>
              <Slider
                style={styles.slider}
                minimumValue={100}
                maximumValue={2000}
                step={100}
                value={config.maxTokens ?? 500}
                onValueChange={(value) => handleConfigChange('maxTokens', value)}
                minimumTrackTintColor={theme.primary[500]}
                maximumTrackTintColor={theme.neutral[300]}
                thumbTintColor={theme.primary[500]}
              />
            </>
          )}
        </Card>

        {/* Messages */}
        <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>Messages</Text>
        <Card variant="outlined" style={styles.section}>
          <Input
            label="Welcome Message"
            value={config.welcomeMessage ?? ''}
            onChangeText={(text) => handleConfigChange('welcomeMessage', text)}
            placeholder="Enter welcome message"
            multiline
            numberOfLines={2}
          />
          <Input
            label="Fallback Message"
            value={config.fallbackMessage ?? ''}
            onChangeText={(text) => handleConfigChange('fallbackMessage', text)}
            placeholder="Message when bot doesn't understand"
            multiline
            numberOfLines={2}
          />
        </Card>

        {/* System Prompt */}
        {config.aiEnabled && (
          <>
            <Text style={[styles.sectionTitle, { color: theme.text.primary }]}>System Prompt</Text>
            <Card variant="outlined" style={styles.section}>
              <Input
                value={config.systemPrompt ?? ''}
                onChangeText={(text) => handleConfigChange('systemPrompt', text)}
                placeholder="Enter system prompt for the AI"
                multiline
                numberOfLines={6}
              />
            </Card>
          </>
        )}

        {/* Save Button */}
        {hasChanges && (
          <Button
            title="Save Changes"
            onPress={handleSave}
            loading={isLoading}
            fullWidth
            style={styles.saveButton}
          />
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
    fontSize: 18,
    fontWeight: '600',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginTop: 20,
    marginBottom: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  section: {
    marginBottom: 8,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 8,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: 16,
    fontWeight: '500',
  },
  settingDescription: {
    fontSize: 12,
    marginTop: 2,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.05)',
    marginVertical: 12,
  },
  slider: {
    width: '100%',
    height: 40,
  },
  saveButton: {
    marginTop: 24,
  },
  bottomPadding: {
    height: 100,
  },
});
