/**
 * StatCard Component
 * Displays statistics in a card format
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

const StatCard = ({
  icon,
  label,
  value,
  subValue,
  trend,
  trendValue,
  color = '#6366f1',
  onPress,
  size = 'medium', // small, medium, large
}) => {
  const getTrendColor = () => {
    if (trend === 'up') return '#22c55e';
    if (trend === 'down') return '#ef4444';
    return '#94a3b8';
  };

  const getTrendIcon = () => {
    if (trend === 'up') return '↑';
    if (trend === 'down') return '↓';
    return '→';
  };

  const Container = onPress ? TouchableOpacity : View;

  return (
    <Container
      style={[
        styles.card,
        size === 'small' && styles.cardSmall,
        size === 'large' && styles.cardLarge,
      ]}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {/* Icon */}
      <View style={[styles.iconContainer, { backgroundColor: `${color}15` }]}>
        <Text style={styles.icon}>{icon}</Text>
      </View>

      {/* Content */}
      <View style={styles.content}>
        <Text style={styles.label}>{label}</Text>
        <Text style={[styles.value, size === 'large' && styles.valueLarge]}>
          {value}
        </Text>
        {subValue && (
          <Text style={styles.subValue}>{subValue}</Text>
        )}
      </View>

      {/* Trend */}
      {trend && trendValue && (
        <View style={[styles.trendContainer, { backgroundColor: `${getTrendColor()}15` }]}>
          <Text style={[styles.trendIcon, { color: getTrendColor() }]}>
            {getTrendIcon()}
          </Text>
          <Text style={[styles.trendValue, { color: getTrendColor() }]}>
            {trendValue}
          </Text>
        </View>
      )}
    </Container>
  );
};

// Skeleton loader for StatCard
export const StatCardSkeleton = ({ size = 'medium' }) => (
  <View style={[styles.card, styles.skeleton, size === 'small' && styles.cardSmall]}>
    <View style={[styles.iconContainer, styles.skeletonBg]} />
    <View style={styles.content}>
      <View style={[styles.skeletonText, { width: 60 }]} />
      <View style={[styles.skeletonText, { width: 80, height: 24, marginTop: 8 }]} />
    </View>
  </View>
);

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#ffffff',
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 8,
    elevation: 2,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardSmall: {
    padding: 12,
  },
  cardLarge: {
    padding: 20,
  },
  iconContainer: {
    width: 48,
    height: 48,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 24,
  },
  content: {
    flex: 1,
    marginLeft: 14,
  },
  label: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 2,
  },
  value: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1e293b',
  },
  valueLarge: {
    fontSize: 28,
  },
  subValue: {
    fontSize: 12,
    color: '#94a3b8',
    marginTop: 2,
  },
  trendContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 20,
    gap: 4,
  },
  trendIcon: {
    fontSize: 12,
    fontWeight: '700',
  },
  trendValue: {
    fontSize: 12,
    fontWeight: '600',
  },
  // Skeleton styles
  skeleton: {
    opacity: 0.7,
  },
  skeletonBg: {
    backgroundColor: '#e2e8f0',
  },
  skeletonText: {
    height: 14,
    backgroundColor: '#e2e8f0',
    borderRadius: 4,
  },
});

export default StatCard;
