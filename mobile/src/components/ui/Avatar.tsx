import React from 'react';
import { View, Image, Text, StyleSheet, ViewStyle } from 'react-native';
import { useTheme } from '../../hooks';

interface AvatarProps {
  source?: string | null;
  name?: string;
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl';
  style?: ViewStyle;
  statusIndicator?: 'online' | 'offline' | 'busy' | 'away';
}

export function Avatar({
  source,
  name,
  size = 'md',
  style,
  statusIndicator,
}: AvatarProps) {
  const theme = useTheme();

  const getSizeValue = () => {
    switch (size) {
      case 'xs':
        return 24;
      case 'sm':
        return 32;
      case 'lg':
        return 56;
      case 'xl':
        return 80;
      default:
        return 40;
    }
  };

  const getFontSize = () => {
    switch (size) {
      case 'xs':
        return 10;
      case 'sm':
        return 12;
      case 'lg':
        return 20;
      case 'xl':
        return 28;
      default:
        return 16;
    }
  };

  const getStatusSize = () => {
    switch (size) {
      case 'xs':
        return 8;
      case 'sm':
        return 10;
      case 'lg':
        return 16;
      case 'xl':
        return 20;
      default:
        return 12;
    }
  };

  const getStatusColor = () => {
    switch (statusIndicator) {
      case 'online':
        return theme.success.main;
      case 'offline':
        return theme.neutral[400];
      case 'busy':
        return theme.error.main;
      case 'away':
        return theme.warning.main;
      default:
        return 'transparent';
    }
  };

  const getInitials = (name: string) => {
    const parts = name.trim().split(' ');
    if (parts.length >= 2) {
      return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  const sizeValue = getSizeValue();

  return (
    <View style={[styles.container, style]}>
      {source ? (
        <Image
          source={{ uri: source }}
          style={[
            styles.image,
            {
              width: sizeValue,
              height: sizeValue,
              borderRadius: sizeValue / 2,
            },
          ]}
        />
      ) : (
        <View
          style={[
            styles.placeholder,
            {
              width: sizeValue,
              height: sizeValue,
              borderRadius: sizeValue / 2,
              backgroundColor: theme.primary[500],
            },
          ]}
        >
          <Text
            style={[
              styles.initials,
              {
                fontSize: getFontSize(),
                color: theme.white,
              },
            ]}
          >
            {name ? getInitials(name) : '?'}
          </Text>
        </View>
      )}
      {statusIndicator && (
        <View
          style={[
            styles.status,
            {
              width: getStatusSize(),
              height: getStatusSize(),
              borderRadius: getStatusSize() / 2,
              backgroundColor: getStatusColor(),
              borderColor: theme.card.background,
            },
          ]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'relative',
  },
  image: {
    resizeMode: 'cover',
  },
  placeholder: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  initials: {
    fontWeight: '600',
  },
  status: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    borderWidth: 2,
  },
});
