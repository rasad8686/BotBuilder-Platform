import React from 'react';
import { View, StyleSheet, Platform } from 'react-native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';

import { DashboardScreen } from '../screens/dashboard';
import { BotsScreen } from '../screens/bots';
import { ConversationsScreen } from '../screens/conversations';
import { AnalyticsScreen } from '../screens/analytics';
import { SettingsScreen } from '../screens/settings';
import { useTheme, useIsDarkMode } from '../hooks';
import { useConversationStore } from '../store';
import { Badge } from '../components/ui';

const Tab = createBottomTabNavigator();

export function TabNavigator() {
  const theme = useTheme();
  const isDarkMode = useIsDarkMode();
  const unreadCount = useConversationStore((state) => state.unreadCount);

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarStyle: {
          position: 'absolute',
          borderTopWidth: 0,
          backgroundColor: Platform.OS === 'ios' ? 'transparent' : theme.background.primary,
          height: Platform.OS === 'ios' ? 85 : 65,
          paddingBottom: Platform.OS === 'ios' ? 30 : 10,
          paddingTop: 10,
          elevation: 0,
        },
        tabBarBackground: () =>
          Platform.OS === 'ios' ? (
            <BlurView
              intensity={80}
              tint={isDarkMode ? 'dark' : 'light'}
              style={StyleSheet.absoluteFill}
            />
          ) : null,
        tabBarActiveTintColor: theme.primary[500],
        tabBarInactiveTintColor: theme.text.tertiary,
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
        tabBarIcon: ({ focused, color, size }) => {
          let iconName: keyof typeof Ionicons.glyphMap;

          switch (route.name) {
            case 'Dashboard':
              iconName = focused ? 'home' : 'home-outline';
              break;
            case 'Bots':
              iconName = focused ? 'cube' : 'cube-outline';
              break;
            case 'Conversations':
              iconName = focused ? 'chatbubbles' : 'chatbubbles-outline';
              break;
            case 'Analytics':
              iconName = focused ? 'stats-chart' : 'stats-chart-outline';
              break;
            case 'Settings':
              iconName = focused ? 'settings' : 'settings-outline';
              break;
            default:
              iconName = 'ellipse';
          }

          return (
            <View>
              <Ionicons name={iconName} size={size} color={color} />
              {route.name === 'Conversations' && unreadCount > 0 && (
                <Badge
                  count={unreadCount}
                  variant="error"
                  size="sm"
                  style={styles.badge}
                />
              )}
            </View>
          );
        },
      })}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{ tabBarLabel: 'Home' }}
      />
      <Tab.Screen name="Bots" component={BotsScreen} />
      <Tab.Screen
        name="Conversations"
        component={ConversationsScreen}
        options={{ tabBarLabel: 'Chats' }}
      />
      <Tab.Screen name="Analytics" component={AnalyticsScreen} />
      <Tab.Screen name="Settings" component={SettingsScreen} />
    </Tab.Navigator>
  );
}

const styles = StyleSheet.create({
  badge: {
    position: 'absolute',
    top: -4,
    right: -8,
  },
});
