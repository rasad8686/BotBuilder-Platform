import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  TouchableOpacity,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNetworkStatus } from '../hooks/useNetworkStatus';
import { offlineService } from '../services/offlineService';
import { useTheme } from '../hooks/useTheme';

interface OfflineBannerProps {
  showQueueStatus?: boolean;
}

export const OfflineBanner: React.FC<OfflineBannerProps> = ({ showQueueStatus = true }) => {
  const theme = useTheme();
  const { isOffline, networkStatus } = useNetworkStatus();
  const [queueLength, setQueueLength] = useState(0);
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'synced' | 'error'>('idle');
  const [slideAnim] = useState(new Animated.Value(-60));

  useEffect(() => {
    // Animate banner in/out
    Animated.spring(slideAnim, {
      toValue: isOffline || queueLength > 0 ? 0 : -60,
      useNativeDriver: true,
      tension: 100,
      friction: 10,
    }).start();
  }, [isOffline, queueLength, slideAnim]);

  useEffect(() => {
    // Update queue length periodically
    const updateQueueLength = () => {
      setQueueLength(offlineService.getQueueLength());
    };

    updateQueueLength();
    const interval = setInterval(updateQueueLength, 5000);

    // Listen for sync status changes
    const unsubscribe = offlineService.addSyncListener((status) => {
      setSyncStatus(status);
      if (status === 'synced') {
        setQueueLength(0);
        setTimeout(() => setSyncStatus('idle'), 3000);
      }
    });

    return () => {
      clearInterval(interval);
      unsubscribe();
    };
  }, []);

  const handleSync = () => {
    if (!isOffline && queueLength > 0) {
      offlineService.processQueue();
    }
  };

  const getBannerContent = () => {
    if (isOffline) {
      return {
        icon: 'cloud-offline',
        text: 'No internet connection',
        subtext: queueLength > 0 ? `${queueLength} changes pending` : 'Working offline',
        color: '#EF4444',
        bgColor: '#FEE2E2',
      };
    }

    if (syncStatus === 'syncing') {
      return {
        icon: 'sync',
        text: 'Syncing...',
        subtext: `Uploading ${queueLength} changes`,
        color: '#3B82F6',
        bgColor: '#DBEAFE',
      };
    }

    if (syncStatus === 'synced') {
      return {
        icon: 'checkmark-circle',
        text: 'All changes synced',
        subtext: '',
        color: '#10B981',
        bgColor: '#D1FAE5',
      };
    }

    if (syncStatus === 'error' || queueLength > 0) {
      return {
        icon: 'warning',
        text: 'Sync incomplete',
        subtext: `${queueLength} changes pending`,
        color: '#F59E0B',
        bgColor: '#FEF3C7',
      };
    }

    return null;
  };

  const content = getBannerContent();
  if (!content) return null;

  return (
    <Animated.View
      style={[
        styles.container,
        { backgroundColor: content.bgColor, transform: [{ translateY: slideAnim }] },
      ]}
    >
      <View style={styles.content}>
        <Ionicons
          name={content.icon as any}
          size={20}
          color={content.color}
          style={syncStatus === 'syncing' ? styles.spinningIcon : undefined}
        />
        <View style={styles.textContainer}>
          <Text style={[styles.mainText, { color: content.color }]}>{content.text}</Text>
          {content.subtext && (
            <Text style={[styles.subText, { color: content.color }]}>{content.subtext}</Text>
          )}
        </View>
        {!isOffline && queueLength > 0 && syncStatus !== 'syncing' && (
          <TouchableOpacity style={[styles.syncButton, { borderColor: content.color }]} onPress={handleSync}>
            <Text style={[styles.syncButtonText, { color: content.color }]}>Sync Now</Text>
          </TouchableOpacity>
        )}
      </View>
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 1000,
    paddingVertical: 8,
    paddingHorizontal: 16,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  textContainer: {
    flex: 1,
    marginLeft: 10,
  },
  mainText: {
    fontSize: 13,
    fontWeight: '600',
  },
  subText: {
    fontSize: 11,
    marginTop: 1,
    opacity: 0.8,
  },
  syncButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  syncButtonText: {
    fontSize: 12,
    fontWeight: '600',
  },
  spinningIcon: {
    // Animation handled via Animated API if needed
  },
});

export default OfflineBanner;
