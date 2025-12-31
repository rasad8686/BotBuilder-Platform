import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../../hooks/useTheme';
import { authService } from '../../services/authService';

export const ChangePasswordScreen: React.FC = () => {
  const theme = useTheme();
  const navigation = useNavigation();

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errors, setErrors] = useState<{ [key: string]: string }>({});

  const validatePassword = (password: string): string[] => {
    const issues: string[] = [];
    if (password.length < 8) issues.push('At least 8 characters');
    if (!/[A-Z]/.test(password)) issues.push('One uppercase letter');
    if (!/[a-z]/.test(password)) issues.push('One lowercase letter');
    if (!/[0-9]/.test(password)) issues.push('One number');
    if (!/[!@#$%^&*]/.test(password)) issues.push('One special character (!@#$%^&*)');
    return issues;
  };

  const getPasswordStrength = (password: string): { label: string; color: string; width: string } => {
    const issues = validatePassword(password);
    if (password.length === 0) return { label: '', color: 'transparent', width: '0%' };
    if (issues.length >= 4) return { label: 'Weak', color: '#EF4444', width: '25%' };
    if (issues.length >= 2) return { label: 'Fair', color: '#F59E0B', width: '50%' };
    if (issues.length >= 1) return { label: 'Good', color: '#3B82F6', width: '75%' };
    return { label: 'Strong', color: '#10B981', width: '100%' };
  };

  const validate = (): boolean => {
    const newErrors: { [key: string]: string } = {};

    if (!currentPassword) {
      newErrors.currentPassword = 'Current password is required';
    }

    const passwordIssues = validatePassword(newPassword);
    if (passwordIssues.length > 0) {
      newErrors.newPassword = `Password must have: ${passwordIssues.join(', ')}`;
    }

    if (newPassword !== confirmPassword) {
      newErrors.confirmPassword = 'Passwords do not match';
    }

    if (currentPassword === newPassword) {
      newErrors.newPassword = 'New password must be different from current password';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    try {
      setIsLoading(true);
      await authService.changePassword(currentPassword, newPassword);

      Alert.alert(
        'Success',
        'Your password has been changed successfully.',
        [
          {
            text: 'OK',
            onPress: () => navigation.goBack(),
          },
        ]
      );
    } catch (error: any) {
      Alert.alert(
        'Error',
        error.response?.data?.message || 'Failed to change password. Please check your current password and try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const strength = getPasswordStrength(newPassword);

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.colors.background }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={theme.colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: theme.colors.text }]}>Change Password</Text>
        <View style={styles.backButton} />
      </View>

      <KeyboardAvoidingView
        style={styles.content}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          <View style={[styles.infoBox, { backgroundColor: theme.colors.primary + '15' }]}>
            <Ionicons name="shield-checkmark" size={24} color={theme.colors.primary} />
            <Text style={[styles.infoText, { color: theme.colors.textSecondary }]}>
              Choose a strong password that you haven't used before. A good password uses a mix of letters, numbers, and symbols.
            </Text>
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Current Password</Text>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: errors.currentPassword ? theme.colors.error : theme.colors.border,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                value={currentPassword}
                onChangeText={setCurrentPassword}
                placeholder="Enter current password"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry={!showCurrentPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowCurrentPassword(!showCurrentPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showCurrentPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            {errors.currentPassword && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errors.currentPassword}
              </Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>New Password</Text>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: errors.newPassword ? theme.colors.error : theme.colors.border,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                value={newPassword}
                onChangeText={setNewPassword}
                placeholder="Enter new password"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry={!showNewPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowNewPassword(!showNewPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showNewPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            {newPassword.length > 0 && (
              <View style={styles.strengthContainer}>
                <View style={[styles.strengthBar, { backgroundColor: theme.colors.border }]}>
                  <View
                    style={[
                      styles.strengthFill,
                      { backgroundColor: strength.color, width: strength.width },
                    ]}
                  />
                </View>
                <Text style={[styles.strengthText, { color: strength.color }]}>{strength.label}</Text>
              </View>
            )}
            {errors.newPassword && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errors.newPassword}
              </Text>
            )}
          </View>

          <View style={styles.formGroup}>
            <Text style={[styles.label, { color: theme.colors.text }]}>Confirm New Password</Text>
            <View
              style={[
                styles.inputContainer,
                {
                  backgroundColor: theme.colors.card,
                  borderColor: errors.confirmPassword ? theme.colors.error : theme.colors.border,
                },
              ]}
            >
              <TextInput
                style={[styles.input, { color: theme.colors.text }]}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Confirm new password"
                placeholderTextColor={theme.colors.textSecondary}
                secureTextEntry={!showConfirmPassword}
                autoCapitalize="none"
              />
              <TouchableOpacity
                onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                style={styles.eyeButton}
              >
                <Ionicons
                  name={showConfirmPassword ? 'eye-off' : 'eye'}
                  size={20}
                  color={theme.colors.textSecondary}
                />
              </TouchableOpacity>
            </View>
            {confirmPassword.length > 0 && newPassword === confirmPassword && (
              <View style={styles.matchIndicator}>
                <Ionicons name="checkmark-circle" size={16} color={theme.colors.success} />
                <Text style={[styles.matchText, { color: theme.colors.success }]}>Passwords match</Text>
              </View>
            )}
            {errors.confirmPassword && (
              <Text style={[styles.errorText, { color: theme.colors.error }]}>
                {errors.confirmPassword}
              </Text>
            )}
          </View>

          <View style={styles.requirements}>
            <Text style={[styles.requirementsTitle, { color: theme.colors.text }]}>
              Password Requirements:
            </Text>
            {[
              { text: 'At least 8 characters', met: newPassword.length >= 8 },
              { text: 'One uppercase letter', met: /[A-Z]/.test(newPassword) },
              { text: 'One lowercase letter', met: /[a-z]/.test(newPassword) },
              { text: 'One number', met: /[0-9]/.test(newPassword) },
              { text: 'One special character', met: /[!@#$%^&*]/.test(newPassword) },
            ].map((req, index) => (
              <View key={index} style={styles.requirementItem}>
                <Ionicons
                  name={req.met ? 'checkmark-circle' : 'ellipse-outline'}
                  size={16}
                  color={req.met ? theme.colors.success : theme.colors.textSecondary}
                />
                <Text
                  style={[
                    styles.requirementText,
                    { color: req.met ? theme.colors.success : theme.colors.textSecondary },
                  ]}
                >
                  {req.text}
                </Text>
              </View>
            ))}
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={[styles.footer, { borderTopColor: theme.colors.border }]}>
        <TouchableOpacity
          style={[styles.cancelButton, { borderColor: theme.colors.border }]}
          onPress={() => navigation.goBack()}
        >
          <Text style={[styles.cancelButtonText, { color: theme.colors.text }]}>Cancel</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.submitButton,
            {
              backgroundColor:
                currentPassword && newPassword && confirmPassword
                  ? theme.colors.primary
                  : theme.colors.border,
            },
          ]}
          onPress={handleSubmit}
          disabled={isLoading || !currentPassword || !newPassword || !confirmPassword}
        >
          {isLoading ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <Text style={styles.submitButtonText}>Change Password</Text>
          )}
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    width: 40,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 16,
    paddingBottom: 20,
  },
  infoBox: {
    flexDirection: 'row',
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
    gap: 12,
  },
  infoText: {
    flex: 1,
    fontSize: 13,
    lineHeight: 20,
  },
  formGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 8,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 14,
  },
  input: {
    flex: 1,
    height: 48,
    fontSize: 16,
  },
  eyeButton: {
    padding: 8,
  },
  errorText: {
    fontSize: 12,
    marginTop: 6,
  },
  strengthContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 8,
    gap: 10,
  },
  strengthBar: {
    flex: 1,
    height: 4,
    borderRadius: 2,
    overflow: 'hidden',
  },
  strengthFill: {
    height: '100%',
    borderRadius: 2,
  },
  strengthText: {
    fontSize: 12,
    fontWeight: '500',
    minWidth: 50,
  },
  matchIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  matchText: {
    fontSize: 12,
  },
  requirements: {
    marginTop: 12,
    padding: 16,
    borderRadius: 12,
  },
  requirementsTitle: {
    fontSize: 14,
    fontWeight: '600',
    marginBottom: 12,
  },
  requirementItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 8,
  },
  requirementText: {
    fontSize: 13,
  },
  footer: {
    flexDirection: 'row',
    padding: 16,
    borderTopWidth: 1,
    gap: 12,
  },
  cancelButton: {
    flex: 1,
    height: 48,
    borderRadius: 24,
    borderWidth: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  cancelButtonText: {
    fontSize: 16,
    fontWeight: '600',
  },
  submitButton: {
    flex: 2,
    height: 48,
    borderRadius: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ChangePasswordScreen;
