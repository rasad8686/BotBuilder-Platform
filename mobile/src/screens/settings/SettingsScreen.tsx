import React from 'react';
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
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuthStore, useSettingsStore } from '../../store';
import { useTheme } from '../../hooks';
import { Card, Avatar } from '../../components/ui';
import type { RootStackParamList } from '../../types';
import { APP_VERSION } from '../../config/constants';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

interface SettingItemProps {
  icon: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  iconBg?: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  rightElement?: React.ReactNode;
  showChevron?: boolean;
}

function SettingItem({
  icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  value,
  onPress,
  rightElement,
  showChevron = true,
}: SettingItemProps) {
  const theme = useTheme();

  return (
    <TouchableOpacity
      style={styles.settingItem}
      onPress={onPress}
      disabled={!onPress && !rightElement}
    >
      <View style={[styles.settingIcon, { backgroundColor: iconBg || theme.background.secondary }]}>
        <Ionicons name={icon} size={20} color={iconColor || theme.text.secondary} />
      </View>
      <View style={styles.settingContent}>
        <Text style={[styles.settingTitle, { color: theme.text.primary }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.settingSubtitle, { color: theme.text.secondary }]}>
            {subtitle}
          </Text>
        )}
      </View>
      {value && (
        <Text style={[styles.settingValue, { color: theme.text.tertiary }]}>{value}</Text>
      )}
      {rightElement}
      {showChevron && onPress && !rightElement && (
        <Ionicons name="chevron-forward" size={20} color={theme.text.tertiary} />
      )}
    </TouchableOpacity>
  );
}

export function SettingsScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { user, logout } = useAuthStore();
  const {
    theme: themeMode,
    setTheme,
    notifications,
    updateNotifications,
    biometricEnabled,
    setBiometricEnabled,
    hapticEnabled,
    setHapticEnabled,
  } = useSettingsStore();

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  const getThemeLabel = () => {
    switch (themeMode) {
      case 'light':
        return 'Light';
      case 'dark':
        return 'Dark';
      default:
        return 'System';
    }
  };

  const cycleTheme = () => {
    const themes: Array<'light' | 'dark' | 'system'> = ['system', 'light', 'dark'];
    const currentIndex = themes.indexOf(themeMode);
    const nextIndex = (currentIndex + 1) % themes.length;
    setTheme(themes[nextIndex]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Header */}
        <View style={styles.header}>
          <Text style={[styles.title, { color: theme.text.primary }]}>Settings</Text>
        </View>

        {/* Profile Card */}
        <Card variant="elevated" style={styles.profileCard} onPress={() => navigation.navigate('Profile')}>
          <View style={styles.profileRow}>
            <Avatar source={user?.avatar} name={user?.name} size="lg" />
            <View style={styles.profileInfo}>
              <Text style={[styles.profileName, { color: theme.text.primary }]}>
                {user?.name || 'User'}
              </Text>
              <Text style={[styles.profileEmail, { color: theme.text.secondary }]}>
                {user?.email}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={theme.text.tertiary} />
          </View>
        </Card>

        {/* Appearance */}
        <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>Appearance</Text>
        <Card variant="outlined">
          <SettingItem
            icon="moon-outline"
            iconColor={theme.primary[500]}
            iconBg={theme.primary[100]}
            title="Theme"
            value={getThemeLabel()}
            onPress={cycleTheme}
          />
          <View style={[styles.divider, { backgroundColor: theme.border.light }]} />
          <SettingItem
            icon="phone-portrait-outline"
            iconColor={theme.secondary[500]}
            iconBg={theme.secondary[100]}
            title="Haptic Feedback"
            rightElement={
              <Switch
                value={hapticEnabled}
                onValueChange={setHapticEnabled}
                trackColor={{ false: theme.neutral[300], true: theme.primary[500] }}
                thumbColor={theme.white}
              />
            }
            showChevron={false}
          />
        </Card>

        {/* Notifications */}
        <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>Notifications</Text>
        <Card variant="outlined">
          <SettingItem
            icon="notifications-outline"
            iconColor={theme.warning.main}
            iconBg={theme.warning.light}
            title="Push Notifications"
            rightElement={
              <Switch
                value={notifications.pushEnabled}
                onValueChange={(value) => updateNotifications({ pushEnabled: value })}
                trackColor={{ false: theme.neutral[300], true: theme.primary[500] }}
                thumbColor={theme.white}
              />
            }
            showChevron={false}
          />
          <View style={[styles.divider, { backgroundColor: theme.border.light }]} />
          <SettingItem
            icon="cube-outline"
            iconColor={theme.info.main}
            iconBg={theme.info.light}
            title="Bot Alerts"
            subtitle="Get notified about bot status changes"
            rightElement={
              <Switch
                value={notifications.botAlerts}
                onValueChange={(value) => updateNotifications({ botAlerts: value })}
                trackColor={{ false: theme.neutral[300], true: theme.primary[500] }}
                thumbColor={theme.white}
              />
            }
            showChevron={false}
          />
          <View style={[styles.divider, { backgroundColor: theme.border.light }]} />
          <SettingItem
            icon="chatbubbles-outline"
            iconColor={theme.success.main}
            iconBg={theme.success.light}
            title="Conversation Alerts"
            subtitle="New messages and escalations"
            rightElement={
              <Switch
                value={notifications.conversationAlerts}
                onValueChange={(value) => updateNotifications({ conversationAlerts: value })}
                trackColor={{ false: theme.neutral[300], true: theme.primary[500] }}
                thumbColor={theme.white}
              />
            }
            showChevron={false}
          />
        </Card>

        {/* Security */}
        <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>Security</Text>
        <Card variant="outlined">
          <SettingItem
            icon="finger-print"
            iconColor={theme.primary[500]}
            iconBg={theme.primary[100]}
            title="Biometric Login"
            subtitle="Use Face ID or fingerprint"
            rightElement={
              <Switch
                value={biometricEnabled}
                onValueChange={setBiometricEnabled}
                trackColor={{ false: theme.neutral[300], true: theme.primary[500] }}
                thumbColor={theme.white}
              />
            }
            showChevron={false}
          />
          <View style={[styles.divider, { backgroundColor: theme.border.light }]} />
          <SettingItem
            icon="key-outline"
            iconColor={theme.warning.main}
            iconBg={theme.warning.light}
            title="Change Password"
            onPress={() => {}}
          />
        </Card>

        {/* Support */}
        <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>Support</Text>
        <Card variant="outlined">
          <SettingItem
            icon="help-circle-outline"
            iconColor={theme.info.main}
            iconBg={theme.info.light}
            title="Help Center"
            onPress={() => {}}
          />
          <View style={[styles.divider, { backgroundColor: theme.border.light }]} />
          <SettingItem
            icon="chatbox-outline"
            iconColor={theme.secondary[500]}
            iconBg={theme.secondary[100]}
            title="Contact Support"
            onPress={() => {}}
          />
          <View style={[styles.divider, { backgroundColor: theme.border.light }]} />
          <SettingItem
            icon="document-text-outline"
            iconColor={theme.neutral[500]}
            iconBg={theme.neutral[200]}
            title="Terms & Privacy"
            onPress={() => {}}
          />
        </Card>

        {/* About */}
        <Text style={[styles.sectionTitle, { color: theme.text.secondary }]}>About</Text>
        <Card variant="outlined">
          <SettingItem
            icon="information-circle-outline"
            iconColor={theme.text.secondary}
            title="App Version"
            value={APP_VERSION}
            showChevron={false}
          />
        </Card>

        {/* Logout */}
        <TouchableOpacity
          style={[styles.logoutButton, { backgroundColor: theme.error.light }]}
          onPress={handleLogout}
        >
          <Ionicons name="log-out-outline" size={20} color={theme.error.dark} />
          <Text style={[styles.logoutText, { color: theme.error.dark }]}>Log Out</Text>
        </TouchableOpacity>

        <View style={styles.bottomPadding} />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  header: {
    paddingVertical: 12,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
  },
  profileCard: {
    marginBottom: 24,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 12,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
  },
  profileEmail: {
    fontSize: 14,
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
    marginTop: 8,
  },
  settingItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  settingIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  settingContent: {
    flex: 1,
    marginLeft: 12,
  },
  settingTitle: {
    fontSize: 15,
    fontWeight: '500',
  },
  settingSubtitle: {
    fontSize: 12,
    marginTop: 2,
  },
  settingValue: {
    fontSize: 14,
    marginRight: 8,
  },
  divider: {
    height: 1,
    marginLeft: 48,
  },
  logoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 12,
    marginTop: 24,
    gap: 8,
  },
  logoutText: {
    fontSize: 16,
    fontWeight: '600',
  },
  bottomPadding: {
    height: 100,
  },
});
