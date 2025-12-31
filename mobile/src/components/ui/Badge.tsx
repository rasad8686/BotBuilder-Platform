import React from 'react';
import { View, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks';

interface BadgeProps {
  text?: string;
  count?: number;
  variant?: 'default' | 'primary' | 'success' | 'warning' | 'error' | 'info';
  size?: 'sm' | 'md' | 'lg';
  dot?: boolean;
  style?: ViewStyle;
}

export function Badge({
  text,
  count,
  variant = 'default',
  size = 'md',
  dot = false,
  style,
}: BadgeProps) {
  const theme = useTheme();

  const getBackgroundColor = () => {
    switch (variant) {
      case 'primary':
        return theme.primary[500];
      case 'success':
        return theme.success.main;
      case 'warning':
        return theme.warning.main;
      case 'error':
        return theme.error.main;
      case 'info':
        return theme.info.main;
      default:
        return theme.neutral[500];
    }
  };

  const getSizeStyles = (): ViewStyle => {
    if (dot) {
      switch (size) {
        case 'sm':
          return { width: 6, height: 6 };
        case 'lg':
          return { width: 12, height: 12 };
        default:
          return { width: 8, height: 8 };
      }
    }

    switch (size) {
      case 'sm':
        return { paddingHorizontal: 6, paddingVertical: 2 };
      case 'lg':
        return { paddingHorizontal: 12, paddingVertical: 6 };
      default:
        return { paddingHorizontal: 8, paddingVertical: 4 };
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'sm':
        return 10;
      case 'lg':
        return 14;
      default:
        return 12;
    }
  };

  const displayText = count !== undefined ? (count > 99 ? '99+' : count.toString()) : text;

  if (dot) {
    return (
      <View
        style={[
          styles.dot,
          { backgroundColor: getBackgroundColor() },
          getSizeStyles(),
          style,
        ]}
      />
    );
  }

  return (
    <View
      style={[
        styles.badge,
        { backgroundColor: getBackgroundColor() },
        getSizeStyles(),
        style,
      ]}
    >
      <Text
        style={[
          styles.text,
          { fontSize: getFontSize(), color: theme.white },
        ]}
      >
        {displayText}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    borderRadius: 100,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dot: {
    borderRadius: 100,
  },
  text: {
    fontWeight: '600',
  },
});
