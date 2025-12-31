import React, { useEffect } from 'react';
import { NavigationContainer, DefaultTheme, DarkTheme } from '@react-navigation/native';

import { AuthNavigator } from './AuthNavigator';
import { MainNavigator } from './MainNavigator';
import { useAuthStore } from '../store';
import { useTheme, useIsDarkMode, useSocket } from '../hooks';
import { LoadingScreen } from '../components/ui';

export function RootNavigator() {
  const theme = useTheme();
  const isDarkMode = useIsDarkMode();
  const { isAuthenticated, isLoading } = useAuthStore();

  // Initialize socket connection
  useSocket();

  const navigationTheme = isDarkMode
    ? {
        ...DarkTheme,
        colors: {
          ...DarkTheme.colors,
          background: theme.background.primary,
          card: theme.card.background,
          text: theme.text.primary,
          border: theme.border.light,
          primary: theme.primary[500],
        },
      }
    : {
        ...DefaultTheme,
        colors: {
          ...DefaultTheme.colors,
          background: theme.background.primary,
          card: theme.card.background,
          text: theme.text.primary,
          border: theme.border.light,
          primary: theme.primary[500],
        },
      };

  if (isLoading) {
    return <LoadingScreen message="Loading..." />;
  }

  return (
    <NavigationContainer theme={navigationTheme}>
      {isAuthenticated ? <MainNavigator /> : <AuthNavigator />}
    </NavigationContainer>
  );
}
