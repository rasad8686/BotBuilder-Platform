/**
 * App Navigator
 * Root navigator that handles auth state
 */
import React, { useRef, useEffect } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { useAuth } from '../contexts/AuthContext';
import AuthNavigator from './AuthNavigator';
import MainNavigator from './MainNavigator';
import { View, ActivityIndicator, StyleSheet } from 'react-native';

const Stack = createNativeStackNavigator();

// Loading Screen
const LoadingScreen = () => (
  <View style={styles.loading}>
    <ActivityIndicator size="large" color="#6366f1" />
  </View>
);

const AppNavigator = ({ onNavigationReady }) => {
  const { isAuthenticated, loading } = useAuth();
  const navigationRef = useRef(null);

  // Pass navigation ref to parent
  useEffect(() => {
    if (navigationRef.current && onNavigationReady) {
      onNavigationReady(navigationRef.current);
    }
  }, [onNavigationReady]);

  if (loading) {
    return <LoadingScreen />;
  }

  return (
    <NavigationContainer
      ref={navigationRef}
      onReady={() => {
        if (onNavigationReady) {
          onNavigationReady(navigationRef.current);
        }
      }}
    >
      <Stack.Navigator screenOptions={{ headerShown: false }}>
        {isAuthenticated ? (
          <Stack.Screen name="Main" component={MainNavigator} />
        ) : (
          <Stack.Screen name="Auth" component={AuthNavigator} />
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
};

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
  },
});

export default AppNavigator;
