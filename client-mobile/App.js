/**
 * BotBuilder Mobile App
 * React Native + Expo application
 */
import React, { useEffect, useRef, useCallback } from 'react';
import { StatusBar, LogBox, Platform, View, StyleSheet } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

// Contexts
import { AuthProvider } from './src/contexts/AuthContext';
import { BotProvider } from './src/contexts/BotContext';
import { NotificationProvider } from './src/contexts/NotificationContext';

// Theme
import { ThemeProvider, useTheme } from './src/theme';

// Navigation
import AppNavigator from './src/navigation/AppNavigator';

// Push Notification Service
import pushService from './src/services/pushService';

// Common Components
import ErrorBoundary from './src/components/common/ErrorBoundary';
import { OfflineNotice } from './src/components/common/OfflineNotice';
import { ToastProvider } from './src/components/common/Toast';
import { ConfirmProvider } from './src/components/common/ConfirmModal';

// Error Handler
import { setupGlobalErrorHandler, createErrorBoundaryHandler } from './src/utils/errorHandler';

// Ignore specific warnings
LogBox.ignoreLogs([
  'Non-serializable values were found in the navigation state',
  'Require cycle:',
  'ViewPropTypes will be removed',
  'ColorPropType will be removed',
]);

// Setup global error handler
if (!__DEV__) {
  setupGlobalErrorHandler();
}

// Error boundary handler
const errorBoundaryHandler = createErrorBoundaryHandler({
  context: { source: 'ErrorBoundary' },
});

/**
 * App Content with theme-aware StatusBar
 */
const AppContent = ({ onNavigationReady }) => {
  const { colors, isDark } = useTheme();

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle={isDark ? 'light-content' : 'dark-content'}
        backgroundColor={colors.background.primary}
      />
      <OfflineNotice showWhenOnline />
      <AppNavigator onNavigationReady={onNavigationReady} />
    </View>
  );
};

/**
 * Main App Component
 */
export default function App() {
  const navigationRef = useRef(null);
  const notificationListener = useRef(null);
  const responseListener = useRef(null);

  // Handle notification navigation
  const handleNotificationNavigation = useCallback((data) => {
    if (!navigationRef.current || !data) return;

    const navigation = navigationRef.current;

    switch (data.type) {
      case 'new_message':
        if (data.botId) {
          navigation.navigate('Chat', { botId: data.botId });
        }
        break;

      case 'bot_status':
      case 'training_complete':
        if (data.botId) {
          navigation.navigate('BotDetail', { botId: data.botId });
        }
        break;

      case 'system_alert':
        navigation.navigate('Notifications');
        break;

      default:
        // Navigate to notifications screen for unknown types
        navigation.navigate('Notifications');
    }
  }, []);

  useEffect(() => {
    // Setup Android notification channels
    if (Platform.OS === 'android') {
      pushService.setupAndroidNotificationChannel();
    }

    // Register for push notifications
    pushService.registerForPushNotifications().then((result) => {
      if (result.success) {
        console.log('Push token:', result.token);
      } else {
        console.log('Push registration failed:', result.error);
      }
    });

    // Handle notification received while app is foregrounded
    notificationListener.current = pushService.addNotificationReceivedListener(
      (notification) => {
        console.log('Notification received:', notification.request.content);
        // Notification will be handled by NotificationContext
      }
    );

    // Handle notification tap (user interaction)
    responseListener.current = pushService.addNotificationResponseListener(
      (response) => {
        console.log('Notification tapped:', response.notification.request.content);

        const data = response.notification.request.content.data;
        handleNotificationNavigation(data);
      }
    );

    // Check if app was opened via notification
    pushService.getLastNotificationResponse().then((result) => {
      if (result.response) {
        const data = result.response.notification.request.content.data;
        // Small delay to ensure navigation is ready
        setTimeout(() => {
          handleNotificationNavigation(data);
        }, 500);
      }
    });

    // Cleanup
    return () => {
      if (notificationListener.current) {
        notificationListener.current.remove();
      }
      if (responseListener.current) {
        responseListener.current.remove();
      }
    };
  }, [handleNotificationNavigation]);

  // Set navigation reference
  const setNavigationRef = useCallback((ref) => {
    navigationRef.current = ref;
  }, []);

  return (
    <ErrorBoundary onError={errorBoundaryHandler}>
      <SafeAreaProvider>
        <ThemeProvider>
          <ToastProvider>
            <ConfirmProvider>
              <AuthProvider>
                <BotProvider>
                  <NotificationProvider>
                    <AppContent onNavigationReady={setNavigationRef} />
                  </NotificationProvider>
                </BotProvider>
              </AuthProvider>
            </ConfirmProvider>
          </ToastProvider>
        </ThemeProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
});
