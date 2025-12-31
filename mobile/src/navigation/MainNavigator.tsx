import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TabNavigator } from './TabNavigator';
import { BotDetailScreen, BotSettingsScreen, CreateBotScreen } from '../screens/bots';
import { ConversationDetailScreen } from '../screens/conversations';
import { ProfileScreen, ChangePasswordScreen, HelpCenterScreen } from '../screens/settings';
import { NotificationsScreen } from '../screens/notifications';
import { VoiceBotsScreen, VoiceCallScreen } from '../screens/voice';
import { CloneListScreen, CloneDetailScreen } from '../screens/clone';
import { PluginsScreen, PluginDetailScreen } from '../screens/plugins';
import type { RootStackParamList } from '../types';

const Stack = createNativeStackNavigator<RootStackParamList>();

export function MainNavigator() {
  return (
    <Stack.Navigator
      screenOptions={{
        headerShown: false,
        animation: 'slide_from_right',
      }}
    >
      <Stack.Screen name="Main" component={TabNavigator} />
      <Stack.Screen name="BotDetail" component={BotDetailScreen} />
      <Stack.Screen name="BotSettings" component={BotSettingsScreen} />
      <Stack.Screen name="CreateBot" component={CreateBotScreen} />
      <Stack.Screen name="ConversationDetail" component={ConversationDetailScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
      {/* Voice screens */}
      <Stack.Screen name="VoiceBots" component={VoiceBotsScreen} />
      <Stack.Screen name="VoiceCall" component={VoiceCallScreen} />
      {/* Clone screens */}
      <Stack.Screen name="Clones" component={CloneListScreen} />
      <Stack.Screen name="CloneDetail" component={CloneDetailScreen} />
      {/* Plugin screens */}
      <Stack.Screen name="Plugins" component={PluginsScreen} />
      <Stack.Screen name="PluginDetail" component={PluginDetailScreen} />
      {/* Settings screens */}
      <Stack.Screen name="ChangePassword" component={ChangePasswordScreen} />
      <Stack.Screen name="HelpCenter" component={HelpCenterScreen} />
    </Stack.Navigator>
  );
}
