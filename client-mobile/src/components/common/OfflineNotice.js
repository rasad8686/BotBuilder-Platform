/**
 * OfflineNotice Component
 * Shows banner when device is offline
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
  Platform,
} from 'react-native';
import NetInfo from '@react-native-community/netinfo';

/**
 * Main Offline Notice Banner
 */
export const OfflineNotice = ({
  showWhenOnline = false,
  onRetry,
  style,
}) => {
  const [isConnected, setIsConnected] = useState(true);
  const [connectionType, setConnectionType] = useState(null);
  const [showOnlineMessage, setShowOnlineMessage] = useState(false);
  const slideAnim = useRef(new Animated.Value(-100)).current;
  const onlineSlideAnim = useRef(new Animated.Value(-100)).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const wasConnected = isConnected;
      const nowConnected = state.isConnected && state.isInternetReachable !== false;

      setIsConnected(nowConnected);
      setConnectionType(state.type);

      // Show online message when reconnected
      if (!wasConnected && nowConnected && showWhenOnline) {
        setShowOnlineMessage(true);
        Animated.timing(onlineSlideAnim, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start();

        // Hide after 3 seconds
        setTimeout(() => {
          Animated.timing(onlineSlideAnim, {
            toValue: -100,
            duration: 300,
            useNativeDriver: true,
          }).start(() => setShowOnlineMessage(false));
        }, 3000);
      }
    });

    return () => unsubscribe();
  }, [isConnected, showWhenOnline]);

  // Animate offline banner
  useEffect(() => {
    Animated.timing(slideAnim, {
      toValue: isConnected ? -100 : 0,
      duration: 300,
      useNativeDriver: true,
    }).start();
  }, [isConnected]);

  return (
    <>
      {/* Offline Banner */}
      <Animated.View
        style={[
          styles.container,
          { transform: [{ translateY: slideAnim }] },
          style,
        ]}
      >
        <View style={styles.content}>
          <Text style={styles.icon}>!</Text>
          <View style={styles.textContainer}>
            <Text style={styles.title}>No Internet Connection</Text>
            <Text style={styles.subtitle}>
              Please check your network settings
            </Text>
          </View>
          {onRetry && (
            <TouchableOpacity
              style={styles.retryButton}
              onPress={onRetry}
              activeOpacity={0.7}
            >
              <Text style={styles.retryText}>Retry</Text>
            </TouchableOpacity>
          )}
        </View>
      </Animated.View>

      {/* Online Banner */}
      {showOnlineMessage && (
        <Animated.View
          style={[
            styles.onlineContainer,
            { transform: [{ translateY: onlineSlideAnim }] },
          ]}
        >
          <Text style={styles.onlineIcon}>OK</Text>
          <Text style={styles.onlineText}>Back Online</Text>
        </Animated.View>
      )}
    </>
  );
};

/**
 * Compact offline indicator
 */
export const OfflineIndicator = ({ style }) => {
  const [isConnected, setIsConnected] = useState(true);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected && state.isInternetReachable !== false);
    });

    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (!isConnected) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 0.5,
            duration: 500,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1,
            duration: 500,
            useNativeDriver: true,
          }),
        ])
      ).start();
    } else {
      pulseAnim.setValue(1);
    }
  }, [isConnected]);

  if (isConnected) return null;

  return (
    <Animated.View
      style={[
        styles.indicator,
        { opacity: pulseAnim },
        style,
      ]}
    >
      <View style={styles.indicatorDot} />
      <Text style={styles.indicatorText}>Offline</Text>
    </Animated.View>
  );
};

/**
 * Network status hook for components
 */
export const useNetworkStatus = () => {
  const [networkState, setNetworkState] = useState({
    isConnected: true,
    isInternetReachable: true,
    type: 'unknown',
    details: null,
  });

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setNetworkState({
        isConnected: state.isConnected,
        isInternetReachable: state.isInternetReachable,
        type: state.type,
        details: state.details,
      });
    });

    return () => unsubscribe();
  }, []);

  return networkState;
};

/**
 * Full screen offline view
 */
export const OfflineScreen = ({ onRetry }) => {
  const waveAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(waveAnim, {
        toValue: 1,
        duration: 2000,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const wave1 = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [1, 1.5],
  });

  const wave2 = waveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [1, 1.3, 1],
  });

  const opacity1 = waveAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.5, 0],
  });

  const opacity2 = waveAnim.interpolate({
    inputRange: [0, 0.5, 1],
    outputRange: [0.3, 0.5, 0.3],
  });

  return (
    <View style={styles.offlineScreen}>
      <View style={styles.offlineIconContainer}>
        <Animated.View
          style={[
            styles.wave,
            {
              transform: [{ scale: wave1 }],
              opacity: opacity1,
            },
          ]}
        />
        <Animated.View
          style={[
            styles.wave,
            styles.wave2,
            {
              transform: [{ scale: wave2 }],
              opacity: opacity2,
            },
          ]}
        />
        <View style={styles.offlineIconInner}>
          <Text style={styles.offlineIcon}>!</Text>
        </View>
      </View>

      <Text style={styles.offlineTitle}>You're Offline</Text>
      <Text style={styles.offlineMessage}>
        It looks like you've lost your internet connection.
        Please check your settings and try again.
      </Text>

      {onRetry && (
        <TouchableOpacity
          style={styles.offlineButton}
          onPress={onRetry}
          activeOpacity={0.8}
        >
          <Text style={styles.offlineButtonText}>Try Again</Text>
        </TouchableOpacity>
      )}

      <View style={styles.offlineTips}>
        <Text style={styles.offlineTipsTitle}>Troubleshooting tips:</Text>
        <Text style={styles.offlineTip}>
          - Check if Wi-Fi or mobile data is enabled
        </Text>
        <Text style={styles.offlineTip}>
          - Try toggling airplane mode on and off
        </Text>
        <Text style={styles.offlineTip}>
          - Move closer to your router
        </Text>
        <Text style={styles.offlineTip}>
          - Restart your device
        </Text>
      </View>
    </View>
  );
};

/**
 * Network Quality Indicator
 */
export const NetworkQualityIndicator = ({ style }) => {
  const [quality, setQuality] = useState('good');

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (!state.isConnected) {
        setQuality('offline');
      } else if (state.type === 'wifi') {
        setQuality('good');
      } else if (state.type === 'cellular') {
        const details = state.details;
        if (details?.cellularGeneration === '4g' || details?.cellularGeneration === '5g') {
          setQuality('good');
        } else if (details?.cellularGeneration === '3g') {
          setQuality('moderate');
        } else {
          setQuality('poor');
        }
      } else {
        setQuality('moderate');
      }
    });

    return () => unsubscribe();
  }, []);

  const getColor = () => {
    switch (quality) {
      case 'good':
        return '#22c55e';
      case 'moderate':
        return '#f59e0b';
      case 'poor':
        return '#ef4444';
      case 'offline':
        return '#94a3b8';
      default:
        return '#94a3b8';
    }
  };

  const bars = [1, 2, 3, 4];
  const activeBars = {
    good: 4,
    moderate: 3,
    poor: 2,
    offline: 0,
  };

  return (
    <View style={[styles.qualityContainer, style]}>
      {bars.map((bar) => (
        <View
          key={bar}
          style={[
            styles.qualityBar,
            { height: bar * 4 + 4 },
            bar <= activeBars[quality]
              ? { backgroundColor: getColor() }
              : { backgroundColor: '#e2e8f0' },
          ]}
        />
      ))}
    </View>
  );
};

const styles = StyleSheet.create({
  // OfflineNotice
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#ef4444',
    paddingTop: Platform.OS === 'ios' ? 50 : 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    zIndex: 1000,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 5,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  icon: {
    fontSize: 20,
    marginRight: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },
  subtitle: {
    fontSize: 12,
    color: 'rgba(255, 255, 255, 0.8)',
    marginTop: 2,
  },
  retryButton: {
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 6,
  },
  retryText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#ffffff',
  },

  // Online Banner
  onlineContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: '#22c55e',
    paddingTop: Platform.OS === 'ios' ? 50 : 10,
    paddingBottom: 12,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  onlineIcon: {
    fontSize: 16,
    marginRight: 8,
    fontWeight: '700',
    color: '#ffffff',
  },
  onlineText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#ffffff',
  },

  // OfflineIndicator
  indicator: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#fef2f2',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
  },
  indicatorDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#ef4444',
    marginRight: 6,
  },
  indicatorText: {
    fontSize: 12,
    fontWeight: '500',
    color: '#ef4444',
  },

  // OfflineScreen
  offlineScreen: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#f8fafc',
    padding: 24,
  },
  offlineIconContainer: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 24,
  },
  wave: {
    position: 'absolute',
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: '#e0e7ff',
  },
  wave2: {
    width: 80,
    height: 80,
    borderRadius: 40,
  },
  offlineIconInner: {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: '#6366f1',
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineIcon: {
    fontSize: 40,
    color: '#ffffff',
    fontWeight: '700',
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1e293b',
    marginBottom: 12,
  },
  offlineMessage: {
    fontSize: 16,
    color: '#64748b',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 32,
    paddingHorizontal: 16,
  },
  offlineButton: {
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
  offlineButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#ffffff',
  },
  offlineTips: {
    marginTop: 40,
    padding: 16,
    backgroundColor: '#f1f5f9',
    borderRadius: 12,
    width: '100%',
  },
  offlineTipsTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#475569',
    marginBottom: 12,
  },
  offlineTip: {
    fontSize: 13,
    color: '#64748b',
    marginBottom: 6,
    paddingLeft: 8,
  },

  // NetworkQualityIndicator
  qualityContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
  },
  qualityBar: {
    width: 4,
    borderRadius: 2,
  },
});

export default OfflineNotice;
