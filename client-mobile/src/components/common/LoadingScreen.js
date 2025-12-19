/**
 * LoadingScreen Component
 * Splash screen and app loading states with animations
 */
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  StatusBar,
} from 'react-native';

const { width, height } = Dimensions.get('window');

/**
 * Main Loading Screen with animated logo
 */
export const LoadingScreen = ({
  message = 'Loading...',
  showMessage = true,
  backgroundColor = '#6366f1',
  logoColor = '#ffffff',
}) => {
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const opacityAnim = useRef(new Animated.Value(0)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const dotAnim1 = useRef(new Animated.Value(0)).current;
  const dotAnim2 = useRef(new Animated.Value(0)).current;
  const dotAnim3 = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    // Logo entrance animation
    Animated.parallel([
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 4,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.timing(opacityAnim, {
        toValue: 1,
        duration: 500,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.inOut(Easing.ease),
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Loading dots animation
    const animateDot = (dot, delay) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.timing(dot, {
            toValue: 1,
            duration: 300,
            useNativeDriver: true,
          }),
          Animated.timing(dot, {
            toValue: 0,
            duration: 300,
            useNativeDriver: true,
          }),
        ])
      ).start();
    };

    animateDot(dotAnim1, 0);
    animateDot(dotAnim2, 200);
    animateDot(dotAnim3, 400);
  }, []);

  return (
    <View style={[styles.container, { backgroundColor }]}>
      <StatusBar barStyle="light-content" backgroundColor={backgroundColor} />

      {/* Animated Logo */}
      <Animated.View
        style={[
          styles.logoContainer,
          {
            opacity: opacityAnim,
            transform: [
              { scale: scaleAnim },
              { scale: pulseAnim },
            ],
          },
        ]}
      >
        <View style={[styles.logoOuter, { borderColor: logoColor }]}>
          <View style={[styles.logoInner, { backgroundColor: logoColor }]}>
            <Text style={[styles.logoText, { color: backgroundColor }]}>B</Text>
          </View>
        </View>
      </Animated.View>

      {/* App Name */}
      <Animated.Text
        style={[
          styles.appName,
          { color: logoColor, opacity: opacityAnim },
        ]}
      >
        BotBuilder
      </Animated.Text>

      {/* Loading Message with Dots */}
      {showMessage && (
        <View style={styles.loadingContainer}>
          <Animated.Text
            style={[styles.loadingText, { color: logoColor, opacity: opacityAnim }]}
          >
            {message}
          </Animated.Text>
          <View style={styles.dotsContainer}>
            <Animated.View
              style={[
                styles.dot,
                { backgroundColor: logoColor, opacity: dotAnim1 },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                { backgroundColor: logoColor, opacity: dotAnim2 },
              ]}
            />
            <Animated.View
              style={[
                styles.dot,
                { backgroundColor: logoColor, opacity: dotAnim3 },
              ]}
            />
          </View>
        </View>
      )}
    </View>
  );
};

/**
 * Compact loading spinner for inline use
 */
export const LoadingSpinner = ({
  size = 'medium',
  color = '#6366f1',
  style,
}) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(spinAnim, {
        toValue: 1,
        duration: 1000,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const sizeMap = {
    small: 20,
    medium: 32,
    large: 48,
  };

  const spinnerSize = sizeMap[size] || sizeMap.medium;

  return (
    <Animated.View
      style={[
        styles.spinner,
        {
          width: spinnerSize,
          height: spinnerSize,
          borderColor: color,
          borderTopColor: 'transparent',
          transform: [{ rotate: spin }],
        },
        style,
      ]}
    />
  );
};

/**
 * Full screen loading overlay
 */
export const LoadingOverlay = ({
  visible,
  message = 'Please wait...',
  transparent = true,
}) => {
  const opacityAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacityAnim, {
      toValue: visible ? 1 : 0,
      duration: 200,
      useNativeDriver: true,
    }).start();
  }, [visible]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        styles.overlay,
        transparent && styles.overlayTransparent,
        { opacity: opacityAnim },
      ]}
    >
      <View style={styles.overlayContent}>
        <LoadingSpinner size="large" color="#6366f1" />
        <Text style={styles.overlayText}>{message}</Text>
      </View>
    </Animated.View>
  );
};

/**
 * Skeleton loader for content placeholders
 */
export const SkeletonLoader = ({
  width: w = '100%',
  height: h = 20,
  borderRadius = 4,
  style,
}) => {
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.loop(
      Animated.timing(shimmerAnim, {
        toValue: 1,
        duration: 1500,
        easing: Easing.linear,
        useNativeDriver: true,
      })
    ).start();
  }, []);

  const translateX = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-200, 200],
  });

  return (
    <View
      style={[
        styles.skeleton,
        { width: w, height: h, borderRadius },
        style,
      ]}
    >
      <Animated.View
        style={[
          styles.shimmer,
          { transform: [{ translateX }] },
        ]}
      />
    </View>
  );
};

/**
 * Skeleton card for list items
 */
export const SkeletonCard = ({ style }) => (
  <View style={[styles.skeletonCard, style]}>
    <View style={styles.skeletonCardHeader}>
      <SkeletonLoader width={48} height={48} borderRadius={24} />
      <View style={styles.skeletonCardHeaderText}>
        <SkeletonLoader width="60%" height={16} />
        <SkeletonLoader width="40%" height={12} style={{ marginTop: 8 }} />
      </View>
    </View>
    <SkeletonLoader width="100%" height={12} style={{ marginTop: 16 }} />
    <SkeletonLoader width="80%" height={12} style={{ marginTop: 8 }} />
  </View>
);

/**
 * Skeleton list for multiple items
 */
export const SkeletonList = ({ count = 3, style }) => (
  <View style={style}>
    {Array.from({ length: count }).map((_, index) => (
      <SkeletonCard key={index} style={{ marginBottom: 12 }} />
    ))}
  </View>
);

/**
 * Pull to refresh loading indicator
 */
export const RefreshIndicator = ({ refreshing, color = '#6366f1' }) => {
  const spinAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (refreshing) {
      Animated.loop(
        Animated.timing(spinAnim, {
          toValue: 1,
          duration: 1000,
          easing: Easing.linear,
          useNativeDriver: true,
        })
      ).start();
    } else {
      spinAnim.setValue(0);
    }
  }, [refreshing]);

  const spin = spinAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  if (!refreshing) return null;

  return (
    <View style={styles.refreshContainer}>
      <Animated.View
        style={[
          styles.refreshIcon,
          { borderColor: color, transform: [{ rotate: spin }] },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  // LoadingScreen
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoOuter: {
    width: 120,
    height: 120,
    borderRadius: 30,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoInner: {
    width: 90,
    height: 90,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 48,
    fontWeight: '800',
  },
  appName: {
    fontSize: 28,
    fontWeight: '700',
    marginTop: 24,
    letterSpacing: 1,
  },
  loadingContainer: {
    position: 'absolute',
    bottom: 100,
    alignItems: 'center',
  },
  loadingText: {
    fontSize: 14,
    fontWeight: '500',
  },
  dotsContainer: {
    flexDirection: 'row',
    marginTop: 12,
    gap: 6,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },

  // LoadingSpinner
  spinner: {
    borderWidth: 3,
    borderRadius: 100,
  },

  // LoadingOverlay
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#ffffff',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 1000,
  },
  overlayTransparent: {
    backgroundColor: 'rgba(255, 255, 255, 0.9)',
  },
  overlayContent: {
    alignItems: 'center',
  },
  overlayText: {
    marginTop: 16,
    fontSize: 16,
    fontWeight: '500',
    color: '#64748b',
  },

  // SkeletonLoader
  skeleton: {
    backgroundColor: '#e2e8f0',
    overflow: 'hidden',
  },
  shimmer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(255, 255, 255, 0.4)',
    width: 100,
  },
  skeletonCard: {
    backgroundColor: '#ffffff',
    borderRadius: 12,
    padding: 16,
    borderWidth: 1,
    borderColor: '#e2e8f0',
  },
  skeletonCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  skeletonCardHeaderText: {
    flex: 1,
    marginLeft: 12,
  },

  // RefreshIndicator
  refreshContainer: {
    alignItems: 'center',
    paddingVertical: 16,
  },
  refreshIcon: {
    width: 24,
    height: 24,
    borderWidth: 2,
    borderRadius: 12,
    borderTopColor: 'transparent',
  },
});

export default LoadingScreen;
