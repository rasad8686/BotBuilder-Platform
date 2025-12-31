import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { LinearGradient } from 'expo-linear-gradient';

import { useAuthStore } from '../../store';
import { useTheme } from '../../hooks';
import { Button, Input } from '../../components/ui';
import { VALIDATION } from '../../config/constants';
import type { RootStackParamList } from '../../types';

type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

export function LoginScreen() {
  const theme = useTheme();
  const navigation = useNavigation<NavigationProp>();
  const { login, authenticateWithBiometric, biometricAvailable, biometricType, checkBiometricAvailability, isLoading, error, clearError } = useAuthStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});

  useEffect(() => {
    checkBiometricAvailability();
  }, []);

  useEffect(() => {
    if (error) {
      const timer = setTimeout(clearError, 5000);
      return () => clearTimeout(timer);
    }
  }, [error]);

  const validate = () => {
    const newErrors: { email?: string; password?: string } = {};

    if (!email) {
      newErrors.email = 'Email is required';
    } else if (!VALIDATION.EMAIL_REGEX.test(email)) {
      newErrors.email = 'Invalid email address';
    }

    if (!password) {
      newErrors.password = 'Password is required';
    } else if (password.length < VALIDATION.PASSWORD_MIN_LENGTH) {
      newErrors.password = `Password must be at least ${VALIDATION.PASSWORD_MIN_LENGTH} characters`;
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleLogin = async () => {
    if (!validate()) return;

    const success = await login({ email, password, rememberMe });
    if (success) {
      // Navigation will be handled by the auth state change
    }
  };

  const handleBiometricLogin = async () => {
    await authenticateWithBiometric();
  };

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
            {/* Logo */}
            <View style={styles.logoContainer}>
              <View style={[styles.logoCircle, { backgroundColor: theme.white }]}>
                <Ionicons name="cube" size={48} color={theme.primary[500]} />
              </View>
              <Text style={[styles.appName, { color: theme.white }]}>BotBuilder</Text>
              <Text style={[styles.tagline, { color: theme.primary[200] }]}>
                Manage your bots on the go
              </Text>
            </View>

            {/* Login Form */}
            <View style={[styles.formCard, { backgroundColor: theme.card.background }]}>
              <Text style={[styles.title, { color: theme.text.primary }]}>
                Welcome Back
              </Text>
              <Text style={[styles.subtitle, { color: theme.text.secondary }]}>
                Sign in to continue
              </Text>

              {error && (
                <View style={[styles.errorBanner, { backgroundColor: theme.error.light }]}>
                  <Ionicons name="alert-circle" size={20} color={theme.error.dark} />
                  <Text style={[styles.errorText, { color: theme.error.dark }]}>
                    {error}
                  </Text>
                </View>
              )}

              <Input
                label="Email"
                placeholder="Enter your email"
                value={email}
                onChangeText={setEmail}
                error={errors.email}
                leftIcon="mail-outline"
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
              />

              <Input
                label="Password"
                placeholder="Enter your password"
                value={password}
                onChangeText={setPassword}
                error={errors.password}
                leftIcon="lock-closed-outline"
                secureTextEntry
              />

              <View style={styles.optionsRow}>
                <TouchableOpacity
                  style={styles.checkboxRow}
                  onPress={() => setRememberMe(!rememberMe)}
                >
                  <View
                    style={[
                      styles.checkbox,
                      {
                        borderColor: rememberMe ? theme.primary[500] : theme.border.medium,
                        backgroundColor: rememberMe ? theme.primary[500] : 'transparent',
                      },
                    ]}
                  >
                    {rememberMe && (
                      <Ionicons name="checkmark" size={14} color={theme.white} />
                    )}
                  </View>
                  <Text style={[styles.checkboxLabel, { color: theme.text.secondary }]}>
                    Remember me
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() => navigation.navigate('ForgotPassword')}
                >
                  <Text style={[styles.forgotPassword, { color: theme.primary[500] }]}>
                    Forgot password?
                  </Text>
                </TouchableOpacity>
              </View>

              <Button
                title="Sign In"
                onPress={handleLogin}
                loading={isLoading}
                fullWidth
                style={styles.loginButton}
              />

              {biometricAvailable && (
                <>
                  <View style={styles.divider}>
                    <View style={[styles.dividerLine, { backgroundColor: theme.border.light }]} />
                    <Text style={[styles.dividerText, { color: theme.text.tertiary }]}>
                      or
                    </Text>
                    <View style={[styles.dividerLine, { backgroundColor: theme.border.light }]} />
                  </View>

                  <Button
                    title={`Sign in with ${biometricType}`}
                    onPress={handleBiometricLogin}
                    variant="outline"
                    fullWidth
                    icon={
                      <Ionicons
                        name={biometricType === 'Face ID' ? 'scan' : 'finger-print'}
                        size={20}
                        color={theme.primary[500]}
                      />
                    }
                  />
                </>
              )}
            </View>

            {/* Register Link */}
            <View style={styles.registerRow}>
              <Text style={[styles.registerText, { color: theme.primary[200] }]}>
                Don't have an account?
              </Text>
              <TouchableOpacity onPress={() => navigation.navigate('Register')}>
                <Text style={[styles.registerLink, { color: theme.white }]}>
                  Sign Up
                </Text>
              </TouchableOpacity>
            </View>
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
  logoContainer: {
    alignItems: 'center',
    marginTop: 32,
    marginBottom: 32,
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    marginBottom: 4,
  },
  tagline: {
    fontSize: 14,
  },
  formCard: {
    borderRadius: 24,
    padding: 24,
    marginBottom: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    marginBottom: 24,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderRadius: 12,
    marginBottom: 16,
  },
  errorText: {
    marginLeft: 8,
    fontSize: 14,
    flex: 1,
  },
  optionsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 24,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  checkboxLabel: {
    fontSize: 14,
  },
  forgotPassword: {
    fontSize: 14,
    fontWeight: '500',
  },
  loginButton: {
    marginTop: 8,
  },
  divider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  dividerLine: {
    flex: 1,
    height: 1,
  },
  dividerText: {
    marginHorizontal: 16,
    fontSize: 12,
  },
  registerRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
  },
  registerText: {
    fontSize: 14,
    marginRight: 4,
  },
  registerLink: {
    fontSize: 14,
    fontWeight: '600',
  },
});
