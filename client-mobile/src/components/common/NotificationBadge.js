/**
 * NotificationBadge Component
 * Displays unread notification count badge
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { useNotifications } from '../../contexts/NotificationContext';

/**
 * Simple badge that shows count
 */
export const Badge = ({ count, size = 'medium', color = '#ef4444', style }) => {
  if (!count || count <= 0) return null;

  const displayCount = count > 99 ? '99+' : count.toString();

  const sizes = {
    small: {
      minWidth: 16,
      height: 16,
      fontSize: 10,
      paddingHorizontal: 4,
    },
    medium: {
      minWidth: 20,
      height: 20,
      fontSize: 11,
      paddingHorizontal: 6,
    },
    large: {
      minWidth: 24,
      height: 24,
      fontSize: 12,
      paddingHorizontal: 8,
    },
  };

  const sizeStyle = sizes[size] || sizes.medium;

  return (
    <View
      style={[
        styles.badge,
        {
          backgroundColor: color,
          minWidth: sizeStyle.minWidth,
          height: sizeStyle.height,
          paddingHorizontal: sizeStyle.paddingHorizontal,
        },
        style,
      ]}
    >
      <Text style={[styles.badgeText, { fontSize: sizeStyle.fontSize }]}>
        {displayCount}
      </Text>
    </View>
  );
};

/**
 * Notification badge with icon
 */
export const NotificationBadge = ({
  onPress,
  icon = '🔔',
  size = 'medium',
  showZero = false,
  style,
}) => {
  const { unreadCount } = useNotifications();

  const shouldShowBadge = showZero ? true : unreadCount > 0;

  const iconSizes = {
    small: 18,
    medium: 22,
    large: 26,
  };

  const containerSizes = {
    small: 32,
    medium: 40,
    large: 48,
  };

  return (
    <TouchableOpacity
      style={[
        styles.container,
        {
          width: containerSizes[size],
          height: containerSizes[size],
        },
        style,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <Text style={{ fontSize: iconSizes[size] }}>{icon}</Text>
      {shouldShowBadge && (
        <Badge
          count={unreadCount}
          size={size === 'large' ? 'medium' : 'small'}
          style={styles.badgePosition}
        />
      )}
    </TouchableOpacity>
  );
};

/**
 * Icon with badge overlay
 */
export const IconWithBadge = ({
  icon,
  count,
  onPress,
  size = 24,
  badgeColor = '#ef4444',
  style,
}) => {
  const Wrapper = onPress ? TouchableOpacity : View;

  return (
    <Wrapper style={[styles.iconWrapper, style]} onPress={onPress}>
      <Text style={{ fontSize: size }}>{icon}</Text>
      {count > 0 && (
        <Badge
          count={count}
          size="small"
          color={badgeColor}
          style={styles.iconBadge}
        />
      )}
    </Wrapper>
  );
};

/**
 * Tab bar badge for navigation
 */
export const TabBarBadge = ({ focused, icon, label }) => {
  const { unreadCount } = useNotifications();

  return (
    <View style={styles.tabContainer}>
      <View style={styles.tabIconWrapper}>
        <Text style={[styles.tabIcon, focused && styles.tabIconFocused]}>
          {icon}
        </Text>
        {unreadCount > 0 && (
          <Badge count={unreadCount} size="small" style={styles.tabBadge} />
        )}
      </View>
      <Text style={[styles.tabLabel, focused && styles.tabLabelFocused]}>
        {label}
      </Text>
    </View>
  );
};

/**
 * Dot indicator (no count, just presence)
 */
export const NotificationDot = ({
  visible = true,
  color = '#ef4444',
  size = 10,
  style,
}) => {
  if (!visible) return null;

  return (
    <View
      style={[
        styles.dot,
        {
          backgroundColor: color,
          width: size,
          height: size,
          borderRadius: size / 2,
        },
        style,
      ]}
    />
  );
};

/**
 * Animated pulsing badge
 */
export const PulsingBadge = ({ count, style }) => {
  if (!count || count <= 0) return null;

  return (
    <View style={[styles.pulsingContainer, style]}>
      <View style={styles.pulsingOuter} />
      <Badge count={count} size="medium" style={styles.pulsingInner} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  badge: {
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    color: '#ffffff',
    fontWeight: '700',
  },
  badgePosition: {
    position: 'absolute',
    top: -4,
    right: -4,
  },
  iconWrapper: {
    position: 'relative',
  },
  iconBadge: {
    position: 'absolute',
    top: -8,
    right: -8,
  },
  tabContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabIconWrapper: {
    position: 'relative',
    marginBottom: 4,
  },
  tabIcon: {
    fontSize: 24,
    opacity: 0.5,
  },
  tabIconFocused: {
    opacity: 1,
  },
  tabBadge: {
    position: 'absolute',
    top: -6,
    right: -10,
  },
  tabLabel: {
    fontSize: 11,
    fontWeight: '500',
    color: '#94a3b8',
  },
  tabLabelFocused: {
    color: '#6366f1',
    fontWeight: '600',
  },
  dot: {
    position: 'absolute',
  },
  pulsingContainer: {
    position: 'relative',
    alignItems: 'center',
    justifyContent: 'center',
  },
  pulsingOuter: {
    position: 'absolute',
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(239, 68, 68, 0.3)',
  },
  pulsingInner: {
    zIndex: 1,
  },
});

export default NotificationBadge;
