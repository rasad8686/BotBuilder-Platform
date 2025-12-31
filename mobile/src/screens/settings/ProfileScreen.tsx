import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';

import { useAuthStore } from '../../store';
import { authService } from '../../services';
import { useTheme } from '../../hooks';
import { Card, Avatar, Button, Input } from '../../components/ui';

export function ProfileScreen() {
  const theme = useTheme();
  const navigation = useNavigation();
  const { user, updateUser } = useAuthStore();

  const [isEditing, setIsEditing] = useState(false);
  const [name, setName] = useState(user?.name || '');
  const [email, setEmail] = useState(user?.email || '');
  const [isSaving, setIsSaving] = useState(false);

  const handleSave = async () => {
    if (!name.trim()) {
      Alert.alert('Error', 'Name cannot be empty');
      return;
    }

    setIsSaving(true);
    const response = await authService.updateProfile({ name });
    setIsSaving(false);

    if (response.success) {
      updateUser({ name });
      setIsEditing(false);
      Alert.alert('Success', 'Profile updated successfully');
    } else {
      Alert.alert('Error', response.error || 'Failed to update profile');
    }
  };

  const handleCancel = () => {
    setName(user?.name || '');
    setIsEditing(false);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background.primary }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()}>
          <Ionicons name="arrow-back" size={24} color={theme.text.primary} />
        </TouchableOpacity>
        <Text style={[styles.title, { color: theme.text.primary }]}>Profile</Text>
        <TouchableOpacity onPress={() => (isEditing ? handleSave() : setIsEditing(true))}>
          <Text style={[styles.editButton, { color: theme.primary[500] }]}>
            {isEditing ? 'Save' : 'Edit'}
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.scrollContent}>
        {/* Avatar Section */}
        <View style={styles.avatarSection}>
          <View style={styles.avatarContainer}>
            <Avatar source={user?.avatar} name={user?.name} size="xl" />
            {isEditing && (
              <TouchableOpacity
                style={[styles.avatarEdit, { backgroundColor: theme.primary[500] }]}
              >
                <Ionicons name="camera" size={16} color={theme.white} />
              </TouchableOpacity>
            )}
          </View>
          {!isEditing && (
            <>
              <Text style={[styles.userName, { color: theme.text.primary }]}>
                {user?.name}
              </Text>
              <Text style={[styles.userRole, { color: theme.text.secondary }]}>
                {user?.role === 'admin' ? 'Administrator' : 'Member'}
              </Text>
            </>
          )}
        </View>

        {/* Profile Form */}
        <Card variant="outlined" style={styles.formCard}>
          {isEditing ? (
            <>
              <Input
                label="Full Name"
                value={name}
                onChangeText={setName}
                placeholder="Enter your name"
              />
              <Input
                label="Email"
                value={email}
                editable={false}
                hint="Email cannot be changed"
              />
            </>
          ) : (
            <>
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: theme.background.secondary }]}>
                  <Ionicons name="person-outline" size={18} color={theme.text.secondary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.text.secondary }]}>
                    Full Name
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.text.primary }]}>
                    {user?.name}
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.border.light }]} />
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: theme.background.secondary }]}>
                  <Ionicons name="mail-outline" size={18} color={theme.text.secondary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.text.secondary }]}>
                    Email
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.text.primary }]}>
                    {user?.email}
                  </Text>
                </View>
              </View>
              <View style={[styles.divider, { backgroundColor: theme.border.light }]} />
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: theme.background.secondary }]}>
                  <Ionicons name="shield-outline" size={18} color={theme.text.secondary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.text.secondary }]}>Role</Text>
                  <Text style={[styles.infoValue, { color: theme.text.primary }]}>
                    {user?.role === 'admin' ? 'Administrator' : user?.role === 'manager' ? 'Manager' : 'Member'}
                  </Text>
                </View>
              </View>
              {user?.organizationId && (
                <>
                  <View style={[styles.divider, { backgroundColor: theme.border.light }]} />
                  <View style={styles.infoRow}>
                    <View style={[styles.infoIcon, { backgroundColor: theme.background.secondary }]}>
                      <Ionicons name="business-outline" size={18} color={theme.text.secondary} />
                    </View>
                    <View style={styles.infoContent}>
                      <Text style={[styles.infoLabel, { color: theme.text.secondary }]}>
                        Organization
                      </Text>
                      <Text style={[styles.infoValue, { color: theme.text.primary }]}>
                        {user.organizationId}
                      </Text>
                    </View>
                  </View>
                </>
              )}
              <View style={[styles.divider, { backgroundColor: theme.border.light }]} />
              <View style={styles.infoRow}>
                <View style={[styles.infoIcon, { backgroundColor: theme.background.secondary }]}>
                  <Ionicons name="calendar-outline" size={18} color={theme.text.secondary} />
                </View>
                <View style={styles.infoContent}>
                  <Text style={[styles.infoLabel, { color: theme.text.secondary }]}>
                    Member Since
                  </Text>
                  <Text style={[styles.infoValue, { color: theme.text.primary }]}>
                    {user?.createdAt
                      ? new Date(user.createdAt).toLocaleDateString('en-US', {
                          year: 'numeric',
                          month: 'long',
                          day: 'numeric',
                        })
                      : 'Unknown'}
                  </Text>
                </View>
              </View>
            </>
          )}
        </Card>

        {isEditing && (
          <View style={styles.buttonRow}>
            <Button
              title="Cancel"
              onPress={handleCancel}
              variant="outline"
              style={styles.button}
            />
            <Button
              title="Save Changes"
              onPress={handleSave}
              loading={isSaving}
              style={styles.button}
            />
          </View>
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
  editButton: {
    fontSize: 16,
    fontWeight: '500',
  },
  scrollContent: {
    paddingHorizontal: 16,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatarEdit: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
  userName: {
    fontSize: 24,
    fontWeight: '700',
    marginTop: 16,
  },
  userRole: {
    fontSize: 14,
    marginTop: 4,
  },
  formCard: {
    marginTop: 16,
  },
  infoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
  },
  infoIcon: {
    width: 36,
    height: 36,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoContent: {
    flex: 1,
    marginLeft: 12,
  },
  infoLabel: {
    fontSize: 12,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    marginTop: 2,
  },
  divider: {
    height: 1,
    marginLeft: 48,
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    marginTop: 24,
  },
  button: {
    flex: 1,
  },
  bottomPadding: {
    height: 100,
  },
});
