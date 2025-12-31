import React from 'react';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

import { TabNavigator } from './TabNavigator';
import { BotDetailScreen, BotSettingsScreen } from '../screens/bots';
import { ConversationDetailScreen } from '../screens/conversations';
import { ProfileScreen } from '../screens/settings';
import { NotificationsScreen } from '../screens/notifications';
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
      <Stack.Screen name="ConversationDetail" component={ConversationDetailScreen} />
      <Stack.Screen name="Profile" component={ProfileScreen} />
      <Stack.Screen name="Notifications" component={NotificationsScreen} />
    </Stack.Navigator>
  );
}
