/**
 * ErrorBoundary Component
 * Catches JavaScript errors and displays fallback UI
 */
import React, { Component } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  SafeAreaView,
  Animated,
  Platform,
} from 'react-native';

/**
 * Error Boundary Class Component
 * Must be a class component to use componentDidCatch
 */
class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
      showDetails: false,
    };
    this.shakeAnim = new Animated.Value(0);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    this.setState({ errorInfo });

    // Log error to console in development
    if (__DEV__) {
      console.error('ErrorBoundary caught an error:', error, errorInfo);
    }

    // Call onError callback if provided
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }

    // Shake animation
    this.triggerShake();
  }

  triggerShake = () => {
    Animated.sequence([
      Animated.timing(this.shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(this.shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(this.shakeAnim, { toValue: 10, duration: 50, useNativeDriver: true }),
      Animated.timing(this.shakeAnim, { toValue: -10, duration: 50, useNativeDriver: true }),
      Animated.timing(this.shakeAnim, { toValue: 0, duration: 50, useNativeDriver: true }),
    ]).start();
  };

  handleRetry = () => {
    this.setState({ hasError: false, error: null, errorInfo: null });
    if (this.props.onRetry) {
      this.props.onRetry();
    }
  };

  toggleDetails = () => {
    this.setState((prev) => ({ showDetails: !prev.showDetails }));
  };

  render() {
    const { hasError, error, errorInfo, showDetails } = this.state;
    const { children, fallback, FallbackComponent } = this.props;

    if (hasError) {
      // Custom fallback component
      if (FallbackComponent) {
        return (
          <FallbackComponent
            error={error}
            errorInfo={errorInfo}
            onRetry={this.handleRetry}
          />
        );
      }

      // Custom fallback element
      if (fallback) {
        return fallback;
      }

      // Default fallback UI
      return (
        <SafeAreaView style={styles.container}>
          <ScrollView
            contentContainerStyle={styles.content}
            showsVerticalScrollIndicator={false}
          >
            {/* Error Icon */}
            <Animated.View
              style={[
                styles.iconContainer,
                { transform: [{ translateX: this.shakeAnim }] },
              ]}
            >
              <Text style={styles.icon}>!</Text>
            </Animated.View>

            {/* Error Title */}
            <Text style={styles.title}>Oops! Something went wrong</Text>
            <Text style={styles.subtitle}>
              We're sorry for the inconvenience. Please try again or contact support if the problem persists.
            </Text>

            {/* Retry Button */}
            <TouchableOpacity
              style={styles.retryButton}
              onPress={this.handleRetry}
              activeOpacity={0.8}
            >
              <Text style={styles.retryButtonText}>Try Again</Text>
            </TouchableOpacity>

            {/* Show Details Toggle (Dev only) */}
            {__DEV__ && (
              <>
                <TouchableOpacity
                  style={styles.detailsToggle}
                  onPress={this.toggleDetails}
                >
                  <Text style={styles.detailsToggleText}>
                    {showDetails ? 'Hide Details' : 'Show Details'}
                  </Text>
                </TouchableOpacity>

                {showDetails && (
                  <View style={styles.detailsContainer}>
                    <Text style={styles.detailsTitle}>Error:</Text>
                    <Text style={styles.detailsText}>
                      {error?.toString()}
                    </Text>

                    {errorInfo?.componentStack && (
                      <>
                        <Text style={styles.detailsTitle}>Component Stack:</Text>
                        <ScrollView
                          horizontal
                          showsHorizontalScrollIndicator={false}
                        >
                          <Text style={styles.stackText}>
                            {errorInfo.componentStack}
                          </Text>
                        </ScrollView>
                      </>
                    )}
                  </View>
                )}
              </>
            )}
          </ScrollView>
        </SafeAreaView>
      );
    }

    return children;
  }
}

/**
 * Error View Component (can be used standalone)
 */
export const ErrorView = ({
  title = 'Something went wrong',
  message = 'An unexpected error occurred',
  onRetry,
  retryText = 'Try Again',
  icon = '!',
  style,
}) => (
  <View style={[styles.errorView, style]}>
    <View style={styles.errorViewIcon}>
      <Text style={styles.errorViewIconText}>{icon}</Text>
    </View>
    <Text style={styles.errorViewTitle}>{title}</Text>
    <Text style={styles.errorViewMessage}>{message}</Text>
    {onRetry && (
      <TouchableOpacity
        style={styles.errorViewButton}
        onPress={onRetry}
        activeOpacity={0.8}
      >
        <Text style={styles.errorViewButtonText}>{retryText}</Text>
      </TouchableOpacity>
    )}
  </View>
);

/**
 * Network Error View
 */
export const NetworkErrorView = ({ onRetry }) => (
  <ErrorView
    title="Connection Error"
    message="Unable to connect to the server. Please check your internet connection."
    onRetry={onRetry}
    icon="!"
  />
);

/**
 * Not Found View
 */
export const NotFoundView = ({ message = 'The requested resource was not found', onBack }) => (
  <ErrorView
    title="Not Found"
    message={message}
    onRetry={onBack}
    retryText="Go Back"
    icon="?"
  />
);

/**
 * Permission Denied View
 */
export const PermissionDeniedView = ({ permission, onRequestPermission }) => (
  <ErrorView
    title="Permission Required"
    message={`This feature requires ${permission} permission to work properly.`}
    onRetry={onRequestPermission}
    retryText="Grant Permission"
    icon="!"
  />
);

/**
 * Maintenance View
 */
export const MaintenanceView = ({ estimatedTime }) => (
  <View style={styles.maintenanceContainer}>
    <Text style={styles.maintenanceIcon}>!</Text>
    <Text style={styles.maintenanceTitle}>Under Maintenance</Text>
    <Text style={styles.maintenanceMessage}>
      We're performing scheduled maintenance to improve our services.
    </Text>
    {estimatedTime && (
      <Text style={styles.maintenanceTime}>
        Estimated completion: {estimatedTime}
      </Text>
    )}
  </View>
);

/**
 * Empty State View
 */
export const EmptyStateView = ({
  title = 'Nothing here yet',
  message = 'Start by adding some content',
  icon = '!',
  actionText,
  onAction,
  style,
}) => (
  <View style={[styles.emptyState, style]}>
    <Text style={styles.emptyStateIcon}>{icon}</Text>
    <Text style={styles.emptyStateTitle}>{title}</Text>
    <Text style={styles.emptyStateMessage}>{message}</Text>
    {actionText && onAction && (
      <TouchableOpacity
        style={styles.emptyStateButton}
        onPress={onAction}
        activeOpacity={0.8}
      >
        <Text style={styles.emptyStateButtonText}>{actionText}</Text>
      </TouchableOpacity>
    )}
  </View>
);

const styles = StyleSheet.create({
  // ErrorBoundary
  container: {
    flex: 1,
    backgroundColor: '#f8fafc',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  icon: {
    fontSize: 40,
    color: '#ef4444',
    fontWeight: '700',
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 12,
  },
  subtitle: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  retryButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 14,
    paddingHorizontal: 32,
    borderRadius: 12,
    shadowColor: '#6366f1',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  retryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  detailsToggle: {
    marginTop: 24,
    padding: 8,
  },
  detailsToggleText: {
    fontSize: 14,
    color: '#6366f1',
    fontWeight: '500',
  },
  detailsContainer: {
    marginTop: 16,
    backgroundColor: '#1e293b',
    borderRadius: 12,
    padding: 16,
    width: '100%',
    maxHeight: 300,
  },
  detailsTitle: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94a3b8',
    marginBottom: 8,
    textTransform: 'uppercase',
  },
  detailsText: {
    fontSize: 12,
    color: '#ef4444',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    marginBottom: 16,
  },
  stackText: {
    fontSize: 10,
    color: '#94a3b8',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
  },

  // ErrorView
  errorView: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#f8fafc',
  },
  errorViewIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: '#fef2f2',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  errorViewIconText: {
    fontSize: 32,
    color: '#ef4444',
    fontWeight: '700',
  },
  errorViewTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  errorViewMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
    paddingHorizontal: 16,
  },
  errorViewButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  errorViewButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },

  // MaintenanceView
  maintenanceContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    backgroundColor: '#fef3c7',
  },
  maintenanceIcon: {
    fontSize: 48,
    marginBottom: 20,
  },
  maintenanceTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#92400e',
    marginBottom: 12,
  },
  maintenanceMessage: {
    fontSize: 16,
    color: '#a16207',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 16,
  },
  maintenanceTime: {
    fontSize: 14,
    color: '#92400e',
    fontWeight: '500',
  },

  // EmptyStateView
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  emptyStateIcon: {
    fontSize: 48,
    marginBottom: 16,
  },
  emptyStateTitle: {
    fontSize: 20,
    fontWeight: '600',
    color: '#1e293b',
    textAlign: 'center',
    marginBottom: 8,
  },
  emptyStateMessage: {
    fontSize: 14,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: 24,
  },
  emptyStateButton: {
    backgroundColor: '#6366f1',
    paddingVertical: 12,
    paddingHorizontal: 24,
    borderRadius: 10,
  },
  emptyStateButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
});

export default ErrorBoundary;
