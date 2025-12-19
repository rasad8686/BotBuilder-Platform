/**
 * Verify Code Screen
 * OTP verification for password reset
 */
import React, { useState, useRef, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  TextInput,
  Alert,
  Keyboard,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AuthButton } from '../../components/auth';
import { useAuth } from '../../contexts/AuthContext';

const CODE_LENGTH = 6;
const RESEND_COOLDOWN = 60; // seconds

const VerifyCodeScreen = ({ navigation, route }) => {
  const { email } = route.params || {};
  const { verifyCode, resendCode } = useAuth();

  const [code, setCode] = useState(Array(CODE_LENGTH).fill(''));
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(RESEND_COOLDOWN);
  const [canResend, setCanResend] = useState(false);

  const inputRefs = useRef([]);

  // Timer for resend cooldown
  useEffect(() => {
    let interval;
    if (resendTimer > 0) {
      interval = setInterval(() => {
        setResendTimer(prev => {
          if (prev <= 1) {
            setCanResend(true);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [resendTimer]);

  // Focus first input on mount
  useEffect(() => {
    setTimeout(() => {
      inputRefs.current[0]?.focus();
    }, 500);
  }, []);

  const handleCodeChange = (value, index) => {
    // Only allow numbers
    const numericValue = value.replace(/[^0-9]/g, '');

    if (numericValue.length > 1) {
      // Handle paste
      const pastedCode = numericValue.slice(0, CODE_LENGTH).split('');
      const newCode = [...code];
      pastedCode.forEach((digit, i) => {
        if (i < CODE_LENGTH) newCode[i] = digit;
      });
      setCode(newCode);

      // Focus last filled input or next empty
      const lastIndex = Math.min(pastedCode.length, CODE_LENGTH) - 1;
      inputRefs.current[lastIndex]?.focus();
      return;
    }

    const newCode = [...code];
    newCode[index] = numericValue;
    setCode(newCode);

    // Auto-focus next input
    if (numericValue && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when complete
    if (newCode.every(digit => digit) && numericValue) {
      Keyboard.dismiss();
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyPress = (e, index) => {
    if (e.nativeEvent.key === 'Backspace' && !code[index] && index > 0) {
      // Focus previous input on backspace
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (verificationCode) => {
    if (!email) {
      Alert.alert('Error', 'Email is missing. Please go back and try again.');
      return;
    }

    setLoading(true);
    const result = await verifyCode(email, verificationCode);
    setLoading(false);

    if (result.success) {
      // Navigate to reset password screen
      navigation.navigate('ResetPassword', {
        email,
        resetToken: result.resetToken,
      });
    } else {
      Alert.alert('Invalid Code', result.error);
      // Clear code
      setCode(Array(CODE_LENGTH).fill(''));
      inputRefs.current[0]?.focus();
    }
  };

  const handleResend = async () => {
    if (!canResend) return;

    setCanResend(false);
    setResendTimer(RESEND_COOLDOWN);

    const result = await resendCode(email);

    if (result.success) {
      Alert.alert('Code Sent', 'A new verification code has been sent to your email.');
    } else {
      Alert.alert('Error', result.error);
      setCanResend(true);
      setResendTimer(0);
    }
  };

  const handleSubmit = () => {
    const verificationCode = code.join('');
    if (verificationCode.length !== CODE_LENGTH) {
      Alert.alert('Incomplete Code', 'Please enter the complete verification code.');
      return;
    }
    handleVerify(verificationCode);
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        {/* Header */}
        <TouchableOpacity
          onPress={() => navigation.goBack()}
          style={styles.backButton}
        >
          <Text style={styles.backIcon}>←</Text>
        </TouchableOpacity>

        <View style={styles.header}>
          <View style={styles.iconContainer}>
            <Text style={styles.icon}>🔐</Text>
          </View>
          <Text style={styles.title}>Verify Code</Text>
          <Text style={styles.subtitle}>
            Enter the 6-digit code sent to
          </Text>
          <Text style={styles.emailText}>{email}</Text>
        </View>

        {/* Code Input */}
        <View style={styles.codeContainer}>
          {code.map((digit, index) => (
            <TextInput
              key={index}
              ref={ref => inputRefs.current[index] = ref}
              style={[
                styles.codeInput,
                digit && styles.codeInputFilled,
              ]}
              value={digit}
              onChangeText={(v) => handleCodeChange(v, index)}
              onKeyPress={(e) => handleKeyPress(e, index)}
              keyboardType="number-pad"
              maxLength={CODE_LENGTH} // Allow paste
              selectTextOnFocus
            />
          ))}
        </View>

        {/* Verify Button */}
        <AuthButton
          title="Verify Code"
          onPress={handleSubmit}
          loading={loading}
          disabled={loading || code.some(d => !d)}
          style={styles.verifyButton}
        />

        {/* Resend */}
        <View style={styles.resendContainer}>
          <Text style={styles.resendText}>Didn't receive the code? </Text>
          {canResend ? (
            <TouchableOpacity onPress={handleResend}>
              <Text style={styles.resendLink}>Resend</Text>
            </TouchableOpacity>
          ) : (
            <Text style={styles.timerText}>
              Resend in {formatTimer(resendTimer)}
            </Text>
          )}
        </View>

        {/* Back to Login */}
        <TouchableOpacity
          onPress={() => navigation.navigate('Login')}
          style={styles.backToLogin}
        >
          <Text style={styles.backToLoginText}>← Back to Login</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#ffffff',
  },
  content: {
    flex: 1,
    padding: 24,
  },
  backButton: {
    marginBottom: 24,
  },
  backIcon: {
    fontSize: 28,
    color: '#1e293b',
  },
  header: {
    alignItems: 'center',
    marginBottom: 40,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
  },
  emailText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#6366f1',
    marginTop: 4,
  },
  codeContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    gap: 10,
    marginBottom: 32,
  },
  codeInput: {
    width: 48,
    height: 56,
    borderWidth: 2,
    borderColor: '#e2e8f0',
    borderRadius: 12,
    fontSize: 24,
    fontWeight: '700',
    textAlign: 'center',
    color: '#1e293b',
    backgroundColor: '#f8fafc',
  },
  codeInputFilled: {
    borderColor: '#6366f1',
    backgroundColor: '#e0e7ff',
  },
  verifyButton: {
    marginBottom: 24,
  },
  resendContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  resendText: {
    fontSize: 14,
    color: '#64748b',
  },
  resendLink: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '600',
  },
  timerText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  backToLogin: {
    alignItems: 'center',
    marginTop: 'auto',
    paddingVertical: 20,
  },
  backToLoginText: {
    fontSize: 15,
    color: '#6366f1',
    fontWeight: '600',
  },
});

export default VerifyCodeScreen;
