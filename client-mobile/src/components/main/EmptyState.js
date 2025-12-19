/**
 * EmptyState Component
 * Displays when there's no data
 */
import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
} from 'react-native';

const EmptyState = ({
  icon = '📭',
  title = 'Nothing here yet',
  description = 'Start by adding something new',
  actionLabel,
  onAction,
  variant = 'default', // default, compact, card
}) => {
  if (variant === 'compact') {
    return (
      <View style={styles.compactContainer}>
        <Text style={styles.compactIcon}>{icon}</Text>
        <Text style={styles.compactText}>{title}</Text>
      </View>
    );
  }

  if (variant === 'card') {
    return (
      <View style={styles.cardContainer}>
        <View style={styles.cardIconContainer}>
          <Text style={styles.cardIcon}>{icon}</Text>
        </View>
        <Text style={styles.cardTitle}>{title}</Text>
        <Text style={styles.cardDescription}>{description}</Text>
        {actionLabel && onAction && (
          <TouchableOpacity
            style={styles.cardButton}
            onPress={onAction}
            activeOpacity={0.7}
          >
            <Text style={styles.cardButtonText}>{actionLabel}</Text>
          </TouchableOpacity>
        )}
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.iconContainer}>
        <Text style={styles.icon}>{icon}</Text>
      </View>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.description}>{description}</Text>
      {actionLabel && onAction && (
        <TouchableOpacity
          style={styles.button}
          onPress={onAction}
          activeOpacity={0.7}
        >
          <Text style={styles.buttonText}>{actionLabel}</Text>
        </TouchableOpacity>
      )}
    </View>
  );
};

// Preset empty states
export const EmptyBots = ({ onAction }) => (
  <EmptyState
    icon="🤖"
    title="No Bots Yet"
    description="Create your first bot to start building amazing conversations"
    actionLabel="Create Bot"
    onAction={onAction}
  />
);

export const EmptyMessages = () => (
  <EmptyState
    icon="💬"
    title="No Messages"
    description="Start a conversation to see messages here"
    variant="compact"
  />
);

export const EmptySearch = ({ query }) => (
  <EmptyState
    icon="🔍"
    title="No Results Found"
    description={`We couldn't find anything matching "${query}"`}
  />
);

export const EmptyNotifications = () => (
  <EmptyState
    icon="🔔"
    title="All Caught Up!"
    description="You don't have any notifications"
    variant="compact"
  />
);

export const ErrorState = ({ message, onRetry }) => (
  <EmptyState
    icon="⚠️"
    title="Something Went Wrong"
    description={message || "We couldn't load the data"}
    actionLabel="Try Again"
    onAction={onRetry}
  />
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
  },
  iconContainer: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#f1f5f9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 48,
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
    textAlign: 'center',
  },
  description: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  button: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 12,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  // Compact variant
  compactContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
  },
  compactIcon: {
    fontSize: 36,
    marginBottom: 12,
  },
  compactText: {
    fontSize: 15,
    color: '#64748b',
    textAlign: 'center',
  },
  // Card variant
  cardContainer: {
    backgroundColor: '#ffffff',
    borderRadius: 20,
    padding: 32,
    alignItems: 'center',
    margin: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 12,
    elevation: 4,
    borderWidth: 1,
    borderColor: '#f1f5f9',
  },
  cardIconContainer: {
    width: 80,
    height: 80,
    borderRadius: 24,
    backgroundColor: '#e0e7ff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  cardIcon: {
    fontSize: 40,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 20,
  },
  cardButton: {
    backgroundColor: '#6366f1',
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 10,
  },
  cardButtonText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default EmptyState;
