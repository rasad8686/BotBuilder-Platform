/**
 * BotCard Component
 * Displays bot information in a card format
 */
import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import Card from './Card';
import { timeAgo, truncate } from '../utils/helpers';

const BotCard = ({ bot, onPress, onLongPress }) => {
  const getStatusColor = (status) => {
    switch (status) {
      case 'active':
        return '#22c55e';
      case 'inactive':
        return '#94a3b8';
      case 'error':
        return '#ef4444';
      default:
        return '#94a3b8';
    }
  };

  return (
    <Card
      onPress={() => onPress?.(bot)}
      style={styles.card}
    >
      <TouchableOpacity
        onLongPress={() => onLongPress?.(bot)}
        activeOpacity={0.9}
        style={styles.content}
      >
        {/* Bot Icon */}
        <View style={styles.iconContainer}>
          <Text style={styles.icon}>🤖</Text>
        </View>

        {/* Bot Info */}
        <View style={styles.info}>
          <View style={styles.header}>
            <Text style={styles.name} numberOfLines={1}>
              {bot.name}
            </Text>
            <View
              style={[
                styles.statusDot,
                { backgroundColor: getStatusColor(bot.status) },
              ]}
            />
          </View>

          {bot.description && (
            <Text style={styles.description} numberOfLines={2}>
              {truncate(bot.description, 60)}
            </Text>
          )}

          <View style={styles.footer}>
            <View style={styles.stat}>
              <Text style={styles.statIcon}>💬</Text>
              <Text style={styles.statValue}>
                {bot.messageCount || 0}
              </Text>
            </View>
            <View style={styles.stat}>
              <Text style={styles.statIcon}>👥</Text>
              <Text style={styles.statValue}>
                {bot.userCount || 0}
              </Text>
            </View>
            <Text style={styles.updated}>
              {bot.updatedAt ? timeAgo(bot.updatedAt) : 'New'}
            </Text>
          </View>
        </View>

        {/* Arrow */}
        <Text style={styles.arrow}>›</Text>
      </TouchableOpacity>
    </Card>
  );
};

const styles = StyleSheet.create({
  card: {
    marginBottom: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  iconContainer: {
    width: 56,
    height: 56,
    borderRadius: 14,
    backgroundColor: '#eff6ff',
    alignItems: 'center',
    justifyContent: 'center',
  },
  icon: {
    fontSize: 28,
  },
  info: {
    flex: 1,
    marginLeft: 14,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  name: {
    fontSize: 16,
    fontWeight: '600',
    color: '#1e293b',
    flex: 1,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  description: {
    fontSize: 13,
    color: '#64748b',
    marginTop: 4,
    lineHeight: 18,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 10,
    gap: 16,
  },
  stat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statIcon: {
    fontSize: 12,
  },
  statValue: {
    fontSize: 12,
    color: '#64748b',
    fontWeight: '500',
  },
  updated: {
    fontSize: 11,
    color: '#94a3b8',
    marginLeft: 'auto',
  },
  arrow: {
    fontSize: 24,
    color: '#cbd5e1',
    marginLeft: 8,
  },
});

export default BotCard;
