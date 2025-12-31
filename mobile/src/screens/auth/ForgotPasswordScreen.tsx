import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { LinearGradient } from 'expo-linear-gradient';

import { authService } from '../../services';
import { useTheme } from '../../hooks';
import { Button, Input } from '../../components/ui';
import { VALIDATION } from '../../config/constants';

export function ForgotPasswordScreen() {
  const theme = useTheme();
  const navigation = useNavigation();

  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validate = () => {
    if (!email) {
      setError('Email is required');
      return false;
    }
    if (!VALIDATION.EMAIL_REGEX.test(email)) {
      setError('Invalid email address');
      return false;
    }
    setError('');
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;

    setIsLoading(true);
    const response = await authService.forgotPassword(email);
    setIsLoading(false);

    if (response.success) {
      setIsSuccess(true);
    } else {
      setError(response.error || 'Failed to send reset email');
    }
  };

  if (isSuccess) {
    return (
      <LinearGradient
        colors={[theme.primary[900], theme.primary[700]]}
        style={styles.gradient}
      >
        <SafeAreaView style={styles.container}>
          <View style={styles.successContainer}>
            <View style={[styles.successIcon, { backgroundColor: theme.success.main }]}>
              <Ionicons name="checkmark" size={48} color={theme.white} />
            </View>
            <Text style={[styles.successTitle, { color: theme.white }]}>
              Check your email
            </Text>
            <Text style={[styles.successText, { color: theme.primary[200] }]}>
              We've sent a password reset link to {email}
            </Text>
            <Button
              title="Back to Login"
              onPress={() => navigation.goBack()}
              variant="outline"
              style={styles.backButton}
              textStyle={{ color: theme.white }}
            />
          </View>
        </SafeAreaView>
      </LinearGradient>
    );
  }

  return (
    <LinearGradient
      colors={[theme.primary[900], theme.primary[700]]}
      style={styles.gradient}
    >
      <SafeAreaView style={styles.container}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={styles.keyboardView}
        >
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
          >
            {/* Header */}
            <TouchableOpacity
              style={styles.backButtonHeader}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={24} color={theme.white} />
            </TouchableOpacity>

            <View style={styles.header}>
              <View style={[styles.iconCircle, { backgroundColor: theme.white }]}>
                <Ionicons name="key-outline" size={32} color={theme.primary[500]} />
              </View>
              <Text style={[styles.title, { color: theme.white }]}>
                Forgot Password?
              </Text>
              <Text style={[styles.subtitle, { color: theme.primary[200] }]}>
                No worries, we'll send you reset instructions
              </Text>
            </View>

            {/* Form */}
            <View style={[styles.formCard, { backgroundColor: theme.card.background }]}>
              <Input
                label="Email"
                placeholder="Enter your email"
                value={email}
                onChangeText={(text) => {
                  setEmail(text);
                  setError('');
                }}
                error={error}
                leftIcon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Button
                title="Send Reset Link"
                onPress={handleSubmit}
                loading={isLoading}
                fullWidth
              />
            </View>

            {/* Back to Login */}
            <TouchableOpacity
              style={styles.loginLink}
              onPress={() => navigation.goBack()}
            >
              <Ionicons name="arrow-back" size={16} color={theme.white} />
              <Text style={[styles.loginLinkText, { color: theme.white }]}>
                Back to Login
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: {
    flex: 1,
  },
  container: {
    flex: 1,
  },
  keyboardView: {
    flex: 1,
  },
  scrollContent: {
    flexGrow: 1,
    padding: 24,
  },
  backButtonHeader: {
    marginBottom: 32,
  },
  header: {
    alignItems: 'center',
    marginBottom: 32,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    textAlign: 'center',
  },
  formCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
  },
  loginLink: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginLinkText: {
    fontSize: 14,
    fontWeight: '500',
    marginLeft: 8,
  },
  successContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  successIcon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  successTitle: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 8,
  },
  successText: {
    fontSize: 14,
    textAlign: 'center',
    marginBottom: 32,
  },
  backButton: {
    borderColor: 'rgba(255,255,255,0.3)',
  },
});
