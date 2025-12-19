/**
 * Settings Screen
 * App settings and user profile
 */
import React, { useState } from 'react';
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
import { Card, Button } from '../components';
import { useAuth } from '../contexts/AuthContext';
import { getSettings, setSettings } from '../utils/storage';

const SettingsScreen = ({ navigation }) => {
  const { user, logout, biometricSupported } = useAuth();
  const [settings, setSettingsState] = useState({
    notifications: true,
    biometricLogin: false,
    darkMode: false,
  });
  const [loggingOut, setLoggingOut] = useState(false);

  const handleLogout = () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            setLoggingOut(true);
            await logout();
          },
        },
      ]
    );
  };

  const updateSetting = async (key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettingsState(newSettings);
    await setSettings(newSettings);
  };

  const SettingRow = ({ icon, title, subtitle, value, onValueChange, showArrow }) => (
    <TouchableOpacity
      style={styles.settingRow}
      disabled={!showArrow && !onValueChange}
      activeOpacity={showArrow ? 0.7 : 1}
    >
      <Text style={styles.settingIcon}>{icon}</Text>
      <View style={styles.settingContent}>
        <Text style={styles.settingTitle}>{title}</Text>
        {subtitle && <Text style={styles.settingSubtitle}>{subtitle}</Text>}
      </View>
      {onValueChange && (
        <Switch
          value={value}
          onValueChange={onValueChange}
          trackColor={{ false: '#e2e8f0', true: '#93c5fd' }}
          thumbColor={value ? '#3b82f6' : '#ffffff'}
        />
      )}
      {showArrow && <Text style={styles.arrow}>›</Text>}
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <Text style={styles.title}>Settings</Text>

        {/* Profile Section */}
        <Card style={styles.profileCard}>
          <View style={styles.profileRow}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {user?.name?.[0]?.toUpperCase() || 'U'}
              </Text>
            </View>
            <View style={styles.profileInfo}>
              <Text style={styles.profileName}>{user?.name || 'User'}</Text>
              <Text style={styles.profileEmail}>{user?.email || ''}</Text>
            </View>
            <Text style={styles.arrow}>›</Text>
          </View>
        </Card>

        {/* App Settings */}
        <Text style={styles.sectionTitle}>App Settings</Text>
        <Card style={styles.settingsCard}>
          <SettingRow
            icon="🔔"
            title="Push Notifications"
            subtitle="Receive alerts and updates"
            value={settings.notifications}
            onValueChange={(v) => updateSetting('notifications', v)}
          />
          {biometricSupported && (
            <SettingRow
              icon="🔐"
              title="Biometric Login"
              subtitle="Use Face ID or fingerprint"
              value={settings.biometricLogin}
              onValueChange={(v) => updateSetting('biometricLogin', v)}
            />
          )}
          <SettingRow
            icon="🌙"
            title="Dark Mode"
            subtitle="Coming soon"
            value={settings.darkMode}
            onValueChange={(v) => updateSetting('darkMode', v)}
          />
        </Card>

        {/* Account */}
        <Text style={styles.sectionTitle}>Account</Text>
        <Card style={styles.settingsCard}>
          <SettingRow
            icon="🔑"
            title="Change Password"
            showArrow
          />
          <SettingRow
            icon="📧"
            title="Email Preferences"
            showArrow
          />
          <SettingRow
            icon="🗑️"
            title="Delete Account"
            showArrow
          />
        </Card>

        {/* Support */}
        <Text style={styles.sectionTitle}>Support</Text>
        <Card style={styles.settingsCard}>
          <SettingRow
            icon="❓"
            title="Help Center"
            showArrow
          />
          <SettingRow
            icon="💬"
            title="Contact Support"
            showArrow
          />
          <SettingRow
            icon="📜"
            title="Terms of Service"
            showArrow
          />
          <SettingRow
            icon="🔒"
            title="Privacy Policy"
            showArrow
          />
        </Card>

        {/* Logout Button */}
        <Button
          title="Logout"
          variant="outline"
          onPress={handleLogout}
          loading={loggingOut}
          style={styles.logoutButton}
        />

        {/* Version */}
        <Text style={styles.version}>Version 1.0.0</Text>
      </ScrollView>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    padding: 20,
    paddingBottom: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 20,
  },
  profileCard: {
    marginBottom: 24,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#3b82f6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 22,
    fontWeight: '600',
    color: '#ffffff',
  },
  profileInfo: {
    flex: 1,
    marginLeft: 14,
  },
  profileName: {
    fontSize: 18,
    fontWeight: '600',
    color: '#1e293b',
  },
  profileEmail: {
    fontSize: 14,
    color: '#64748b',
    marginTop: 2,
  },
  sectionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#64748b',
    marginBottom: 8,
    marginTop: 8,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  settingsCard: {
    marginBottom: 16,
    padding: 0,
    overflow: 'hidden',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#f1f5f9',
  },
  settingIcon: {
    fontSize: 22,
    marginRight: 14,
  },
  settingContent: {
    flex: 1,
  },
  settingTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#1e293b',
  },
  settingSubtitle: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 2,
  },
  arrow: {
    fontSize: 22,
    color: '#cbd5e1',
  },
  logoutButton: {
    marginTop: 24,
  },
  version: {
    textAlign: 'center',
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 20,
  },
});

export default SettingsScreen;
